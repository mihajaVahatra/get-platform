import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { StorageService } from '../../common/services/storage.service';
@Injectable()
export class TeachingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly storageService: StorageService,
  ) {}
  private async teacher(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Profil professeur introuvable');
    return teacher;
  }
  async profile(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: { user: { select: { email: true, theme: true } } },
    });
    if (!teacher) throw new ForbiddenException('Profil professeur introuvable');
    return teacher;
  }
  async dashboardSummary(userId: string) {
    const teacher = await this.teacher(userId);
    const courseWhere = {
      teacherId: teacher.id,
      school: {
        teacherAssignments: {
          some: { teacherId: teacher.id, isActive: true },
        },
      },
    };
    const [courses, submissionsToGrade, upcomingEvaluations, unreadMessages] =
      await Promise.all([
        this.prisma.course.count({ where: courseWhere }),
        this.prisma.assignmentSubmission.count({
          where: {
            grade: null,
            assignment: { course: courseWhere },
          },
        }),
        this.prisma.evaluation.count({
          where: {
            scheduledAt: { gte: new Date() },
            course: courseWhere,
          },
        }),
        this.prisma.message.count({
          where: { recipientId: userId, isRead: false },
        }),
      ]);
    return { courses, submissionsToGrade, upcomingEvaluations, unreadMessages };
  }
  async updateProfile(
    userId: string,
    dto: { firstName?: string; lastName?: string; phone?: string },
  ) {
    const teacher = await this.teacher(userId);
    return this.prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.trim(),
      },
      include: { user: { select: { email: true, theme: true } } },
    });
  }
  async updateAvatar(userId: string, avatarUrl: string) {
    const teacher = await this.teacher(userId);
    return this.prisma.teacher.update({
      where: { id: teacher.id },
      data: { avatarUrl },
      include: { user: { select: { email: true, theme: true } } },
    });
  }
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Utilisateur introuvable');
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      throw new BadRequestException('Le mot de passe actuel est incorrect');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    return { success: true };
  }
  async updateTheme(userId: string, theme: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { theme },
      select: { theme: true },
    });
    return user;
  }
  private async course(userId: string, courseId: string) {
    const teacher = await this.teacher(userId);
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId: teacher.id,
        school: {
          teacherAssignments: {
            some: { teacherId: teacher.id, isActive: true },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Cours introuvable');
    return course;
  }
  private async evaluation(userId: string, evaluationId: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });
    if (!evaluation) throw new NotFoundException('Évaluation introuvable');
    await this.course(userId, evaluation.courseId);
    return evaluation;
  }
  private async assignment(userId: string, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Devoir introuvable');
    await this.course(userId, assignment.courseId);
    return assignment;
  }
  private async submission(userId: string, submissionId: string) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new NotFoundException('Soumission introuvable');
    await this.assignment(userId, submission.assignmentId);
    return submission;
  }
  courses(userId: string) {
    return this.teacher(userId).then((teacher) =>
      this.prisma.course.findMany({
        where: {
          teacherId: teacher.id,
          school: {
            teacherAssignments: {
              some: { teacherId: teacher.id, isActive: true },
            },
          },
        },
        include: {
          school: { select: { id: true, name: true, slug: true } },
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
  async schools(userId: string) {
    const teacher = await this.teacher(userId);
    return this.prisma.teacherSchool.findMany({
      where: { teacherId: teacher.id, isActive: true },
      include: { school: { select: { id: true, name: true, slug: true } } },
      orderBy: { school: { name: 'asc' } },
    });
  }
  async schedule(userId: string) {
    const teacher = await this.teacher(userId);
    return this.prisma.courseSlot.findMany({
      where: {
        course: {
          teacherId: teacher.id,
          school: {
            teacherAssignments: {
              some: { teacherId: teacher.id, isActive: true },
            },
          },
        },
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            school: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }
  async resources(userId: string, page = 1, limit = 25) {
    const teacher = await this.teacher(userId);
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const where = {
      chapter: {
        course: {
          teacherId: teacher.id,
          school: {
            teacherAssignments: {
              some: { teacherId: teacher.id, isActive: true },
            },
          },
        },
      },
    };
    const [items, total] = await Promise.all([
      this.prisma.courseResource.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        include: {
          chapter: {
            select: {
              title: true,
              course: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.courseResource.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
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
  async updateCourseSettings(
    userId: string,
    courseId: string,
    dto: {
      welcomeMessage?: string;
      allowGroupMessages?: boolean;
      notifyOnPublish?: boolean;
    },
  ) {
    await this.course(userId, courseId);
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        welcomeMessage: dto.welcomeMessage?.trim(),
        allowGroupMessages: dto.allowGroupMessages,
        notifyOnPublish: dto.notifyOnPublish,
      },
      include: { _count: { select: { enrollments: true } } },
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
  async updateChapter(
    userId: string,
    courseId: string,
    chapterId: string,
    dto: { title?: string; description?: string },
  ) {
    await this.course(userId, courseId);
    const chapter = await this.prisma.courseChapter.findFirst({
      where: { id: chapterId, courseId },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    return this.prisma.courseChapter.update({
      where: { id: chapterId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }
  async deleteChapter(userId: string, courseId: string, chapterId: string) {
    await this.course(userId, courseId);
    const chapter = await this.prisma.courseChapter.findFirst({
      where: { id: chapterId, courseId },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    return this.prisma.courseChapter.delete({ where: { id: chapterId } });
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
    dto: { title: string; url?: string; type: string },
    file?: Express.Multer.File,
  ) {
    await this.course(userId, courseId);
    const chapter = await this.prisma.courseChapter.findFirst({
      where: { id: chapterId, courseId },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    const url = file
      ? this.storageService.uploadCourseMaterial(file, courseId).url
      : dto.url;
    if (!url) throw new BadRequestException('Ajoutez un lien ou un fichier');
    return this.prisma.courseResource.create({
      data: { chapterId, title: dto.title, url, type: dto.type },
    });
  }
  async updateResource(
    userId: string,
    courseId: string,
    chapterId: string,
    resourceId: string,
    dto: { title?: string; url?: string; type?: string },
  ) {
    await this.course(userId, courseId);
    const chapter = await this.prisma.courseChapter.findFirst({
      where: { id: chapterId, courseId },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    const resource = await this.prisma.courseResource.findFirst({
      where: { id: resourceId, chapterId },
    });
    if (!resource) throw new NotFoundException('Ressource introuvable');
    return this.prisma.courseResource.update({
      where: { id: resourceId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
      },
    });
  }
  async deleteResource(
    userId: string,
    courseId: string,
    chapterId: string,
    resourceId: string,
  ) {
    await this.course(userId, courseId);
    const chapter = await this.prisma.courseChapter.findFirst({
      where: { id: chapterId, courseId },
    });
    if (!chapter) throw new NotFoundException('Chapitre introuvable');
    const resource = await this.prisma.courseResource.findFirst({
      where: { id: resourceId, chapterId },
    });
    if (!resource) throw new NotFoundException('Ressource introuvable');
    return this.prisma.courseResource.delete({ where: { id: resourceId } });
  }
  async students(userId: string, courseId: string, page = 1, limit = 25) {
    await this.course(userId, courseId);
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const where = { courseId };
    const [items, total] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        include: {
          student: { include: { user: { select: { email: true } } } },
        },
        orderBy: { student: { lastName: 'asc' } },
      }),
      this.prisma.courseEnrollment.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }
  async evaluations(userId: string, courseId: string) {
    await this.course(userId, courseId);
    return this.prisma.evaluation.findMany({
      where: { courseId },
      orderBy: { scheduledAt: 'asc' },
    });
  }
  async createAnnouncement(
    userId: string,
    courseId: string,
    dto: { title: string; body: string },
  ) {
    const course = await this.course(userId, courseId);
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { courseId },
      select: { student: { select: { userId: true } } },
    });
    const announcement = await this.prisma.announcement.create({
      data: {
        schoolId: course.schoolId,
        authorId: userId,
        courseId,
        targetType: 'COURSE_STUDENTS',
        targetClasses: [],
        title: dto.title.trim(),
        body: dto.body.trim(),
      },
    });
    const recipients = await this.notificationService.sendInAppBatch(
      enrollments.map((enrollment) => enrollment.student.userId),
      { title: announcement.title, body: announcement.body },
    );
    if (recipients.length) {
      await this.prisma.announcementRecipient.createMany({
        data: recipients.map((recipient) => ({
          announcementId: announcement.id,
          ...recipient,
        })),
      });
    }
    return {
      announcementId: announcement.id,
      recipientCount: recipients.length,
    };
  }
  async announcements(userId: string, courseId: string) {
    await this.course(userId, courseId);
    const announcements = await this.prisma.announcement.findMany({
      where: { courseId, targetType: 'COURSE_STUDENTS' },
      include: {
        recipients: {
          select: { notification: { select: { isRead: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      createdAt: announcement.createdAt,
      recipientCount: announcement.recipients.length,
      readCount: announcement.recipients.filter(
        (recipient) => recipient.notification.isRead,
      ).length,
    }));
  }
  async createEvaluation(
    userId: string,
    courseId: string,
    dto: {
      title: string;
      type: string;
      scheduledAt?: string;
      coefficient?: number;
    },
  ) {
    await this.course(userId, courseId);
    return this.prisma.evaluation.create({
      data: {
        courseId,
        title: dto.title,
        type: dto.type,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        coefficient: dto.coefficient,
      },
    });
  }
  async grades(userId: string, evaluationId: string, page = 1, limit = 25) {
    const evaluation = await this.evaluation(userId, evaluationId);
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const where = { courseId: evaluation.courseId };
    const [enrollments, total] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        include: {
          student: { include: { user: { select: { email: true } } } },
        },
        orderBy: { student: { lastName: 'asc' } },
      }),
      this.prisma.courseEnrollment.count({ where }),
    ]);
    const grades = await this.prisma.grade.findMany({
      where: {
        evaluationId,
        studentId: { in: enrollments.map((enrollment) => enrollment.studentId) },
      },
    });
    const gradesByStudentId = new Map(
      grades.map((grade) => [grade.studentId, grade]),
    );
    return {
      items: enrollments.map((enrollment) => ({
        studentId: enrollment.studentId,
        student: enrollment.student,
        grade: gradesByStudentId.get(enrollment.studentId) || null,
      })),
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }
  async saveGrade(
    userId: string,
    evaluationId: string,
    dto: { studentId: string; value: number; comment?: string },
  ) {
    const evaluation = await this.evaluation(userId, evaluationId);
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: evaluation.courseId,
          studentId: dto.studentId,
        },
      },
    });
    if (!enrollment)
      throw new NotFoundException('Étudiant non inscrit à ce cours');
    return this.prisma.grade.upsert({
      where: {
        evaluationId_studentId: {
          evaluationId,
          studentId: dto.studentId,
        },
      },
      update: { value: dto.value, comment: dto.comment },
      create: {
        evaluationId,
        studentId: dto.studentId,
        value: dto.value,
        comment: dto.comment,
      },
    });
  }
  async createAssignment(
    userId: string,
    courseId: string,
    dto: { title: string; instructions?: string; dueAt?: string },
  ) {
    await this.course(userId, courseId);
    return this.prisma.assignment.create({
      data: {
        courseId,
        title: dto.title,
        instructions: dto.instructions,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        publishedAt: null,
      },
    });
  }
  async publishAssignment(userId: string, assignmentId: string) {
    await this.assignment(userId, assignmentId);
    return this.prisma.assignment.update({
      where: { id: assignmentId },
      data: { publishedAt: new Date() },
    });
  }
  async submissions(userId: string, assignmentId: string) {
    await this.assignment(userId, assignmentId);
    return this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: { student: { include: { user: { select: { email: true } } } } },
      orderBy: { submittedAt: 'desc' },
    });
  }
  async gradeSubmission(
    userId: string,
    submissionId: string,
    dto: { grade: number; feedback?: string },
  ) {
    await this.submission(userId, submissionId);
    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { grade: dto.grade, feedback: dto.feedback },
    });
  }
}
