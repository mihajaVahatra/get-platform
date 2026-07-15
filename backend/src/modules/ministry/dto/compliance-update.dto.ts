import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export enum ComplianceStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

export class ComplianceUpdateDto {
  @ApiProperty({ enum: ComplianceStatus })
  @IsEnum(ComplianceStatus)
  status: ComplianceStatus;

  @ApiPropertyOptional({ example: 'Documentation complète' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: 85, description: 'Score de conformité (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;
}
