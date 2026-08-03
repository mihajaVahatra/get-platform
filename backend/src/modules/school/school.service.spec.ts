import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { AnnouncementService } from '../announcement/announcement.service';
import { TeacherAvailabilityService } from '../teacher-availability/teacher-availability.service';
import { SchoolService } from './school.service';

describe('SchoolService', () => {
  let service: SchoolService;
  let prisma: {
    course: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    courseEnrollment: {
      count: jest.Mock;
      deleteMany: jest.Mock;
      upsert: jest.Mock;
    };
    teacherSchool: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      course: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      courseEnrollment: {
        count: jest.fn(),
        deleteMany: jest.fn().mockReturnValue('delete-obsolete-enrollments'),
        upsert: jest
          .fn()
          .mockImplementation(
            ({
              create,
            }: {
              create: { courseId: string; studentId: string };
            }) => ({ ...create }),
          ),
      },
      teacherSchool: { findMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new SchoolService(
      prisma as unknown as PrismaService,
      {} as NotificationService,
      {} as AnnouncementService,
      {} as TeacherAvailabilityService,
    );
  });

  it('inscrit uniquement aux cours publiés de la filière et du niveau concernés', async () => {
    prisma.course.findMany.mockResolvedValue([
      { id: 'course-1' },
      { id: 'course-2' },
    ]);

    await service.syncCourseEnrollments(
      'student-1',
      'school-1',
      'program-1',
      2,
    );

    expect(prisma.course.findMany).toHaveBeenCalledWith({
      where: {
        schoolId: 'school-1',
        programId: 'program-1',
        programLevel: 2,
        isPublished: true,
      },
      select: { id: true },
    });
    expect(prisma.courseEnrollment.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.courseEnrollment.upsert).toHaveBeenCalledWith({
      where: {
        courseId_studentId: { courseId: 'course-1', studentId: 'student-1' },
      },
      update: {},
      create: { courseId: 'course-1', studentId: 'student-1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'delete-obsolete-enrollments',
      { courseId: 'course-1', studentId: 'student-1' },
      { courseId: 'course-2', studentId: 'student-1' },
    ]);
  });

  it('retire aussi les inscriptions précédentes si aucun cours ne correspond plus', async () => {
    prisma.course.findMany.mockResolvedValue([]);

    await service.syncCourseEnrollments(
      'student-1',
      'school-1',
      'program-2',
      3,
    );

    expect(prisma.courseEnrollment.deleteMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: { notIn: [] },
        course: { schoolId: 'school-1' },
      },
    });
    expect(prisma.courseEnrollment.upsert).not.toHaveBeenCalled();
  });

  it('empêche la désactivation d’un cours avec des inscriptions actives', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      teacherId: 'teacher-1',
    });
    prisma.courseEnrollment.count.mockResolvedValue(1);

    await expect(
      service.updateCourse('school-1', 'course-1', { isPublished: false }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.courseEnrollment.count).toHaveBeenCalledWith({
      where: {
        courseId: 'course-1',
        student: { enrollmentStatus: 'ACTIVE', deletedAt: null },
      },
    });
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it('retourne les professeurs désactivés de l’établissement pour réaffectation', async () => {
    prisma.teacherSchool.findMany.mockResolvedValue([]);

    await service.getInactiveTeacherAssignments('school-1');

    expect(prisma.teacherSchool.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-1', isActive: false },
      select: {
        teacherId: true,
        teacher: { select: { id: true, user: { select: { email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
});
