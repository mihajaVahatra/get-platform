import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExportFormat,
  GenerateReportDto,
  ReportSection,
  ReportType,
} from './dto/report-request.dto';
import {
  ComplianceStatus,
  ComplianceUpdateDto,
} from './dto/compliance-update.dto';
import { createReportExport } from './report-exporter';

/**
 * Les filtres de Ministry ne portent que sur des dimensions institutionnelles.
 * Aucun sélecteur d'étudiant, d'identité ou de dossier individuel n'est admis.
 */
export interface MinistryAnalyticsFilters {
  from?: Date;
  to?: Date;
  region?: string;
  filiere?: string;
  schoolId?: string;
  limit?: number;
}

interface ResolvedAnalyticsFilters extends MinistryAnalyticsFilters {
  limit: number;
}

export interface PeriodRange {
  from: string | null;
  to: string | null;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface AggregateCounter {
  count: number;
  acceptedCount: number;
  pendingCount: number;
}

export interface RegionalAggregate {
  region: string;
  count: number;
}

export interface FiliereAggregate extends AggregateCounter {
  filiere: string;
  programme: string | null;
}

export interface SchoolAggregate extends AggregateCounter {
  school: string;
  region: string;
  city: string;
}

export interface SchoolProgrammeAggregate extends SchoolAggregate {
  filiere: string;
  programme: string | null;
}

export interface PeriodAggregate extends AggregateCounter {
  period: string;
}

export interface EnrollmentBySchoolProgramme {
  school: string;
  region: string;
  city: string;
  filiere: string;
  programme: string;
  enrolledCount: number;
}

export interface ApplicationAnalyticsResult {
  period: PeriodRange;
  total: number;
  acceptedCount: number;
  pendingCount: number;
  byStatus: StatusCount[];
  byRegion: RegionalAggregate[];
  byFiliere: FiliereAggregate[];
  bySchool: SchoolAggregate[];
  bySchoolProgramme: SchoolProgrammeAggregate[];
  byPeriod: PeriodAggregate[];
}

export interface EnrollmentAnalyticsResult {
  total: number;
  bySchoolProgramme: EnrollmentBySchoolProgramme[];
}

interface ComplianceSummary {
  totalSchoolsChecked: number;
  byStatus: StatusCount[];
}

const UNKNOWN_REGION = 'Non renseignée';
const UNKNOWN_CITY = 'Non renseignée';
const DEFAULT_BREAKDOWN_LIMIT = 20;
const MAX_BREAKDOWN_LIMIT = 100;
const ACCEPTED_APPLICATION_STATUSES = new Set(['ACCEPTED', 'ENROLLED']);
const PENDING_APPLICATION_STATUSES = new Set([
  'PENDING',
  'UNDER_REVIEW',
  'TEST_SCHEDULED',
  'INTERVIEW_SCHEDULED',
  'PRESELECTED',
  'WAITLISTED',
]);

@Injectable()
export class MinistryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vue nationale strictement agrégée. Les requêtes ne sélectionnent jamais
   * les étudiants, leur identifiant, leur nom, leurs coordonnées ou leurs
   * documents : seules les dimensions établissement/programme sont retournées.
   */
  async getDashboard(filters?: Pick<MinistryAnalyticsFilters, 'from' | 'to'>) {
    const analyticsFilters = this.resolveAnalyticsFilters({
      ...filters,
      limit: DEFAULT_BREAKDOWN_LIMIT,
    });
    const studentWhere = this.buildStudentPopulationWhere(analyticsFilters);

    const [
      applications,
      enrollments,
      totalStudents,
      totalSchools,
      totalOffers,
      pendingApplicationsOver48h,
    ] = await Promise.all([
      this.collectApplicationAnalytics(analyticsFilters),
      this.collectEnrollmentAnalytics(analyticsFilters),
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.school.count({
        where: { deletedAt: null, isActive: true },
      }),
      this.prisma.offer.count({
        where: {
          deletedAt: null,
          isOpen: true,
          school: { deletedAt: null, isActive: true },
        },
      }),
      // Alerte opérationnelle : candidatures en attente depuis plus de 48h,
      // tous établissements confondus. N'expose aucune identité, seulement
      // un compteur.
      this.prisma.application.count({
        where: {
          deletedAt: null,
          status: 'PENDING',
          submittedAt: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const acceptanceRate =
      applications.total === 0
        ? 0
        : Math.round((applications.acceptedCount / applications.total) * 100);

    return {
      period: applications.period,
      totalApplications: applications.total,
      totalStudents,
      totalEnrolledStudents: enrollments.total,
      totalSchools,
      totalOffers,
      acceptanceRate,
      applicationsByStatus: applications.byStatus,
      regionalDistribution: applications.byRegion,
      applicationsByFiliere: applications.byFiliere,
      applicationsBySchool: applications.bySchool,
      applicationsBySchoolProgramme: applications.bySchoolProgramme,
      enrollmentsBySchoolProgramme: enrollments.bySchoolProgramme,
      trends: applications.byPeriod,
      alerts: { pendingApplicationsOver48h },
    };
  }

  /**
   * Statistiques détaillées uniquement sous forme de compteurs. Une ligne ne
   * représente jamais une candidature ni un étudiant, mais un regroupement.
   */
  async getApplicationStats(filters?: MinistryAnalyticsFilters) {
    return this.collectApplicationAnalytics(
      this.resolveAnalyticsFilters(filters),
    );
  }

  async getSchoolStats() {
    const schoolWhere: Prisma.SchoolWhereInput = { deletedAt: null };
    const applicationWhere = this.buildApplicationWhere(
      this.resolveAnalyticsFilters({}),
    );

    const [schools, totalOffers, totalApplications] = await Promise.all([
      this.prisma.school.findMany({
        where: schoolWhere,
        select: { type: true, region: true },
      }),
      this.prisma.offer.count({
        where: { deletedAt: null, school: { deletedAt: null } },
      }),
      this.prisma.application.count({ where: applicationWhere }),
    ]);

    const schoolsByRegion = new Map<string, number>();
    let publicSchools = 0;
    let privateSchools = 0;

    for (const school of schools) {
      if (school.type === 'PUBLIC') publicSchools += 1;
      if (school.type === 'PRIVATE') privateSchools += 1;
      const region = school.region || UNKNOWN_REGION;
      schoolsByRegion.set(region, (schoolsByRegion.get(region) || 0) + 1);
    }

    const totalSchools = schools.length;
    return {
      totalSchools,
      publicSchools,
      privateSchools,
      totalOffers,
      schoolsByRegion: this.sortByCount(
        [...schoolsByRegion.entries()].map(([region, count]) => ({
          region,
          count,
        })),
      ),
      averageOffersPerSchool:
        totalSchools === 0
          ? 0
          : Number((totalOffers / totalSchools).toFixed(2)),
      averageApplicationsPerSchool:
        totalSchools === 0
          ? 0
          : Number((totalApplications / totalSchools).toFixed(2)),
    };
  }

  async getGeographicStats() {
    const [byRegion, byCity] = await Promise.all([
      this.prisma.student.groupBy({
        by: ['region'],
        where: { deletedAt: null, region: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.student.groupBy({
        by: ['city'],
        where: { deletedAt: null, city: { not: null } },
        _count: { _all: true },
      }),
    ]);

    return {
      byRegion: this.sortByCount(
        byRegion.map((entry) => ({
          region: entry.region || UNKNOWN_REGION,
          count: entry._count._all,
        })),
      ),
      byCity: this.sortByCount(
        byCity.map((entry) => ({
          city: entry.city || UNKNOWN_CITY,
          count: entry._count._all,
        })),
      ).slice(0, MAX_BREAKDOWN_LIMIT),
    };
  }

  /**
   * La vue par défaut renvoie le dernier contrôle de chaque établissement.
   * Ainsi, l'interface ne présente pas l'historique comme s'il s'agissait de
   * plusieurs états actuels pour une même école.
   */
  async getCompliance(options?: {
    status?: ComplianceStatus;
    page?: number;
    limit?: number;
    latestOnly?: boolean;
  }) {
    const { page, limit, skip } = this.resolvePagination(options);
    const select = {
      id: true,
      status: true,
      score: true,
      remarks: true,
      checkedAt: true,
      school: {
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          type: true,
        },
      },
    } as const;
    const baseWhere: Prisma.ComplianceCheckWhereInput = {
      school: { deletedAt: null },
    };

    if (options?.latestOnly !== false) {
      const checks = await this.prisma.complianceCheck.findMany({
        where: baseWhere,
        orderBy: [{ checkedAt: 'desc' }, { createdAt: 'desc' }],
        select,
      });
      const latestBySchool = new Map<string, (typeof checks)[number]>();
      for (const check of checks) {
        if (!latestBySchool.has(check.school.id)) {
          latestBySchool.set(check.school.id, check);
        }
      }
      const requestedStatus = options?.status ? String(options.status) : null;
      const currentChecks = [...latestBySchool.values()].filter(
        (check) => !requestedStatus || check.status === requestedStatus,
      );

      return {
        items: currentChecks.slice(skip, skip + limit),
        meta: this.paginationMeta(page, limit, currentChecks.length),
      };
    }

    const where: Prisma.ComplianceCheckWhereInput = {
      ...baseWhere,
      ...(options?.status ? { status: options.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.complianceCheck.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ checkedAt: 'desc' }, { createdAt: 'desc' }],
        select,
      }),
      this.prisma.complianceCheck.count({ where }),
    ]);

    return { items, meta: this.paginationMeta(page, limit, total) };
  }

  async updateCompliance(
    schoolId: string,
    dto: ComplianceUpdateDto,
    userId?: string,
  ) {
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!school) throw new NotFoundException('Établissement introuvable');

    return this.prisma.complianceCheck.create({
      data: {
        schoolId,
        checkType: 'REGULAR',
        status: dto.status,
        score: dto.score,
        remarks: dto.remarks,
        checkedBy: userId,
        checkedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        score: true,
        remarks: true,
        checkedAt: true,
        school: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
            type: true,
          },
        },
      },
    });
  }

  async getReports(options?: {
    type?: ReportType;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = this.resolvePagination(options);
    const where: Prisma.MinistryReportWhereInput = options?.type
      ? { type: options.type }
      : {};
    const select = {
      id: true,
      name: true,
      description: true,
      type: true,
      period: true,
      periodStart: true,
      periodEnd: true,
      generatedAt: true,
    } as const;
    const [items, total] = await Promise.all([
      this.prisma.ministryReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        select,
      }),
      this.prisma.ministryReport.count({ where }),
    ]);

    return { items, meta: this.paginationMeta(page, limit, total) };
  }

