/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- réponses Supertest (.body) non typées par nature (any) ; ce fichier e2e lit des payloads JSON dynamiques dans des assertions, pas du code de production. */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bootstrapTestApp } from './utils/bootstrap';
import {
  cleanupE2eData,
  createOffer,
  createSchool,
  createSchoolAdmin,
  createStudent,
  disconnectFixtures,
  e2eEmail,
  enrollMfa,
  newRunId,
  prisma,
} from './utils/fixtures';

/**
 * Vérifie l'AC central de US-02 : deux décisions ACCEPTED concurrentes sur
 * une offre de capacité 1 ne doivent jamais produire deux candidatures
 * acceptées à la fois — voir ApplicationService.applyStatusTransaction
 * (transaction Serializable dès que la capacité est concernée).
 */
describe('Concurrence de capacité d’offre (e2e)', () => {
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

  it('deux acceptations simultanées sur une offre de capacité 1 ne produisent qu’un seul accepté', async () => {
    const school = await createSchool({
      runId,
      name: `École concurrence ${runId}`,
    });
    const offer = await createOffer({ schoolId: school.id, capacity: 1 });

    const adminEmail = e2eEmail(runId, 'capacity-admin');
    await createSchoolAdmin({
      email: adminEmail,
      password,
      schoolId: school.id,
    });
    const adminAgentA = request.agent(app.getHttpServer());
    const adminAgentB = request.agent(app.getHttpServer());
    await adminAgentA
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    await adminAgentB
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    // MfaEnforcedGuard exige le MFA actif pour SCHOOL_ADMIN sur tout
    // endpoint mutable — un seul enrôlement suffit pour les deux agents (même
    // utilisateur en base, JwtStrategy la recharge à chaque requête).
    await enrollMfa(adminAgentA);

    // Deux candidats distincts postulent à la même offre.
    const applicationIds: string[] = [];
    for (const label of ['candidate-a', 'candidate-b']) {
      const studentEmail = e2eEmail(runId, label);
      await createStudent({ email: studentEmail, password });
      const studentAgent = request.agent(app.getHttpServer());
      await studentAgent
        .post('/api/auth/login')
        .send({ email: studentEmail, password })
        .expect(200);
      await studentAgent
        .post('/api/applications')
        .send({ offerIds: [offer.id] })
        .expect(201);
      const mine = await studentAgent.get('/api/applications/me').expect(200);
      applicationIds.push(mine.body.data[0].id);
    }

    // Les deux acceptations sont déclenchées en parallèle, via deux agents
    // (deux connexions HTTP distinctes) — pas séquentiellement, pour
    // réellement exercer la course entre les deux transactions Prisma.
    const [resultA, resultB] = await Promise.allSettled([
      adminAgentA
        .put(`/api/applications/${applicationIds[0]}/status`)
        .send({ status: 'ACCEPTED' }),
      adminAgentB
        .put(`/api/applications/${applicationIds[1]}/status`)
        .send({ status: 'ACCEPTED' }),
    ]);

    const statusCodes = [resultA, resultB].map((r) =>
      r.status === 'fulfilled' ? r.value.status : -1,
    );
    // L'une des deux doit réussir (200), l'autre doit être rejetée (400 —
    // capacité atteinte) : jamais les deux à 200.
    const successCount = statusCodes.filter((code) => code === 200).length;
    expect(successCount).toBe(1);
    expect(statusCodes.filter((code) => code === 400)).toHaveLength(1);

    // Vérification en base, pas seulement sur les réponses HTTP : au plus
    // une candidature ACCEPTED sur cette offre, quel que soit l'ordre réel
    // d'exécution des deux transactions.
    const acceptedCount = await prisma.application.count({
      where: { offerId: offer.id, status: 'ACCEPTED' },
    });
    expect(acceptedCount).toBe(1);
  });
});
