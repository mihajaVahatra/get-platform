/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- réponses Supertest (.body) non typées par nature (any) ; ce fichier e2e lit des payloads JSON dynamiques dans des assertions, pas du code de production. */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import * as speakeasy from 'speakeasy';
import { bootstrapTestApp } from './utils/bootstrap';
import {
  cleanupE2eData,
  createPrivilegedUser,
  createStudent,
  disconnectFixtures,
  e2eEmail,
  newRunId,
} from './utils/fixtures';

describe('MFA (e2e)', () => {
  let app: NestExpressApplication;
  const runId = newRunId();
  const password = 'SecurePass123!';
  const email = e2eEmail(runId, 'mfa');

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await createPrivilegedUser({ email, password, roleName: 'ADMIN_GET' });
  });

  afterAll(async () => {
    await cleanupE2eData(runId);
    await disconnectFixtures();
    await app.close();
  });

  it('enrôle le MFA, exige le code TOTP pour terminer la connexion, puis peut être désactivé', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);

    // 1. Enrôlement : génère un secret TOTP.
    const enableResponse = await agent.post('/api/auth/mfa/enable').expect(201);
    const secret: string = enableResponse.body.secret;
    expect(secret).toBeTruthy();

    const validCode = () => speakeasy.totp({ secret, encoding: 'base32' });

    // 2. Confirmation : le MFA n'est actif qu'après un code TOTP valide.
    await agent
      .post('/api/auth/mfa/verify')
      .send({ code: validCode() })
      .expect(201);

    // 3. Une fois le MFA actif, une connexion normale ne pose plus les
    // cookies de session directement — elle exige un second facteur.
    const secondAgent = request.agent(app.getHttpServer());
    const loginResponse = await secondAgent
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(loginResponse.body.mfaRequired).toBe(true);
    expect(loginResponse.body.challengeToken).toBeTruthy();
    expect(loginResponse.headers['set-cookie']).toBeUndefined();

    // Un code invalide ne complète pas la connexion.
    await secondAgent
      .post('/api/auth/mfa/login-verify')
      .send({
        challengeToken: loginResponse.body.challengeToken,
        code: '000000',
      })
      .expect(400);

    // Le bon code TOTP complète la connexion et pose les cookies.
    const verifyResponse = await secondAgent
      .post('/api/auth/mfa/login-verify')
      .send({
        challengeToken: loginResponse.body.challengeToken,
        code: validCode(),
      })
      .expect(200);
    expect(verifyResponse.body.user.email).toBe(email);
    await secondAgent.get('/api/auth/me').expect(200);

    // 4. Désactivation : exige aussi un code TOTP courant valide (US-12 —
    // sans quoi un cookie de session volé suffirait à désactiver le MFA).
    await agent
      .post('/api/auth/mfa/disable')
      .send({ code: '000000' })
      .expect(400);
    await agent
      .post('/api/auth/mfa/disable')
      .send({ code: validCode() })
      .expect(201);

    // Une fois désactivé, une connexion normale repose directement les
    // cookies de session sans étape MFA.
    const thirdAgent = request.agent(app.getHttpServer());
    const finalLogin = await thirdAgent
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(finalLogin.body.mfaRequired).toBeUndefined();
    expect(finalLogin.body.user.email).toBe(email);
  });

  it('interdit l’enrôlement MFA à un rôle non privilégié (STUDENT)', async () => {
    const studentEmail = e2eEmail(runId, 'mfa-student');
    await createStudent({ email: studentEmail, password });

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);

    await agent.post('/api/auth/mfa/enable').expect(403);
  });
});
