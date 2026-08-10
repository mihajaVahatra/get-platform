import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  MaxLength,
} from 'class-validator';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  // Utilisé par le tableau de bord Ministère et les imports de données —
  // doit rester dans cette énumération pour que l'API candidat/école le
  // reconnaisse au lieu d'afficher un statut vide/inconnu.
  UNDER_REVIEW = 'UNDER_REVIEW',
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

// Transitions autorisées à partir de chaque statut. REJECTED et CANCELLED
// sont des états terminaux : sans cette garde, une candidature rejetée
// pouvait être renvoyée directement à ACCEPTED et redéclencher une
// inscription réelle (faille corrigée suite à l'audit QA).
export const APPLICATION_STATUS_TRANSITIONS: Record<
  ApplicationStatus,
  ApplicationStatus[]
> = {
  [ApplicationStatus.PENDING]: [
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.PRESELECTED,
    ApplicationStatus.TEST_SCHEDULED,
    ApplicationStatus.INTERVIEW_SCHEDULED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WAITLISTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.UNDER_REVIEW]: [
    ApplicationStatus.PRESELECTED,
    ApplicationStatus.TEST_SCHEDULED,
    ApplicationStatus.INTERVIEW_SCHEDULED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WAITLISTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.PRESELECTED]: [
    ApplicationStatus.TEST_SCHEDULED,
    ApplicationStatus.INTERVIEW_SCHEDULED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WAITLISTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.TEST_SCHEDULED]: [
    ApplicationStatus.TEST_COMPLETED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.TEST_COMPLETED]: [
    ApplicationStatus.INTERVIEW_SCHEDULED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WAITLISTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.INTERVIEW_SCHEDULED]: [
    ApplicationStatus.INTERVIEW_COMPLETED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.INTERVIEW_COMPLETED]: [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WAITLISTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.WAITLISTED]: [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.ACCEPTED]: [
    ApplicationStatus.ENROLLED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.ENROLLED]: [ApplicationStatus.CANCELLED],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.CANCELLED]: [],
};

/**
 * Payload de changement de statut d'une candidature. Le statut cible doit
 * respecter la machine à états `APPLICATION_STATUS_TRANSITIONS` (validé côté
 * service, pas ici).
 */
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

/** Payload de planification d'un entretien pour une candidature. */
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

/** Payload de planification d'un test/examen pour une candidature. */
export class ScheduleTestDto {
  @ApiProperty({ example: '2024-02-10T10:00:00Z' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'QCM' })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({ example: 'Logic test' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;

  @ApiPropertyOptional({ example: 'Amphithéâtre A, Campus Ankatso' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiPropertyOptional({ example: ["Pièce d'identité", 'Calculatrice'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredDocuments?: string[];
}
