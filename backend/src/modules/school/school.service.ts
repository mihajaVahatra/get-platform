import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';
import {
  CreateSchoolCourseDto,
  UpdateSchoolCourseDto,
} from './dto/create-school-course.dto';
import {
  CreateCourseSlotDto,
  UpdateCourseSlotDto,
} from './dto/course-slot.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import {
  CreateSchoolProgramDto,
  UpdateSchoolProgramDto,
} from './dto/school-program.dto';
import {
  CreateSchoolAcademicYearDto,
  UpdateSchoolAcademicYearDto,
} from './dto/school-academic-year.dto';
import { NotificationService } from '../notification/notification.service';
import { AnnouncementService } from '../announcement/announcement.service';
import { TeacherAvailabilityService } from '../teacher-availability/teacher-availability.service';
import slugify from 'slugify';

/**
 * Service métier de gestion des écoles partenaires.
 *
 * Regroupe l'ensemble de la logique applicative liée aux écoles :
 * - CRUD des établissements, filières (programs) et années académiques ;
 * - inscription des étudiants (avec synchronisation automatique de leurs
 *   inscriptions aux cours) et suivi de leur parcours (documents, classes) ;
 * - gestion des enseignants (affectations, matières) ainsi que des cours et
 *   de l'emploi du temps (créneaux horaires, détection de conflits de salle
 *   et de disponibilité enseignant) ;
 * - annonces ciblées ou diffusées à l'ensemble des écoles, avec envoi des
 *   notifications associées ;
 * - paiements, rapports statistiques et exports CSV.
 *
 * La quasi-totalité des méthodes est isolée par `schoolId` afin de garantir
 * l'étanchéité des données entre établissements.
 */
