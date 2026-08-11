import * as crypto from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { ConfigService } from '@nestjs/config';
import type { PaymentProvider } from './providers/payment-provider.interface';

const WEBHOOK_SECRET = 'test-secret';

function signWebhook(dto: unknown) {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(dto))
    .digest('hex');
}

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentProvider: {
    initiatePayment: jest.Mock;
    confirmPayment: jest.Mock;
    refundPayment: jest.Mock;
  };
  let schoolService: { syncCourseEnrollments: jest.Mock };
  let config: { get: jest.Mock };
  let prisma: {
    student: { findUnique: jest.Mock; update: jest.Mock };
    studentEnrollment: { upsert: jest.Mock };
    application: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    payment: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    refund: { create: jest.Mock; update: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
    schoolAcademicYear: { findFirst: jest.Mock };
    applicationTimeline: { create: jest.Mock };
    transaction: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn(), update: jest.fn() },
      studentEnrollment: { upsert: jest.fn() },
      application: { findUnique: jest.fn(), update: jest.fn() },
      payment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      refund: { create: jest.fn(), update: jest.fn() },
      schoolProgram: { findFirst: jest.fn() },
      schoolAcademicYear: { findFirst: jest.fn() },
      applicationTimeline: { create: jest.fn() },
      transaction: { create: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    paymentProvider = {
      initiatePayment: jest.fn(),
      confirmPayment: jest.fn(),
      refundPayment: jest.fn(),
    };
    schoolService = { syncCourseEnrollments: jest.fn() };
    config = { get: jest.fn().mockReturnValue(WEBHOOK_SECRET) };
    service = new PaymentService(
      prisma as unknown as PrismaService,
      paymentProvider,
      config as unknown as ConfigService,
      schoolService as unknown as SchoolService,
    );
  });

  describe('initiatePayment', () => {
    const dto = { applicationId: 'application-1', method: 'MVOLA' } as any;

    it('refuse un paiement pour un étudiant introuvable', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(
        service.initiatePayment('student-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un paiement pour la candidature d’un autre étudiant', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'another-student',
        status: 'ACCEPTED',
        offer: { tuitionFees: 5000 },
      });

      await expect(
        service.initiatePayment('student-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse un paiement pour une candidature pas encore acceptée', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'PENDING',
        offer: { tuitionFees: 5000 },
      });

      await expect(
        service.initiatePayment('student-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('refuse un second paiement si un paiement est déjà en cours ou complété', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'ACCEPTED',
        offer: { tuitionFees: 5000 },
      });
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        status: 'COMPLETED',
      });

      await expect(
        service.initiatePayment('student-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('calcule le montant depuis l’offre, jamais depuis le client', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'ACCEPTED',
        offer: { tuitionFees: 5000 },
      });
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.payment.create.mockResolvedValue({ id: 'payment-1' });
      paymentProvider.initiatePayment.mockResolvedValue({
        providerReference: 'provider-ref-1',
        redirectUrl: 'https://provider.test/pay',
      });
      prisma.payment.update.mockResolvedValue({});

      const result = await service.initiatePayment('student-1', {
        applicationId: 'application-1',
        method: 'MVOLA',
        amount: 1,
      } as any);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 5000, commission: 250 }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ amount: 5000, status: 'PROCESSING' }),
      );
    });
  });

  describe('handleWebhook', () => {
    const dto = { providerReference: 'provider-ref-1' } as any;

    it('refuse un webhook sans signature', async () => {
      await expect(
        service.handleWebhook(dto, undefined, undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse un webhook avec une signature invalide', async () => {
      await expect(
        service.handleWebhook(dto, undefined, 'signature-invalide'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse un webhook dont le paiement est introuvable', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.handleWebhook(dto, undefined, signWebhook(dto)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('confirme le paiement et inscrit automatiquement l’étudiant', async () => {
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: 'payment-1',
          status: 'PROCESSING',
          amount: 5000,
          method: 'MVOLA',
          applicationId: 'application-1',
          reference: 'PAY-1',
        })
        // Second appel : recherche d'un AUTRE paiement déjà COMPLETED pour
        // la même candidature (détection de webhook tardif) — aucun ici.
        .mockResolvedValueOnce(null);
      paymentProvider.confirmPayment.mockResolvedValue({
        status: 'COMPLETED',
        providerTransactionId: 'txn-1',
        rawData: {},
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        status: 'COMPLETED',
      });
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'ACCEPTED',
        offer: { programId: 'program-1', schoolId: 'school-1' },
      });
      prisma.schoolProgram.findFirst.mockResolvedValue({
        id: 'program-1',
        name: 'Informatique',
      });
      prisma.schoolAcademicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        label: '2026-2027',
      });
      prisma.studentEnrollment.upsert.mockResolvedValue({ id: 'enrollment-1' });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'application-1' },
        data: { status: 'ENROLLED' },
      });
      expect(prisma.studentEnrollment.upsert).toHaveBeenCalledWith({
        where: {
          studentId_schoolId: { studentId: 'student-1', schoolId: 'school-1' },
        },
        create: expect.objectContaining({
          studentId: 'student-1',
          schoolId: 'school-1',
          programId: 'program-1',
        }),
        update: expect.objectContaining({ programId: 'program-1' }),
      });
      expect(schoolService.syncCourseEnrollments).toHaveBeenCalledWith(
        'student-1',
        'school-1',
        'program-1',
        1,
        prisma,
      );
      expect(prisma.transaction.create).toHaveBeenCalled();
    });

    it('ne reste jamais silencieux si le paiement est confirmé mais l’inscription automatique est impossible', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: 'payment-1',
          status: 'PROCESSING',
          amount: 5000,
          method: 'MVOLA',
          applicationId: 'application-1',
          reference: 'PAY-1',
        })
        .mockResolvedValueOnce(null);
      paymentProvider.confirmPayment.mockResolvedValue({
        status: 'COMPLETED',
        providerTransactionId: 'txn-1',
        rawData: {},
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        status: 'COMPLETED',
      });
      // Offre non liée à un programme (le bug corrigé le 2026-08-03).
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'ACCEPTED',
        offer: { programId: null, schoolId: 'school-1' },
      });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.studentEnrollment.upsert).not.toHaveBeenCalled();
      expect(schoolService.syncCourseEnrollments).not.toHaveBeenCalled();
      expect(prisma.applicationTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            applicationId: 'application-1',
            note: expect.stringContaining('inscription automatique impossible'),
          }),
        }),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ALERTE INSCRIPTION]'),
      );
      consoleErrorSpy.mockRestore();
    });

    it('ne fait rien si le prestataire répond encore PENDING (ne le transforme pas en FAILED)', async () => {
      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-1',
        status: 'PROCESSING',
        amount: 5000,
        method: 'MVOLA',
        applicationId: 'application-1',
        reference: 'PAY-1',
      });
      paymentProvider.confirmPayment.mockResolvedValue({ status: 'PENDING' });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.application.update).not.toHaveBeenCalled();
    });

    it('ne réinscrit jamais un candidat dont la candidature a été annulée, et déclenche le remboursement', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: 'payment-1',
          status: 'PROCESSING',
          amount: 5000,
          method: 'MVOLA',
          applicationId: 'application-1',
          reference: 'PAY-1',
        })
        .mockResolvedValueOnce(null);
      paymentProvider.confirmPayment.mockResolvedValue({
        status: 'COMPLETED',
        providerTransactionId: 'txn-1',
        rawData: {},
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        status: 'COMPLETED',
      });
      // Le candidat a annulé sa candidature entre l'initiation du paiement
      // (qui exigeait ACCEPTED) et la confirmation tardive du webhook.
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'CANCELLED',
        offer: { programId: 'program-1', schoolId: 'school-1' },
      });
      paymentProvider.refundPayment.mockResolvedValue({
        success: true,
        refundId: 'REF-1',
      });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.application.update).not.toHaveBeenCalled();
      expect(prisma.studentEnrollment.upsert).not.toHaveBeenCalled();
      expect(schoolService.syncCourseEnrollments).not.toHaveBeenCalled();
      expect(prisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId: 'payment-1',
            amount: 5000,
            status: 'PENDING',
          }),
        }),
      );
      expect(prisma.applicationTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            applicationId: 'application-1',
            note: expect.stringContaining('réconciliation'),
          }),
        }),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ALERTE RÉCONCILIATION]'),
      );
      expect(paymentProvider.refundPayment).toHaveBeenCalledWith(
        'provider-ref-1',
      );
      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { paymentId: 'payment-1' },
        data: { status: 'COMPLETED', processedAt: expect.any(Date) },
      });
      // Le relevé comptable du paiement reçu reste écrit même en réconciliation.
      expect(prisma.transaction.create).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('laisse la ligne Refund en PENDING si le remboursement fournisseur échoue, sans faire échouer le webhook', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: 'payment-1',
          status: 'PROCESSING',
          amount: 5000,
          method: 'MVOLA',
          applicationId: 'application-1',
          reference: 'PAY-1',
        })
        .mockResolvedValueOnce(null);
      paymentProvider.confirmPayment.mockResolvedValue({
        status: 'COMPLETED',
        providerTransactionId: 'txn-1',
        rawData: {},
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        status: 'COMPLETED',
      });
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'REJECTED',
        offer: { programId: 'program-1', schoolId: 'school-1' },
      });
      paymentProvider.refundPayment.mockResolvedValue({ success: false });

      const result = await service.handleWebhook(
        dto,
        undefined,
        signWebhook(dto),
      );

      expect(result).toEqual({ id: 'payment-1', status: 'COMPLETED' });
      expect(prisma.refund.update).toHaveBeenCalledWith({
        where: { paymentId: 'payment-1' },
        data: { status: 'FAILED', processedAt: undefined },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ALERTE REMBOURSEMENT]'),
      );
      consoleErrorSpy.mockRestore();
    });

    it('inscrit normalement un paiement confirmé tardivement même si le Payment local était déjà EXPIRED', async () => {
      // Le sweep de `initiatePayment` a marqué ce paiement EXPIRED (délai de
      // 15 min dépassé) avant que le prestataire ne confirme finalement le
      // paiement d'origine. Tant que la candidature est toujours ACCEPTED et
      // qu'aucun autre paiement n'est COMPLETED pour elle, la confirmation
      // reste légitime : elle doit aboutir normalement.
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: 'payment-1',
          status: 'EXPIRED',
          amount: 5000,
          method: 'MVOLA',
          applicationId: 'application-1',
          reference: 'PAY-1',
        })
        .mockResolvedValueOnce(null);
      paymentProvider.confirmPayment.mockResolvedValue({
        status: 'COMPLETED',
        providerTransactionId: 'txn-1',
        rawData: {},
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        status: 'COMPLETED',
      });
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: 'ACCEPTED',
        offer: { programId: 'program-1', schoolId: 'school-1' },
      });
      prisma.schoolProgram.findFirst.mockResolvedValue({
        id: 'program-1',
        name: 'Informatique',
      });
      prisma.schoolAcademicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        label: '2026-2027',
      });
      prisma.studentEnrollment.upsert.mockResolvedValue({ id: 'enrollment-1' });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'application-1' },
        data: { status: 'ENROLLED' },
      });
      expect(prisma.refund.create).not.toHaveBeenCalled();
    });

    it('est idempotent en cas de double réception du même webhook (ne rappelle pas le prestataire)', async () => {
      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 'payment-1',
        status: 'COMPLETED',
        amount: 5000,
        method: 'MVOLA',
        applicationId: 'application-1',
        reference: 'PAY-1',
      });

      const result = await service.handleWebhook(
        dto,
        undefined,
        signWebhook(dto),
      );

      expect(result).toEqual(
        expect.objectContaining({ id: 'payment-1', status: 'COMPLETED' }),
      );
      expect(paymentProvider.confirmPayment).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('signale un webhook tardif sans rejouer l’inscription si un autre paiement est déjà complété', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: 'payment-1',
          status: 'PROCESSING',
          amount: 5000,
          method: 'MVOLA',
          applicationId: 'application-1',
          reference: 'PAY-1',
        })
        // Un autre paiement pour la même candidature est déjà COMPLETED.
        .mockResolvedValueOnce({ id: 'payment-2' });
      paymentProvider.confirmPayment.mockResolvedValue({
        status: 'COMPLETED',
        providerTransactionId: 'txn-1',
        rawData: {},
      });
      prisma.payment.update.mockResolvedValue({
        id: 'payment-1',
        status: 'COMPLETED',
      });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.application.update).not.toHaveBeenCalled();
      expect(prisma.studentEnrollment.upsert).not.toHaveBeenCalled();
      expect(prisma.applicationTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            applicationId: 'application-1',
            note: expect.stringContaining('Webhook tardif'),
          }),
        }),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ALERTE RÉCONCILIATION]'),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getPayment', () => {
    it('refuse au rôle Ministry le détail nominatif d’un paiement', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        student: {
          userId: 'student-user',
          firstName: 'Ada',
          lastName: 'Lovelace',
          user: { email: 'ada@example.test' },
        },
      });

      await expect(
        service.getPayment('payment-1', 'ministry-user', 'MINISTRY'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
