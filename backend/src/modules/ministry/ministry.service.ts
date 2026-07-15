import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateReportDto, ReportType, ExportFormat } from './dto/report-request.dto';
import { ComplianceUpdateDto, ComplianceStatus } from './dto/compliance-update.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MinistryService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 1. DASHBOARD NATIONAL
  // ============================================================

  async getDashboard(filters?: { from?: Date; to?: Date }) {
    const where: any = {};
    if (filters?.from) where.createdAt = { gte: filters.from };
    if (filters?.to) where.createdAt = { ...where.createdAt, lte: filters.to };

    const [totalApplications, totalStudents, totalSchools, totalOffers] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.student.count(),
      this.prisma.school.count({ where: { deletedAt: null } }),
      this.prisma.offer.count({ where: { deletedAt: null } }),
    ]);

    const acceptedCount = await this.prisma.application.count({
      where: { ...where, status: 'ACCEPTED' },
    });
    const acceptanceRate = totalApplications > 0
      ? Math.round((acceptedCount / totalApplications) * 100)
      : 0;

    // Le champ gender n'existe pas encore, on met des valeurs par défaut
    const genderDistribution = {
      male: 0,
      female: 0,
      other: 0,
      unknown: 0,
    };

    const studentsByRegion = await this.prisma.student.groupBy({
      by: ['region'],
      _count: true,
      orderBy: { _count: { region: 'desc' } },
    });

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

    const filiereData = applicationsByFiliere.map((a) => ({
      filiere: offerMap.get(a.offerId) || 'Unknown',
      count: a._count,
    }));
    filiereData.sort((a, b) => b.count - a.count);

    const monthAggregation = await this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "submittedAt") as period,
        COUNT(*) as count
      FROM "applications"
      WHERE "submittedAt" IS NOT NULL
      GROUP BY DATE_TRUNC('month', "submittedAt")
      ORDER BY period DESC
      LIMIT 12
    `;

    return {
      totalApplications,
      totalStudents,
      totalSchools,
      totalOffers,
      acceptanceRate,
      genderDistribution,
      regionalDistribution: studentsByRegion.map((r) => ({
        region: r.region || 'Non renseigné',
        count: r._count,
      })),
      applicationsByFiliere: filiereData.slice(0, 10),
      trends: monthAggregation,
    };
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
    const where: any = {};

    if (filters?.from) where.submittedAt = { gte: filters.from };
    if (filters?.to) where.submittedAt = { ...where.submittedAt, lte: filters.to };

    if (filters?.region) {
      where.offer = {
        school: {
          region: filters.region,
        },
      };
    }

    if (filters?.schoolId) {
      where.offer = {
        ...where.offer,
        schoolId: filters.schoolId,
      };
    }

    if (filters?.filiere) {
      where.offer = {
        ...where.offer,
        title: { contains: filters.filiere, mode: 'insensitive' },
      };
    }

    const total = await this.prisma.application.count({ where });

    const byStatus = await this.prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const regionData = await this.prisma.$queryRaw`
      SELECT 
        s.region,
        COUNT(a.id) as count
      FROM applications a
      JOIN offers o ON a."offerId" = o.id
      JOIN schools s ON o."schoolId" = s.id
      WHERE a."deletedAt" IS NULL
        AND s."deletedAt" IS NULL
      GROUP BY s.region
      ORDER BY count DESC
    `;

    const filiereData = await this.prisma.$queryRaw`
      SELECT 
        o.title as filiere,
        COUNT(a.id) as count
      FROM applications a
      JOIN offers o ON a."offerId" = o.id
      WHERE a."deletedAt" IS NULL
        AND o."deletedAt" IS NULL
      GROUP BY o.title
      ORDER BY count DESC
      LIMIT 20
    `;

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byRegion: regionData,
      byFiliere: filiereData,
    };
  }

  // ============================================================
  // 3. STATISTIQUES DES ÉCOLES
  // ============================================================

  async getSchoolStats() {
    const [totalSchools, publicSchools, privateSchools, schoolsByRegion, offersPerSchool, applicationsPerSchool] =
      await Promise.all([
        this.prisma.school.count({ where: { deletedAt: null } }),
        this.prisma.school.count({ where: { deletedAt: null, type: 'PUBLIC' } }),
        this.prisma.school.count({ where: { deletedAt: null, type: 'PRIVATE' } }),
        this.prisma.school.groupBy({
          by: ['region'],
          where: { deletedAt: null },
          _count: true,
        }),
        this.prisma.$queryRaw<{ average: number }[]>`
          SELECT AVG(offer_count)::float as average
          FROM (
            SELECT COUNT(*) as offer_count
            FROM offers
            WHERE "deletedAt" IS NULL
            GROUP BY "schoolId"
          ) as subquery
        `,
        this.prisma.$queryRaw<{ avg: number }[]>`
          SELECT AVG(app_count)::float as avg
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

    const avgOffers = offersPerSchool.length > 0 ? offersPerSchool[0]?.average : 0;
    const avgApps = applicationsPerSchool.length > 0 ? applicationsPerSchool[0]?.avg : 0;

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
  }

  // ============================================================
  // 4. STATISTIQUES GÉOGRAPHIQUES
  // ============================================================

  async getGeographicStats() {
    const byRegion = await this.prisma.student.groupBy({
      by: ['region'],
      _count: true,
      where: { region: { not: null } },
      orderBy: { _count: { region: 'desc' } },
    });

    const byCity = await this.prisma.student.groupBy({
      by: ['city'],
      _count: true,
      where: { city: { not: null } },
      orderBy: { _count: { city: 'desc' } },
      take: 20,
    });

    return {
      byRegion: byRegion.map((r) => ({
        region: r.region,
        count: r._count,
      })),
      byCity: byCity.map((c) => ({
        city: c.city,
        count: c._count,
      })),
    };
  }

  // ============================================================
  // 5. CONFORMITÉ
  // ============================================================

  async getCompliance(options?: { status?: string; page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options?.status) where.status = options.status;

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
  }

  async updateCompliance(
    schoolId: string,
    dto: ComplianceUpdateDto,
    userId?: string,
  ) {
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
    });
    if (!school) throw new NotFoundException('School not found');

    const check = await this.prisma.complianceCheck.create({
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

    return check;
  }

  // ============================================================
  // 6. RAPPORTS
  // ============================================================

  async getReports(options?: { type?: ReportType; page?: number; limit?: number }) {
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

  async exportReport(reportId: string, format: ExportFormat): Promise<{ buffer: Buffer; contentType: string }> {
    const report = await this.getReport(reportId);

    const content = `
      REPORT: ${report.name}
      Type: ${report.type}
      Period: ${report.periodStart} - ${report.periodEnd}
      Generated: ${report.generatedAt}
      Format: ${format}
    `;

    const buffer = Buffer.from(content);

    const contentType = {
      [ExportFormat.PDF]: 'application/pdf',
      [ExportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [ExportFormat.CSV]: 'text/csv',
      [ExportFormat.JSON]: 'application/json',
    }[format] || 'text/plain';

    return { buffer, contentType };
  }
}
