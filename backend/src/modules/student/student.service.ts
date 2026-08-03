import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { OrientationQuestionnaireDto } from './dto/orientation-questionnaire.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private storageService: StorageService,
  ) {}

  private async enrolledStudent(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  private async courseEnrollment(studentId: string, courseId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
    });
    if (!enrollment) throw new NotFoundException('Cours introuvable');
    return enrollment;
  }

  async getCourses(userId: string) {
    const student = await this.enrolledStudent(userId);
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId: student.id },
      include: { course: { include: { school: true } } },
    });
    return enrollments.map(({ course }) => course);
  }

  async getCourseAssignments(userId: string, courseId: string) {
    const student = await this.enrolledStudent(userId);
    await this.courseEnrollment(student.id, courseId);

    const assignments = await this.prisma.assignment.findMany({
      where: { courseId, publishedAt: { not: null } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        submissions: {
          where: { studentId: student.id },
          select: { id: true, submittedAt: true, grade: true },
        },
      },
    });

    return assignments.map(({ submissions, ...assignment }) => ({
      ...assignment,
      submission: submissions[0] ?? null,
    }));
  }

  async submitAssignment(
    userId: string,
    assignmentId: string,
    file: Express.Multer.File,
  ) {
    const student = await this.enrolledStudent(userId);
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, courseId: true, publishedAt: true },
    });
    if (!assignment || !assignment.publishedAt) {
      throw new NotFoundException('Devoir introuvable');
    }
    await this.courseEnrollment(student.id, assignment.courseId);

    const existingSubmission =
      await this.prisma.assignmentSubmission.findUnique({
        where: {
          assignmentId_studentId: { assignmentId, studentId: student.id },
        },
        select: { id: true, grade: true },
      });
    if (
      existingSubmission?.grade !== null &&
      existingSubmission?.grade !== undefined
    ) {
      throw new ConflictException(
        'Cette soumission a déjà été notée et ne peut plus être remplacée',
      );
    }

    const { url: contentUrl } = this.storageService.uploadDocument(
      file,
      student.id,
    );
    return this.prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: { assignmentId, studentId: student.id },
      },
      update: { contentUrl, submittedAt: new Date() },
      create: { assignmentId, studentId: student.id, contentUrl },
    });
  }

  // ========== PROFILE ==========

  async getProfile(userId: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
              theme: true,
            },
          },
          documents: {
            where: { deletedAt: null },
            orderBy: { uploadedAt: 'desc' },
          },
          applications: {
            include: {
              offer: {
                include: {
                  school: true,
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
            take: 10,
          },
          // Un étudiant peut être inscrit activement dans plusieurs écoles
          // à la fois (double diplôme, cursus parallèle) : liste, pas un
          // objet unique.
          schoolEnrollments: {
            where: { status: 'ACTIVE' },
            include: { school: true, program: true, academicYear: true },
          },
        },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      // ✅ Décryptage sécurisé avec fallback
      let decryptedPhone: string | null = null;
      let decryptedCin: string | null = null;

      if (student.phone) {
        try {
          decryptedPhone = this.encryption.decrypt(student.phone);
        } catch (e) {
          console.warn(
            '⚠️ Erreur décryptage phone, utilisation de la valeur brute:',
            e.message,
          );
          decryptedPhone = student.phone;
        }
      }

      if (student.cin) {
        try {
          decryptedCin = this.encryption.decrypt(student.cin);
        } catch (e) {
          console.warn(
            '⚠️ Erreur décryptage cin, utilisation de la valeur brute:',
            e.message,
          );
          decryptedCin = student.cin;
        }
      }

      return {
        ...student,
        phone: decryptedPhone,
        cin: decryptedCin,
        profileCompleted: this.calculateProfileCompletion(student),
      };
    } catch (error) {
      console.error('❌ Erreur getProfile:', error);
      throw error;
    }
  }

  async updateProfile(userId: string, dto: UpdateStudentProfileDto) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const profileCompleted = this.calculateProfileCompletion({
      ...student,
      ...dto,
    });

    const data: any = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      bacYear: dto.bacYear,
      bacType: dto.bacType,
      city: dto.city,
      address: dto.address,
      region: dto.region,
      bio: dto.bio,
      interests: dto.interests,
      skills: dto.skills,
      aspirations: dto.aspirations,
      profileCompleted,
    };

    if (dto.phone) {
      try {
        data.phone = this.encryption.encrypt(dto.phone);
      } catch (e) {
        // Ne jamais stocker une donnée sensible en clair en cas d'échec du
        // chiffrement : on refuse l'opération plutôt que de dégrader la
        // confidentialité silencieusement.
        throw new BadRequestException(
          'Impossible de sécuriser le numéro de téléphone, réessayez plus tard',
        );
      }
    }
    if (dto.cin) {
      try {
        data.cin = this.encryption.encrypt(dto.cin);
      } catch (e) {
        throw new BadRequestException(
          'Impossible de sécuriser le CIN, réessayez plus tard',
        );
      }
    }

    const updatedStudent = await this.prisma.student.update({
      where: { userId },
      data,
    });

    return updatedStudent;
  }

  private calculateProfileCompletion(student: any): boolean {
    const fields = [
      student.firstName,
      student.lastName,
      student.phone,
      student.birthDate,
      student.cin,
      student.bacYear,
      student.city,
      student.bio,
    ];
    const filled = fields.filter(
      (f) => f !== null && f !== undefined && f !== '',
    ).length;
    return filled / fields.length >= 0.7;
  }

  // ========== DOCUMENTS ==========

  async getDocuments(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return this.prisma.document.findMany({
      where: {
        studentId: student.id,
        deletedAt: null,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const { url: fileUrl } = await this.storageService.uploadDocument(
      file,
      student.id,
    );

    return this.prisma.document.create({
      data: {
        studentId: student.id,
        type: dto.type,
        name: dto.name || file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });
  }

  async deleteDocument(userId: string, documentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        studentId: student.id,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  // ========== ORIENTATION ==========

  async submitOrientationQuestionnaire(
    userId: string,
    dto: OrientationQuestionnaireDto,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.prisma.student.update({
      where: { userId },
      data: {
        interests: dto.interests,
        skills: dto.skills,
        aspirations: dto.careerGoals,
      },
    });

    const suggestions = await this.generateOrientationSuggestions(dto);

    return suggestions;
  }

  async getOrientationSuggestions(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (!student.interests?.length) {
      throw new BadRequestException(
        'Please complete the orientation questionnaire first',
      );
    }

    const dto: OrientationQuestionnaireDto = {
      interests: student.interests,
      skills: student.skills,
      careerGoals: student.aspirations,
    };

    return this.generateOrientationSuggestions(dto);
  }

  private async generateOrientationSuggestions(
    dto: OrientationQuestionnaireDto,
  ) {
    const offers = await this.prisma.offer.findMany({
      where: {
        isOpen: true,
        deletedAt: null,
      },
      include: {
        school: true,
      },
      take: 10,
    });

    const suggestions = offers.map((offer) => {
      let matchScore = 0;

      if (
        dto.interests.some((i) =>
          offer.title.toLowerCase().includes(i.toLowerCase()),
        )
      ) {
        matchScore += 30;
      }

      if (dto.preferredDiplomas?.some((d) => offer.diploma.includes(d))) {
        matchScore += 20;
      }

      if (
        dto.preferredDomain &&
        offer.title.toLowerCase().includes(dto.preferredDomain.toLowerCase())
      ) {
        matchScore += 30;
      }

      if (
        dto.interestedInInternational &&
        offer.title.toLowerCase().includes('international')
      ) {
        matchScore += 20;
      }

      return {
        schoolId: offer.schoolId,
        schoolName: offer.school.name,
        offerId: offer.id,
        offerTitle: offer.title,
        matchScore,
        reasons: this.generateMatchReasons(offer, dto),
      };
    });

    return suggestions
      .filter((s) => s.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }

  private generateMatchReasons(
    offer: any,
    dto: OrientationQuestionnaireDto,
  ): string[] {
    const reasons: string[] = [];

    if (
      dto.interests.some((i) =>
        offer.title.toLowerCase().includes(i.toLowerCase()),
      )
    ) {
      reasons.push('Matches your interests');
    }

    if (dto.preferredDiplomas?.some((d) => offer.diploma.includes(d))) {
      reasons.push(`Matching diploma: ${offer.diploma}`);
    }

    if (
      dto.preferredDomain &&
      offer.title.toLowerCase().includes(dto.preferredDomain.toLowerCase())
    ) {
      reasons.push(`Matches your preferred domain: ${dto.preferredDomain}`);
    }

    if (reasons.length === 0) {
      reasons.push('Recommended complementary training');
    }

    return reasons;
  }

  // ========== STATISTICS ==========

  async getStudentStats(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const applications = await this.prisma.application.findMany({
      where: { studentId: student.id },
    });

    const documents = await this.prisma.document.findMany({
      where: {
        studentId: student.id,
        deletedAt: null,
      },
    });

    return {
      totalApplications: applications.length,
      pendingApplications: applications.filter((a) => a.status === 'PENDING')
        .length,
      acceptedApplications: applications.filter((a) => a.status === 'ACCEPTED')
        .length,
      rejectedApplications: applications.filter((a) => a.status === 'REJECTED')
        .length,
      documentsUploaded: documents.length,
      profileCompletion: this.calculateProfileCompletion(student),
    };
  }

  // ========== AVATAR ==========

  async updateAvatar(userId: string, avatarUrl: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return this.prisma.student.update({
      where: { userId },
      data: { avatarUrl },
    });
  }

  // ========== GRADES ==========

  async getGrades(userId: string) {
    const student = await this.enrolledStudent(userId);
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId: student.id },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            evaluations: {
              include: {
                grades: { where: { studentId: student.id } },
              },
            },
            assignments: {
              where: { publishedAt: { not: null } },
              include: {
                submissions: {
                  where: { studentId: student.id },
                  select: { grade: true },
                },
              },
            },
          },
        },
      },
    });

    return enrollments.map(({ course }) => ({
      courseId: course.id,
      code: course.code,
      title: course.title,
      evaluations: course.evaluations.map((evaluation) => ({
        id: evaluation.id,
        title: evaluation.title,
        type: evaluation.type,
        coefficient: evaluation.coefficient,
        scheduledAt: evaluation.scheduledAt,
        value: evaluation.grades[0]?.value ?? null,
      })),
      assignments: course.assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        grade: assignment.submissions[0]?.grade ?? null,
      })),
    }));
  }

  // ========== SCHEDULE ==========

  async getSchedule(userId: string) {
    const student = await this.enrolledStudent(userId);
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId: student.id },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((enrollment) => enrollment.courseId);
    if (courseIds.length === 0) return [];

    return this.prisma.courseSlot.findMany({
      where: { courseId: { in: courseIds } },
      include: {
        course: { select: { id: true, title: true, code: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ========== SECURITY & PREFERENCES ==========

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Le mot de passe actuel est incorrect');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    return { success: true };
  }

  async updateTheme(userId: string, theme: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { theme },
      select: { theme: true },
    });
  }
}
