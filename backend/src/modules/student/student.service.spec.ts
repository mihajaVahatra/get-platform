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
    studentEnrollment: { findUnique: jest.Mock };
    assignment: { findUnique: jest.Mock; findMany: jest.Mock };
    assignmentSubmission: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let storageService: { uploadDocument: jest.Mock };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
      courseEnrollment: { findUnique: jest.fn(), findMany: jest.fn() },
      // ACTIVE par défaut : les tests d'un parcours "inscription valide"
      // n'ont pas à s'en préoccuper, seuls ceux qui testent la révocation
      // d'accès (retrait/diplomation) la redéfinissent explicitement.
      studentEnrollment: {
        findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      },
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

  it('refuse l’accès à un cours si l’inscription à l’école n’est plus active (retrait/diplomation)', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
      course: { schoolId: 'school-1' },
    });
    prisma.studentEnrollment.findUnique.mockResolvedValue({
      status: 'WITHDRAWN',
    });

    await expect(
      service.getCourseAssignments('user-1', 'course-1'),
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
      course: { schoolId: 'school-1' },
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
      course: { schoolId: 'school-1' },
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

describe('StudentService — profil (PII chiffrées)', () => {
  let service: StudentService;
  let encryption: { encrypt: jest.Mock; decrypt: jest.Mock };
  let prisma: {
    student: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn(), update: jest.fn() },
    };
    encryption = {
      encrypt: jest.fn((v: string) => `enc(${v})`),
      decrypt: jest.fn((v: string) =>
        v.replace(/^enc\(/, '').replace(/\)$/, ''),
      ),
    };
    service = new StudentService(
      prisma as unknown as PrismaService,
      encryption as unknown as EncryptionService,
      {} as StorageService,
    );
  });

  describe('updateProfile', () => {
    it('chiffre phone/cin/address avant écriture, jamais en clair', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prisma.student.update.mockResolvedValue({ id: 'student-1' });

      await service.updateProfile('user-1', {
        phone: '034 00 000 00',
        cin: '123456789012',
        address: 'Lot II B 45 Antananarivo',
      });

      expect(encryption.encrypt).toHaveBeenCalledWith('034 00 000 00');
      expect(encryption.encrypt).toHaveBeenCalledWith('123456789012');
      expect(encryption.encrypt).toHaveBeenCalledWith(
        'Lot II B 45 Antananarivo',
      );
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() est typé `any` par @types/jest
          data: expect.objectContaining({
            phone: 'enc(034 00 000 00)',
            cin: 'enc(123456789012)',
            address: 'enc(Lot II B 45 Antananarivo)',
          }),
        }),
      );
    });

    it('refuse la mise à jour plutôt que d’écrire une adresse en clair si le chiffrement échoue', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      encryption.encrypt.mockImplementation(() => {
        throw new Error('clé de chiffrement invalide');
      });

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- DTO volontairement partiel pour ce cas de test
        service.updateProfile('user-1', {
          address: 'Lot II B 45 Antananarivo',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('n’écrit aucun des trois champs PII quand ils ne sont pas fournis', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      prisma.student.update.mockResolvedValue({ id: 'student-1' });

      await service.updateProfile('user-1', { city: 'Antananarivo' });

      expect(encryption.encrypt).not.toHaveBeenCalled();
      const calls = prisma.student.update.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >;
      const data = calls[0][0].data;
      expect(data.phone).toBeUndefined();
      expect(data.cin).toBeUndefined();
      expect(data.address).toBeUndefined();
    });
  });

  describe('getProfile', () => {
    it('déchiffre phone/cin/address avant de les renvoyer', async () => {
      prisma.student.findUnique.mockResolvedValue({
        id: 'student-1',
        phone: 'enc(034 00 000 00)',
        cin: 'enc(123456789012)',
        address: 'enc(Lot II B 45 Antananarivo)',
        documents: [],
        applications: [],
        schoolEnrollments: [],
      });

      const result = await service.getProfile('user-1');

      expect(result.phone).toBe('034 00 000 00');
      expect(result.cin).toBe('123456789012');
      expect(result.address).toBe('Lot II B 45 Antananarivo');
    });

    it('masque un champ plutôt que d’exposer une valeur potentiellement en clair si le déchiffrement échoue', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      prisma.student.findUnique.mockResolvedValue({
        id: 'student-1',
        phone: null,
        cin: null,
        address: 'ceci-n’est-pas-un-format-chiffré-valide',
        documents: [],
        applications: [],
        schoolEnrollments: [],
      });
      encryption.decrypt.mockImplementation(() => {
        throw new Error('Invalid encrypted data format');
      });

      const result = await service.getProfile('user-1');

      expect(result.address).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('déchiffrement address'),
        expect.any(String),
      );
      consoleErrorSpy.mockRestore();
    });
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() est typé `any` par @types/jest
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
