import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      activeSchools,
      enrolledStudents,
      distinctEnrolledStudents,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      revenue,
    ] = await Promise.all([
      this.prisma.school.count({ where: { isActive: true, deletedAt: null } }),
      // Nombre d'inscriptions actives (un étudiant à double cursus compte
      // pour 2, une par école) — voir distinctEnrolledStudents ci-dessous
      // pour le nombre réel d'étudiants.
      this.prisma.studentEnrollment.count({
        where: { status: 'ACTIVE', student: { deletedAt: null } },
      }),
      this.prisma.student.count({
        where: {
          deletedAt: null,
          schoolEnrollments: { some: { status: 'ACTIVE' } },
        },
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
      distinctEnrolledStudents,
      totalApplications,
      pendingApplications,
      acceptanceRate: totalApplications
        ? Number(((acceptedApplications / totalApplications) * 100).toFixed(1))
        : 0,
      totalRevenue: revenue._sum.amount || 0,
    };
  }
}
