import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationService } from './application.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { ApplicationStatus } from './dto/update-application-status.dto';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let schoolService: { syncCourseEnrollments: jest.Mock };
  let notificationService: { sendApplicationStatusUpdate: jest.Mock };
  let auditService: { log: jest.Mock };
  let prisma: {
    student: { findUnique: jest.Mock; update: jest.Mock };
    studentEnrollment: { upsert: jest.Mock };
    offer: { findFirst: jest.Mock };
    application: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    applicationTimeline: { create: jest.Mock };
    user: { findUnique: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
    schoolAcademicYear: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn(), update: jest.fn() },
      studentEnrollment: { upsert: jest.fn() },
      offer: { findFirst: jest.fn() },
      application: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      applicationTimeline: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      schoolProgram: { findFirst: jest.fn() },
      schoolAcademicYear: { findFirst: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    schoolService = { syncCourseEnrollments: jest.fn() };
    notificationService = { sendApplicationStatusUpdate: jest.fn() };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ApplicationService(
      prisma as unknown as PrismaService,
      schoolService as unknown as SchoolService,
      notificationService as unknown as NotificationService,
      auditService as unknown as AuditService,
    );
  });

  describe('submitApplications', () => {
    it('refuse de candidater pour un étudiant introuvable', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(
        service.submitApplications('student-1', ['offer-1']),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.application.create).not.toHaveBeenCalled();
    });

    it('classe chaque offre en soumise, échouée ou déjà candidatée', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prisma.offer.findFirst.mockImplementation(({ where }) => {
        if (where.id === 'offer-closed') return Promise.resolve(null);
        return Promise.resolve({ id: where.id });
      });
      prisma.application.findFirst.mockImplementation(({ where }) =>
        where.offerId === 'offer-already'
          ? Promise.resolve({ id: 'existing-application' })
          : Promise.resolve(null),
      );
      prisma.application.create.mockResolvedValue({ id: 'application-1' });

      const result = await service.submitApplications('student-1', [
        'offer-open',
        'offer-closed',
        'offer-already',
      ]);

      expect(result).toEqual({
        submitted: ['offer-open'],
        failed: ['offer-closed'],
        alreadyApplied: ['offer-already'],
      });
      expect(prisma.application.create).toHaveBeenCalledTimes(1);
      expect(prisma.applicationTimeline.create).toHaveBeenCalledWith({
        data: {
          applicationId: 'application-1',
          status: ApplicationStatus.PENDING,
          note: 'Application submitted',
        },
      });
    });
  });

  describe('updateStatus', () => {
    it('refuse à un administrateur d’une autre école de statuer sur le dossier', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        offer: { schoolId: 'school-1' },
      });
      prisma.user.findUnique.mockResolvedValue({
        role: { name: 'SCHOOL_ADMIN' },
        schoolAdmin: { schoolId: 'other-school' },
      });

      await expect(
        service.updateStatus(
          'application-1',
          { status: ApplicationStatus.REJECTED } as any,
          'user-1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.application.update).not.toHaveBeenCalled();
    });

    it('met à jour le statut sans inscrire l’étudiant lorsqu’il est rejeté', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: ApplicationStatus.PENDING,
        offer: { schoolId: 'school-1', programId: 'program-1' },
      });
      prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });
      prisma.application.update.mockResolvedValue({
        id: 'application-1',
        status: ApplicationStatus.REJECTED,
      });

      await service.updateStatus(
        'application-1',
        {
          status: ApplicationStatus.REJECTED,
          reason: 'Dossier incomplet',
        } as any,
        'admin-1',
      );

      expect(prisma.student.update).not.toHaveBeenCalled();
      expect(schoolService.syncCourseEnrollments).not.toHaveBeenCalled();
    });

    it('inscrit automatiquement l’étudiant lorsque la candidature est acceptée', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: ApplicationStatus.PENDING,
        offer: { schoolId: 'school-1', programId: 'program-1' },
      });
      prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });
      prisma.application.update.mockResolvedValue({
        id: 'application-1',
        status: ApplicationStatus.ACCEPTED,
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

      await service.updateStatus(
        'application-1',
        { status: ApplicationStatus.ACCEPTED } as any,
        'admin-1',
      );

      expect(prisma.studentEnrollment.upsert).toHaveBeenCalledWith({
        where: {
          studentId_schoolId: { studentId: 'student-1', schoolId: 'school-1' },
        },
        create: expect.objectContaining({
          studentId: 'student-1',
          schoolId: 'school-1',
          programId: 'program-1',
          programLevel: 1,
          academicYearId: 'year-1',
          status: 'ACTIVE',
        }),
        update: expect.objectContaining({
          programId: 'program-1',
          programLevel: 1,
          academicYearId: 'year-1',
          status: 'ACTIVE',
        }),
      });
      expect(schoolService.syncCourseEnrollments).toHaveBeenCalledWith(
        'student-1',
        'school-1',
        'program-1',
        1,
        prisma,
      );
    });

    it('ne reste jamais silencieux si l’offre n’est liée à aucun programme', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: ApplicationStatus.PENDING,
        offer: { schoolId: 'school-1', programId: null },
      });
      prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });
      prisma.application.update.mockResolvedValue({
        id: 'application-1',
        status: ApplicationStatus.ACCEPTED,
      });

      await service.updateStatus(
        'application-1',
        { status: ApplicationStatus.ACCEPTED } as any,
        'admin-1',
      );

      expect(prisma.studentEnrollment.upsert).not.toHaveBeenCalled();
      expect(schoolService.syncCourseEnrollments).not.toHaveBeenCalled();
      expect(prisma.applicationTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            note: expect.stringContaining('inscription automatique impossible'),
          }),
        }),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ALERTE INSCRIPTION]'),
      );
      consoleErrorSpy.mockRestore();
    });

    it('refuse de renvoyer une candidature REJECTED directement à ACCEPTED', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: ApplicationStatus.REJECTED,
        offer: { schoolId: 'school-1', programId: 'program-1' },
      });
      prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });

      await expect(
        service.updateStatus(
          'application-1',
          { status: ApplicationStatus.ACCEPTED } as any,
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.application.update).not.toHaveBeenCalled();
    });

    it('refuse d’accepter un candidat quand la capacité de l’offre est atteinte', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: ApplicationStatus.PENDING,
        offerId: 'offer-1',
        offer: { schoolId: 'school-1', programId: 'program-1', capacity: 1 },
      });
      prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });
      prisma.application.count.mockResolvedValue(1);

      await expect(
        service.updateStatus(
          'application-1',
          { status: ApplicationStatus.ACCEPTED } as any,
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.application.update).not.toHaveBeenCalled();
    });

    it('inscrit l’étudiant dans une 2ᵉ école sans toucher à la 1ʳᵉ (double cursus autorisé)', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
        status: ApplicationStatus.PENDING,
        offerId: 'offer-1',
        offer: { schoolId: 'school-2', programId: 'program-1' },
      });
      prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });
      prisma.application.update.mockResolvedValue({
        id: 'application-1',
        status: ApplicationStatus.ACCEPTED,
      });
      prisma.schoolProgram.findFirst.mockResolvedValue({
        id: 'program-1',
        name: 'Génie Civil',
      });
      prisma.schoolAcademicYear.findFirst.mockResolvedValue({
        id: 'year-2',
        label: '2026-2027',
      });
      prisma.studentEnrollment.upsert.mockResolvedValue({ id: 'enrollment-2' });

      await service.updateStatus(
        'application-1',
        { status: ApplicationStatus.ACCEPTED } as any,
        'admin-1',
      );

      // Aucune vérification d'inscription existante ailleurs : l'upsert est
      // scopé à (studentId, school-2) et ne touche jamais une éventuelle
      // inscription à une autre école.
      expect(prisma.studentEnrollment.upsert).toHaveBeenCalledWith({
        where: {
          studentId_schoolId: { studentId: 'student-1', schoolId: 'school-2' },
        },
        create: expect.objectContaining({
          studentId: 'student-1',
          schoolId: 'school-2',
          programId: 'program-1',
        }),
        update: expect.objectContaining({ programId: 'program-1' }),
      });
      expect(schoolService.syncCourseEnrollments).toHaveBeenCalledWith(
        'student-1',
        'school-2',
        'program-1',
        1,
        prisma,
      );
    });
  });

  describe('getApplicationById', () => {
    it('refuse au Ministry l’accès à un dossier nominatif', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        student: { userId: 'student-user' },
        offer: { schoolId: 'school-1' },
        timeline: [],
      });

      await expect(
        service.getApplicationById(
          'application-1',
          'ministry-user',
          'MINISTRY',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
