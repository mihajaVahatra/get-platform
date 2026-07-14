import { ApiProperty } from '@nestjs/swagger';

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
