import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsNumber } from 'class-validator';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  PRESELECTED = 'PRESELECTED',
  TEST_SCHEDULED = 'TEST_SCHEDULED',
  TEST_COMPLETED = 'TEST_COMPLETED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_COMPLETED = 'INTERVIEW_COMPLETED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  ENROLLED = 'ENROLLED',
  CANCELLED = 'CANCELLED',
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @ApiPropertyOptional({ example: 'Strong profile, accepted' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 85.5 })
  @IsOptional()
  @IsNumber()
  score?: number;
}

export class ScheduleInterviewDto {
  @ApiProperty({ example: '2024-02-15T14:30:00Z' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-defg-hij' })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({ example: 'Please bring your CV' })
  @IsOptional()
  @IsString()
  notes?: string;
}
