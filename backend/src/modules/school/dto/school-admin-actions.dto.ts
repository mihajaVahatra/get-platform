import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathématiques' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}

export class UpdateSubjectDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;
}

export class CreateSchoolRequirementDto {
  @ApiProperty({ example: 'Relevé de notes du Baccalauréat' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'DOCUMENT' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'Licence' })
  @IsOptional()
  @IsString()
  diploma?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateSchoolRequirementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSchoolStudentEnrollmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiProperty({ enum: ['ACTIVE', 'WITHDRAWN', 'GRADUATED'] })
  @IsIn(['ACTIVE', 'WITHDRAWN', 'GRADUATED'])
  status: 'ACTIVE' | 'WITHDRAWN' | 'GRADUATED';
}
