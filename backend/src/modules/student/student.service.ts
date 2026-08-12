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

/**
 * Logique métier de l'espace étudiant : profil (avec chiffrement des
 * données sensibles), documents, cours/devoirs, orientation, statistiques,
 * notes, emploi du temps et préférences de compte. Toutes les méthodes
 * publiques prennent un `userId` (identifiant du compte User) et résolvent
 * elles-mêmes l'entité Student correspondante.
 */
@Injectable()
export class StudentService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private storageService: StorageService,
  ) {}

  /**
   * Résout l'entité Student liée à un compte utilisateur.
   * @throws NotFoundException si l'utilisateur n'a pas de profil étudiant.
   */
  private async enrolledStudent(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  /**
   * Vérifie qu'un étudiant est bien inscrit à un cours donné, ET que son
   * inscription à l'école propriétaire de ce cours est toujours ACTIVE.
   * Un retrait ou une diplomation (StudentEnrollment.status devient
   * WITHDRAWN/GRADUATED, voir SchoolService.updateEnrollment) ne supprime
   * délibérément pas les CourseEnrollment historiques — sans cette
   * seconde vérification, un étudiant retiré/diplômé garderait donc un
   * accès indéfini aux devoirs/contenus du cours (faille corrigée suite à
   * l'audit sécurité).
   * @throws NotFoundException si l'inscription n'existe pas, ou si
   * l'inscription à l'école n'est plus active.
   */
  private async courseEnrollment(studentId: string, courseId: string) {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
      include: { course: { select: { schoolId: true } } },
    });
    if (!enrollment) throw new NotFoundException('Cours introuvable');
    const schoolEnrollment = await this.prisma.studentEnrollment.findUnique({
      where: {
        studentId_schoolId: { studentId, schoolId: enrollment.course.schoolId },
      },
      select: { status: true },
    });
    if (schoolEnrollment?.status !== 'ACTIVE') {
      throw new NotFoundException('Cours introuvable');
    }
    return enrollment;
  }

  /**
   * Liste les cours (avec leur école) auxquels l'étudiant est inscrit et
   * dont l'inscription à l'école est toujours ACTIVE (voir courseEnrollment
   * pour le raisonnement — un retrait/diplomation ne doit pas laisser les
   * cours visibles indéfiniment).
   */
  async getCourses(userId: string) {
    const student = await this.enrolledStudent(userId);
    const activeSchools = await this.prisma.studentEnrollment.findMany({
      where: { studentId: student.id, status: 'ACTIVE' },
      select: { schoolId: true },
    });
    const activeSchoolIds = new Set(activeSchools.map((e) => e.schoolId));
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId: student.id },
      include: {
        course: {
          include: {
            school: true,
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    return enrollments
      .filter(({ course }) => activeSchoolIds.has(course.schoolId))
      .map(({ course }) => course);
  }

  /**
   * Liste les devoirs publiés d'un cours et rattache, pour chacun, l'unique
   * soumission de l'étudiant (s'il en a fait une). Vérifie l'inscription au
   * cours au préalable.
   */
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

  /**
   * Dépose ou remplace la soumission d'un étudiant pour un devoir publié.
   * Le fichier est uploadé vers le stockage (S3) puis l'enregistrement en
   * base est fait via upsert (une soumission par couple devoir/étudiant).
   * @throws NotFoundException si le devoir n'existe pas, n'est pas publié,
   *   ou si l'étudiant n'est pas inscrit au cours correspondant.
   * @throws ConflictException si une soumission existante a déjà été notée
   *   (règle métier : une note verrouille la soumission).
   */
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

    const { url: contentUrl } = await this.storageService.uploadDocument(
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

  /**
   * Récupère le profil complet de l'étudiant (utilisateur lié, documents
   * non supprimés, 10 dernières candidatures, inscriptions actives) et
   * déchiffre `phone`/`cin`. En cas d'échec de déchiffrement (ex. donnée
   * chiffrée avec une ancienne clé), la valeur brute est renvoyée en
   * fallback plutôt que de faire échouer toute la requête.
   * @throws NotFoundException si le profil étudiant n'existe pas.
   */
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

      // Ne jamais faire retomber une donnée sensible en clair vers le client
      // en cas d'échec de déchiffrement (ex. ENCRYPTION_KEY changée, donnée
      // corrompue) : on masque le champ plutôt que d'exposer un potentiel
      // texte en clair (voir remédiation 2026-08-10 pour les lignes legacy
      // stockées en clair avant l'ajout du chiffrement à l'inscription).
      let decryptedPhone: string | null = null;
      let decryptedCin: string | null = null;

      if (student.phone) {
        try {
          decryptedPhone = this.encryption.decrypt(student.phone);
        } catch (e) {
          console.error('❌ Erreur déchiffrement phone:', e.message);
        }
      }

      if (student.cin) {
        try {
          decryptedCin = this.encryption.decrypt(student.cin);
        } catch (e) {
          console.error('❌ Erreur déchiffrement cin:', e.message);
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

  /**
   * Met à jour les champs modifiables du profil étudiant. Recalcule
   * `profileCompleted` à partir des données fusionnées (existantes + DTO).
   * `phone` et `cin`, s'ils sont fournis, sont chiffrés avant écriture ;
   * si le chiffrement échoue, l'opération est refusée entièrement (voir
   * commentaire inline) plutôt que d'écrire la donnée en clair.
   * @throws NotFoundException si le profil étudiant n'existe pas.
   * @throws BadRequestException si le chiffrement de phone/cin échoue.
   */
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

  /**
   * Détermine si le profil est considéré comme "complet" : vrai dès que
   * 70% ou plus des champs clés (identité, contact, bac, ville, bio) sont
   * renseignés. Seuil arbitraire, pas une contrainte technique.
   */
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

  /** Liste les documents non supprimés de l'étudiant, du plus récent au plus ancien. */
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

  /**
   * Upload un document vers le stockage puis crée l'enregistrement en
   * base. Utilise le nom de fichier d'origine si `dto.name` est absent.
   */
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

  /**
   * Supprime un document de manière logique (`deletedAt` renseigné, le
   * fichier n'est pas retiré du stockage). Vérifie que le document
   * appartient bien à l'étudiant demandeur.
   * @throws NotFoundException si le profil ou le document est introuvable.
   */
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

  /**
   * Enregistre les réponses du questionnaire d'orientation sur le profil
   * étudiant (intérêts, compétences, objectifs de carrière) puis calcule
   * et retourne des suggestions de formations à partir de ces réponses.
   */
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

  /**
   * Recalcule les suggestions d'orientation à partir des réponses déjà
   * stockées sur le profil (pas besoin de resoumettre le questionnaire).
   * @throws BadRequestException si aucun intérêt n'a encore été enregistré
   *   (le questionnaire n'a jamais été complété).
   */
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

  /**
   * Calcule un score de correspondance simple (0-100) entre les réponses du
   * questionnaire et jusqu'à 10 offres de formation ouvertes, puis retourne
   * les 5 meilleures. Le scoring est une heuristique par mots-clés
   * (intitulé de l'offre contenant un intérêt/domaine, diplôme préféré,
   * mention "international"), pas un algorithme de matching sophistiqué.
   */
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

  /**
   * Construit la liste des raisons textuelles justifiant le score d'une
   * offre (utilisée pour l'affichage). Retourne un message générique si
   * aucune raison spécifique n'a été trouvée.
   */
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

  /**
   * Agrège des statistiques personnelles : répartition des candidatures par
   * statut, nombre de documents et taux de complétion du profil.
   */
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

  /** Enregistre l'URL de l'avatar déjà uploadé (l'upload lui-même est géré par le contrôleur/StorageService). */
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

  /**
   * Construit, pour chaque cours inscrit, la liste des évaluations (avec
   * la note de l'étudiant si elle existe) et des devoirs (avec la note de
   * la soumission de l'étudiant, uniquement les devoirs publiés).
   */
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

  // ========== PRÉSENCE ==========

  /**
   * Compte les présences/absences/retards de l'étudiant, tous cours
   * confondus, marqués par ses enseignants (voir TeachingService.
   * markAttendance). Historique complet, non filtré sur le statut
   * d'inscription actif — au même titre que les notes (getGrades), c'est un
   * fait passé, pas un accès en cours à révoquer.
   */
  async getAttendanceStats(userId: string) {
    const student = await this.enrolledStudent(userId);
    const records = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId: student.id },
      _count: { status: true },
    });
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
    for (const record of records) {
      if (record.status in counts) {
        counts[record.status as keyof typeof counts] = record._count.status;
      }
    }
    return {
      ...counts,
      total: counts.PRESENT + counts.ABSENT + counts.LATE,
    };
  }

  // ========== SCHEDULE ==========

  /**
   * Retourne les créneaux de cours (courseSlot) de tous les cours inscrits,
   * triés par jour puis heure de début. Retourne un tableau vide si
   * l'étudiant n'a aucune inscription (évite une requête inutile).
   */
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

  /**
   * Change le mot de passe de l'utilisateur après vérification du mot de
   * passe actuel via bcrypt. Le nouveau mot de passe est haché (bcrypt,
   * 10 rounds) avant écriture ; `sessionVersion` est incrémenté dans la
   * même mise à jour pour révoquer toutes les sessions existantes (même
   * garantie que AuthService.resetPassword — un changement de mot de passe
   * ne doit pas laisser une session compromise active).
   * @throws NotFoundException si l'utilisateur n'existe pas.
   * @throws BadRequestException si le mot de passe actuel est incorrect.
   */
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
      data: { password: hashedPassword, sessionVersion: { increment: 1 } },
    });
    return { success: true };
  }

  /** Met à jour la préférence de thème de l'utilisateur. */
  async updateTheme(userId: string, theme: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { theme },
      select: { theme: true },
    });
  }
}
