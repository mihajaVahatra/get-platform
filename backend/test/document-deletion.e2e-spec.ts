/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- réponses Supertest (.body) non typées par nature (any) ; ce fichier e2e lit des payloads JSON dynamiques dans des assertions, pas du code de production. */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap';
import {
  cleanupE2eData,
  createStudent,
  disconnectFixtures,
  e2eEmail,
  newRunId,
} from './utils/fixtures';

/**
 * Vérifie l'AC de US-04 : un document supprimé ne doit plus être accessible
 * par aucun ancien lien, ni via une nouvelle URL présignée (contrôle
 * `Document.deletedAt` côté route protégée) ni via l'objet S3 sous-jacent
 * (retiré du bucket) — voir protected-uploads.middleware.ts et
 * StudentService.deleteDocument.
 */
describe('Suppression de document (e2e)', () => {
  let app: NestExpressApplication;
  const runId = newRunId();
  const password = 'SecurePass123!';

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await cleanupE2eData(runId);
    await disconnectFixtures();
    await app.close();
  });

  it('un document supprimé n’est plus accessible par son ancienne URL (404), même pour son propriétaire', async () => {
    const email = e2eEmail(runId, 'document-owner');
    await createStudent({ email, password });
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);

    const uploadResponse = await agent
      .post('/api/students/me/documents')
      .field('type', 'CV')
      .field('name', 'CV E2E.pdf')
      .attach('file', Buffer.from('%PDF-1.4 contenu factice e2e'), {
        filename: 'cv-e2e.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const document = uploadResponse.body.data;
    const downloadPath = new URL(document.fileUrl).pathname; // /uploads/documents/:studentId/:fileName

    // Document actif : la route protégée redirige (302) vers une URL S3
    // présignée.
    await agent.get(downloadPath).expect(302);

    // Suppression logique + retrait de l'objet S3 sous-jacent.
    await agent.delete(`/api/students/me/documents/${document.id}`).expect(200);

    // Après suppression : même le propriétaire authentifié ne peut plus
    // obtenir de lien de téléchargement.
    await agent.get(downloadPath).expect(404);

    // Le document ne réapparaît plus dans la liste des documents actifs.
    const listResponse = await agent
      .get('/api/students/me/documents')
      .expect(200);
    expect(
      listResponse.body.data.find((d: { id: string }) => d.id === document.id),
    ).toBeUndefined();

    // La suppression est idempotente côté API : un second appel échoue
    // proprement (déjà supprimé), pas une exception non gérée.
    await agent.delete(`/api/students/me/documents/${document.id}`).expect(404);
  });

  it('refuse l’accès à un document d’un autre étudiant', async () => {
    const ownerEmail = e2eEmail(runId, 'document-owner-2');
    await createStudent({ email: ownerEmail, password });
    const ownerAgent = request.agent(app.getHttpServer());
    await ownerAgent
      .post('/api/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const uploadResponse = await ownerAgent
      .post('/api/students/me/documents')
      .field('type', 'CV')
      .field('name', 'CV E2E.pdf')
      .attach('file', Buffer.from('%PDF-1.4 contenu factice e2e'), {
        filename: 'cv-e2e.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const downloadPath = new URL(uploadResponse.body.data.fileUrl).pathname;

    const otherEmail = e2eEmail(runId, 'document-intruder');
    await createStudent({ email: otherEmail, password });
    const otherAgent = request.agent(app.getHttpServer());
    await otherAgent
      .post('/api/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);

    await otherAgent.get(downloadPath).expect(403);
  });
});
