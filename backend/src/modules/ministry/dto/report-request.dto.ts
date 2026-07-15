import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

// Les différents types de rapports possibles
export enum ReportType {
  NATIONAL = 'NATIONAL',      // Rapport national
  REGIONAL = 'REGIONAL',      // Rapport par région
  SECTORIAL = 'SECTORIAL',    // Rapport par filière
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

  @ApiProperty({ enum: ExportFormat, default: ExportFormat.PDF })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({ type: [String], example: ['applications', 'schools', 'payments'] })
  @IsOptional()
  sections?: string[];
}
