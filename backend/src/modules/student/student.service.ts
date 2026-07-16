import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { OrientationQuestionnaireDto } from './dto/orientation-questionnaire.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  // ========== PROFILE ==========

  async getProfile(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
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
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    //Déchiffrer les données sensibles avant de les renvoyer
    return {
      ...student,
      phone: student.phone ? this.encryption.decrypt(student.phone) : null,
      cin: student.cin ? this.encryption.decrypt(student.cin) : null,
      profileCompleted: this.calculateProfileCompletion(student),
    };
  }

  async updateProfile(userId: string, dto: UpdateStudentProfileDto) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const profileCompleted = this.calculateProfileCompletion({ ...student, ...dto });

    //Construire les données à mettre à jour avec chiffrement
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

    //Chiffrer les données sensibles avant l'enregistrement
    if (dto.phone) data.phone = this.encryption.encrypt(dto.phone);
    if (dto.cin) data.cin = this.encryption.encrypt(dto.cin);

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
    const filled = fields.filter(f => f !== null && f !== undefined && f !== '').length;
    // Profile is considered complete if at least 70% of fields are filled
    return (filled / fields.length) >= 0.7;
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

    // Mock storage - will be replaced with S3/MinIO later
    const fileUrl = `https://storage.get.mg/documents/${student.id}/${Date.now()}-${file.originalname}`;

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
      throw new BadRequestException('Please complete the orientation questionnaire first');
    }

    const dto: OrientationQuestionnaireDto = {
      interests: student.interests,
      skills: student.skills,
      careerGoals: student.aspirations,
    };

    return this.generateOrientationSuggestions(dto);
  }

  private async generateOrientationSuggestions(dto: OrientationQuestionnaireDto) {
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

      if (dto.interests.some((i) => offer.title.toLowerCase().includes(i.toLowerCase()))) {
        matchScore += 30;
      }

      if (dto.preferredDiplomas?.some((d) => offer.diploma.includes(d))) {
        matchScore += 20;
      }

      if (dto.preferredDomain && offer.title.toLowerCase().includes(dto.preferredDomain.toLowerCase())) {
        matchScore += 30;
      }

      if (dto.interestedInInternational && offer.title.toLowerCase().includes('international')) {
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

  private generateMatchReasons(offer: any, dto: OrientationQuestionnaireDto): string[] {
    const reasons: string[] = [];

    if (dto.interests.some((i) => offer.title.toLowerCase().includes(i.toLowerCase()))) {
      reasons.push('Matches your interests');
    }

    if (dto.preferredDiplomas?.some((d) => offer.diploma.includes(d))) {
      reasons.push(`Matching diploma: ${offer.diploma}`);
    }

    if (dto.preferredDomain && offer.title.toLowerCase().includes(dto.preferredDomain.toLowerCase())) {
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
      pendingApplications: applications.filter((a) => a.status === 'PENDING').length,
      acceptedApplications: applications.filter((a) => a.status === 'ACCEPTED').length,
      rejectedApplications: applications.filter((a) => a.status === 'REJECTED').length,
      documentsUploaded: documents.length,
      profileCompletion: this.calculateProfileCompletion(student),
    };
  }
}