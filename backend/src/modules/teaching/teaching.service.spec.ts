import { NotFoundException } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { TeachingService } from './teaching.service';

describe('TeachingService', () => {
  let service: TeachingService;
  let notificationService: { sendInAppBatch: jest.Mock };
  let storageService: { uploadCourseMaterial: jest.Mock };
  let prisma: {
    teacher: { findUnique: jest.Mock; update: jest.Mock };
    course: { findFirst: jest.Mock; count: jest.Mock };
    courseSlot: { findMany: jest.Mock };
    courseResource: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    courseChapter: {
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    evaluation: { findUnique: jest.Mock; count: jest.Mock };
    assignment: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    assignmentSubmission: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    courseEnrollment: { findUnique: jest.Mock; findMany: jest.Mock };
    announcement: { create: jest.Mock; findMany: jest.Mock };
    announcementRecipient: { createMany: jest.Mock };
    grade: { findMany: jest.Mock; upsert: jest.Mock };
    message: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      teacher: {
        findUnique: jest.fn().mockResolvedValue({ id: 'teacher-1' }),
        update: jest.fn(),
      },
      course: {
        findFirst: jest.fn().mockResolvedValue({ id: 'course-1' }),
        count: jest.fn(),
      },
      courseSlot: { findMany: jest.fn() },
      courseResource: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      courseChapter: {
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      evaluation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evaluation-1',
          courseId: 'course-1',
        }),
        count: jest.fn(),
      },
      assignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          courseId: 'course-1',
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      assignmentSubmission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      courseEnrollment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      announcement: { create: jest.fn(), findMany: jest.fn() },
      announcementRecipient: { createMany: jest.fn() },
      grade: { findMany: jest.fn(), upsert: jest.fn() },
      message: { count: jest.fn() },
    };
    notificationService = { sendInAppBatch: jest.fn() };
    storageService = { uploadCourseMaterial: jest.fn() };
    service = new TeachingService(
      prisma as unknown as PrismaService,
      notificationService as unknown as NotificationService,
      storageService as unknown as StorageService,
    );
  });

  it('refuse de noter un étudiant non inscrit au cours de l’évaluation', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);

    await expect(
      service.saveGrade('user-1', 'evaluation-1', {
        studentId: 'student-outside-course',
        value: 14,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it('retourne le vrai profil professeur avec son e-mail', async () => {
    prisma.teacher.findUnique.mockResolvedValue({
      id: 'teacher-1',
      firstName: 'Haja',
      lastName: 'Rasoanaivo',
      user: { email: 'haja@example.test' },
    });

    await expect(service.profile('user-1')).resolves.toEqual({
      id: 'teacher-1',
      firstName: 'Haja',
      lastName: 'Rasoanaivo',
      user: { email: 'haja@example.test' },
    });
  });

  it('agrège le tableau de bord sans charger chaque cours individuellement', async () => {
    prisma.course.count.mockResolvedValue(3);
    prisma.assignmentSubmission.count.mockResolvedValue(7);
    prisma.evaluation.count.mockResolvedValue(2);
    prisma.message.count.mockResolvedValue(4);

    await expect(service.dashboardSummary('user-1')).resolves.toEqual({
      courses: 3,
      submissionsToGrade: 7,
      upcomingEvaluations: 2,
      unreadMessages: 4,
    });

    expect(prisma.course.findFirst).not.toHaveBeenCalled();
    expect(prisma.assignmentSubmission.count).toHaveBeenCalledWith({
      where: {
        grade: null,
        assignment: {
          course: {
            teacherId: 'teacher-1',
            school: {
              teacherAssignments: {
                some: { teacherId: 'teacher-1', isActive: true },
              },
            },
          },
        },
      },
    });
    expect(prisma.message.count).toHaveBeenCalledWith({
      where: { recipientId: 'user-1', isRead: false },
    });
  });

  it('met à jour uniquement le profil du professeur connecté', async () => {
    prisma.teacher.update.mockResolvedValue({ id: 'teacher-1' });

    await service.updateProfile('user-1', {
      firstName: ' Haja ',
      phone: ' 034 00 000 00 ',
    });

    expect(prisma.teacher.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: {
        firstName: 'Haja',
        lastName: undefined,
        phone: '034 00 000 00',
      },
      include: { user: { select: { email: true, theme: true } } },
    });
  });

  it('met à jour un chapitre uniquement après vérification du cours', async () => {
    prisma.courseChapter.findFirst.mockResolvedValue({ id: 'chapter-1' });
    prisma.courseChapter.update.mockResolvedValue({ id: 'chapter-1' });

    await service.updateChapter('user-1', 'course-1', 'chapter-1', {
      title: 'Titre corrigé',
    });

    expect(prisma.courseChapter.findFirst).toHaveBeenCalledWith({
      where: { id: 'chapter-1', courseId: 'course-1' },
    });
    expect(prisma.courseChapter.update).toHaveBeenCalledWith({
      where: { id: 'chapter-1' },
      data: { title: 'Titre corrigé' },
    });
  });

  it('stocke un fichier de ressource après avoir vérifié le chapitre', async () => {
    prisma.courseChapter.findFirst.mockResolvedValue({ id: 'chapter-1' });
    storageService.uploadCourseMaterial.mockReturnValue({
      url: 'https://storage.test/course-material.pdf',
    });
    prisma.courseResource.create.mockResolvedValue({ id: 'resource-1' });

    await service.addResource(
      'user-1',
      'course-1',
      'chapter-1',
      { title: 'Support', type: 'PDF' },
      { originalname: 'support.pdf' } as Express.Multer.File,
    );

    expect(storageService.uploadCourseMaterial).toHaveBeenCalledWith(
      expect.anything(),
      'course-1',
    );
    expect(prisma.courseResource.create).toHaveBeenCalledWith({
      data: {
        chapterId: 'chapter-1',
        title: 'Support',
        url: 'https://storage.test/course-material.pdf',
        type: 'PDF',
      },
    });
  });

  it('refuse de supprimer une ressource qui n’appartient pas au chapitre', async () => {
    prisma.courseChapter.findFirst.mockResolvedValue({ id: 'chapter-1' });
    prisma.courseResource.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteResource(
        'user-1',
        'course-1',
        'chapter-1',
        'resource-outside',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.courseResource.delete).not.toHaveBeenCalled();
  });

  it('retourne uniquement les créneaux des cours du professeur', async () => {
    prisma.courseSlot.findMany.mockResolvedValue([]);

    await service.schedule('user-1');

    expect(prisma.courseSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          course: {
            teacherId: 'teacher-1',
            school: {
              teacherAssignments: {
                some: { teacherId: 'teacher-1', isActive: true },
              },
            },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    );
  });

  it('retourne uniquement les ressources des cours du professeur', async () => {
    prisma.courseResource.findMany.mockResolvedValue([]);

    await service.resources('user-1');

    expect(prisma.courseResource.findMany).toHaveBeenCalledWith({
      where: {
        chapter: {
          course: {
            teacherId: 'teacher-1',
            school: {
              teacherAssignments: {
                some: { teacherId: 'teacher-1', isActive: true },
              },
            },
          },
        },
      },
      include: {
        chapter: {
          select: {
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('annonce uniquement aux étudiants réellement inscrits au cours', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      schoolId: 'school-1',
    });
    prisma.courseEnrollment.findMany.mockResolvedValue([
      { student: { userId: 'student-user-1' } },
      { student: { userId: 'student-user-2' } },
    ]);
    prisma.announcement.create.mockResolvedValue({
      id: 'announcement-1',
      title: 'Consigne',
      body: 'À lire',
    });
    notificationService.sendInAppBatch.mockResolvedValue([
      {
        userId: 'student-user-1',
        notificationId: 'notification-1',
      },
      {
        userId: 'student-user-2',
        notificationId: 'notification-2',
      },
    ]);

    await service.createAnnouncement('user-1', 'course-1', {
      title: ' Consigne ',
      body: ' À lire ',
    });

    expect(prisma.courseEnrollment.findMany).toHaveBeenCalledWith({
      where: { courseId: 'course-1' },
      select: { student: { select: { userId: true } } },
    });
    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: {
        schoolId: 'school-1',
        authorId: 'user-1',
        courseId: 'course-1',
        targetType: 'COURSE_STUDENTS',
        targetClasses: [],
        title: 'Consigne',
        body: 'À lire',
      },
    });
    expect(notificationService.sendInAppBatch).toHaveBeenCalledWith(
      ['student-user-1', 'student-user-2'],
      { title: 'Consigne', body: 'À lire' },
    );
    expect(prisma.announcementRecipient.createMany).toHaveBeenCalledWith({
      data: [
        {
          announcementId: 'announcement-1',
          userId: 'student-user-1',
          notificationId: 'notification-1',
        },
        {
          announcementId: 'announcement-1',
          userId: 'student-user-2',
          notificationId: 'notification-2',
        },
      ],
    });
  });

  it('refuse l’accès aux notes lorsqu’un cours n’appartient pas au professeur', async () => {
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      service.grades('user-1', 'evaluation-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.courseEnrollment.findMany).not.toHaveBeenCalled();
    expect(prisma.grade.findMany).not.toHaveBeenCalled();
  });

  it('retourne tous les inscrits, avec une note nulle lorsque non saisie', async () => {
    prisma.courseEnrollment.findMany.mockResolvedValue([
      {
        studentId: 'student-1',
        student: {
          firstName: 'Tina',
          lastName: 'Raso',
          user: { email: 'tina@example.test' },
        },
      },
      {
        studentId: 'student-2',
        student: {
          firstName: 'Mamy',
          lastName: 'Rakoto',
          user: { email: 'mamy@example.test' },
        },
      },
    ]);
    prisma.grade.findMany.mockResolvedValue([
      { studentId: 'student-1', value: 16, comment: 'Très bien' },
    ]);

    await expect(service.grades('user-1', 'evaluation-1')).resolves.toEqual([
      {
        studentId: 'student-1',
        student: {
          firstName: 'Tina',
          lastName: 'Raso',
          user: { email: 'tina@example.test' },
        },
        grade: { studentId: 'student-1', value: 16, comment: 'Très bien' },
      },
      {
        studentId: 'student-2',
        student: {
          firstName: 'Mamy',
          lastName: 'Rakoto',
          user: { email: 'mamy@example.test' },
        },
        grade: null,
      },
    ]);
  });

  it('crée un devoir en brouillon', async () => {
    prisma.assignment.create.mockResolvedValue({ id: 'assignment-1' });

    await service.createAssignment('user-1', 'course-1', {
      title: 'TP de révision',
    });

    expect(prisma.assignment.create).toHaveBeenCalledWith({
      data: {
        courseId: 'course-1',
        title: 'TP de révision',
        instructions: undefined,
        dueAt: undefined,
        publishedAt: null,
      },
    });
  });

  it('refuse de noter une soumission rattachée à un devoir hors cours du professeur', async () => {
    prisma.assignmentSubmission.findUnique.mockResolvedValue({
      id: 'submission-1',
      assignmentId: 'assignment-foreign',
    });
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assignment-foreign',
      courseId: 'course-foreign',
    });
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      service.gradeSubmission('user-1', 'submission-1', { grade: 15 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assignmentSubmission.update).not.toHaveBeenCalled();
  });
});
