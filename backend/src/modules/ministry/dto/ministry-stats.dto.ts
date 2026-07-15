import { ApiProperty } from '@nestjs/swagger';

export class ApplicationStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  byStatus: {
    status: string;
    count: number;
  }[];

  @ApiProperty()
  byRegion: {
    region: string;
    count: number;
  }[];

  @ApiProperty()
  byFiliere: {
    filiere: string;
    count: number;
  }[];

  @ApiProperty()
  byGender: {
    gender: string;
    count: number;
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
  schoolsByRegion: {
    region: string;
    count: number;
  }[];

  @ApiProperty()
  averageApplicationsPerSchool: number;

  @ApiProperty()
  totalOffers: number;
}

export class DashboardDto {
  @ApiProperty()
  totalApplications: number;

  @ApiProperty()
  totalStudents: number;

  @ApiProperty()
  totalSchools: number;

  @ApiProperty()
  totalOffers: number;

  @ApiProperty()
  acceptanceRate: number;

  @ApiProperty()
  genderDistribution: {
    male: number;
    female: number;
    other: number;
  };

  @ApiProperty()
  regionalDistribution: {
    region: string;
    count: number;
  }[];

  @ApiProperty({ type: [Object] })
  applicationsByFiliere: {
    filiere: string;
    count: number;
  }[];

  @ApiProperty({ type: [Object] })
  trends: {
    period: string;
    count: number;
  }[];
}
