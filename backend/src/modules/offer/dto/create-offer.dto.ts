import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  IsBoolean,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class CreateOfferDto {
  @ApiProperty({ example: 'Master Finance' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    example: 'Corporate finance and management control training',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'BAC+5' })
  @IsString()
  diploma: string;

  @ApiProperty({ example: 24, description: 'Duration in months' })
  @IsNumber()
  @Min(6)
  @Max(60)
  duration: number;

  @ApiProperty({ example: 4500000, description: 'Tuition fees in MGA' })
  @IsNumber()
  @Min(0)
  tuitionFees: number;

  @ApiPropertyOptional({ example: ['BAC+2 in finance', 'B2 English'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];

  @ApiPropertyOptional({ type: [String], description: 'IDs des prérequis configurés par l’école' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  requirementIds?: string[];

  @ApiPropertyOptional({ example: 30, description: 'Capacity' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: '2025-03-15' })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;

  @ApiProperty({ example: '2024-2025' })
  @IsString()
  academicYear: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiProperty({ description: 'School ID to associate the offer with' })
  @IsString()
  schoolId: string;
}
