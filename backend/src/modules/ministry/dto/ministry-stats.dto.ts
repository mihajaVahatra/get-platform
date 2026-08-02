import { ApiProperty } from '@nestjs/swagger';

/**
 * Contrats Swagger des statistiques Ministry. Ils documentent exclusivement
 * des regroupements institutionnels : aucune identité ou donnée de dossier
 * étudiant ne fait partie de ces réponses.
 */
export class ApplicationStatsDto {
  @ApiProperty({
    example: { from: '2026-01-01T00:00:00.000Z', to: null },
  })
  period: { from: string | null; to: string | null };

  @ApiProperty({ example: 1240 })
  total: number;

  @ApiProperty({ example: 510 })
  acceptedCount: number;

  @ApiProperty({ example: 420 })
  pendingCount: number;

  @ApiProperty({
    type: [Object],
    example: [{ status: 'ACCEPTED', count: 510 }],
  })
  byStatus: { status: string; count: number }[];

  @ApiProperty({
    type: [Object],
    example: [{ region: 'Analamanga', count: 640 }],
  })
  byRegion: { region: string; count: number }[];

  @ApiProperty({
    type: [Object],
    example: [
      {
        filiere: 'Informatique',
        programme: 'Licence',
        count: 230,
        acceptedCount: 90,
        pendingCount: 80,
      },
    ],
  })
  byFiliere: {
    filiere: string;
    programme: string | null;
    count: number;
    acceptedCount: number;
    pendingCount: number;
  }[];

  @ApiProperty({
    type: [Object],
    example: [
      {
        school: 'ENI',
        region: 'Haute Matsiatra',
        city: 'Fianarantsoa',
        count: 180,
        acceptedCount: 70,
        pendingCount: 60,
      },
    ],
  })
  bySchool: {
    school: string;
    region: string;
    city: string;
    count: number;
    acceptedCount: number;
    pendingCount: number;
  }[];

  @ApiProperty({
    type: [Object],
    example: [
      {
        school: 'ENI',
        region: 'Haute Matsiatra',
        city: 'Fianarantsoa',
        filiere: 'Informatique',
        programme: 'Licence',
        count: 120,
        acceptedCount: 52,
        pendingCount: 41,
      },
    ],
  })
  bySchoolProgramme: {
    school: string;
    region: string;
    city: string;
    filiere: string;
    programme: string | null;
    count: number;
    acceptedCount: number;
    pendingCount: number;
  }[];

  @ApiProperty({
    type: [Object],
    example: [
      { period: '2026-01', count: 180, acceptedCount: 70, pendingCount: 60 },
    ],
  })
  byPeriod: {
    period: string;
    count: number;
    acceptedCount: number;
    pendingCount: number;
  }[];
}

export class SchoolStatsDto {
  @ApiProperty()
  totalSchools: number;

  @ApiProperty()
  publicSchools: number;

  @ApiProperty()
  privateSchools: number;

  @ApiProperty()
  totalOffers: number;

  @ApiProperty({ type: [Object] })
  schoolsByRegion: { region: string; count: number }[];

  @ApiProperty()
  averageOffersPerSchool: number;

  @ApiProperty()
  averageApplicationsPerSchool: number;
}

export class DashboardDto {
  @ApiProperty({
    example: { from: '2026-01-01T00:00:00.000Z', to: null },
  })
  period: { from: string | null; to: string | null };

  @ApiProperty()
  totalApplications: number;

  @ApiProperty()
  totalStudents: number;

  @ApiProperty()
  totalEnrolledStudents: number;

  @ApiProperty()
  totalSchools: number;

  @ApiProperty()
  totalOffers: number;

  @ApiProperty()
  acceptanceRate: number;

  @ApiProperty({ type: [Object] })
  applicationsByStatus: { status: string; count: number }[];

  @ApiProperty({ type: [Object] })
  regionalDistribution: { region: string; count: number }[];

  @ApiProperty({ type: [Object] })
  applicationsByFiliere: ApplicationStatsDto['byFiliere'];

  @ApiProperty({ type: [Object] })
  applicationsBySchool: ApplicationStatsDto['bySchool'];

  @ApiProperty({ type: [Object] })
  applicationsBySchoolProgramme: ApplicationStatsDto['bySchoolProgramme'];

  @ApiProperty({
    type: [Object],
    example: [
      {
        school: 'ENI',
        region: 'Haute Matsiatra',
        city: 'Fianarantsoa',
        filiere: 'Informatique',
        programme: 'Licence',
        enrolledCount: 95,
      },
    ],
  })
  enrollmentsBySchoolProgramme: {
    school: string;
    region: string;
    city: string;
    filiere: string;
    programme: string;
    enrolledCount: number;
  }[];

  @ApiProperty({ type: [Object] })
  trends: ApplicationStatsDto['byPeriod'];
}
