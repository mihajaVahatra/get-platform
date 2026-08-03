import { ComplianceStatus } from './dto/compliance-update.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MinistryService } from './ministry.service';

type SelectQuery = { select: Record<string, unknown> };
type ApplicationQuery = SelectQuery & {
  where?: { submittedAt?: { gte?: Date; lte?: Date } };
};

function firstMockArgument(mock: unknown): unknown {
  const candidate = mock as { mock?: { calls?: unknown[][] } };
  return candidate.mock?.calls?.[0]?.[0];
}

describe('MinistryService', () => {
  const buildPrisma = () => ({
    application: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    student: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    studentEnrollment: {
      findMany: jest.fn(),
    },
    school: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    offer: { count: jest.fn() },
    complianceCheck: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    ministryReport: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  });

  it('agrège les candidatures par établissement et programme sans lire de données élèves', async () => {
    const prisma = buildPrisma();
    prisma.application.findMany.mockResolvedValue([
      {
        status: 'ACCEPTED',
        submittedAt: new Date('2026-01-10T10:00:00.000Z'),
        offer: {
          title: 'Informatique',
          program: { name: 'Licence' },
          school: {
            name: 'ENI',
            region: 'Haute Matsiatra',
            city: 'Fianarantsoa',
          },
        },
      },
      {
        status: 'PENDING',
        submittedAt: new Date('2026-01-12T10:00:00.000Z'),
        offer: {
          title: 'Informatique',
          program: { name: 'Licence' },
          school: {
            name: 'ENI',
            region: 'Haute Matsiatra',
            city: 'Fianarantsoa',
          },
        },
      },
    ]);
    const service = new MinistryService(prisma as unknown as PrismaService);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T23:59:59.999Z');

    const result = await service.getApplicationStats({ from, to });

    expect(result).toMatchObject({
      total: 2,
      acceptedCount: 1,
      pendingCount: 1,
      bySchoolProgramme: [
        {
          school: 'ENI',
          filiere: 'Informatique',
          programme: 'Licence',
          count: 2,
          acceptedCount: 1,
          pendingCount: 1,
        },
      ],
    });
    const query = firstMockArgument(
      prisma.application.findMany,
    ) as ApplicationQuery;
    expect(query.where?.submittedAt).toEqual({ gte: from, lte: to });
    expect(query.select).not.toHaveProperty('student');
    expect(query.select).not.toHaveProperty('studentId');
    expect(JSON.stringify(result)).not.toContain('studentId');
    expect(JSON.stringify(result)).not.toContain('firstName');
  });

  it('retourne les inscriptions uniquement sous forme de compteurs établissement-programme', async () => {
    const prisma = buildPrisma();
    prisma.application.findMany.mockResolvedValue([]);
    // s1 est inscrit à la fois à ENI (Informatique) et à Poly (Génie Civil) —
    // double cursus légitime : total (lignes d'inscription) doit valoir 3
    // mais totalDistinctStudents (étudiants réels) ne doit valoir que 2.
    prisma.studentEnrollment.findMany.mockResolvedValue([
      {
        studentId: 's1',
        school: { name: 'ENI', region: 'Haute Matsiatra', city: 'Fianarantsoa' },
        program: { name: 'Informatique', diploma: 'Licence' },
      },
      {
        studentId: 's1',
        school: { name: 'Poly', region: 'Analamanga', city: 'Antananarivo' },
        program: { name: 'Génie Civil', diploma: 'Licence' },
      },
      {
        studentId: 's2',
        school: { name: 'ENI', region: 'Haute Matsiatra', city: 'Fianarantsoa' },
        program: { name: 'Informatique', diploma: 'Licence' },
      },
    ]);
    prisma.student.count.mockResolvedValue(3);
    prisma.school.count.mockResolvedValue(1);
    prisma.offer.count.mockResolvedValue(3);
    const service = new MinistryService(prisma as unknown as PrismaService);

    const dashboard = await service.getDashboard();

    expect(dashboard.totalEnrolledStudents).toBe(3);
    expect(dashboard.totalDistinctEnrolledStudents).toBe(2);
    expect(dashboard.enrollmentsBySchoolProgramme).toEqual([
      {
        school: 'ENI',
        region: 'Haute Matsiatra',
        city: 'Fianarantsoa',
        filiere: 'Informatique',
        programme: 'Licence',
        enrolledCount: 2,
      },
      {
        school: 'Poly',
        region: 'Analamanga',
        city: 'Antananarivo',
        filiere: 'Génie Civil',
        programme: 'Licence',
        enrolledCount: 1,
      },
    ]);
    const query = firstMockArgument(
      prisma.studentEnrollment.findMany,
    ) as SelectQuery;
    expect(query.select).not.toHaveProperty('firstName');
    expect(query.select).not.toHaveProperty('lastName');
    expect(query.select).not.toHaveProperty('user');
  });

  it('calcule un état de conformité courant, puis applique le filtre de statut', async () => {
    const prisma = buildPrisma();
    prisma.complianceCheck.findMany.mockResolvedValue([
      {
        id: 'newest-school-a',
        status: ComplianceStatus.PASSED,
        score: 90,
        remarks: null,
        checkedAt: new Date('2026-02-01T00:00:00.000Z'),
        school: {
          id: 'school-a',
          name: 'ENI',
          city: 'Fianarantsoa',
          region: 'Haute Matsiatra',
          type: 'PUBLIC',
        },
      },
      {
        id: 'old-school-a',
        status: ComplianceStatus.FAILED,
        score: 30,
        remarks: null,
        checkedAt: new Date('2026-01-01T00:00:00.000Z'),
        school: {
          id: 'school-a',
          name: 'ENI',
          city: 'Fianarantsoa',
          region: 'Haute Matsiatra',
          type: 'PUBLIC',
        },
      },
      {
        id: 'newest-school-b',
        status: ComplianceStatus.FAILED,
        score: 40,
        remarks: null,
        checkedAt: new Date('2026-01-15T00:00:00.000Z'),
        school: {
          id: 'school-b',
          name: 'ESSA',
          city: 'Antananarivo',
          region: 'Analamanga',
          type: 'PUBLIC',
        },
      },
    ]);
    const service = new MinistryService(prisma as unknown as PrismaService);

    const result = await service.getCompliance({
      latestOnly: true,
      status: ComplianceStatus.FAILED,
    });

    expect(result.meta.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 'newest-school-b' });
  });
});
