import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      activeSchools,
      enrolledStudents,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      revenue,
    ] = await Promise.all([
      this.prisma.school.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.student.count({
        where: { enrolledSchoolId: { not: null }, enrollmentStatus: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.application.count({ where: { deletedAt: null } }),
      this.prisma.application.count({ where: { deletedAt: null, status: 'PENDING' } }),
      this.prisma.application.count({ where: { deletedAt: null, status: 'ACCEPTED' } }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    return {
      activeSchools,
      enrolledStudents,
      totalApplications,
      pendingApplications,
      acceptanceRate: totalApplications
        ? Number(((acceptedApplications / totalApplications) * 100).toFixed(1))
        : 0,
      totalRevenue: revenue._sum.amount || 0,
    };
  }
}
