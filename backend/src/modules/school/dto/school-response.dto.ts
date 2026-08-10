import { ApiProperty } from '@nestjs/swagger';

/** Représentation publique d'une école telle que renvoyée par l'API (documentation Swagger). */
export class SchoolResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  city?: string;

  @ApiProperty()
  region?: string;

  @ApiProperty()
  contactEmail?: string;

  @ApiProperty()
  contactPhone?: string;

  @ApiProperty()
  website?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
