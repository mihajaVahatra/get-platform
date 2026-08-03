import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ComplianceStatus } from './compliance-update.dto';
import { ExportFormat, ReportType } from './report-request.dto';

export class DateRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ApplicationStatsQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ example: 'Analamanga' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    example: 'Informatique',
    description: "Filtre sur l'intitulé de la filière ou du programme",
  })
  @IsOptional()
  @IsString()
  filiere?: string;

  @ApiPropertyOptional({ example: 'school-uuid' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ example: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ComplianceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ComplianceStatus })
  @IsOptional()
  @IsEnum(ComplianceStatus)
  status?: ComplianceStatus;

  @ApiPropertyOptional({
    example: true,
    description:
      'Retourne uniquement le dernier contrôle de chaque établissement',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const rawValue: unknown = value;
    if (rawValue === true || rawValue === 'true') return true;
    if (rawValue === false || rawValue === 'false') return false;
    return rawValue;
  })
  @IsBoolean()
  latestOnly?: boolean;
}

export class ReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReportType })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;
}

export class ExportReportQueryDto {
  @ApiPropertyOptional({ enum: ExportFormat, default: ExportFormat.PDF })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;
}
