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
  };
  let schoolService: { syncCourseEnrollments: jest.Mock };
  let config: { get: jest.Mock };
  let prisma: {
    student: { findUnique: jest.Mock; update: jest.Mock };
    application: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    payment: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
    schoolAcademicYear: { findFirst: jest.Mock };
    applicationTimeline: { create: jest.Mock };
    transaction: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn(), update: jest.fn() },
      application: { findUnique: jest.fn(), update: jest.fn() },
      payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      schoolProgram: { findFirst: jest.fn() },
      schoolAcademicYear: { findFirst: jest.fn() },
      applicationTimeline: { create: jest.fn() },
      transaction: { create: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    paymentProvider = { initiatePayment: jest.fn(), confirmPayment: jest.fn() };
    schoolService = { syncCourseEnrollments: jest.fn() };
    config = { get: jest.fn().mockReturnValue(WEBHOOK_SECRET) };
    service = new PaymentService(
      prisma as unknown as PrismaService,
      paymentProvider as unknown as PaymentProvider,
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
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        status: 'PROCESSING',
        amount: 5000,
        method: 'MVOLA',
        applicationId: 'application-1',
      });
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
      prisma.student.update.mockResolvedValue({ id: 'student-1' });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'application-1' },
        data: { status: 'ENROLLED' },
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
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        status: 'PROCESSING',
        amount: 5000,
        method: 'MVOLA',
        applicationId: 'application-1',
      });
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
        offer: { programId: null, schoolId: 'school-1' },
      });

      await service.handleWebhook(dto, undefined, signWebhook(dto));

      expect(prisma.student.update).not.toHaveBeenCalled();
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
  });
});
