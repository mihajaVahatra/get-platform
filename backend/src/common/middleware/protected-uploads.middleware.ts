import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Router, Request, Response } from 'express';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { StorageService } from '../services/storage.service';

const REVIEWER_ROLES = new Set(['ADMIN_GET', 'SCHOOL_ADMIN']);

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
        include: { student: true, teacher: true, role: true, schoolAdmin: true },
      });
      if (!user || !user.isActive) {
        res.status(401).json({ message: 'Utilisateur invalide' });
        return null;
      }
      return { ...user, role: user.role?.name || 'STUDENT' };
    } catch {
      res.status(401).json({ message: 'Jeton invalide ou expiré' });
      return null;
    }
  }

  async function redirectToFile(res: Response, segments: string[]) {
    const url = await storage.createPresignedDownloadUrl(...segments);
    if (!url) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }
    res.redirect(302, url);
  }

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
      select: { teacherId: true },
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
    if (!isTeacher && !isEnrolledStudent && !REVIEWER_ROLES.has(user.role)) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    await redirectToFile(res, ['course-materials', courseId, fileName]);
  });

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
    if (!isParticipant && !REVIEWER_ROLES.has(user.role)) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    await redirectToFile(res, ['messages', messageId, fileName]);
  });

  return router;
}
