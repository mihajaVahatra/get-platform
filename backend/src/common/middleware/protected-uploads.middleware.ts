import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Router, Request, Response } from 'express';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { StorageService } from '../services/storage.service';

/**
 * Extrait le JWT d'accès depuis la requête : d'abord l'en-tête `Authorization: Bearer`,
 * puis en repli le cookie `access_token` (cas du navigateur affichant un fichier via <img>/<a>
 * sans pouvoir positionner d'en-tête personnalisé).
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }
  const cookieHeader = req.headers.cookie;
  const cookie = cookieHeader
    ?.split('; ')
    .find((c) => c.startsWith('access_token='));
  return cookie ? cookie.split('=')[1] : null;
}

/**
 * Sert les fichiers sensibles (documents étudiants, supports de cours,
 * pièces jointes de messages) qui ne doivent jamais être exposés en statique
 * public : ils exigent un JWT valide et un contrôle de propriété/rôle.
 * Les images publiques (avatars, logos, bannières) sont uploadées en
 * accès public sur le bucket S3 et ne transitent jamais par ce routeur.
 *
 * Le fichier lui-même vit sur le stockage S3-compatible (voir
 * StorageService) : une fois l'autorisation vérifiée, ce routeur ne
 * streame plus rien lui-même, il redirige (302) vers une URL présignée à
 * courte durée de vie.
 */
export function createProtectedUploadsRouter(app: INestApplication): Router {
  const router = Router();
  const jwt = app.get(JwtService);
  const config = app.get(ConfigService);
  const prisma = app.get(PrismaService);
  const storage = app.get(StorageService);

  /**
   * Vérifie le JWT de la requête, recharge l'utilisateur en base (avec ses relations
   * rôle/étudiant/enseignant/admin d'école) et s'assure que sa session n'a pas été
   * révoquée. Écrit directement une réponse 401 et retourne `null` en cas d'échec ;
   * retourne l'utilisateur enrichi (rôle normalisé) en cas de succès.
   */
  async function requireUser(req: Request, res: Response) {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ message: 'Authentification requise' });
      return null;
    }
    try {
      const payload = jwt.verify(token, {
        secret: config.get('JWT_SECRET'),
      });
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        // select explicite : ne jamais charger `password`/`mfaSecret` ici,
        // même chiffrés/hashés, ce routeur n'en a aucun besoin.
        select: {
          id: true,
          isActive: true,
          sessionVersion: true,
          role: { select: { name: true } },
          student: { select: { id: true } },
          teacher: { select: { id: true } },
          schoolAdmin: { select: { schoolId: true } },
        },
      });
      if (!user || !user.isActive) {
        res.status(401).json({ message: 'Utilisateur invalide' });
        return null;
      }
      // Même révocation de session que JwtStrategy.validate() — ce routeur
      // vérifie le JWT indépendamment (en dehors du pipeline Passport) et
      // doit donc répéter le contrôle.
      if (payload.sessionVersion !== user.sessionVersion) {
        res.status(401).json({ message: 'Session révoquée' });
        return null;
      }
      return { ...user, role: user.role?.name || 'STUDENT' };
    } catch {
      res.status(401).json({ message: 'Jeton invalide ou expiré' });
      return null;
    }
  }

  /**
   * Génère une URL S3 présignée à courte durée de vie pour les segments de chemin donnés
   * et redirige le client vers celle-ci (302), ou répond 404 si le fichier n'existe pas.
   */
  async function redirectToFile(res: Response, segments: string[]) {
    const url = await storage.createPresignedDownloadUrl(...segments);
    if (!url) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }
    res.redirect(302, url);
  }

  // Documents d'un étudiant : accessibles à son propriétaire, à ADMIN_GET, et au
  // SCHOOL_ADMIN de l'école où l'étudiant a candidaté. Interdit à MINISTRY.
  router.get('/documents/:studentId/:fileName', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (user.role === 'MINISTRY') {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }

    const { studentId, fileName } = req.params;
    const isOwner = user.student?.id === studentId;
    // Un ADMIN_GET (plateforme) peut tout consulter ; un SCHOOL_ADMIN ne
    // peut consulter les documents d'un candidat que si celui-ci a
    // effectivement postulé dans SON école — sans cette vérification,
    // n'importe quel SCHOOL_ADMIN pouvait télécharger les documents de
    // n'importe quel candidat d'une autre école (faille IDOR corrigée).
    let isAuthorizedReviewer = false;
    if (user.role === 'ADMIN_GET') {
      isAuthorizedReviewer = true;
    } else if (user.role === 'SCHOOL_ADMIN' && user.schoolAdmin) {
      const hasApplicationAtThisSchool = await prisma.application.findFirst({
        where: {
          studentId,
          offer: { schoolId: user.schoolAdmin.schoolId },
        },
        select: { id: true },
      });
      isAuthorizedReviewer = !!hasApplicationAtThisSchool;
    }
    if (!isOwner && !isAuthorizedReviewer) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    await redirectToFile(res, ['documents', studentId, fileName]);
  });

  // Supports de cours : accessibles à l'enseignant du cours, aux étudiants inscrits,
  // à ADMIN_GET, et au SCHOOL_ADMIN de l'école propriétaire du cours. Interdit à MINISTRY.
  router.get('/course-materials/:courseId/:fileName', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    // Ministry est limité aux statistiques institutionnelles agrégées : ce
    // rôle ne peut pas télécharger de supports, même si l'URL est connue.
    if (user.role === 'MINISTRY') {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    const { courseId, fileName } = req.params;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true, schoolId: true },
    });
    const isTeacher = course && user.teacher?.id === course.teacherId;
    const isEnrolledStudent =
      user.student &&
      (await prisma.courseEnrollment.findUnique({
        where: {
          courseId_studentId: { courseId, studentId: user.student.id },
        },
        select: { id: true },
      }));
    // Même règle que /documents : un ADMIN_GET (plateforme) peut tout
    // consulter, mais un SCHOOL_ADMIN ne peut consulter que les supports
    // des cours de SA propre école — sans ce contrôle, n'importe quel
    // SCHOOL_ADMIN pouvait télécharger les supports d'une autre école
    // (faille IDOR).
    const isAuthorizedReviewer =
      user.role === 'ADMIN_GET' ||
      (user.role === 'SCHOOL_ADMIN' &&
        !!user.schoolAdmin &&
        course?.schoolId === user.schoolAdmin.schoolId);
    if (!isTeacher && !isEnrolledStudent && !isAuthorizedReviewer) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    await redirectToFile(res, ['course-materials', courseId, fileName]);
  });

  // Pièces jointes de messagerie privée : réservées aux participants de la conversation
  // (expéditeur/destinataire) et à ADMIN_GET. Interdit à MINISTRY.
  router.get('/messages/:messageId/:fileName', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (user.role === 'MINISTRY') {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }

    const { messageId, fileName } = req.params;
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, recipientId: true },
    });
    const isParticipant =
      message &&
      (message.senderId === user.id || message.recipientId === user.id);
    // Une messagerie privée n'a pas de notion d'« école propriétaire » : un
    // SCHOOL_ADMIN n'a donc aucune raison de voir les pièces jointes d'une
    // conversation à laquelle il ne participe pas (contrairement à
    // /documents ou /course-materials, où l'appartenance à une école
    // justifie un accès de relecture). Seul ADMIN_GET (supervision
    // plateforme) conserve un accès de secours hors participation.
    if (!isParticipant && user.role !== 'ADMIN_GET') {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    await redirectToFile(res, ['messages', messageId, fileName]);
  });

  return router;
}
