import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import {
  UpdateApplicationStatusDto,
  ScheduleInterviewDto,
  ApplicationStatus,
} from './dto/update-application-status.dto';

@Injectable()
export class ApplicationService {
  constructor(private prisma: PrismaService) {}

  // ========== STUDENT ==========

  async submitApplications(studentId: string, offerIds: string[]) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const results = {
      submitted: [] as string[],
      failed: [] as string[],
      alreadyApplied: [] as string[],
    };

    for (const offerId of offerIds) {
      const offer = await this.prisma.offer.findFirst({
        where: { id: offerId, isOpen: true, deletedAt: null },
      });
      if (!offer) {
        results.failed.push(offerId);
        continue;
      }

      const existing = await this.prisma.application.findFirst({
        where: { studentId, offerId },
      });
      if (existing) {
        results.alreadyApplied.push(offerId);
        continue;
      }

      const application = await this.prisma.application.create({
        data: {
          studentId,
          offerId,
          status: ApplicationStatus.PENDING,
        },
      });
      results.submitted.push(offerId);

      await this.prisma.applicationTimeline.create({
        data: {
          applicationId: application.id,
          status: ApplicationStatus.PENDING,
          note: 'Application submitted',
        },
      });
    }

    return results;
  }

  async getStudentApplications(
    studentId: string,
    options?: { status?: ApplicationStatus; page?: number; limit?: number },
  ) {
    // ✅ Conversion explicite en nombre pour éviter l'erreur "take: string"
    const page = Number(options?.page) || 1;
    const limit = Number(options?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { studentId };
    if (options?.status) where.status = options.status;

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          offer: {
            include: {
              school: true,
            },
          },
          timeline: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ========== SCHOOL ADMIN / MINISTRY ==========

  async getSchoolApplications(
    schoolAdminId: string,
    options?: {
      status?: ApplicationStatus;
      offerId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const admin = await this.prisma.schoolAdmin.findUnique({
      where: { userId: schoolAdminId },
      include: { school: true },
    });
    if (!admin) throw new ForbiddenException('You are not a school admin');

    const page = Number(options?.page) || 1;
    const limit = Number(options?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      offer: {
        schoolId: admin.schoolId,
      },
    };
    if (options?.status) where.status = options.status;
    if (options?.offerId) where.offerId = options.offerId;

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          student: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
          offer: {
            include: {
              school: true,
            },
          },
          timeline: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getApplicationById(
    applicationId: string,
    userId: string,
    role: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        student: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        offer: {
          include: {
            school: true,
          },
        },
        timeline: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.ensureCanAccessApplication(application, userId, role);
    return application;
  }

  async getApplicationDocuments(
    applicationId: string,
    userId: string,
    role: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        student: true,
        offer: true,
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    await this.ensureCanAccessApplication(application, userId, role);

    return this.prisma.document.findMany({
      where: {
        studentId: application.studentId,
        deletedAt: null,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  // ========== STATUS MANAGEMENT ==========

  async updateStatus(
    applicationId: string,
    dto: UpdateApplicationStatusDto,
    userId: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: { include: { school: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.ensureCanManageApplication(application, userId);

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: dto.status,
        score: dto.score,
        decisionReason: dto.reason,
        decisionDate: new Date(),
      },
    });

    await this.prisma.applicationTimeline.create({
      data: {
        applicationId,
        status: dto.status,
        note: dto.reason || `Status changed to ${dto.status}`,
        createdBy: userId,
      },
    });

    return updated;
  }

  async scheduleTest(
    applicationId: string,
    data: { date: Date; type: string; details?: string },
    userId: string,
  ) {
    const applicationToManage = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: true },
    });
    if (!applicationToManage)
      throw new NotFoundException('Application not found');
    await this.ensureCanManageApplication(applicationToManage, userId);
    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.TEST_SCHEDULED,
        testResults: {
          type: data.type,
          details: data.details,
          scheduledAt: data.date,
        },
      },
    });

    await this.prisma.applicationTimeline.create({
      data: {
        applicationId,
        status: ApplicationStatus.TEST_SCHEDULED,
        note: `Test scheduled: ${data.type} on ${data.date}`,
        createdBy: userId,
      },
    });

    return application;
  }

  async scheduleInterview(
    applicationId: string,
    dto: ScheduleInterviewDto,
    userId: string,
  ) {
    const applicationToManage = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: true },
    });
    if (!applicationToManage)
      throw new NotFoundException('Application not found');
    await this.ensureCanManageApplication(applicationToManage, userId);
    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.INTERVIEW_SCHEDULED,
        interviewDate: new Date(dto.date),
        interviewLink: dto.link,
      },
    });

    await this.prisma.applicationTimeline.create({
      data: {
        applicationId,
        status: ApplicationStatus.INTERVIEW_SCHEDULED,
        note: `Interview scheduled on ${dto.date}${dto.link ? ` (link: ${dto.link})` : ''}`,
        createdBy: userId,
      },
    });

    return application;
  }

  async recordScore(
    applicationId: string,
    data: { score: number; comments?: string },
    userId: string,
  ) {
    const applicationToManage = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { offer: true },
    });
    if (!applicationToManage)
      throw new NotFoundException('Application not found');
    await this.ensureCanManageApplication(applicationToManage, userId);
    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        score: data.score,
        testResults: { comments: data.comments },
        status: ApplicationStatus.TEST_COMPLETED,
      },
    });

    await this.prisma.applicationTimeline.create({
      data: {
        applicationId,
        status: ApplicationStatus.TEST_COMPLETED,
        note: `Score recorded: ${data.score}${data.comments ? ` (${data.comments})` : ''}`,
        createdBy: userId,
      },
    });

    return application;
  }

  // ========== STATISTICS (for Ministry) ==========

  async getStats(filters?: { from?: Date; to?: Date; schoolId?: string }) {
    const where: any = {};
    if (filters?.from) where.submittedAt = { gte: filters.from };
    if (filters?.to)
      where.submittedAt = { ...where.submittedAt, lte: filters.to };
    if (filters?.schoolId) {
      where.offer = { schoolId: filters.schoolId };
    }

    const total = await this.prisma.application.count({ where });
    const byStatus = await this.prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    };
  }

  private async ensureCanAccessApplication(
    application: any,
    userId: string,
    role: string,
  ) {
    if (role === 'ADMIN_GET' || role === 'MINISTRY') return;
    if (role === 'STUDENT' && application.student.userId === userId) return;
    if (role === 'SCHOOL_ADMIN') {
      const admin = await this.prisma.schoolAdmin.findUnique({
        where: { userId },
      });
      if (admin?.schoolId === application.offer.schoolId) return;
    }
    throw new ForbiddenException(
      'Vous n’êtes pas autorisé à consulter ce dossier',
    );
  }

  private async ensureCanManageApplication(application: any, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, schoolAdmin: true },
    });
    if (user?.role?.name === 'ADMIN_GET') return;
    if (
      user?.role?.name === 'SCHOOL_ADMIN' &&
      user.schoolAdmin?.schoolId === application.offer.schoolId
    )
      return;
    throw new ForbiddenException(
      'Vous n’êtes pas autorisé à modifier ce dossier',
    );
  }
}
