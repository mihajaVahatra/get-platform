import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateReportDto, ReportType, ReportPeriod, ExportFormat } from './dto/report-request.dto';
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
    if (filters?.from) where.submittedAt = { gte: filters.from };
    if (filters?.to) where.submittedAt = { ...where.submittedAt, lte: filters.to };

    // Total des candidatures
    const totalApplications = await this.prisma.application.count({ where });

    // Total des étudiants
    const totalStudents = await this.prisma.student.count();

    // Total des écoles actives
    const totalSchools = await this.prisma.school.count({
      where: { isActive: true, deletedAt: null },
    });

    // Total des offres ouvertes
    const totalOffers = await this.prisma.offer.count({
      where: { isOpen: true, deletedAt: null },
    });

    // Taux d'acceptation
    const accepted = await this.prisma.application.count({
      where: { ...where, status: 'ACCEPTED' },
    });
    const acceptanceRate = totalApplications > 0 ? (accepted / totalApplications) * 100 : 0;

    // Répartition par genre (approximatif via les étudiants)
    const students = await this.prisma.student.findMany({
      include: { user: true },
    });
    const genderDistribution = {
      male: 0,
      female: 0,
      other: 0,
      unknown: 0,
    };
    // Répartition par région
    const regionalDistribution = await this.prisma.$queryRaw`
      SELECT region, COUNT(*) as count
      FROM students
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `;

    // Répartition par filière (via les offres)
    const applicationsByFiliere = await this.prisma.$queryRaw`
      SELECT o.diploma as filiere, COUNT(a.id) as count
      FROM applications a
      JOIN offers o ON a."offerId" = o.id
      GROUP BY o.diploma
      ORDER BY count DESC
      LIMIT 10
    `;

    // Tendances mensuelles
    const monthlyTrends = await this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "submittedAt") as period,
        COUNT(*) as count
      FROM applications
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
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      genderDistribution,
      regionalDistribution,
      applicationsByFiliere,
      trends: monthlyTrends,
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
    if (filters?.schoolId) where.offer = { schoolId: filters.schoolId };

    // Total
    const total = await this.prisma.application.count({ where });

    // Par statut
    const byStatus = await this.prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    // Par région (via l'étudiant)
    const byRegion = await this.prisma.$queryRaw`
      SELECT s.region, COUNT(a.id) as count
      FROM applications a
      JOIN students s ON a."studentId" = s.id
      WHERE s.region IS NOT NULL
      GROUP BY s.region
      ORDER BY count DESC
    `;

    // Par filière (via l'offre)
    const byFiliere = await this.prisma.$queryRaw`
      SELECT o.diploma as filiere, COUNT(a.id) as count
      FROM applications a
      JOIN offers o ON a."offerId" = o.id
      GROUP BY o.diploma
      ORDER BY count DESC
    `;

    // Par genre (approximatif)
    const byGender = await this.prisma.$queryRaw`
      SELECT u.gender, COUNT(a.id) as count
      FROM applications a
      JOIN students s ON a."studentId" = s.id
      JOIN users u ON s."userId" = u.id
      WHERE u.gender IS NOT NULL
      GROUP BY u.gender
    `;

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byRegion,
      byFiliere,
      byGender,
    };
  }

  // ============================================================
  // 3. STATISTIQUES DES ÉCOLES
  // ============================================================

  async getSchoolStats() {
    const totalSchools = await this.prisma.school.count({
      where: { deletedAt: null },
    });

    const publicSchools = await this.prisma.school.count({
      where: { type: 'PUBLIC', deletedAt: null },
    });

    const privateSchools = await this.prisma.school.count({
      where: { type: 'PRIVATE', deletedAt: null },
    });

    // Par région
    const schoolsByRegion = await this.prisma.$queryRaw`
      SELECT region, COUNT(*) as count
      FROM schools
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `;

    // Nombre d'offres par école
    const offersPerSchool = await this.prisma.$queryRaw`
      SELECT 
        s.name,
        COUNT(o.id) as offerCount
      FROM schools s
      LEFT JOIN offers o ON s.id = o."schoolId"
      WHERE s."deletedAt" IS NULL
      GROUP BY s.id, s.name
      ORDER BY offerCount DESC
    `;

    // Candidatures par école
   const applicationsPerSchool = await this.prisma.$queryRaw<{ avg: number }[]>`
    SELECT AVG(app_count)::float as avg
    FROM (
      SELECT COUNT(*) as app_count
      FROM applications a
      JOIN offers o ON a."offerId" = o.id
      WHERE a."deletedAt" IS NULL
      AND o."deletedAt" IS NULL
      GROUP BY o."schoolId"
    ) as subquery
`;
const avgApps = applicationsPerSchool.length > 0 ? applicationsPerSchool[0]?.avg : 0;

    // Calcul de la moyenne
    const avgApplications = await this.prisma.$queryRaw`
      SELECT AVG(applicationCount) as avg
      FROM (
        SELECT COUNT(a.id) as applicationCount
        FROM schools s
        LEFT JOIN offers o ON s.id = o."schoolId"
        LEFT JOIN applications a ON o.id = a."offerId"
        WHERE s."deletedAt" IS NULL
        GROUP BY s.id
      ) as school_stats
    `;

    return {
      totalSchools,
      publicSchools,
      privateSchools,
      schoolsByRegion,
      offersPerSchool,
      applicationsPerSchool,
      averageApplicationsPerSchool: Number(avgApps) || 0,
    };
  }

  // ============================================================
  // 4. STATISTIQUES GÉOGRAPHIQUES
  // ============================================================

  async getGeographicStats() {
    // Étudiants par région
    const studentsByRegion = await this.prisma.$queryRaw`
      SELECT region, COUNT(*) as count
      FROM students
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `;

    // Écoles par région
    const schoolsByRegion = await this.prisma.$queryRaw`
      SELECT region, COUNT(*) as count
      FROM schools
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `;

    // Candidatures par région
    const applicationsByRegion = await this.prisma.$queryRaw`
      SELECT s.region, COUNT(a.id) as count
      FROM applications a
      JOIN students s ON a."studentId" = s.id
      WHERE s.region IS NOT NULL
      GROUP BY s.region
      ORDER BY count DESC
    `;

    return {
      studentsByRegion,
      schoolsByRegion,
      applicationsByRegion,
    };
  }

  // ============================================================
  // 5. GESTION DE LA CONFORMITÉ
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
          school: true,
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

  async updateCompliance(schoolId: string, dto: ComplianceUpdateDto, userId?: string) {
    // Vérifier que l'école existe
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
    });
    if (!school) throw new NotFoundException('School not found');

    // Créer un nouveau check
    const compliance = await this.prisma.complianceCheck.create({
      data: {
        schoolId,
        checkType: 'REGULAR',
        status: dto.status,
        score: dto.score,
        remarks: dto.remarks,
        checkedBy: userId,
        checkedAt: new Date(),
      },
      include: {
        school: true,
      },
    });

    return compliance;
  }

  // ============================================================
  // 6. GESTION DES RAPPORTS
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
    // Récupérer les données selon les sections demandées
    const data: any = {};
    if (dto.sections?.includes('applications') || !dto.sections) {
      data.applications = await this.getApplicationStats({
        from: new Date(dto.periodStart),
        to: new Date(dto.periodEnd),
      });
    }
    if (dto.sections?.includes('schools') || !dto.sections) {
      data.schools = await this.getSchoolStats();
    }
    if (dto.sections?.includes('geographic') || !dto.sections) {
      data.geographic = await this.getGeographicStats();
    }

    // Créer le rapport en base
    const report = await this.prisma.ministryReport.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        period: dto.period,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        data,
        generatedBy: userId,
        generatedAt: new Date(),
      },
    });

    // Pour le moment, on simule la génération du fichier
    // Plus tard, on générera un vrai PDF/Excel
    const fileUrl = `https://storage.get.mg/reports/${report.id}.${dto.format.toLowerCase()}`;

    await this.prisma.ministryReport.update({
      where: { id: report.id },
      data: { fileUrl },
    });

    return {
      reportId: report.id,
      status: 'COMPLETED',
      fileUrl,
    };
  }

  async getReport(id: string) {
    const report = await this.prisma.ministryReport.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async exportReport(id: string, format: ExportFormat): Promise<{ buffer: Buffer; contentType: string }> {
    const report = await this.getReport(id);

    // Simulation d'export
    // Plus tard, on générera un vrai PDF avec PDFKit ou un Excel avec ExcelJS
    const content = JSON.stringify(report.data, null, 2);
    const buffer = Buffer.from(content, 'utf-8');

    const contentType = {
      [ExportFormat.PDF]: 'application/pdf',
      [ExportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [ExportFormat.CSV]: 'text/csv',
      [ExportFormat.JSON]: 'application/json',
    }[format] || 'application/octet-stream';

    return { buffer, contentType };
  }

  // ============================================================
  // 7. STATISTIQUES PUBLIQUES (API ouverte)
  // ============================================================

  async getPublicStats() {
    // Version simplifiée et anonymisée des stats
    const totalSchools = await this.prisma.school.count({
      where: { isActive: true, deletedAt: null },
    });

    const totalOffers = await this.prisma.offer.count({
      where: { isOpen: true, deletedAt: null },
    });

    const totalApplications = await this.prisma.application.count();

    const schoolsByRegion = await this.prisma.$queryRaw`
      SELECT region, COUNT(*) as count
      FROM schools
      WHERE region IS NOT NULL AND "isActive" = true
      GROUP BY region
      ORDER BY count DESC
    `;

    return {
      totalSchools,
      totalOffers,
      totalApplications,
      schoolsByRegion,
    };
  }
}
