import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { ApplicationStatus } from './dto/update-application-status.dto';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let schoolService: { syncCourseEnrollments: jest.Mock };
  let prisma: {
    student: { findUnique: jest.Mock; update: jest.Mock };
    offer: { findFirst: jest.Mock };
    application: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    applicationTimeline: { create: jest.Mock };
    user: { findUnique: jest.Mock };
    schoolProgram: { findFirst: jest.Mock };
    schoolAcademicYear: { findFirst: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn(), update: jest.fn() },
      offer: { findFirst: jest.fn() },
      application: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      applicationTimeline: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      schoolProgram: { findFirst: jest.fn() },
      schoolAcademicYear: { findFirst: jest.fn() },
    };
    schoolService = { syncCourseEnrollments: jest.fn() };
    service = new ApplicationService(
      prisma as unknown as PrismaService,
      schoolService as unknown as SchoolService,
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
        offer: { schoolId: 'school-1', programId: 'program-1' },
      });
      prisma.user.findUnique.mockResolvedValue({ role: { name: 'ADMIN_GET' } });
      prisma.application.update.mockResolvedValue({
        id: 'application-1',
        status: ApplicationStatus.REJECTED,
      });

      await service.updateStatus(
        'application-1',
        { status: ApplicationStatus.REJECTED, reason: 'Dossier incomplet' } as any,
        'admin-1',
      );

      expect(prisma.student.update).not.toHaveBeenCalled();
      expect(schoolService.syncCourseEnrollments).not.toHaveBeenCalled();
    });

    it('inscrit automatiquement l’étudiant lorsque la candidature est acceptée', async () => {
      prisma.application.findUnique.mockResolvedValue({
        id: 'application-1',
        studentId: 'student-1',
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
      prisma.student.update.mockResolvedValue({ id: 'student-1' });

      await service.updateStatus(
        'application-1',
        { status: ApplicationStatus.ACCEPTED } as any,
        'admin-1',
      );

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: expect.objectContaining({
          enrolledSchoolId: 'school-1',
          programId: 'program-1',
          programLevel: 1,
          academicYearId: 'year-1',
          enrollmentStatus: 'ACTIVE',
        }),
      });
      expect(schoolService.syncCourseEnrollments).toHaveBeenCalledWith(
        'student-1',
        'school-1',
        'program-1',
        1,
      );
    });
  });
});
