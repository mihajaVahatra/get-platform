import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GenerateReportDto,
  ReportType,
  ExportFormat,
} from './dto/report-request.dto';
import {
  ComplianceUpdateDto,
  ComplianceStatus,
} from './dto/compliance-update.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MinistryService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 1. DASHBOARD NATIONAL
  // ============================================================

  async getDashboard(filters?: { from?: Date; to?: Date }) {
    try {
      const where: any = {};
      if (filters?.from) where.createdAt = { gte: filters.from };
      if (filters?.to)
        where.createdAt = { ...where.createdAt, lte: filters.to };

      const [totalApplications, totalStudents, totalSchools, totalOffers] =
        await Promise.all([
          this.prisma.application.count({ where }),
          this.prisma.student.count(),
          this.prisma.school.count({ where: { deletedAt: null } }),
          this.prisma.offer.count({ where: { deletedAt: null } }),
        ]);

      const acceptedCount = await this.prisma.application.count({
        where: { ...where, status: 'ACCEPTED' },
      });
      const acceptanceRate =
        totalApplications > 0
          ? Math.round((acceptedCount / totalApplications) * 100)
          : 0;

      // Répartition par genre (fallback)
      const genderDistribution = {
        male: 0,
        female: 0,
        other: 0,
        unknown: totalStudents,
      };

      // Répartition par région (simplifiée)
      let regionalDistribution: any[] = [];
      try {
        const regionData = await this.prisma.student.groupBy({
          by: ['region'],
          _count: true,
        });
        regionalDistribution = regionData
          .map((r) => ({
            region: r.region || 'Non renseigné',
            count: r._count,
          }))
          .sort((a, b) => b.count - a.count);
      } catch {
        regionalDistribution = [];
      }

      // Top filières (simplifiée)
      let filiereData: any[] = [];
      try {
        const applicationsByFiliere = await this.prisma.application.groupBy({
          by: ['offerId'],
          _count: true,
        });
        const offerIds = applicationsByFiliere.map((a) => a.offerId);
        const offers = await this.prisma.offer.findMany({
          where: { id: { in: offerIds } },
          select: { id: true, title: true },
        });
        const offerMap = new Map(offers.map((o) => [o.id, o.title]));
        filiereData = applicationsByFiliere
          .map((a) => ({
            filiere: offerMap.get(a.offerId) || 'Non renseigné',
            count: a._count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      } catch {
        filiereData = [];
      }

      // Tendances mensuelles
      let monthAggregation: any[] = [];
      try {
        monthAggregation = await this.prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('month', "submittedAt") as period,
            COUNT(*)::int as count
          FROM "applications"
          WHERE "submittedAt" IS NOT NULL
          GROUP BY DATE_TRUNC('month', "submittedAt")
          ORDER BY period DESC
          LIMIT 12
        `;
      } catch {
        monthAggregation = [];
      }

      return {
        totalApplications,
        totalStudents,
        totalSchools,
        totalOffers,
        acceptanceRate,
        genderDistribution,
        regionalDistribution,
        applicationsByFiliere: filiereData,
        trends: monthAggregation,
      };
    } catch (error) {
      console.error('Erreur dashboard:', error);
      return {
        totalApplications: 0,
        totalStudents: 0,
        totalSchools: 0,
        totalOffers: 0,
        acceptanceRate: 0,
        genderDistribution: { male: 0, female: 0, other: 0, unknown: 0 },
        regionalDistribution: [],
        applicationsByFiliere: [],
        trends: [],
      };
    }
  }

  // ============================================================
  // 2. STATISTIQUES DES CANDIDATURES
  // ============================================================

  async getApplicationStats(filters?: {
    from?: Date;
    to?: Date;
    region?: string;
    filiere?: string;
    schoolId?: string;
  }) {
    try {
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

      // Répartition par région
      let regionData: any[] = [];
      try {
        regionData = await this.prisma.$queryRaw`
          SELECT 
            COALESCE(s.region, 'Non renseigné') as region,
            COUNT(a.id)::int as count
          FROM applications a
          JOIN offers o ON a."offerId" = o.id
          JOIN schools s ON o."schoolId" = s.id
          WHERE a."deletedAt" IS NULL
            AND s."deletedAt" IS NULL
          GROUP BY s.region
          ORDER BY count DESC
        `;
      } catch {
        regionData = [];
      }

      // Par filière
      let filiereData: any[] = [];
      try {
        filiereData = await this.prisma.$queryRaw`
          SELECT 
            COALESCE(o.title, 'Non renseigné') as filiere,
            COUNT(a.id)::int as count
          FROM applications a
          JOIN offers o ON a."offerId" = o.id
          WHERE a."deletedAt" IS NULL
            AND o."deletedAt" IS NULL
          GROUP BY o.title
          ORDER BY count DESC
          LIMIT 20
        `;
      } catch {
        filiereData = [];
      }

      return {
        total,
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
        byRegion: regionData,
        byFiliere: filiereData,
      };
    } catch (error) {
      console.error('Erreur stats applications:', error);
      return {
        total: 0,
        byStatus: [],
        byRegion: [],
        byFiliere: [],
      };
    }
  }

  // ============================================================
  // 3. STATISTIQUES DES ÉCOLES
  // ============================================================

  async getSchoolStats() {
    try {
      const [
        totalSchools,
        publicSchools,
        privateSchools,
        schoolsByRegion,
        offersPerSchool,
        applicationsPerSchool,
      ] = await Promise.all([
        this.prisma.school.count({ where: { deletedAt: null } }),
        this.prisma.school.count({
          where: { deletedAt: null, type: 'PUBLIC' },
        }),
        this.prisma.school.count({
          where: { deletedAt: null, type: 'PRIVATE' },
        }),
        this.prisma.school.groupBy({
          by: ['region'],
          where: { deletedAt: null },
          _count: true,
        }),
        this.prisma.$queryRaw<{ average: number }[]>`
            SELECT COALESCE(AVG(offer_count), 0)::float as average
            FROM (
              SELECT COUNT(*) as offer_count
              FROM offers
              WHERE "deletedAt" IS NULL
              GROUP BY "schoolId"
            ) as subquery
          `,
        this.prisma.$queryRaw<{ avg: number }[]>`
            SELECT COALESCE(AVG(app_count), 0)::float as avg
            FROM (
              SELECT COUNT(*) as app_count
              FROM applications a
              JOIN offers o ON a."offerId" = o.id
              WHERE a."deletedAt" IS NULL
                AND o."deletedAt" IS NULL
              GROUP BY o."schoolId"
            ) as subquery
          `,
      ]);

      const avgOffers =
        offersPerSchool.length > 0 ? offersPerSchool[0]?.average : 0;
      const avgApps =
        applicationsPerSchool.length > 0 ? applicationsPerSchool[0]?.avg : 0;

      return {
        totalSchools,
        publicSchools,
        privateSchools,
        schoolsByRegion: schoolsByRegion.map((r) => ({
          region: r.region || 'Non renseigné',
          count: r._count,
        })),
        averageOffersPerSchool: Number(avgOffers) || 0,
        averageApplicationsPerSchool: Number(avgApps) || 0,
      };
    } catch (error) {
      console.error('Erreur stats écoles:', error);
      return {
        totalSchools: 0,
        publicSchools: 0,
        privateSchools: 0,
        schoolsByRegion: [],
        averageOffersPerSchool: 0,
        averageApplicationsPerSchool: 0,
      };
    }
  }

  // ============================================================
  // 4. STATISTIQUES GÉOGRAPHIQUES
  // ============================================================

  async getGeographicStats() {
    try {
      const byRegion = await this.prisma.student.groupBy({
        by: ['region'],
        _count: true,
        where: { region: { not: null } },
      });

      const byCity = await this.prisma.student.groupBy({
        by: ['city'],
        _count: true,
        where: { city: { not: null } },
      });

      return {
        byRegion: byRegion
          .map((r) => ({
            region: r.region || 'Non renseigné',
            count: r._count,
          }))
          .sort((a, b) => b.count - a.count),
        byCity: byCity
          .map((c) => ({
            city: c.city || 'Non renseigné',
            count: c._count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
      };
    } catch (error) {
      console.error('Erreur stats géographiques:', error);
      return { byRegion: [], byCity: [] };
    }
  }

  // ============================================================
  // 5. CONFORMITÉ
  // ============================================================

  async getCompliance(options?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options?.status) where.status = options.status;

    try {
      const [items, total] = await Promise.all([
        this.prisma.complianceCheck.findMany({
          where,
          skip,
          take: limit,
          orderBy: { checkedAt: 'desc' },
          include: {
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
        }),
        this.prisma.complianceCheck.count({ where }),
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
    } catch (error) {
      console.error('Erreur conformité:', error);
      return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  // ============================================================
  // 6. CONFORMITÉ - UPDATE
  // ============================================================

  async updateCompliance(
    schoolId: string,
    dto: ComplianceUpdateDto,
    userId?: string,
  ) {
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
    });
    if (!school) throw new NotFoundException('School not found');

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
    });
  }

  // ============================================================
  // 7. RAPPORTS
  // ============================================================

  async getReports(options?: {
    type?: ReportType;
    page?: number;
    limit?: number;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options?.type) where.type = options.type;

    const [items, total] = await Promise.all([
      this.prisma.ministryReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.ministryReport.count({ where }),
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

  async generateReport(dto: GenerateReportDto, userId?: string) {
    const report = await this.prisma.ministryReport.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        period: dto.period,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        data: {
          sections: dto.sections,
          generatedAt: new Date().toISOString(),
          format: dto.format,
        },
        generatedBy: userId,
        fileUrl: `https://storage.get.mg/reports/${uuidv4()}.${dto.format.toLowerCase()}`,
      },
    });

    return {
      reportId: report.id,
      status: 'GENERATED',
      estimatedCompletion: new Date().toISOString(),
    };
  }

  async getReport(reportId: string) {
    const report = await this.prisma.ministryReport.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async exportReport(
    reportId: string,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const report = await this.getReport(reportId);

    const content = `
      REPORT: ${report.name}
      Type: ${report.type}
      Period: ${report.periodStart} - ${report.periodEnd}
      Generated: ${report.generatedAt}
      Format: ${format}
    `;

    const buffer = Buffer.from(content);

    const contentType =
      {
        [ExportFormat.PDF]: 'application/pdf',
        [ExportFormat.EXCEL]:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        [ExportFormat.CSV]: 'text/csv',
        [ExportFormat.JSON]: 'application/json',
      }[format] || 'text/plain';

    return { buffer, contentType };
  }
}
