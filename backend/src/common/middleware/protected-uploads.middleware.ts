import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../modules/prisma/prisma.service';

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
 * Les images publiques (avatars, logos, bannières) continuent d'être
 * servies par `useStaticAssets`, monté après ce routeur.
 */
export function createProtectedUploadsRouter(app: INestApplication): Router {
  const router = Router();
  const jwt = app.get(JwtService);
  const config = app.get(ConfigService);
  const prisma = app.get(PrismaService);
  const uploadDir = path.resolve(config.get('UPLOAD_DIR') || './uploads');

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
        include: { student: true, role: true },
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

  function sendUploadFile(res: Response, relativeSegments: string[]) {
    const resolved = path.resolve(uploadDir, ...relativeSegments);
    const relative = path.relative(uploadDir, resolved);
    if (
      relative.startsWith(`..${path.sep}`) ||
      relative === '..' ||
      path.isAbsolute(relative) ||
      !fs.existsSync(resolved)
    ) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }
    res.sendFile(resolved);
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
    if (!isOwner && !REVIEWER_ROLES.has(user.role)) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    sendUploadFile(res, ['documents', studentId, fileName]);
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
    // Authentification requise ; le contrôle d'inscription fin par cours
    // reste à affiner (cf. audit sécurité).
    const { courseId, fileName } = req.params;
    sendUploadFile(res, ['course-materials', courseId, fileName]);
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
    sendUploadFile(res, ['messages', messageId, fileName]);
  });

  return router;
}
