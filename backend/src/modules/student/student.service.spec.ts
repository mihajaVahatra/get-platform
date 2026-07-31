import { ConflictException, NotFoundException } from '@nestjs/common';
import { EncryptionService } from '../../common/services/encryption.service';
import { StorageService } from '../../common/services/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentService } from './student.service';

describe('StudentService — devoirs', () => {
  let service: StudentService;
  let prisma: {
    student: { findUnique: jest.Mock };
    courseEnrollment: { findUnique: jest.Mock; findMany: jest.Mock };
    assignment: { findUnique: jest.Mock; findMany: jest.Mock };
    assignmentSubmission: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let storageService: { uploadDocument: jest.Mock };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
      courseEnrollment: { findUnique: jest.fn(), findMany: jest.fn() },
      assignment: { findUnique: jest.fn(), findMany: jest.fn() },
      assignmentSubmission: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    storageService = {
      uploadDocument: jest
        .fn()
        .mockReturnValue({ url: 'https://storage/submission.pdf' }),
    };
    service = new StudentService(
      prisma as unknown as PrismaService,
      {} as EncryptionService,
      storageService as unknown as StorageService,
    );
  });

  it('refuse de lister les devoirs d’un cours sans inscription réelle', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);

    await expect(
      service.getCourseAssignments('user-1', 'course-outside'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assignment.findMany).not.toHaveBeenCalled();
  });

  it('refuse de remplacer une soumission déjà notée avant tout upload', async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      courseId: 'course-1',
      publishedAt: new Date(),
    });
    prisma.courseEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
    });
    prisma.assignmentSubmission.findUnique.mockResolvedValue({
      id: 'submission-1',
      grade: 14,
    });

    await expect(
      service.submitAssignment('user-1', 'assignment-1', {
        originalname: 'revision.pdf',
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(storageService.uploadDocument).not.toHaveBeenCalled();
    expect(prisma.assignmentSubmission.upsert).not.toHaveBeenCalled();
  });

  it('dépose une soumission pour un devoir publié du cours de l’étudiant', async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      courseId: 'course-1',
      publishedAt: new Date(),
    });
    prisma.courseEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
    });
    prisma.assignmentSubmission.findUnique.mockResolvedValue(null);
    prisma.assignmentSubmission.upsert.mockResolvedValue({
      id: 'submission-1',
    });

    await service.submitAssignment('user-1', 'assignment-1', {
      originalname: 'revision.pdf',
    } as Express.Multer.File);

    expect(storageService.uploadDocument).toHaveBeenCalledWith(
      expect.anything(),
      'student-1',
    );
    expect(prisma.assignmentSubmission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assignmentId_studentId: {
            assignmentId: 'assignment-1',
            studentId: 'student-1',
          },
        },
        create: {
          assignmentId: 'assignment-1',
          studentId: 'student-1',
          contentUrl: 'https://storage/submission.pdf',
        },
      }),
    );
  });
});
