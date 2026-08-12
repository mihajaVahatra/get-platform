/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- réponses Supertest (.body) non typées par nature (any) ; ce fichier e2e lit des payloads JSON dynamiques dans des assertions, pas du code de production. */
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
} from './utils/fixtures';

describe('Admission (e2e)', () => {
  let app: NestExpressApplication;
  const runId = newRunId();
  const password = 'SecurePass123!';

  let offerId: string;
  let studentAgent: ReturnType<typeof request.agent>;
  let schoolAdminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    app = await bootstrapTestApp();

    const school = await createSchool({ runId });
    const offer = await createOffer({ schoolId: school.id, capacity: 10 });
    offerId = offer.id;

    const studentEmail = e2eEmail(runId, 'candidate');
    await createStudent({ email: studentEmail, password });
    studentAgent = request.agent(app.getHttpServer());
    await studentAgent
      .post('/api/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);

    const adminEmail = e2eEmail(runId, 'school-admin');
    await createSchoolAdmin({
      email: adminEmail,
      password,
      schoolId: school.id,
    });
    schoolAdminAgent = request.agent(app.getHttpServer());
    await schoolAdminAgent
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    // MfaEnforcedGuard exige le MFA actif pour SCHOOL_ADMIN sur tout
    // endpoint mutable (voir enrollMfa) — sans ça, les PUT status ci-dessous
    // échoueraient tous en 403.
    await enrollMfa(schoolAdminAgent);
  });

  afterAll(async () => {
    await cleanupE2eData(runId);
    await disconnectFixtures();
    await app.close();
  });

  let applicationId: string;

  it('un étudiant soumet une candidature à une offre', async () => {
    const response = await studentAgent
      .post('/api/applications')
      .send({ offerIds: [offerId] })
      .expect(201);

    expect(response.body.data.submitted).toContain(offerId);

    const mine = await studentAgent.get('/api/applications/me').expect(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].status).toBe('PENDING');
    applicationId = mine.body.data[0].id;
  });

  it('resoumettre la même offre est refusé (déjà candidaté), pas une deuxième ligne', async () => {
    const response = await studentAgent
      .post('/api/applications')
      .send({ offerIds: [offerId] })
      .expect(201);
    expect(response.body.data.alreadyApplied).toContain(offerId);

    const mine = await studentAgent.get('/api/applications/me').expect(200);
    expect(mine.body.data).toHaveLength(1);
  });

  it('le SCHOOL_ADMIN de l’établissement fait avancer la candidature dans le workflow', async () => {
    const response = await schoolAdminAgent
      .put(`/api/applications/${applicationId}/status`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    expect(response.body.data.status).toBe('UNDER_REVIEW');
  });

  it('une transition interdite depuis l’état courant est rejetée (machine à états)', async () => {
    // UNDER_REVIEW -> TEST_COMPLETED n'est pas une transition directe
    // autorisée (il faut passer par TEST_SCHEDULED).
    await schoolAdminAgent
      .put(`/api/applications/${applicationId}/status`)
      .send({ status: 'TEST_COMPLETED' })
      .expect(400);
  });

  it('REJECTED est un état terminal : aucune transition n’en repart', async () => {
    await schoolAdminAgent
      .put(`/api/applications/${applicationId}/status`)
      .send({ status: 'REJECTED' })
      .expect(200);

    await schoolAdminAgent
      .put(`/api/applications/${applicationId}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(400);
  });
});
