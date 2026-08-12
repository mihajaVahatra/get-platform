/* eslint-disable @typescript-eslint/no-unsafe-member-access -- réponses Supertest (.body) non typées par nature (any) ; ce fichier e2e lit des payloads JSON dynamiques dans des assertions, pas du code de production. */
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

/** superagent type `set-cookie` comme `string`, mais Express/Node renvoie
 * toujours un tableau dès qu'au moins un cookie est posé. */
function getSetCookies(response: request.Response): string[] {
  return response.headers['set-cookie'] as unknown as string[];
}

describe('Connexion (e2e)', () => {
  let app: NestExpressApplication;
  const runId = newRunId();
  const password = 'SecurePass123!';
  const email = e2eEmail(runId, 'login');

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await createStudent({ email, password });
  });

  afterAll(async () => {
    await cleanupE2eData(runId);
    await disconnectFixtures();
    await app.close();
  });

  it('refuse un mot de passe incorrect', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('connecte avec les bons identifiants, pose les cookies de session et donne accès à /auth/me', async () => {
    const agent = request.agent(app.getHttpServer());

    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loginResponse.body.user.email).toBe(email);
    const cookies = getSetCookies(loginResponse);
    expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(
      true,
    );
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(
      true,
    );

    // L'agent superagent renvoie automatiquement les cookies posés
    // ci-dessus — même comportement qu'un navigateur.
    const meResponse = await agent.get('/api/auth/me').expect(200);
    expect(meResponse.body.user.email).toBe(email);
  });

  it('rejette /auth/me sans cookie de session', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('rafraîchit la session via le cookie refresh_token', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);

    const refreshResponse = await agent.post('/api/auth/refresh').expect(200);
    expect(refreshResponse.body.user.email).toBe(email);
    const cookies = getSetCookies(refreshResponse);
    expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(
      true,
    );
  });

  it('la déconnexion révoque la session : /auth/me échoue ensuite même avec l’ancien cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    await agent.get('/api/auth/me').expect(200);

    await agent.post('/api/auth/logout').expect(204);

    await agent.get('/api/auth/me').expect(401);
  });
});
