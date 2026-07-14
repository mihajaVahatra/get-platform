import { ApiProperty } from '@nestjs/swagger';

export class OfferResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  diploma: string;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  tuitionFees: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ type: [String] })
  prerequisites: string[];

  @ApiProperty()
  capacity?: number;

  @ApiProperty()
  applicationDeadline?: Date;

  @ApiProperty()
  academicYear: string;

  @ApiProperty()
  isOpen: boolean;

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  school?: {
    id: string;
    name: string;
    city: string;
  };
}
