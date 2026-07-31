import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SchoolService } from './school.service';

describe('SchoolService', () => {
  let service: SchoolService;
  let prisma: {
    course: { findMany: jest.Mock };
    courseEnrollment: { deleteMany: jest.Mock; upsert: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      course: { findMany: jest.fn() },
      courseEnrollment: {
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
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new SchoolService(
      prisma as unknown as PrismaService,
      {} as NotificationService,
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
});
