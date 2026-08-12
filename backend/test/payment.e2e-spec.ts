/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- réponses Supertest (.body) non typées par nature (any) ; ce fichier e2e lit des payloads JSON dynamiques dans des assertions, pas du code de production. */
import * as crypto from 'crypto';
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
import type { PaymentProvider } from '../src/modules/payment/providers/payment-provider.interface';

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET as string;

function signWebhookBody(body: object): { raw: string; signature: string } {
  const raw = JSON.stringify(body);
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
  return { raw, signature };
}

/** Double déterministe du prestataire de paiement — le mock réel intègre
 * volontairement un taux d'échec aléatoire de 10% (simulation réaliste),
 * ce qui rendrait ce test flaky. La logique métier testée (initiation,
 * webhook, passage à COMPLETED, inscription) reste, elle, entièrement réelle. */
class DeterministicPaymentProvider implements PaymentProvider {
  initiatePayment(data: { reference: string }) {
    return Promise.resolve({
      providerReference: `E2E-${data.reference}`,
      status: 'PENDING' as const,
    });
  }
  confirmPayment() {
    return Promise.resolve({
      status: 'COMPLETED' as const,
      providerTransactionId: 'E2E-TX-1',
    });
  }
  refundPayment() {
    return Promise.resolve({ success: true, refundId: 'E2E-REFUND-1' });
  }
}

describe('Paiement (e2e)', () => {
  let app: NestExpressApplication;
  const runId = newRunId();
  const password = 'SecurePass123!';

  beforeAll(async () => {
    app = await bootstrapTestApp((builder) =>
      builder
        .overrideProvider('PaymentProvider')
        .useValue(new DeterministicPaymentProvider()),
    );
  });

  afterAll(async () => {
    await cleanupE2eData(runId);
    await disconnectFixtures();
    await app.close();
  });

  it('refuse de payer une candidature non acceptée', async () => {
    const school = await createSchool({ runId });
    const offer = await createOffer({ schoolId: school.id, capacity: 10 });
    const studentEmail = e2eEmail(runId, 'unpaid');
    await createStudent({ email: studentEmail, password });
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);
    await agent
      .post('/api/applications')
      .send({ offerIds: [offer.id] })
      .expect(201);
    const mine = await agent.get('/api/applications/me').expect(200);

    await agent
      .post('/api/payments/initiate')
      .send({ applicationId: mine.body.data[0].id, method: 'MVOLA' })
      .expect(400);
  });

  it('paie une candidature acceptée : initiation puis webhook signé confirment le paiement et débloquent la suite', async () => {
    const school = await createSchool({
      runId,
      name: `École paiement ${runId}`,
    });
    const offer = await createOffer({
      schoolId: school.id,
      capacity: 10,
      tuitionFees: 1_200_000,
    });

    const studentEmail = e2eEmail(runId, 'payer');
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
    const applicationId = mine.body.data[0].id;

    const adminEmail = e2eEmail(runId, 'payment-admin');
    await createSchoolAdmin({
      email: adminEmail,
      password,
      schoolId: school.id,
    });
    const adminAgent = request.agent(app.getHttpServer());
    await adminAgent
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    // MfaEnforcedGuard exige le MFA actif pour SCHOOL_ADMIN sur tout
    // endpoint mutable (voir enrollMfa) — sans ça, le PUT status ci-dessous
    // échouerait en 403.
    await enrollMfa(adminAgent);
    await adminAgent
      .put(`/api/applications/${applicationId}/status`)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    // 1. Initiation : le montant vient de l'offre, jamais du client. La
    // référence prestataire n'est jamais renvoyée au client (elle vit côté
    // Payment.providerRef, mise à jour après l'appel au prestataire) — on
    // la relit directement en base, comme le ferait le webhook réel.
    const initiateResponse = await studentAgent
      .post('/api/payments/initiate')
      .send({ applicationId, method: 'MVOLA' })
      .expect(201);
    expect(initiateResponse.body.data.amount).toBe(1_200_000);

    const paymentAfterInitiate = await prisma.payment.findFirst({
      where: { applicationId },
    });
    expect(paymentAfterInitiate?.status).toBe('PROCESSING');
    expect(paymentAfterInitiate?.amount).toBe(1_200_000);
    const providerReference = paymentAfterInitiate?.providerRef as string;
    expect(providerReference).toMatch(/^E2E-/);

    // 2. Un webhook sans signature est rejeté.
    await studentAgent
      .post('/api/payments/webhook')
      .send({
        providerReference,
        status: 'SUCCESS',
        providerTransactionId: 'unsigned',
      })
      .expect(403);

    // 3. Webhook correctement signé (HMAC sur les octets bruts) : confirme
    // le paiement. Le statut réel vient de paymentProvider.confirmPayment
    // (jamais du corps du webhook seul), voir PaymentService.handleWebhook.
    const webhookBody = {
      providerReference,
      status: 'SUCCESS',
      providerTransactionId: 'irrelevant-provider-says-so',
    };
    const { raw, signature } = signWebhookBody(webhookBody);
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signature)
      .send(raw)
      .expect(201);

    const paymentAfterWebhook = await prisma.payment.findFirst({
      where: { applicationId },
    });
    expect(paymentAfterWebhook?.status).toBe('COMPLETED');
    expect(paymentAfterWebhook?.paidAt).not.toBeNull();

    // 4. Le webhook est idempotent : le rejouer ne casse rien et ne
    // déclenche pas de second traitement.
    await request(app.getHttpServer())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signature)
      .send(raw)
      .expect(201);
    const paymentCount = await prisma.payment.count({
      where: { applicationId },
    });
    expect(paymentCount).toBe(1);
  });
});
