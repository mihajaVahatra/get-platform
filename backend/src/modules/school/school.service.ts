import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';
import {
  CreateSchoolCourseDto,
  UpdateSchoolCourseDto,
} from './dto/create-school-course.dto';
import { CreateCourseSlotDto, UpdateCourseSlotDto } from './dto/course-slot.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateSchoolProgramDto, UpdateSchoolProgramDto } from './dto/school-program.dto';
import { CreateSchoolAcademicYearDto, UpdateSchoolAcademicYearDto } from './dto/school-academic-year.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/dto/send-notification.dto';
import slugify from 'slugify';

@Injectable()
export class SchoolService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreateSchoolDto, userId: string) {
    const slug = slugify(dto.name, { lower: true, strict: true });
    const data: any = {
      name: dto.name,
      slug,
      type: dto.type,
      isActive: true,
    };
    if (dto.description) data.description = dto.description;
    if (dto.city) data.city = dto.city;
    if (dto.region) data.region = dto.region;
    if (dto.contactEmail) data.contactEmail = dto.contactEmail;
    if (dto.contactPhone) data.contactPhone = dto.contactPhone;
    if (dto.website) data.website = dto.website;

    const school = await this.prisma.school.create({ data });
    return school;
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: { city?: string; type?: string; search?: string },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    if (filters?.city)
      where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters?.type) where.type = filters.type;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          offers: {
            where: { isOpen: true, deletedAt: null },
            take: 5,
          },
        },
      }),
      this.prisma.school.count({ where }),
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

  async findOne(id: string) {
    const school = await this.prisma.school.findFirst({
      where: { id, deletedAt: null },
      include: {
        offers: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async getEnrolledStudents(
    schoolId: string,
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const searchTerms = search?.trim().split(/\s+/).filter(Boolean) || [];
    const where = {
      enrolledSchoolId: schoolId,
      deletedAt: null,
      ...(searchTerms.length
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                {
                  firstName: {
                    contains: term,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  lastName: {
                    contains: term,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  user: {
                    email: {
                      contains: term,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            })),
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          user: {
            select: { email: true },
          },
        },
      }),
      this.prisma.student.count({ where }),
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

  async getStudentClasses(schoolId: string) {
    const rows = await this.prisma.student.findMany({
      where: {
        enrolledSchoolId: schoolId,
        deletedAt: null,
        enrolledYear: { not: null },
      },
      select: { enrolledYear: true },
      distinct: ['enrolledYear'],
      orderBy: { enrolledYear: 'asc' },
    });
    return rows.flatMap((row) => (row.enrolledYear ? [row.enrolledYear] : []));
  }

  async getPrograms(schoolId: string) {
    return this.prisma.schoolProgram.findMany({
      where: { schoolId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createProgram(schoolId: string, dto: CreateSchoolProgramDto) {
    return this.prisma.schoolProgram.create({
      data: { schoolId, name: dto.name.trim(), diploma: dto.diploma.trim(), durationYears: dto.durationYears },
    });
  }

  async updateProgram(schoolId: string, id: string, dto: UpdateSchoolProgramDto) {
    const program = await this.prisma.schoolProgram.findFirst({ where: { id, schoolId } });
    if (!program) throw new NotFoundException('Filière introuvable');
    if (dto.durationYears && dto.durationYears < program.durationYears) {
      const higherLevelStudent = await this.prisma.student.findFirst({ where: { programId: id, programLevel: { gt: dto.durationYears }, deletedAt: null } });
      if (higherLevelStudent) throw new BadRequestException('La durée ne peut pas être inférieure au niveau d’un étudiant inscrit');
    }
    const updated = await this.prisma.schoolProgram.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.diploma !== undefined ? { diploma: dto.diploma.trim() } : {}),
        ...(dto.durationYears !== undefined ? { durationYears: dto.durationYears } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    if (dto.name !== undefined) await this.refreshProgramEnrollmentLabels(id, updated.name);
    return updated;
  }

  async getAcademicYears(schoolId: string) {
    return this.prisma.schoolAcademicYear.findMany({ where: { schoolId }, orderBy: [{ isCurrent: 'desc' }, { enrollmentOpensAt: 'desc' }] });
  }

  async createAcademicYear(schoolId: string, dto: CreateSchoolAcademicYearDto) {
    this.assertEnrollmentPeriod(dto.enrollmentOpensAt, dto.enrollmentClosesAt);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) await tx.schoolAcademicYear.updateMany({ where: { schoolId, isCurrent: true }, data: { isCurrent: false } });
      return tx.schoolAcademicYear.create({ data: { schoolId, label: dto.label.trim(), enrollmentOpensAt: new Date(dto.enrollmentOpensAt), enrollmentClosesAt: new Date(dto.enrollmentClosesAt), isCurrent: dto.isCurrent ?? false } });
    });
  }

  async updateAcademicYear(schoolId: string, id: string, dto: UpdateSchoolAcademicYearDto) {
    const academicYear = await this.prisma.schoolAcademicYear.findFirst({ where: { id, schoolId } });
    if (!academicYear) throw new NotFoundException('Année académique introuvable');
    const opensAt = dto.enrollmentOpensAt || academicYear.enrollmentOpensAt.toISOString();
    const closesAt = dto.enrollmentClosesAt || academicYear.enrollmentClosesAt.toISOString();
    this.assertEnrollmentPeriod(opensAt, closesAt);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) await tx.schoolAcademicYear.updateMany({ where: { schoolId, isCurrent: true, id: { not: id } }, data: { isCurrent: false } });
      return tx.schoolAcademicYear.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
          ...(dto.enrollmentOpensAt !== undefined ? { enrollmentOpensAt: new Date(dto.enrollmentOpensAt) } : {}),
          ...(dto.enrollmentClosesAt !== undefined ? { enrollmentClosesAt: new Date(dto.enrollmentClosesAt) } : {}),
          ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}),
        },
      });
    });
    if (dto.label !== undefined) await this.refreshAcademicYearEnrollmentLabels(id, updated.label);
    return updated;
  }

  private assertEnrollmentPeriod(opensAt: string, closesAt: string) {
    if (new Date(closesAt).getTime() < new Date(opensAt).getTime()) throw new BadRequestException("La date de fermeture doit être postérieure à la date d'ouverture");
  }

  private async refreshProgramEnrollmentLabels(programId: string, programName: string) {
    const students = await this.prisma.student.findMany({ where: { programId, deletedAt: null }, select: { id: true, programLevel: true, academicYear: { select: { label: true } } } });
    await this.prisma.$transaction(students.map((student) => this.prisma.student.update({ where: { id: student.id }, data: { enrolledYear: this.enrollmentLabel(programName, student.programLevel, student.academicYear?.label) } })));
  }

  private async refreshAcademicYearEnrollmentLabels(academicYearId: string, academicYearLabel: string) {
    const students = await this.prisma.student.findMany({ where: { academicYearId, deletedAt: null }, select: { id: true, programLevel: true, program: { select: { name: true } } } });
    await this.prisma.$transaction(students.map((student) => this.prisma.student.update({ where: { id: student.id }, data: { enrolledYear: this.enrollmentLabel(student.program?.name, student.programLevel, academicYearLabel) } })));
  }

  private enrollmentLabel(programName?: string | null, level?: number | null, academicYearLabel?: string | null) {
    return programName && level && academicYearLabel ? `Année ${level} · ${programName} · ${academicYearLabel}` : null;
  }

  async getStudentDocuments(
    schoolId: string,
    page = 1,
    limit = 20,
    enrolledYear?: string,
    type?: string,
    search?: string,
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const allowedTypes = ['CV', 'LETTER', 'ID', 'DIPLOMA', 'PHOTO', 'OTHER'];
    if (type && !allowedTypes.includes(type)) {
      throw new BadRequestException('Type de document invalide');
    }
    const terms = search?.trim().split(/\s+/).filter(Boolean) || [];
    const where = {
      deletedAt: null,
      ...(type ? { type } : {}),
      student: {
        enrolledSchoolId: schoolId,
        deletedAt: null,
        ...(enrolledYear ? { enrolledYear } : {}),
        ...(terms.length
          ? {
              AND: terms.map((term) => ({
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' as const } },
                  { lastName: { contains: term, mode: 'insensitive' as const } },
                ],
              })),
            }
          : {}),
      },
    };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              enrolledYear: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
      }),
      this.prisma.document.count({ where }),
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

  async enrollStudent(schoolId: string, dto: EnrollStudentDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { role: { select: { name: true } }, student: true },
    });
    if (!user?.student || user.role?.name !== 'STUDENT' || user.student.deletedAt) {
      throw new NotFoundException('Aucun compte étudiant trouvé pour cet e-mail');
    }
    if (
      user.student.enrolledSchoolId &&
      user.student.enrolledSchoolId !== schoolId
    ) {
      throw new ConflictException(
        "Cet étudiant est déjà inscrit dans un autre établissement. Un transfert doit être traité explicitement.",
      );
    }

    const academicYear = await this.prisma.schoolAcademicYear.findFirst({ where: { id: dto.academicYearId, schoolId } });
    if (!academicYear) throw new NotFoundException('Année académique introuvable');
    const now = new Date();
    if (now < academicYear.enrollmentOpensAt || now > academicYear.enrollmentClosesAt) throw new ForbiddenException(`Les inscriptions pour cette année académique ne sont pas ouvertes actuellement (période : ${academicYear.enrollmentOpensAt.toLocaleDateString('fr-FR')} – ${academicYear.enrollmentClosesAt.toLocaleDateString('fr-FR')}).`);
    const program = await this.prisma.schoolProgram.findFirst({ where: { id: dto.programId, schoolId, isActive: true } });
    if (!program) throw new NotFoundException('Filière introuvable ou archivée');
    if (dto.level > program.durationYears) throw new BadRequestException(`Ce programme ne compte que ${program.durationYears} année(s)`);
    const enrolledYear = this.enrollmentLabel(program.name, dto.level, academicYear.label);
    return this.prisma.student.update({
      where: { id: user.student.id },
      data: { enrolledSchoolId: schoolId, programId: dto.programId, programLevel: dto.level, academicYearId: dto.academicYearId, enrolledYear },
      include: { user: { select: { email: true } } },
    });
  }

  async createAnnouncement(
    schoolId: string,
    senderId: string,
    dto: CreateAnnouncementDto,
  ) {
    const classes = dto.classes?.filter(Boolean) || [];
    const studentIds = dto.studentIds || [];
    const teacherIds = dto.teacherIds || [];
    if (dto.targetType === 'CLASSES' && classes.length === 0) {
      throw new BadRequestException('Au moins une classe doit être sélectionnée');
    }
    if (dto.targetType === 'STUDENTS' && studentIds.length === 0) {
      throw new BadRequestException('Au moins un étudiant doit être sélectionné');
    }
    if (dto.targetType === 'TEACHERS' && teacherIds.length === 0) {
      throw new BadRequestException('Au moins un professeur doit être sélectionné');
    }

    let userIds: string[] = [];
    if (dto.targetType === 'TEACHERS') {
      const teachers = await this.prisma.teacherSchool.findMany({
        where: { teacherId: { in: teacherIds }, schoolId, isActive: true },
        select: { teacher: { select: { userId: true } } },
      });
      userIds = teachers.map((assignment) => assignment.teacher.userId);
    } else {
      const students = await this.prisma.student.findMany({
        where: {
          enrolledSchoolId: schoolId,
          deletedAt: null,
          ...(dto.targetType === 'CLASSES' ? { enrolledYear: { in: classes } } : {}),
          ...(dto.targetType === 'STUDENTS' ? { id: { in: studentIds } } : {}),
        },
        select: { userId: true },
      });
      userIds = students.map((student) => student.userId);
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        schoolId,
        authorId: senderId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        targetType: dto.targetType,
        targetClasses: dto.targetType === 'CLASSES' ? classes : [],
      },
    });
    const recipientIds = [...new Set(userIds)];
    const recipients: Array<{ userId: string; notificationId: string }> = [];

    const batchSize = 25;
    for (let index = 0; index < recipientIds.length; index += batchSize) {
      const results = await Promise.all(
        recipientIds.slice(index, index + batchSize).map(async (userId) => ({
          userId,
          result: await this.notificationService.send({
            userId,
            type: NotificationType.IN_APP,
            title: announcement.title,
            body: announcement.body,
          }),
        })),
      );
      for (const { userId, result } of results) {
        if (result.success && result.notificationId) {
          recipients.push({ userId, notificationId: result.notificationId });
        }
      }
    }
    if (recipients.length) {
      await this.prisma.announcementRecipient.createMany({ data: recipients.map((recipient) => ({ announcementId: announcement.id, ...recipient })) });
    }

    return { announcementId: announcement.id, recipientCount: recipients.length };
  }

  async getAnnouncements(schoolId: string, page = 1, limit = 20) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        include: {
          recipients: { select: { notification: { select: { isRead: true } } } },
        },
      }),
      this.prisma.announcement.count({ where: { schoolId } }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        targetType: item.targetType,
        targetClasses: item.targetClasses,
        createdAt: item.createdAt,
        recipientCount: item.recipients.length,
        readCount: item.recipients.filter((recipient) => recipient.notification.isRead).length,
      })),
      meta: { page: currentPage, limit: currentLimit, total, totalPages: Math.ceil(total / currentLimit) },
    };
  }

  async getReportPipeline(schoolId: string) {
    const stages = [
      'PENDING',
      'PRESELECTED',
      'TEST_SCHEDULED',
      'TEST_COMPLETED',
      'INTERVIEW_SCHEDULED',
      'INTERVIEW_COMPLETED',
    ];
    const grouped = await this.prisma.application.groupBy({
      by: ['status'],
      where: { deletedAt: null, offer: { schoolId, deletedAt: null } },
      _count: true,
    });
    const counts = new Map(grouped.map((item) => [item.status, item._count]));
    return stages.map((status) => ({ status, count: counts.get(status) || 0 }));
  }

  async getReportOutcomes(schoolId: string) {
    const grouped = await this.prisma.application.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        offer: { schoolId, deletedAt: null },
        status: { in: ['ACCEPTED', 'REJECTED', 'WAITLISTED'] },
      },
      _count: true,
    });
    const counts = new Map(grouped.map((item) => [item.status, item._count]));
    return {
      accepted: counts.get('ACCEPTED') || 0,
      rejected: counts.get('REJECTED') || 0,
      waitlisted: counts.get('WAITLISTED') || 0,
    };
  }

  async getReportTrend(schoolId: string, months = 6) {
    const currentMonths = Math.min(Math.max(Number(months) || 6, 1), 24);
    return this.prisma.$queryRaw<{ period: Date; count: number }[]>`
      SELECT DATE_TRUNC('month', a."submittedAt") as period,
      COUNT(*)::int as count
      FROM applications a
      JOIN offers o ON a."offerId" = o.id
      WHERE o."schoolId" = ${schoolId}
        AND a."deletedAt" IS NULL
        AND o."deletedAt" IS NULL
      GROUP BY period
      ORDER BY period ASC
      LIMIT ${currentMonths}
    `;
  }

  async getReportByClass(schoolId: string) {
    const grouped = await this.prisma.student.groupBy({
      by: ['enrolledYear'],
      where: {
        enrolledSchoolId: schoolId,
        deletedAt: null,
        enrolledYear: { not: null },
      },
      _count: true,
      orderBy: { enrolledYear: 'asc' },
    });
    return grouped.map((item) => ({ enrolledYear: item.enrolledYear, count: item._count }));
  }

  async getReportByOffer(schoolId: string) {
    const grouped = await this.prisma.application.groupBy({
      by: ['offerId'],
      where: { deletedAt: null, offer: { schoolId, deletedAt: null } },
      _count: true,
    });
    const top = grouped.sort((left, right) => right._count - left._count).slice(0, 10);
    const offers = await this.prisma.offer.findMany({
      where: { id: { in: top.map((item) => item.offerId) }, schoolId, deletedAt: null },
      select: { id: true, title: true },
    });
    const titles = new Map(offers.map((offer) => [offer.id, offer.title]));
    return top.map((item) => ({
      offerId: item.offerId,
      title: titles.get(item.offerId) || 'Offre supprimée',
      count: item._count,
    }));
  }

  async exportCsv(schoolId: string, type: 'applications' | 'students') {
    if (type === 'students') {
      const students = await this.prisma.student.findMany({
        where: { enrolledSchoolId: schoolId, deletedAt: null },
        include: { user: { select: { email: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      return this.toCsv(
        ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Ville', 'Année d’inscription'],
        students.map((student) => [
          student.firstName,
          student.lastName,
          student.user.email,
          student.phone,
          student.city,
          student.enrolledYear,
        ]),
      );
    }

    const applications = await this.prisma.application.findMany({
      where: { deletedAt: null, offer: { schoolId, deletedAt: null } },
      include: {
        student: { include: { user: { select: { email: true } } } },
        offer: { select: { title: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return this.toCsv(
      ['Prénom', 'Nom', 'E-mail', 'Offre', 'Statut', 'Date de soumission'],
      applications.map((application) => [
        application.student.firstName,
        application.student.lastName,
        application.student.user.email,
        application.offer.title,
        application.status,
        application.submittedAt.toISOString(),
      ]),
    );
  }

  async getTeacherAssignments(schoolId: string) {
    return this.prisma.teacherSchool.findMany({
      where: { schoolId, isActive: true },
      include: {
        teacher: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        subjects: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubjects(schoolId: string) { return this.prisma.schoolSubject.findMany({ where: { schoolId }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }); }
  async createSubject(schoolId: string, name: string) { return this.prisma.schoolSubject.create({ data: { schoolId, name: name.trim() } }); }
  async updateSubject(schoolId: string, id: string, isActive: boolean) { const subject = await this.prisma.schoolSubject.findFirst({ where: { id, schoolId } }); if (!subject) throw new NotFoundException('Matière introuvable'); return this.prisma.schoolSubject.update({ where: { id }, data: { isActive } }); }

  async assignTeacher(schoolId: string, dto: AssignTeacherDto) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: dto.teacherId },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const assignment = await this.prisma.teacherSchool.upsert({
      where: {
        teacherId_schoolId: {
          teacherId: dto.teacherId,
          schoolId,
        },
      },
      create: {
        teacherId: dto.teacherId,
        schoolId,
        department: dto.department,
        specialty: dto.specialty,
      },
      update: {
        department: dto.department,
        specialty: dto.specialty,
        isActive: true,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: { email: true },
            },
          },
        }, subjects: { include: { subject: true } },
      },
    });
    if (dto.subjectIds) await this.syncTeacherSubjects(schoolId, assignment.id, dto.subjectIds);
    return this.prisma.teacherSchool.findUnique({ where: { id: assignment.id }, include: { teacher: { include: { user: { select: { email: true } } } }, subjects: { include: { subject: true } } } });
  }

  async updateTeacherAssignment(
    schoolId: string,
    teacherSchoolId: string,
    dto: UpdateTeacherAssignmentDto,
  ) {
    const assignment = await this.prisma.teacherSchool.findFirst({
      where: { id: teacherSchoolId, schoolId },
    });
    if (!assignment) throw new NotFoundException('Teacher assignment not found');

    const updated = await this.prisma.teacherSchool.update({
      where: { id: teacherSchoolId },
      data: {
        department: dto.department,
        specialty: dto.specialty,
        isActive: dto.isActive,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: { email: true },
            },
          },
        }, subjects: { include: { subject: true } },
      },
    });
    if (dto.subjectIds) await this.syncTeacherSubjects(schoolId, teacherSchoolId, dto.subjectIds);
    return updated;
  }

  async findTeacherByEmail(email: string) { const teacher = await this.prisma.teacher.findFirst({ where: { user: { email: { equals: email.trim(), mode: 'insensitive' } } }, include: { user: true } }); if (!teacher) throw new NotFoundException('Aucun compte professeur trouvé pour cet e-mail'); return teacher; }
  private async syncTeacherSubjects(schoolId: string, teacherSchoolId: string, subjectIds: string[]) { const subjects = await this.prisma.schoolSubject.findMany({ where: { id: { in: subjectIds }, schoolId, isActive: true }, select: { id: true } }); await this.prisma.$transaction([this.prisma.teacherSchoolSubject.deleteMany({ where: { teacherSchoolId } }), this.prisma.teacherSchoolSubject.createMany({ data: subjects.map((subject) => ({ teacherSchoolId, subjectId: subject.id })), skipDuplicates: true })]); }

  async getCourses(schoolId: string) {
    return this.prisma.course.findMany({
      where: { schoolId },
      include: {
        teacher: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { title: 'asc' },
    });
  }

  async getSchedule(schoolId: string) {
    return this.prisma.courseSlot.findMany({
      where: { course: { schoolId } },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            level: true,
            group: true,
            teacher: { select: { user: { select: { email: true } } } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createCourseSlot(
    schoolId: string,
    courseId: string,
    dto: CreateCourseSlotDto,
  ) {
    await this.ensureSchoolCourse(schoolId, courseId);
    this.assertSlotTimes(dto.startTime, dto.endTime);
    await this.ensureNoRoomConflict(schoolId, dto);

    return this.prisma.courseSlot.create({ data: { courseId, ...dto } });
  }

  async updateCourseSlot(
    schoolId: string,
    courseId: string,
    slotId: string,
    dto: UpdateCourseSlotDto,
  ) {
    await this.ensureSchoolCourse(schoolId, courseId);
    const slot = await this.prisma.courseSlot.findFirst({
      where: { id: slotId, courseId },
    });
    if (!slot) throw new NotFoundException('Course slot not found');

    const candidate = {
      dayOfWeek: dto.dayOfWeek ?? slot.dayOfWeek,
      startTime: dto.startTime ?? slot.startTime,
      endTime: dto.endTime ?? slot.endTime,
      room: dto.room ?? slot.room,
    };
    this.assertSlotTimes(candidate.startTime, candidate.endTime);
    await this.ensureNoRoomConflict(schoolId, candidate, slotId);

    return this.prisma.courseSlot.update({ where: { id: slotId }, data: dto });
  }

  async deleteCourseSlot(schoolId: string, courseId: string, slotId: string) {
    await this.ensureSchoolCourse(schoolId, courseId);
    const slot = await this.prisma.courseSlot.findFirst({
      where: { id: slotId, courseId },
    });
    if (!slot) throw new NotFoundException('Course slot not found');
    return this.prisma.courseSlot.delete({ where: { id: slotId } });
  }

  async getPayments(schoolId: string, page = 1, limit = 5, status?: string) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 5, 1), 100);
    const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    if (status && !statuses.includes(status)) {
      throw new BadRequestException('Statut de paiement invalide');
    }
    const where = {
      application: {
        deletedAt: null,
        offer: { schoolId, deletedAt: null },
      },
      ...(status ? { status } : {}),
    };

    const [payments, total, completedPayments, pendingPayments, failedPayments, completedAmount] =
      await Promise.all([
        this.prisma.payment.findMany({
          where,
          skip: (currentPage - 1) * currentLimit,
          take: currentLimit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            paidAt: true,
            createdAt: true,
            student: {
              select: {
                firstName: true,
                lastName: true,
                user: { select: { email: true } },
              },
            },
            application: {
              select: { offer: { select: { title: true } } },
            },
          },
        }),
        this.prisma.payment.count({ where }),
        this.prisma.payment.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.payment.count({
          where: { ...where, status: { in: ['PENDING', 'PROCESSING'] } },
        }),
        this.prisma.payment.count({ where: { ...where, status: 'FAILED' } }),
        this.prisma.payment.aggregate({
          where: { ...where, status: 'COMPLETED' },
          _sum: { amount: true },
        }),
      ]);

    return {
      items: payments,
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
      summary: {
        totalPayments: total,
        completedPayments,
        pendingPayments,
        failedPayments,
        completedAmount: completedAmount._sum.amount ?? 0,
      },
    };
  }

  async createCourse(schoolId: string, dto: CreateSchoolCourseDto) {
    await this.ensureActiveTeacherAssignment(schoolId, dto.teacherId);
    const subject = await this.prisma.schoolSubject.findFirst({ where: { id: dto.subjectId, schoolId, isActive: true } });
    const program = await this.prisma.schoolProgram.findFirst({ where: { id: dto.programId, schoolId, isActive: true } });
    if (!subject || !program) throw new NotFoundException('Matière ou filière introuvable');
    if (dto.programLevel > program.durationYears) throw new BadRequestException(`Ce programme ne compte que ${program.durationYears} année(s)`);

    return this.prisma.course.create({
      data: {
        schoolId,
        teacherId: dto.teacherId,
        code: dto.code,
        title: subject.name, subjectId: subject.id, programId: program.id, programLevel: dto.programLevel,
        description: dto.description,
        level: `Année ${dto.programLevel} · ${program.name}`,
        group: dto.group,
        credits: dto.credits ?? 0,
        room: dto.room,
        schedule: dto.schedule,
        isPublished: dto.isPublished ?? true,
      },
      include: {
        teacher: {
          include: { user: { select: { email: true } } },
        },
      },
    });
  }

  async updateCourse(
    schoolId: string,
    courseId: string,
    dto: UpdateSchoolCourseDto,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId },
    });
    if (!course) throw new NotFoundException('Course not found');

    const teacherId = dto.teacherId ?? course.teacherId;
    await this.ensureActiveTeacherAssignment(schoolId, teacherId);

    const subject = dto.subjectId ? await this.prisma.schoolSubject.findFirst({ where: { id: dto.subjectId, schoolId, isActive: true } }) : null;
    const program = dto.programId ? await this.prisma.schoolProgram.findFirst({ where: { id: dto.programId, schoolId, isActive: true } }) : null;
    if (dto.subjectId && !subject || dto.programId && !program) throw new NotFoundException('Matière ou filière introuvable');
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        teacherId,
        code: dto.code,
        title: subject?.name,
        subjectId: dto.subjectId,
        programId: dto.programId,
        programLevel: dto.programLevel,
        description: dto.description,
        level: program && dto.programLevel ? `Année ${dto.programLevel} · ${program.name}` : undefined,
        group: dto.group,
        credits: dto.credits,
        room: dto.room,
        schedule: dto.schedule,
        isPublished: dto.isPublished,
      },
      include: {
        teacher: {
          include: { user: { select: { email: true } } },
        },
      },
    });
  }

  private async ensureActiveTeacherAssignment(
    schoolId: string,
    teacherId: string,
  ) {
    const assignment = await this.prisma.teacherSchool.findFirst({
      where: { schoolId, teacherId, isActive: true },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Le professeur doit être activement affecté à cet établissement',
      );
    }
  }

  private toCsv(headers: string[], rows: Array<Array<string | null | undefined>>) {
    const escape = (value: string | null | undefined) => {
      const normalized = String(value ?? '').replace(/"/g, '""');
      return /[",\r\n]/.test(normalized) ? `"${normalized}"` : normalized;
    };
    return Buffer.from(`\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}\r\n`, 'utf-8');
  }

  private async ensureSchoolCourse(schoolId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private assertSlotTimes(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(
        "L'heure de fin doit être postérieure à l'heure de début",
      );
    }
  }

  private async ensureNoRoomConflict(
    schoolId: string,
    slot: Pick<CreateCourseSlotDto, 'dayOfWeek' | 'startTime' | 'endTime' | 'room'>,
    excludedSlotId?: string,
  ) {
    const conflict = await this.prisma.courseSlot.findFirst({
      where: {
        ...(excludedSlotId ? { id: { not: excludedSlotId } } : {}),
        dayOfWeek: slot.dayOfWeek,
        room: slot.room,
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime },
        course: { schoolId },
      },
    });
    if (conflict) {
      throw new BadRequestException(
        'Ce créneau chevauche déjà un autre cours dans cette salle',
      );
    }
  }

  async update(id: string, dto: UpdateSchoolDto, userId: string) {
    await this.findOne(id);
    const slug = dto.name
      ? slugify(dto.name, { lower: true, strict: true })
      : undefined;
    return this.prisma.school.update({
      where: { id },
      data: {
        ...dto,
        slug,
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id);
    return this.prisma.school.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ========== LOGO ==========

  async updateLogo(schoolId: string, logoUrl: string) {
    const school = await this.findOne(schoolId);
    return this.prisma.school.update({
      where: { id: schoolId },
      data: { logo: logoUrl },
    });
  }
}