@Injectable()
export class SchoolService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private announcementService: AnnouncementService,
    private teacherAvailabilityService: TeacherAvailabilityService,
  ) {}

  /**
   * Aligne les inscriptions aux cours (`CourseEnrollment`) d'un étudiant sur
   * les cours publiés du programme/niveau courant : supprime les inscriptions
   * aux cours qui ne correspondent plus, puis crée (upsert) celles manquantes.
   * Appelée après toute création/modification d'inscription à une école.
   * Si un client de transaction `tx` est fourni (ex: webhook de paiement déjà
   * dans une transaction), les opérations sont exécutées séquentiellement sur
   * ce client au lieu d'ouvrir une nouvelle transaction imbriquée (non
   * supporté par Prisma).
   */
  async syncCourseEnrollments(
    studentId: string,
    schoolId: string,
    programId: string,
    programLevel: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const courses = await client.course.findMany({
      where: { schoolId, programId, programLevel, isPublished: true },
      select: { id: true },
    });

    const operations = [
      client.courseEnrollment.deleteMany({
        where: {
          studentId,
          courseId: { notIn: courses.map((course) => course.id) },
          course: { schoolId },
        },
      }),
      ...courses.map((course) =>
        client.courseEnrollment.upsert({
          where: {
            courseId_studentId: { courseId: course.id, studentId },
          },
          update: {},
          create: { courseId: course.id, studentId },
        }),
      ),
    ];

    if (tx) {
      // Déjà à l'intérieur d'une transaction appelante (ex: webhook de
      // paiement) : Prisma ne permet pas d'imbriquer un $transaction, on
      // exécute donc les opérations séquentiellement sur le même client.
      for (const operation of operations) {
        await operation;
      }
    } else {
      await this.prisma.$transaction(operations);
    }
  }

  /**
   * Crée un nouvel établissement scolaire, actif par défaut.
   * Le `slug` est dérivé automatiquement du nom (utile pour les URLs
   * publiques). Les champs optionnels du DTO ne sont inclus dans les données
   * insérées que s'ils sont renseignés.
   */
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

  /**
   * Liste paginée des écoles non supprimées, avec un aperçu de leurs offres
   * ouvertes (5 max) et le nombre d'étudiants inscrits. Filtrable par ville,
   * type d'établissement, et recherche textuelle (nom/description).
   * `page`/`limit` sont bornés (page >= 1, 1 <= limit <= 100).
   */
  async findAll(
    page = 1,
    limit = 20,
    filters?: { city?: string; type?: string; search?: string },
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (currentPage - 1) * currentLimit;
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
        take: currentLimit,
        orderBy: { name: 'asc' },
        include: {
          offers: {
            where: { isOpen: true, deletedAt: null },
            take: 5,
          },
          _count: {
            select: { enrolledStudents: true },
          },
        },
      }),
      this.prisma.school.count({ where }),
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

  /**
   * Récupère une école par son identifiant (avec ses offres non supprimées).
   * @throws NotFoundException si l'école n'existe pas ou a été supprimée.
   */
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

  /**
   * Vue transversale (multi-écoles) des étudiants activement inscrits,
   * paginée, avec recherche par prénom/nom/e-mail (tous les termes doivent
   * matcher, un terme par mot de la recherche). `schoolId` optionnel permet
   * de restreindre à une seule école ; sans lui la liste couvre toutes les
   * écoles.
   */
  async getAllEnrolledStudents(
    page = 1,
    limit = 20,
    search?: string,
    schoolId?: string,
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const searchTerms = search?.trim().split(/\s+/).filter(Boolean) || [];
    const studentSearch = searchTerms.length
      ? {
          AND: searchTerms.map((term) => ({
            OR: [
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { lastName: { contains: term, mode: 'insensitive' as const } },
              { user: { email: { contains: term, mode: 'insensitive' as const } } },
            ],
          })),
        }
      : {};
    const where = {
      status: 'ACTIVE',
      ...(schoolId ? { schoolId } : {}),
      student: { deletedAt: null, ...studentSearch },
    };
    const [items, total] = await Promise.all([
      this.prisma.studentEnrollment.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: [
          { student: { lastName: 'asc' } },
          { student: { firstName: 'asc' } },
        ],
        include: {
          student: { include: { user: { select: { email: true } } } },
          school: { select: { id: true, name: true } },
        },
      }),
      this.prisma.studentEnrollment.count({ where }),
    ]);
    return {
      items: items.map((enrollment) => ({
        ...enrollment.student,
        enrolledYear: enrollment.enrolledYear,
        enrolledSchool: enrollment.school,
      })),
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  /**
   * Variante de {@link getAllEnrolledStudents} restreinte à une seule école
   * (équivalent fonctionnel avec `schoolId` obligatoire). Mêmes règles de
   * pagination et de recherche multi-critères.
   */
  async getEnrolledStudents(
    schoolId: string,
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const searchTerms = search?.trim().split(/\s+/).filter(Boolean) || [];
    const studentSearch = searchTerms.length
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
      : {};
    const where = {
      schoolId,
      status: 'ACTIVE',
      student: { deletedAt: null, ...studentSearch },
    };
    const [items, total] = await Promise.all([
      this.prisma.studentEnrollment.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: [
          { student: { lastName: 'asc' } },
          { student: { firstName: 'asc' } },
        ],
        include: {
          student: { include: { user: { select: { email: true } } } },
        },
      }),
      this.prisma.studentEnrollment.count({ where }),
    ]);

    return {
      items: items.map((enrollment) => ({
        ...enrollment.student,
        enrolledYear: enrollment.enrolledYear,
      })),
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  /**
   * Détail complet d'un étudiant inscrit dans une école donnée (profil,
   * filière, année académique, niveau et statut d'inscription).
   * @throws NotFoundException si l'inscription n'existe pas ou si le compte
   * étudiant a été supprimé (soft delete).
   */
  async getStudentDetail(schoolId: string, studentId: string) {
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { studentId_schoolId: { studentId, schoolId } },
      include: {
        student: { include: { user: { select: { email: true } } } },
        program: true,
        academicYear: true,
      },
    });
    if (!enrollment || enrollment.student.deletedAt)
      throw new NotFoundException('Étudiant inscrit introuvable');
    return {
      ...enrollment.student,
      program: enrollment.program,
      academicYear: enrollment.academicYear,
      programLevel: enrollment.programLevel,
      enrolledYear: enrollment.enrolledYear,
      enrollmentStatus: enrollment.status,
    };
  }

  /**
   * Liste distincte des libellés de classe (`enrolledYear`) des étudiants
   * actifs d'une école, triée par ordre alphabétique. Sert à peupler les
   * filtres/sélecteurs de classe côté front.
   */
  async getStudentClasses(schoolId: string) {
    const rows = await this.prisma.studentEnrollment.findMany({
      where: { schoolId, status: 'ACTIVE' },
      select: { enrolledYear: true },
      distinct: ['enrolledYear'],
      orderBy: { enrolledYear: 'asc' },
    });
    return rows.map((row) => row.enrolledYear);
  }

  /** Liste (non paginée) des filières d'une école, actives en premier. */
  async getPrograms(schoolId: string) {
    return this.prisma.schoolProgram.findMany({
      where: { schoolId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Vue transversale paginée des filières, toutes écoles confondues par
   * défaut (ou restreinte via `schoolId`). Différent de {@link getPrograms}
   * qui retourne la liste complète et non paginée d'une seule école.
   */
  async getAllPrograms(page = 1, limit = 20, schoolId?: string) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const where = schoolId ? { schoolId } : {};
    const [items, total] = await Promise.all([
      this.prisma.schoolProgram.findMany({
        where,
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        include: { school: { select: { id: true, name: true } } },
      }),
      this.prisma.schoolProgram.count({ where }),
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

  /** Crée une filière (programme) pour une école donnée. */
  async createProgram(schoolId: string, dto: CreateSchoolProgramDto) {
    return this.prisma.schoolProgram.create({
      data: {
        schoolId,
        name: dto.name.trim(),
        diploma: dto.diploma.trim(),
        durationYears: dto.durationYears,
      },
    });
  }

  /**
   * Met à jour une filière. Si la durée (`durationYears`) est réduite,
   * vérifie qu'aucun étudiant activement inscrit n'a déjà un niveau
   * supérieur à la nouvelle durée avant d'autoriser le changement.
   * Si le nom change, régénère le libellé d'inscription
   * (`enrolledYear`) de tous les étudiants concernés.
   * @throws NotFoundException si la filière n'existe pas dans cette école.
   * @throws BadRequestException si la nouvelle durée est incompatible avec
   * le niveau d'un étudiant déjà inscrit.
   */
  async updateProgram(
    schoolId: string,
    id: string,
    dto: UpdateSchoolProgramDto,
  ) {
    const program = await this.prisma.schoolProgram.findFirst({
      where: { id, schoolId },
    });
    if (!program) throw new NotFoundException('Filière introuvable');
    if (dto.durationYears && dto.durationYears < program.durationYears) {
      const higherLevelEnrollment = await this.prisma.studentEnrollment.findFirst({
        where: {
          programId: id,
          programLevel: { gt: dto.durationYears },
          status: 'ACTIVE',
          student: { deletedAt: null },
        },
      });
      if (higherLevelEnrollment)
        throw new BadRequestException(
          'La durée ne peut pas être inférieure au niveau d’un étudiant inscrit',
        );
    }
    const updated = await this.prisma.schoolProgram.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.diploma !== undefined ? { diploma: dto.diploma.trim() } : {}),
        ...(dto.durationYears !== undefined
          ? { durationYears: dto.durationYears }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    if (dto.name !== undefined)
      await this.refreshProgramEnrollmentLabels(id, updated.name);
    return updated;
  }

  /** Liste des années académiques d'une école, l'année courante en tête. */
  async getAcademicYears(schoolId: string) {
    return this.prisma.schoolAcademicYear.findMany({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { enrollmentOpensAt: 'desc' }],
    });
  }

  /**
   * Crée une année académique après validation de la période d'inscription
   * (ouverture < fermeture). Si `isCurrent` est demandé, désactive d'abord
   * le flag `isCurrent` sur toutes les autres années de l'école (une seule
   * année courante à la fois), le tout dans une transaction.
   * @throws BadRequestException si la période d'inscription est invalide.
   */
  async createAcademicYear(schoolId: string, dto: CreateSchoolAcademicYearDto) {
    this.assertEnrollmentPeriod(dto.enrollmentOpensAt, dto.enrollmentClosesAt);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent)
        await tx.schoolAcademicYear.updateMany({
          where: { schoolId, isCurrent: true },
          data: { isCurrent: false },
        });
      return tx.schoolAcademicYear.create({
        data: {
          schoolId,
          label: dto.label.trim(),
          enrollmentOpensAt: new Date(dto.enrollmentOpensAt),
          enrollmentClosesAt: new Date(dto.enrollmentClosesAt),
          isCurrent: dto.isCurrent ?? false,
        },
      });
    });
  }

  /**
   * Met à jour une année académique. Revalide la période d'inscription
   * complète (en combinant les nouvelles dates avec les existantes si
   * partiellement fournies) et, comme pour la création, garantit qu'une
   * seule année reste `isCurrent` par école. Si le libellé change, régénère
   * le libellé d'inscription des étudiants concernés.
   * @throws NotFoundException si l'année académique n'existe pas.
   * @throws BadRequestException si la période d'inscription est invalide.
   */
  async updateAcademicYear(
    schoolId: string,
    id: string,
    dto: UpdateSchoolAcademicYearDto,
  ) {
    const academicYear = await this.prisma.schoolAcademicYear.findFirst({
      where: { id, schoolId },
    });
    if (!academicYear)
      throw new NotFoundException('Année académique introuvable');
    const opensAt =
      dto.enrollmentOpensAt || academicYear.enrollmentOpensAt.toISOString();
    const closesAt =
      dto.enrollmentClosesAt || academicYear.enrollmentClosesAt.toISOString();
    this.assertEnrollmentPeriod(opensAt, closesAt);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent)
        await tx.schoolAcademicYear.updateMany({
          where: { schoolId, isCurrent: true, id: { not: id } },
          data: { isCurrent: false },
        });
      return tx.schoolAcademicYear.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
          ...(dto.enrollmentOpensAt !== undefined
            ? { enrollmentOpensAt: new Date(dto.enrollmentOpensAt) }
            : {}),
          ...(dto.enrollmentClosesAt !== undefined
            ? { enrollmentClosesAt: new Date(dto.enrollmentClosesAt) }
            : {}),
          ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}),
        },
      });
    });
    if (dto.label !== undefined)
      await this.refreshAcademicYearEnrollmentLabels(id, updated.label);
    return updated;
  }

  /**
   * Garde-fou : vérifie que la date de fermeture des inscriptions n'est pas
   * antérieure à la date d'ouverture.
   * @throws BadRequestException si la période est incohérente.
   */
  private assertEnrollmentPeriod(opensAt: string, closesAt: string) {
    if (new Date(closesAt).getTime() < new Date(opensAt).getTime())
      throw new BadRequestException(
        "La date de fermeture doit être postérieure à la date d'ouverture",
      );
  }

  /**
   * Régénère le libellé `enrolledYear` de toutes les inscriptions actives
   * d'une filière après un changement de nom de celle-ci, afin de garder ce
   * champ dénormalisé cohérent avec les données sources.
   */
  private async refreshProgramEnrollmentLabels(
    programId: string,
    programName: string,
  ) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { programId, student: { deletedAt: null } },
      select: {
        id: true,
        programLevel: true,
        academicYear: { select: { label: true } },
      },
    });
    await this.prisma.$transaction(
      enrollments.map((enrollment) =>
        this.prisma.studentEnrollment.update({
          where: { id: enrollment.id },
          data: {
            enrolledYear: this.enrollmentLabel(
              programName,
              enrollment.programLevel,
              enrollment.academicYear.label,
            ),
          },
        }),
      ),
    );
  }

  /**
   * Équivalent de {@link refreshProgramEnrollmentLabels} côté année
   * académique : régénère `enrolledYear` pour toutes les inscriptions
   * actives rattachées à une année académique dont le libellé a changé.
   */
  private async refreshAcademicYearEnrollmentLabels(
    academicYearId: string,
    academicYearLabel: string,
  ) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { academicYearId, student: { deletedAt: null } },
      select: {
        id: true,
        programLevel: true,
        program: { select: { name: true } },
      },
    });
    await this.prisma.$transaction(
      enrollments.map((enrollment) =>
        this.prisma.studentEnrollment.update({
          where: { id: enrollment.id },
          data: {
            enrolledYear: this.enrollmentLabel(
              enrollment.program.name,
              enrollment.programLevel,
              academicYearLabel,
            ),
          },
        }),
      ),
    );
  }

  /**
   * Construit le libellé humain d'inscription (`enrolledYear`) affiché aux
   * étudiants, ex. "Année 2 · Informatique · 2024-2025".
   */
  private enrollmentLabel(
    programName: string,
    level: number,
    academicYearLabel: string,
  ) {
    return `Année ${level} · ${programName} · ${academicYearLabel}`;
  }

  /**
   * Liste paginée des documents (CV, lettre, pièce d'identité, diplôme,
   * photo, etc.) des étudiants d'une école, avec filtres par classe, type de
   * document et recherche par nom/prénom.
   * @throws BadRequestException si `type` ne fait pas partie des types
   * autorisés.
   */
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
        deletedAt: null,
        schoolEnrollments: {
          some: {
            schoolId,
            status: 'ACTIVE',
            ...(enrolledYear ? { enrolledYear } : {}),
          },
        },
        ...(terms.length
          ? {
              AND: terms.map((term) => ({
                OR: [
                  {
                    firstName: { contains: term, mode: 'insensitive' as const },
                  },
                  {
                    lastName: { contains: term, mode: 'insensitive' as const },
                  },
                ],
              })),
            }
          : {}),
      },
    };
    const [rawItems, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              schoolEnrollments: {
                where: { schoolId },
                select: { enrolledYear: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
      }),
      this.prisma.document.count({ where }),
    ]);
    const items = rawItems.map((document) => ({
      ...document,
      student: {
        firstName: document.student.firstName,
        lastName: document.student.lastName,
        enrolledYear: document.student.schoolEnrollments[0]?.enrolledYear ?? null,
      },
    }));
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

  /**
   * Inscrit (ou réinscrit) un étudiant dans une école, pour une filière, un
   * niveau et une année académique donnés. Résout le compte étudiant par
   * e-mail, vérifie que la période d'inscription de l'année académique est
   * bien ouverte à la date courante, que la filière est active, et que le
   * niveau demandé ne dépasse pas la durée de la filière. Crée ou met à jour
   * (upsert) l'inscription (statut ACTIVE), puis synchronise les inscriptions
   * aux cours via {@link syncCourseEnrollments}.
   * @throws NotFoundException si aucun compte étudiant ne correspond à
   * l'e-mail, si l'année académique ou la filière est introuvable.
   * @throws ForbiddenException si la période d'inscription n'est pas ouverte.
   * @throws BadRequestException si le niveau demandé dépasse la durée de la
   * filière.
   */
  async enrollStudent(schoolId: string, dto: EnrollStudentDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { role: { select: { name: true } }, student: true },
    });
    if (
      !user?.student ||
      user.role?.name !== 'STUDENT' ||
      user.student.deletedAt
    ) {
      throw new NotFoundException(
        'Aucun compte étudiant trouvé pour cet e-mail',
      );
    }
    // Un étudiant peut être inscrit activement dans plusieurs écoles à la
    // fois (double diplôme, cursus parallèle) : pas de blocage ici, une
    // ligne StudentEnrollment par école.

    const academicYear = await this.prisma.schoolAcademicYear.findFirst({
      where: { id: dto.academicYearId, schoolId },
    });
    if (!academicYear)
      throw new NotFoundException('Année académique introuvable');
    const now = new Date();
    if (
      now < academicYear.enrollmentOpensAt ||
      now > academicYear.enrollmentClosesAt
    )
      throw new ForbiddenException(
        `Les inscriptions pour cette année académique ne sont pas ouvertes actuellement (période : ${academicYear.enrollmentOpensAt.toLocaleDateString('fr-FR')} – ${academicYear.enrollmentClosesAt.toLocaleDateString('fr-FR')}).`,
      );
    const program = await this.prisma.schoolProgram.findFirst({
      where: { id: dto.programId, schoolId, isActive: true },
    });
    if (!program)
      throw new NotFoundException('Filière introuvable ou archivée');
    if (dto.level > program.durationYears)
      throw new BadRequestException(
        `Ce programme ne compte que ${program.durationYears} année(s)`,
      );
    const enrolledYear = this.enrollmentLabel(
      program.name,
      dto.level,
      academicYear.label,
    );
    await this.prisma.studentEnrollment.upsert({
      where: {
        studentId_schoolId: { studentId: user.student.id, schoolId },
      },
      create: {
        studentId: user.student.id,
        schoolId,
        programId: dto.programId,
        programLevel: dto.level,
        academicYearId: dto.academicYearId,
        enrolledYear,
        status: 'ACTIVE',
      },
      update: {
        programId: dto.programId,
        programLevel: dto.level,
        academicYearId: dto.academicYearId,
        enrolledYear,
        status: 'ACTIVE',
      },
    });
    await this.syncCourseEnrollments(
      user.student.id,
      schoolId,
      program.id,
      dto.level,
    );
    return this.prisma.student.findUnique({
      where: { id: user.student.id },
      include: { user: { select: { email: true } } },
    });
  }

  /**
   * Met à jour l'inscription d'un étudiant à une école. Si le nouveau statut
   * n'est pas ACTIVE (retrait, diplômé), se contente de changer le statut
   * sans revalider ni resynchroniser filière/niveau/cours. Si le statut
   * reste (ou redevient) ACTIVE, revalide filière/année académique/niveau
   * (en reprenant les valeurs actuelles pour les champs non fournis) puis
   * resynchronise les inscriptions aux cours.
   * @throws NotFoundException si l'inscription n'existe pas ou si l'étudiant
   * a été supprimé.
   * @throws BadRequestException si la filière, l'année académique ou le
   * niveau résultants sont invalides.
   */
  async updateEnrollment(
    schoolId: string,
    studentId: string,
    data: {
      programId?: string;
      level?: number;
      academicYearId?: string;
      status: 'ACTIVE' | 'WITHDRAWN' | 'GRADUATED';
    },
  ) {
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { studentId_schoolId: { studentId, schoolId } },
      include: { student: true },
    });
    if (!enrollment || enrollment.student.deletedAt)
      throw new NotFoundException('Étudiant inscrit introuvable');
    if (data.status !== 'ACTIVE')
      // Retrait/diplomation : on ne touche pas aux CourseEnrollment existants,
      // le statut de StudentEnrollment sert de source de vérité côté élève.
      return this.prisma.studentEnrollment.update({
        where: { id: enrollment.id },
        data: { status: data.status },
      });
    const programId = data.programId ?? enrollment.programId;
    const academicYearId = data.academicYearId ?? enrollment.academicYearId;
    const level = data.level ?? enrollment.programLevel;
    const [program, academicYear] = await Promise.all([
      this.prisma.schoolProgram.findFirst({
        where: { id: programId || '', schoolId },
      }),
      this.prisma.schoolAcademicYear.findFirst({
        where: { id: academicYearId || '', schoolId },
      }),
    ]);
    if (!program || !academicYear || !level || level > program.durationYears)
      throw new BadRequestException(
        'Filière, niveau ou année académique invalide',
      );
    const updatedEnrollment = await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        programId: program.id,
        programLevel: level,
        academicYearId: academicYear.id,
        enrolledYear: `Année ${level} · ${program.name} · ${academicYear.label}`,
        status: 'ACTIVE',
      },
    });
    await this.syncCourseEnrollments(studentId, schoolId, program.id, level);
    return updatedEnrollment;
  }

  /**
   * Inscrit un lot d'étudiants (ex: import CSV) via {@link enrollStudent}.
   * Précharge une seule fois les filières/années académiques de l'école pour
   * résoudre les noms fournis en identifiants, au lieu de refaire ces
   * requêtes pour chaque ligne. Chaque ligne est traitée indépendamment : une
   * erreur sur une ligne (filière/année introuvable, etc.) est capturée et
   * n'interrompt pas le traitement des lignes suivantes.
   * @returns la liste des e-mails inscrits avec succès et la liste des
   * lignes en échec avec leur raison.
   */
  async bulkEnrollStudents(
    schoolId: string,
    rows: Array<{
      email: string;
      programName: string;
      level: number;
      academicYearLabel: string;
    }>,
  ) {
    const succeeded: string[] = [];
    const failed: Array<{ row: unknown; reason: string }> = [];

    // Pré-charger une bonne fois pour toutes les filières/années de l'école
    // au lieu de refaire les deux mêmes requêtes pour chaque ligne du
    // fichier importé (un import de 500 étudiants faisait jusqu'ici 1000
    // requêtes rien que pour cette résolution).
    const [programs, academicYears] = await Promise.all([
      this.prisma.schoolProgram.findMany({
        where: { schoolId, isActive: true },
      }),
      this.prisma.schoolAcademicYear.findMany({ where: { schoolId } }),
    ]);
    const programByName = new Map(
      programs.map((p) => [p.name.trim().toLowerCase(), p]),
    );
    const yearByLabel = new Map(
      academicYears.map((y) => [y.label.trim().toLowerCase(), y]),
    );

    for (const row of rows) {
      try {
        const program = programByName.get(row.programName.trim().toLowerCase());
        const academicYear = yearByLabel.get(
          row.academicYearLabel.trim().toLowerCase(),
        );
        if (!program) throw new NotFoundException('Filière introuvable');
        if (!academicYear)
          throw new NotFoundException('Année académique introuvable');
        await this.enrollStudent(schoolId, {
          email: row.email,
          programId: program.id,
          level: Number(row.level),
          academicYearId: academicYear.id,
        });
        succeeded.push(row.email);
      } catch (error) {
        failed.push({
          row,
          reason: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }
    return { succeeded, failed };
  }

  /**
   * Crée une annonce ciblée dans une école et déclenche les notifications
   * correspondantes via {@link AnnouncementService.createAndNotify}. La
   * résolution des destinataires dépend de `dto.targetType` :
   * - CLASSES : étudiants actifs des classes sélectionnées ;
   * - STUDENTS : étudiants explicitement listés ;
   * - TEACHERS : enseignants explicitement listés (affectation active) ;
   * - EVERYONE : tous les enseignants actifs et étudiants actifs de l'école ;
   * - tout autre type : traité comme un ciblage étudiants standard.
   * @throws BadRequestException si le type de ciblage exige une sélection
   * (classes/étudiants/enseignants) qui est vide.
   */
  async createAnnouncement(
    schoolId: string,
    senderId: string,
    dto: CreateAnnouncementDto,
  ) {
    const classes = dto.classes?.filter(Boolean) || [];
    const studentIds = dto.studentIds || [];
    const teacherIds = dto.teacherIds || [];
    if (dto.targetType === 'CLASSES' && classes.length === 0) {
      throw new BadRequestException(
        'Au moins une classe doit être sélectionnée',
      );
    }
    if (dto.targetType === 'STUDENTS' && studentIds.length === 0) {
      throw new BadRequestException(
        'Au moins un étudiant doit être sélectionné',
      );
    }
    if (dto.targetType === 'TEACHERS' && teacherIds.length === 0) {
      throw new BadRequestException(
        'Au moins un professeur doit être sélectionné',
      );
    }

    let userIds: string[] = [];
    if (dto.targetType === 'TEACHERS') {
      const teachers = await this.prisma.teacherSchool.findMany({
        where: { teacherId: { in: teacherIds }, schoolId, isActive: true },
        select: { teacher: { select: { userId: true } } },
      });
      userIds = teachers.map((assignment) => assignment.teacher.userId);
    } else if (dto.targetType === 'EVERYONE') {
      const [teacherAssignments, students] = await Promise.all([
        this.prisma.teacherSchool.findMany({
          where: { schoolId, isActive: true },
          select: { teacher: { select: { userId: true } } },
        }),
        this.prisma.student.findMany({
          where: {
            deletedAt: null,
            schoolEnrollments: { some: { schoolId, status: 'ACTIVE' } },
          },
          select: { userId: true },
        }),
      ]);
      userIds = [
        ...teacherAssignments.map((assignment) => assignment.teacher.userId),
        ...students.map((student) => student.userId),
      ];
    } else {
      const students = await this.prisma.student.findMany({
        where: {
          deletedAt: null,
          schoolEnrollments: {
            some: {
              schoolId,
              status: 'ACTIVE',
              ...(dto.targetType === 'CLASSES'
                ? { enrolledYear: { in: classes } }
                : {}),
            },
          },
          ...(dto.targetType === 'STUDENTS' ? { id: { in: studentIds } } : {}),
        },
        select: { userId: true },
      });
      userIds = students.map((student) => student.userId);
    }

    return this.announcementService.createAndNotify(
      {
        schoolId,
        authorId: senderId,
        title: dto.title,
        body: dto.body,
        targetType: dto.targetType,
        targetClasses: dto.targetType === 'CLASSES' ? classes : [],
      },
      userIds,
    );
  }

  /**
   * Diffuse une annonce (type ALL_STUDENTS) à tous les étudiants actifs de
   * toutes les écoles actives et non supprimées. Traite les écoles une par
   * une (une annonce distincte est créée par école) et notifie leurs
   * étudiants inscrits actifs.
   * @returns le nombre d'écoles touchées et le total de destinataires
   * notifiés.
   */
  async broadcastAnnouncement(
    adminUserId: string,
    dto: { title: string; body: string },
  ) {
    const schools = await this.prisma.school.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });

    let recipientCount = 0;
    // Traitement séquentiel école par école (pas de préchargement global
    // comme dans bulkEnrollStudents) : à surveiller si le nombre d'écoles
    // devient important.
    for (const school of schools) {
      const students = await this.prisma.student.findMany({
        where: {
          deletedAt: null,
          schoolEnrollments: { some: { schoolId: school.id, status: 'ACTIVE' } },
        },
        select: { userId: true },
      });
      const result = await this.announcementService.createAndNotify(
        {
          schoolId: school.id,
          authorId: adminUserId,
          title: dto.title,
          body: dto.body,
          targetType: 'ALL_STUDENTS',
        },
        students.map((student) => student.userId),
      );
      recipientCount += result.recipientCount;
    }

    return { schoolsCount: schools.length, recipientCount };
  }

  /**
   * Reconstitue l'historique des diffusions ({@link broadcastAnnouncement})
   * à partir des annonces individuelles ALL_STUDENTS créées par écoles (une
   * par école lors d'une diffusion). Les 300 annonces les plus récentes de
   * l'auteur sont regroupées par titre + corps + horodatage arrondi à la
   * minute, afin de reformer une seule entrée de diffusion multi-écoles ;
   * seules les 20 diffusions les plus récentes sont retournées.
   */
  async getBroadcastHistory(adminUserId: string) {
    const announcements = await this.prisma.announcement.findMany({
      where: { authorId: adminUserId, targetType: 'ALL_STUDENTS' },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { title: true, body: true, createdAt: true, schoolId: true },
    });

    const groups = new Map<
      string,
      { title: string; body: string; createdAt: Date; schoolIds: Set<string> }
    >();
    // Clé de regroupement heuristique : titre + corps + minute de création.
    // Deux diffusions distinctes avec un texte identique dans la même minute
    // seraient fusionnées à tort ; ce compromis est jugé acceptable ici.
    for (const item of announcements) {
      const key = `${item.title} ${item.body} ${Math.floor(item.createdAt.getTime() / 60000)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.schoolIds.add(item.schoolId);
      } else {
        groups.set(key, {
          title: item.title,
          body: item.body,
          createdAt: item.createdAt,
          schoolIds: new Set([item.schoolId]),
        });
      }
    }

    return Array.from(groups.values())
      .slice(0, 20)
      .map((group) => ({
        title: group.title,
        body: group.body,
        createdAt: group.createdAt,
        schoolsReached: group.schoolIds.size,
      }));
  }

  /**
   * Liste paginée des annonces d'une école (les plus récentes en premier),
   * enrichies du nombre de destinataires et du nombre de lectures pour
   * chaque annonce.
   */
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
          recipients: {
            select: { notification: { select: { isRead: true } } },
          },
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
        imageUrl: item.imageUrl,
        createdAt: item.createdAt,
        recipientCount: item.recipients.length,
        readCount: item.recipients.filter(
          (recipient) => recipient.notification.isRead,
        ).length,
      })),
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  /**
   * Associe une image à une annonce existante de l'école (upload de photo
   * d'illustration). Utilise `updateMany` scopé par école pour vérifier
   * l'appartenance en un seul aller-retour DB.
   * @throws NotFoundException si aucune annonce ne correspond dans cette
   * école.
   */
  async setAnnouncementPhoto(
    schoolId: string,
    announcementId: string,
    imageUrl: string,
  ) {
    const { count } = await this.prisma.announcement.updateMany({
      where: { id: announcementId, schoolId },
      data: { imageUrl },
    });
    if (count === 0) {
      throw new NotFoundException('Annonce introuvable pour cette école');
    }
    return { imageUrl };
  }

  /**
   * Liste paginée des annonces reçues par un utilisateur (étudiant ou
   * enseignant), triées par date de notification décroissante, avec l'état
   * de lecture de chacune.
   */
  async getMyAnnouncements(userId: string, page = 1, limit = 20) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const [items, total] = await Promise.all([
      this.prisma.announcementRecipient.findMany({
        where: { userId },
        orderBy: { notification: { createdAt: 'desc' } },
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        include: { announcement: true, notification: true },
      }),
      this.prisma.announcementRecipient.count({ where: { userId } }),
    ]);
    return {
      items: items.map((recipient) => ({
        announcementId: recipient.announcement.id,
        title: recipient.announcement.title,
        body: recipient.announcement.body,
        imageUrl: recipient.announcement.imageUrl,
        targetType: recipient.announcement.targetType,
        createdAt: recipient.announcement.createdAt,
        notificationId: recipient.notificationId,
        isRead: recipient.notification.isRead,
      })),
      meta: {
        page: currentPage,
        limit: currentLimit,
        total,
        totalPages: Math.ceil(total / currentLimit),
      },
    };
  }

  /**
   * Répartition des candidatures (applications) d'une école par étape du
   * pipeline de recrutement. Retourne toutes les étapes définies même à 0
   * pour permettre un affichage stable en entonnoir côté front.
   */
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

  /**
   * Répartition des candidatures d'une école par issue finale (acceptée,
   * refusée, en liste d'attente).
   */
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
    const grouped = await this.prisma.studentEnrollment.groupBy({
      by: ['enrolledYear'],
      where: { schoolId, status: 'ACTIVE' },
      _count: true,
      orderBy: { enrolledYear: 'asc' },
    });
    return grouped.map((item) => ({
      enrolledYear: item.enrolledYear,
      count: item._count,
    }));
  }

  async getReportByOffer(schoolId: string) {
    const grouped = await this.prisma.application.groupBy({
      by: ['offerId'],
      where: { deletedAt: null, offer: { schoolId, deletedAt: null } },
      _count: true,
    });
    const top = grouped
      .sort((left, right) => right._count - left._count)
      .slice(0, 10);
    const offers = await this.prisma.offer.findMany({
      where: {
        id: { in: top.map((item) => item.offerId) },
        schoolId,
        deletedAt: null,
      },
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
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: { schoolId, status: 'ACTIVE', student: { deletedAt: null } },
        include: { student: { include: { user: { select: { email: true } } } } },
        orderBy: [
          { student: { lastName: 'asc' } },
          { student: { firstName: 'asc' } },
        ],
      });
      return this.toCsv(
        [
          'Prénom',
          'Nom',
          'E-mail',
          'Téléphone',
          'Ville',
          'Année d’inscription',
        ],
        enrollments.map((enrollment) => [
          enrollment.student.firstName,
          enrollment.student.lastName,
          enrollment.student.user.email,
          enrollment.student.phone,
          enrollment.student.city,
          enrollment.enrolledYear,
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

  async getInactiveTeacherAssignments(schoolId: string) {
    return this.prisma.teacherSchool.findMany({
      where: { schoolId, isActive: false },
      select: {
        teacherId: true,
        teacher: { select: { id: true, user: { select: { email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubjects(schoolId: string) {
    return this.prisma.schoolSubject.findMany({
      where: { schoolId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }
  async createSubject(schoolId: string, name: string) {
    return this.prisma.schoolSubject.create({
      data: { schoolId, name: name.trim() },
    });
  }
  async updateSubject(schoolId: string, id: string, isActive: boolean) {
    const subject = await this.prisma.schoolSubject.findFirst({
      where: { id, schoolId },
    });
    if (!subject) throw new NotFoundException('Matière introuvable');
    return this.prisma.schoolSubject.update({
      where: { id },
      data: { isActive },
    });
  }

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
        },
        subjects: { include: { subject: true } },
      },
    });
    if (dto.subjectIds)
      await this.syncTeacherSubjects(schoolId, assignment.id, dto.subjectIds);
    return this.prisma.teacherSchool.findUnique({
      where: { id: assignment.id },
      include: {
        teacher: { include: { user: { select: { email: true } } } },
        subjects: { include: { subject: true } },
      },
    });
  }

  async updateTeacherAssignment(
    schoolId: string,
    teacherSchoolId: string,
    dto: UpdateTeacherAssignmentDto,
  ) {
    const assignment = await this.prisma.teacherSchool.findFirst({
      where: { id: teacherSchoolId, schoolId },
    });
    if (!assignment)
      throw new NotFoundException('Teacher assignment not found');

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
        },
        subjects: { include: { subject: true } },
      },
    });
    if (dto.subjectIds)
      await this.syncTeacherSubjects(schoolId, teacherSchoolId, dto.subjectIds);
    return updated;
  }

  async findTeacherByEmail(email: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { user: { email: { equals: email.trim(), mode: 'insensitive' } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!teacher)
      throw new NotFoundException(
        'Aucun compte professeur trouvé pour cet e-mail',
      );
    return teacher;
  }
  private async syncTeacherSubjects(
    schoolId: string,
    teacherSchoolId: string,
    subjectIds: string[],
  ) {
    const subjects = await this.prisma.schoolSubject.findMany({
      where: { id: { in: subjectIds }, schoolId, isActive: true },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.teacherSchoolSubject.deleteMany({
        where: { teacherSchoolId },
      }),
      this.prisma.teacherSchoolSubject.createMany({
        data: subjects.map((subject) => ({
          teacherSchoolId,
          subjectId: subject.id,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

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
    const course = await this.ensureSchoolCourse(schoolId, courseId);
    this.assertSlotTimes(dto.startTime, dto.endTime);
    await this.ensureNoRoomConflict(schoolId, dto);
    await this.teacherAvailabilityService.assertTeacherFreeOrThrow(
      course.teacherId,
      schoolId,
      dto,
    );

    let slot;
    try {
      slot = await this.prisma.courseSlot.create({
        data: { courseId, teacherId: course.teacherId, ...dto },
      });
    } catch (error) {
      throw this.teacherAvailabilityService.translateExclusionConstraintError(error) ?? error;
    }
    await this.notifyTeacherScheduleChange(course.teacherId, 'ajouté');
    return slot;
  }

  async updateCourseSlot(
    schoolId: string,
    courseId: string,
    slotId: string,
    dto: UpdateCourseSlotDto,
  ) {
    const course = await this.ensureSchoolCourse(schoolId, courseId);
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
    await this.teacherAvailabilityService.assertTeacherFreeOrThrow(
      course.teacherId,
      schoolId,
      candidate,
      slotId,
    );

    let updated;
    try {
      updated = await this.prisma.courseSlot.update({ where: { id: slotId }, data: dto });
    } catch (error) {
      throw this.teacherAvailabilityService.translateExclusionConstraintError(error) ?? error;
    }
    await this.notifyTeacherScheduleChange(course.teacherId, 'modifié');
    return updated;
  }

  async deleteCourseSlot(schoolId: string, courseId: string, slotId: string) {
    const course = await this.ensureSchoolCourse(schoolId, courseId);
    const slot = await this.prisma.courseSlot.findFirst({
      where: { id: slotId, courseId },
    });
    if (!slot) throw new NotFoundException('Course slot not found');
    const deleted = await this.prisma.courseSlot.delete({ where: { id: slotId } });
    await this.notifyTeacherScheduleChange(course.teacherId, 'annulé');
    return deleted;
  }

  private async notifyTeacherScheduleChange(teacherId: string, action: 'ajouté' | 'modifié' | 'annulé') {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { userId: true },
    });
    if (!teacher) return;
    await this.notificationService.sendInAppBatch([teacher.userId], {
      title: 'Emploi du temps mis à jour',
      body: `Un créneau a été ${action} dans votre emploi du temps.`,
    });
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

    const [
      payments,
      total,
      completedPayments,
      pendingPayments,
      failedPayments,
      completedAmount,
    ] = await Promise.all([
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
    const subject = await this.prisma.schoolSubject.findFirst({
      where: { id: dto.subjectId, schoolId, isActive: true },
    });
    const program = await this.prisma.schoolProgram.findFirst({
      where: { id: dto.programId, schoolId, isActive: true },
    });
    if (!subject || !program)
      throw new NotFoundException('Matière ou filière introuvable');
    if (dto.programLevel > program.durationYears)
      throw new BadRequestException(
        `Ce programme ne compte que ${program.durationYears} année(s)`,
      );

    return this.prisma.course.create({
      data: {
        schoolId,
        teacherId: dto.teacherId,
        code: dto.code,
        title: subject.name,
        subjectId: subject.id,
        programId: program.id,
        programLevel: dto.programLevel,
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

    if (dto.isPublished === false) {
      const activeEnrollmentCount = await this.prisma.courseEnrollment.count({
        where: {
          courseId,
          student: {
            deletedAt: null,
            schoolEnrollments: { some: { schoolId, status: 'ACTIVE' } },
          },
        },
      });
      if (activeEnrollmentCount > 0) {
        throw new BadRequestException(
          'Impossible de désactiver ce cours : des étudiants y sont encore inscrits.',
        );
      }
    }

    const teacherId = dto.teacherId ?? course.teacherId;
    await this.ensureActiveTeacherAssignment(schoolId, teacherId);

    const subject = dto.subjectId
      ? await this.prisma.schoolSubject.findFirst({
          where: { id: dto.subjectId, schoolId, isActive: true },
        })
      : null;
    const program = dto.programId
      ? await this.prisma.schoolProgram.findFirst({
          where: { id: dto.programId, schoolId, isActive: true },
        })
      : null;
    if ((dto.subjectId && !subject) || (dto.programId && !program))
      throw new NotFoundException('Matière ou filière introuvable');
    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        teacherId,
        code: dto.code,
        title: subject?.name,
        subjectId: dto.subjectId,
        programId: dto.programId,
        programLevel: dto.programLevel,
        description: dto.description,
        level:
          program && dto.programLevel
            ? `Année ${dto.programLevel} · ${program.name}`
            : undefined,
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

    // Garder la colonne dénormalisée CourseSlot.teacherId cohérente si le
    // prof du cours change (elle porte la contrainte anti-double-réservation).
    if (dto.teacherId && dto.teacherId !== course.teacherId) {
      try {
        await this.prisma.courseSlot.updateMany({
          where: { courseId },
          data: { teacherId: dto.teacherId },
        });
      } catch (error) {
        throw this.teacherAvailabilityService.translateExclusionConstraintError(error) ?? error;
      }
    }

    return updated;
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

  private toCsv(
    headers: string[],
    rows: Array<Array<string | null | undefined>>,
  ) {
    const escape = (value: string | null | undefined) => {
      // Neutralise l'injection de formule (CSV/DDE) : Excel/LibreOffice
      // interprètent comme une formule toute cellule commençant par
      // =, +, - ou @, y compris quand la valeur vient d'un champ que
      // l'étudiant contrôle lui-même (firstName/lastName/city, voir les deux
      // appelants de toCsv ci-dessus) — un prénom "=cmd|'/c calc'!A1" ouvert
      // par un school-admin dans son tableur exécuterait la formule. Le
      // préfixe apostrophe est la neutralisation standard (recommandation
      // OWASP CSV Injection) : Excel/LibreOffice affichent alors la valeur
      // comme texte brut, apostrophe non affichée (faille corrigée suite à
      // l'audit sécurité).
      const raw = String(value ?? '');
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      const normalized = safe.replace(/"/g, '""');
      return /[",\r\n]/.test(normalized) ? `"${normalized}"` : normalized;
    };
    return Buffer.from(
      `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}\r\n`,
      'utf-8',
    );
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
    slot: Pick<
      CreateCourseSlotDto,
      'dayOfWeek' | 'startTime' | 'endTime' | 'room'
    >,
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

  // ========== ÉVÉNEMENTS ==========

  /** Liste les événements à venir d'une école, du plus proche au plus lointain. */
  async listUpcomingEvents(schoolId: string) {
    return this.prisma.schoolEvent.findMany({
      where: { schoolId, startAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
    });
  }

  private async event(schoolId: string, eventId: string) {
    const event = await this.prisma.schoolEvent.findFirst({
      where: { id: eventId, schoolId },
    });
    if (!event) throw new NotFoundException('Événement introuvable');
    return event;
  }

  async createEvent(
    schoolId: string,
    userId: string,
    dto: {
      title: string;
      description?: string;
      location?: string;
      startAt: string;
    },
  ) {
    return this.prisma.schoolEvent.create({
      data: {
        schoolId,
        createdBy: userId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: new Date(dto.startAt),
      },
    });
  }

  async updateEvent(
    schoolId: string,
    eventId: string,
    dto: {
      title?: string;
      description?: string;
      location?: string;
      startAt?: string;
    },
  ) {
    await this.event(schoolId, eventId);
    return this.prisma.schoolEvent.update({
      where: { id: eventId },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      },
    });
  }

  async deleteEvent(schoolId: string, eventId: string) {
    await this.event(schoolId, eventId);
    await this.prisma.schoolEvent.delete({ where: { id: eventId } });
    return { success: true };
  }
}
