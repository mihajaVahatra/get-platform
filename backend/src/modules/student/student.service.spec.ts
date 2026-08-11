import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EncryptionService } from '../../common/services/encryption.service';
import { StorageService } from '../../common/services/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentService } from './student.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

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

describe('StudentService — notes, emploi du temps et préférences', () => {
  let service: StudentService;
  let prisma: {
    student: { findUnique: jest.Mock };
    courseEnrollment: { findMany: jest.Mock };
    courseSlot: { findMany: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
      courseEnrollment: { findMany: jest.fn() },
      courseSlot: { findMany: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    service = new StudentService(
      prisma as unknown as PrismaService,
      {} as EncryptionService,
      {} as StorageService,
    );
  });

  it('ne retourne les notes que pour les cours où l’étudiant est inscrit', async () => {
    prisma.courseEnrollment.findMany.mockResolvedValue([
      {
        course: {
          id: 'course-1',
          code: 'INF101',
          title: 'Algorithmique',
          evaluations: [
            {
              id: 'eval-1',
              title: 'Contrôle 1',
              type: 'CC',
              coefficient: 1,
              scheduledAt: null,
              grades: [{ value: 15 }],
            },
          ],
          assignments: [
            {
              id: 'assignment-1',
              title: 'Devoir 1',
              submissions: [],
            },
          ],
        },
      },
    ]);

    const result = await service.getGrades('user-1');

    expect(prisma.courseEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 'student-1' } }),
    );
    expect(result).toEqual([
      {
        courseId: 'course-1',
        code: 'INF101',
        title: 'Algorithmique',
        evaluations: [
          {
            id: 'eval-1',
            title: 'Contrôle 1',
            type: 'CC',
            coefficient: 1,
            scheduledAt: null,
            value: 15,
          },
        ],
        assignments: [{ id: 'assignment-1', title: 'Devoir 1', grade: null }],
      },
    ]);
  });

  it('ne retourne les créneaux que pour les cours où l’étudiant est inscrit', async () => {
    prisma.courseEnrollment.findMany.mockResolvedValue([
      { courseId: 'course-1' },
    ]);
    prisma.courseSlot.findMany.mockResolvedValue([]);

    await service.getSchedule('user-1');

    expect(prisma.courseSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId: { in: ['course-1'] } },
      }),
    );
  });

  it('ne consulte pas les créneaux si l’étudiant n’est inscrit à aucun cours', async () => {
    prisma.courseEnrollment.findMany.mockResolvedValue([]);

    const result = await service.getSchedule('user-1');

    expect(result).toEqual([]);
    expect(prisma.courseSlot.findMany).not.toHaveBeenCalled();
  });

  it('refuse de changer le mot de passe si le mot de passe actuel est incorrect', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: 'hashed-current',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.changePassword('user-1', 'wrong-password', 'NewPass123!'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('met à jour le mot de passe quand le mot de passe actuel est valide', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: 'hashed-current',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');

    await service.changePassword('user-1', 'current-password', 'NewPass123!');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'hashed-new',
        sessionVersion: { increment: 1 },
      },
    });
  });

  it('met à jour la préférence de thème', async () => {
    prisma.user.update.mockResolvedValue({ theme: 'dark' });

    const result = await service.updateTheme('user-1', 'dark');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { theme: 'dark' },
      select: { theme: true },
    });
    expect(result).toEqual({ theme: 'dark' });
  });
});

describe('StudentService — deleteDocument', () => {
  let service: StudentService;
  let prisma: {
    student: { findUnique: jest.Mock };
    document: { findFirst: jest.Mock; update: jest.Mock };
  };
  let storageService: { deleteObject: jest.Mock };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
      document: { findFirst: jest.fn(), update: jest.fn() },
    };
    storageService = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    service = new StudentService(
      prisma as unknown as PrismaService,
      {} as EncryptionService,
      storageService as unknown as StorageService,
    );
  });

  it('refuse de supprimer un document introuvable ou déjà supprimé', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteDocument('user-1', 'document-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(storageService.deleteObject).not.toHaveBeenCalled();
  });

  it('marque le document supprimé (deletedAt) et retire l’objet S3 sous-jacent', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      fileUrl: 'http://localhost:3001/uploads/documents/student-1/abc123.pdf',
    });

    const result = await service.deleteDocument('user-1', 'document-1');

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'documents',
      'student-1',
      'abc123.pdf',
    );
    expect(result).toEqual({ success: true });
  });
});
