import express from 'express';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { StorageService } from '../services/storage.service';
import { createProtectedUploadsRouter } from './protected-uploads.middleware';

describe('protected-uploads.middleware — GET /documents/:studentId/:fileName', () => {
  let jwt: { verify: jest.Mock };
  let config: { get: jest.Mock };
  let prisma: {
    user: { findUnique: jest.Mock };
    application: { findFirst: jest.Mock };
    document: { findFirst: jest.Mock };
  };
  let storage: { createPresignedDownloadUrl: jest.Mock };

  const activeStudentUser = {
    id: 'user-1',
    isActive: true,
    sessionVersion: 1,
    role: { name: 'STUDENT' },
    student: { id: 'student-1' },
    teacher: null,
    schoolAdmin: null,
  };

  function buildApp() {
    const fakeNestApp = {
      get: (token: unknown) => {
        if (token === JwtService) return jwt;
        if (token === ConfigService) return config;
        if (token === PrismaService) return prisma;
        if (token === StorageService) return storage;
        throw new Error(`Unexpected token requested: ${String(token)}`);
      },
    };
    const router = createProtectedUploadsRouter(
      fakeNestApp as unknown as INestApplication,
    );
    const app = express();
    app.use('/uploads', router);
    return app;
  }

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    config = { get: jest.fn() };
    prisma = {
      user: { findUnique: jest.fn() },
      application: { findFirst: jest.fn() },
      document: { findFirst: jest.fn() },
    };
    storage = { createPresignedDownloadUrl: jest.fn() };
  });

  it('refuse sans jeton', async () => {
    const res = await request(buildApp()).get(
      '/uploads/documents/student-1/file.pdf',
    );
    expect(res.status).toBe(401);
  });

  it('génère une URL présignée pour un document actif appartenant à l’appelant', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', sessionVersion: 1 });
    prisma.user.findUnique.mockResolvedValue(activeStudentUser);
    prisma.document.findFirst.mockResolvedValue({ id: 'document-1' });
    storage.createPresignedDownloadUrl.mockResolvedValue(
      'https://s3.example.test/signed-url',
    );

    const res = await request(buildApp())
      .get('/uploads/documents/student-1/file.pdf')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://s3.example.test/signed-url');
    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() est typé `any` par @types/jest
        where: expect.objectContaining({
          studentId: 'student-1',
          deletedAt: null,
        }),
      }),
    );
  });

  it('renvoie 404 pour un document supprimé, même si l’appelant est le propriétaire authentifié', async () => {
    jwt.verify.mockReturnValue({ sub: 'user-1', sessionVersion: 1 });
    prisma.user.findUnique.mockResolvedValue(activeStudentUser);
    // Aucun document actif ne correspond : soit supprimé (deletedAt
    // renseigné), soit jamais existé.
    prisma.document.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .get('/uploads/documents/student-1/file.pdf')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(404);
    expect(storage.createPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('refuse 403 à un SCHOOL_ADMIN d’une autre école, même pour un document actif', async () => {
    jwt.verify.mockReturnValue({ sub: 'admin-1', sessionVersion: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      isActive: true,
      sessionVersion: 1,
      role: { name: 'SCHOOL_ADMIN' },
      student: null,
      teacher: null,
      schoolAdmin: { schoolId: 'other-school' },
    });
    // Le candidat n'a postulé dans aucune offre de l'école de cet admin.
    prisma.application.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .get('/uploads/documents/student-1/file.pdf')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(403);
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(storage.createPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('refuse toujours 403 à MINISTRY, même pour un document actif', async () => {
    jwt.verify.mockReturnValue({ sub: 'ministry-1', sessionVersion: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'ministry-1',
      isActive: true,
      sessionVersion: 1,
      role: { name: 'MINISTRY' },
      student: null,
      teacher: null,
      schoolAdmin: null,
    });

    const res = await request(buildApp())
      .get('/uploads/documents/student-1/file.pdf')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(403);
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
  });
});