  async generateReport(dto: GenerateReportDto, userId?: string) {
    const periodStart = this.toReportBoundary(dto.periodStart, false);
    const periodEnd = this.toReportBoundary(dto.periodEnd, true);
    if (periodStart > periodEnd) {
      throw new BadRequestException(
        'La date de début du rapport doit précéder sa date de fin',
      );
    }

    const snapshot = await this.createAggregateReportSnapshot(
      { from: periodStart, to: periodEnd },
      dto.sections,
    );
    const report = await this.prisma.ministryReport.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        period: dto.period,
        periodStart,
        periodEnd,
        data: snapshot as Prisma.InputJsonValue,
        // Un export est construit à la demande à partir de l'instantané. Il
        // n'existe donc pas de faux lien de stockage ni de fichier incomplet.
        fileUrl: null,
        generatedBy: userId,
      },
      select: { id: true, generatedAt: true },
    });

    return {
      reportId: report.id,
      status: 'READY',
      generatedAt: report.generatedAt,
    };
  }

  async getReport(reportId: string) {
    const report = await this.prisma.ministryReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        period: true,
        periodStart: true,
        periodEnd: true,
        generatedAt: true,
        data: true,
      },
    });
    if (!report) throw new NotFoundException('Rapport introuvable');

    return { ...report, data: this.safeReportSnapshot(report.data) };
  }

  async exportReport(reportId: string, format: ExportFormat) {
    const report = await this.getReport(reportId);
    return createReportExport(report, format);
  }

  private async collectApplicationAnalytics(
    filters: ResolvedAnalyticsFilters,
  ): Promise<ApplicationAnalyticsResult> {
    const records = await this.prisma.application.findMany({
      where: this.buildApplicationWhere(filters),
      // Aucun champ de candidature lié à la personne (studentId, score,
      // entretien, document…) n'est lu : il s'agit exclusivement de
      // dimensions institutionnelles nécessaires au regroupement.
      select: {
        status: true,
        submittedAt: true,
        offer: {
          select: {
            title: true,
            program: { select: { name: true } },
            school: { select: { name: true, region: true, city: true } },
          },
        },
      },
    });

    const byStatus = new Map<string, number>();
    const byRegion = new Map<string, number>();
    const byFiliere = new Map<string, FiliereAggregate>();
    const bySchool = new Map<string, SchoolAggregate>();
    const bySchoolProgramme = new Map<string, SchoolProgrammeAggregate>();
    const byPeriod = new Map<string, PeriodAggregate>();
    let acceptedCount = 0;
    let pendingCount = 0;

    for (const record of records) {
      const school = record.offer.school.name;
      const region = record.offer.school.region || UNKNOWN_REGION;
      const city = record.offer.school.city || UNKNOWN_CITY;
      const filiere = record.offer.title || 'Non renseignée';
      const programme = record.offer.program?.name || null;
      const isAccepted = ACCEPTED_APPLICATION_STATUSES.has(record.status);
      const isPending = PENDING_APPLICATION_STATUSES.has(record.status);

      byStatus.set(record.status, (byStatus.get(record.status) || 0) + 1);
      byRegion.set(region, (byRegion.get(region) || 0) + 1);
      if (isAccepted) acceptedCount += 1;
      if (isPending) pendingCount += 1;

      const filiereKey = JSON.stringify([filiere, programme]);
      this.incrementAggregate(
        byFiliere,
        filiereKey,
        { filiere, programme, count: 0, acceptedCount: 0, pendingCount: 0 },
        isAccepted,
        isPending,
      );

      const schoolKey = JSON.stringify([school, region, city]);
      this.incrementAggregate(
        bySchool,
        schoolKey,
        { school, region, city, count: 0, acceptedCount: 0, pendingCount: 0 },
        isAccepted,
        isPending,
      );

      const schoolProgrammeKey = JSON.stringify([
        school,
        region,
        city,
        filiere,
        programme,
      ]);
      this.incrementAggregate(
        bySchoolProgramme,
        schoolProgrammeKey,
        {
          school,
          region,
          city,
          filiere,
          programme,
          count: 0,
          acceptedCount: 0,
          pendingCount: 0,
        },
        isAccepted,
        isPending,
      );

      const period = this.toMonthKey(record.submittedAt);
      this.incrementAggregate(
        byPeriod,
        period,
        { period, count: 0, acceptedCount: 0, pendingCount: 0 },
        isAccepted,
        isPending,
      );
    }

    return {
      period: this.periodRange(filters),
      total: records.length,
      acceptedCount,
      pendingCount,
      byStatus: this.sortByCount(
        [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      ),
      byRegion: this.sortByCount(
        [...byRegion.entries()].map(([region, count]) => ({ region, count })),
      ).slice(0, filters.limit),
      byFiliere: this.sortByCount([...byFiliere.values()]).slice(
        0,
        filters.limit,
      ),
      bySchool: this.sortByCount([...bySchool.values()]).slice(
        0,
        filters.limit,
      ),
      bySchoolProgramme: this.sortByCount([
        ...bySchoolProgramme.values(),
      ]).slice(0, filters.limit),
      byPeriod: [...byPeriod.values()].sort((left, right) =>
        left.period.localeCompare(right.period),
      ),
    };
  }

  private async collectEnrollmentAnalytics(
    filters: ResolvedAnalyticsFilters,
  ): Promise<EnrollmentAnalyticsResult> {
    const students = await this.prisma.student.findMany({
      where: this.buildEnrollmentWhere(filters),
      // La jointure est volontairement limitée à l'établissement et au
      // programme. Aucun identifiant étudiant, nom, prénom, e-mail ou dossier
      // n'est chargé, même temporairement, pour cette statistique.
      select: {
        enrolledSchool: { select: { name: true, region: true, city: true } },
        program: { select: { name: true, diploma: true } },
      },
    });
    const bySchoolProgramme = new Map<string, EnrollmentBySchoolProgramme>();

    for (const student of students) {
      if (!student.enrolledSchool) continue;
      const school = student.enrolledSchool.name;
      const region = student.enrolledSchool.region || UNKNOWN_REGION;
      const city = student.enrolledSchool.city || UNKNOWN_CITY;
      const filiere = student.program?.name || 'Programme non renseigné';
      const programme = student.program?.diploma || 'Programme non renseigné';
      const key = JSON.stringify([school, region, city, filiere, programme]);
      const current = bySchoolProgramme.get(key) || {
        school,
        region,
        city,
        filiere,
        programme,
        enrolledCount: 0,
      };
      current.enrolledCount += 1;
      bySchoolProgramme.set(key, current);
    }

    return {
      total: students.filter((student) => student.enrolledSchool).length,
      bySchoolProgramme: this.sortByCount(
        [...bySchoolProgramme.values()],
        'enrolledCount',
      ).slice(0, filters.limit),
    };
  }

  private buildApplicationWhere(
    filters: ResolvedAnalyticsFilters,
  ): Prisma.ApplicationWhereInput {
    const schoolWhere: Prisma.SchoolWhereInput = { deletedAt: null };
    if (filters.region) {
      schoolWhere.region = {
        equals: filters.region,
        mode: 'insensitive',
      };
    }

    const offerWhere: Prisma.OfferWhereInput = {
      deletedAt: null,
      school: schoolWhere,
    };
    if (filters.schoolId) offerWhere.schoolId = filters.schoolId;
    if (filters.filiere) {
      offerWhere.OR = [
        { title: { contains: filters.filiere, mode: 'insensitive' } },
        {
          program: {
            is: { name: { contains: filters.filiere, mode: 'insensitive' } },
          },
        },
      ];
    }

    const submittedAt: Prisma.DateTimeFilter = {};
    if (filters.from) submittedAt.gte = filters.from;
    if (filters.to) submittedAt.lte = filters.to;

    return {
      deletedAt: null,
      offer: offerWhere,
      ...(Object.keys(submittedAt).length > 0 ? { submittedAt } : {}),
    };
  }

  private buildStudentPopulationWhere(
    filters: Pick<ResolvedAnalyticsFilters, 'from' | 'to'>,
  ): Prisma.StudentWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.from) createdAt.gte = filters.from;
    if (filters.to) createdAt.lte = filters.to;
    return {
      deletedAt: null,
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    };
  }

  private buildEnrollmentWhere(
    filters: Pick<ResolvedAnalyticsFilters, 'from' | 'to'>,
  ): Prisma.StudentWhereInput {
    return {
      ...this.buildStudentPopulationWhere(filters),
      enrolledSchoolId: { not: null },
      enrolledSchool: { is: { deletedAt: null } },
    };
  }

  private incrementAggregate<T extends AggregateCounter>(
    map: Map<string, T>,
    key: string,
    initial: T,
    accepted: boolean,
    pending: boolean,
  ) {
    const aggregate = map.get(key) || initial;
    aggregate.count += 1;
    if (accepted) aggregate.acceptedCount += 1;
    if (pending) aggregate.pendingCount += 1;
    map.set(key, aggregate);
  }

  private sortByCount<T extends object>(
    items: T[],
    countKey: keyof T = 'count' as keyof T,
  ) {
    return [...items].sort((left, right) => {
      const rightCount = Number(right[countKey]) || 0;
      const leftCount = Number(left[countKey]) || 0;
      if (rightCount !== leftCount) return rightCount - leftCount;
      return JSON.stringify(left).localeCompare(JSON.stringify(right));
    });
  }

  private resolveAnalyticsFilters(
    filters?: MinistryAnalyticsFilters,
  ): ResolvedAnalyticsFilters {
    const requestedLimit = Number(filters?.limit ?? DEFAULT_BREAKDOWN_LIMIT);
    return {
      ...filters,
      limit: Number.isFinite(requestedLimit)
        ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_BREAKDOWN_LIMIT)
        : DEFAULT_BREAKDOWN_LIMIT,
    };
  }

  private resolvePagination(options?: { page?: number; limit?: number }) {
    const rawPage = Number(options?.page ?? 1);
    const rawLimit = Number(options?.limit ?? DEFAULT_BREAKDOWN_LIMIT);
    const page = Number.isFinite(rawPage)
      ? Math.max(Math.floor(rawPage), 1)
      : 1;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_BREAKDOWN_LIMIT)
      : DEFAULT_BREAKDOWN_LIMIT;
    return { page, limit, skip: (page - 1) * limit };
  }

  private paginationMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  private periodRange(filters: Pick<ResolvedAnalyticsFilters, 'from' | 'to'>) {
    return {
      from: filters.from?.toISOString() || null,
      to: filters.to?.toISOString() || null,
    };
  }

  private toMonthKey(value: Date) {
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}`;
  }

  private async createAggregateReportSnapshot(
    range: Pick<MinistryAnalyticsFilters, 'from' | 'to'>,
    requestedSections?: ReportSection[],
  ) {
    const sections = new Set(
      requestedSections?.length
        ? requestedSections
        : Object.values(ReportSection),
    );
    const [dashboard, applicationStats, schoolStats, geography, compliance] =
      await Promise.all([
        this.getDashboard(range),
        this.getApplicationStats({ ...range, limit: MAX_BREAKDOWN_LIMIT }),
        this.getSchoolStats(),
        this.getGeographicStats(),
        this.getComplianceSummary(),
      ]);

    const snapshot: Record<string, unknown> = {
      schemaVersion: 'ministry-aggregate-v1',
      period: dashboard.period,
    };

    if (sections.has(ReportSection.SUMMARY)) {
      snapshot.summary = {
        totalApplications: dashboard.totalApplications,
        totalEnrolledStudents: dashboard.totalEnrolledStudents,
        totalSchools: dashboard.totalSchools,
        totalOffers: dashboard.totalOffers,
        acceptanceRate: dashboard.acceptanceRate,
      };
    }
    if (sections.has(ReportSection.APPLICATIONS)) {
      snapshot.applications = {
        byStatus: applicationStats.byStatus,
        byFiliere: applicationStats.byFiliere,
        bySchool: applicationStats.bySchool,
        bySchoolProgramme: applicationStats.bySchoolProgramme,
        byPeriod: applicationStats.byPeriod,
        enrollmentsBySchoolProgramme: dashboard.enrollmentsBySchoolProgramme,
      };
    }
    if (sections.has(ReportSection.SCHOOLS)) snapshot.schools = schoolStats;
    if (sections.has(ReportSection.GEOGRAPHY)) snapshot.geography = geography;
    if (sections.has(ReportSection.COMPLIANCE)) {
      snapshot.compliance = compliance;
    }
    return snapshot;
  }

  private async getComplianceSummary(): Promise<ComplianceSummary> {
    const checks = await this.prisma.complianceCheck.findMany({
      where: { school: { deletedAt: null } },
      orderBy: [{ checkedAt: 'desc' }, { createdAt: 'desc' }],
      // schoolId sert exclusivement à dédupliquer côté serveur. Il n'est pas
      // présent dans l'objet retourné ou enregistré dans l'instantané.
      select: { schoolId: true, status: true },
    });
    const latestStatusBySchool = new Map<string, string>();
    for (const check of checks) {
      if (!latestStatusBySchool.has(check.schoolId)) {
        latestStatusBySchool.set(check.schoolId, check.status);
      }
    }
    const byStatus = new Map<string, number>();
    for (const status of latestStatusBySchool.values()) {
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
    }
    return {
      totalSchoolsChecked: latestStatusBySchool.size,
      byStatus: this.sortByCount(
        [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      ),
    };
  }

  private toReportBoundary(value: string, endOfDay: boolean) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Date de rapport invalide');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
      );
    }
    return date;
  }

  private safeReportSnapshot(data: Prisma.JsonValue) {
    if (
      typeof data === 'object' &&
      data !== null &&
      !Array.isArray(data) &&
      data.schemaVersion === 'ministry-aggregate-v1'
    ) {
      return data;
    }

    // Les éventuels rapports historiques ne sont pas reconnus comme sûrs :
    // on les garde téléchargeables sans ré-exposer une ancienne charge utile.
    return {
      schemaVersion: 'ministry-aggregate-v1',
      summary: {
        message:
          'Rapport historique : seul le périmètre agrégé est disponible après la mise à niveau de confidentialité.',
      },
    };
  }
}
