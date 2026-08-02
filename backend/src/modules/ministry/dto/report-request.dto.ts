import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

// Les différents types de rapports possibles
export enum ReportType {
  NATIONAL = 'NATIONAL', // Rapport national
  REGIONAL = 'REGIONAL', // Rapport par région
  SECTORIAL = 'SECTORIAL', // Rapport par filière
}

// Les périodes possibles
export enum ReportPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
}

// Formats d'export
export enum ExportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  JSON = 'JSON',
}

export enum ReportSection {
  SUMMARY = 'summary',
  APPLICATIONS = 'applications',
  SCHOOLS = 'schools',
  GEOGRAPHY = 'geography',
  COMPLIANCE = 'compliance',
}

export class GenerateReportDto {
  @ApiProperty({ example: 'Rapport Annuel 2024' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Description du rapport' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({ enum: ReportPeriod })
  @IsEnum(ReportPeriod)
  period: ReportPeriod;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional({ enum: ExportFormat, default: ExportFormat.PDF })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @ApiPropertyOptional({
    enum: ReportSection,
    isArray: true,
    example: [ReportSection.SUMMARY, ReportSection.APPLICATIONS],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(ReportSection, { each: true })
  sections?: ReportSection[];
}
