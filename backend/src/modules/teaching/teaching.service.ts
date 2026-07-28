import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class TeachingService {
  constructor(private readonly prisma: PrismaService) {}
  private async teacher(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Profil professeur introuvable');
    return teacher;
  }
  private async course(userId: string, courseId: string) {
    const teacher = await this.teacher(userId);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, teacherId: teacher.id },
    });
    if (!course) throw new NotFoundException('Cours introuvable');
    return course;
  }
  courses(userId: string) {
    return this.teacher(userId).then((teacher) =>
      this.prisma.course.findMany({
        where: { teacherId: teacher.id },
        include: {
          _count: {
            select: {
              enrollments: true,
              chapters: true,
              evaluations: true,
              assignments: true,
            },
          },
        },
        orderBy: { title: 'asc' },
      }),
    );
  }
  async detail(userId: string, courseId: string) {
    await this.course(userId, courseId);
    return this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          include: { resources: true },
          orderBy: { position: 'asc' },
        },
        evaluations: { orderBy: { scheduledAt: 'asc' } },
        assignments: { orderBy: { dueAt: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
  }
  async createChapter(
    userId: string,
    courseId: string,
    dto: { title: string; description?: string },
  ) {
    await this.course(userId, courseId);
    const position =
      (await this.prisma.courseChapter.count({ where: { courseId } })) + 1;
    return this.prisma.courseChapter.create({
      data: { courseId, position, ...dto },
    });
  }
  async publishChapter(userId: string, courseId: string, chapterId: string) {
    await this.course(userId, courseId);
    const chapter = await this.prisma.courseChapter.findFirst({
      where: { id: chapterId, courseId },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    return this.prisma.courseChapter.update({
      where: { id: chapterId },
      data: { isPublished: true, publishedAt: new Date() },
    });
  }
  async addResource(
    userId: string,
    courseId: string,
    chapterId: string,
    dto: { title: string; url: string; type: string },
  ) {
    await this.course(userId, courseId);
    const chapter = await this.prisma.courseChapter.findFirst({
      where: { id: chapterId, courseId },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    return this.prisma.courseResource.create({ data: { chapterId, ...dto } });
  }
  async students(userId: string, courseId: string) {
    await this.course(userId, courseId);
    return this.prisma.courseEnrollment.findMany({
      where: { courseId },
      include: { student: { include: { user: { select: { email: true } } } } },
    });
  }
}
