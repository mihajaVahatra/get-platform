import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Paramètres de génération automatique d'un emploi du temps pour une année académique.
 * Les filtres optionnels (classId, subjectId, teacherId, roomId) permettent de restreindre
 * la génération à un sous-ensemble (ex: régénérer uniquement pour une classe donnée)
 * plutôt que de régénérer l'intégralité de l'emploi du temps.
 */
export class GenerateScheduleDto {
  /** Année académique pour laquelle générer l'emploi du temps. */
  @IsUUID()
  academicYearId: string;

  /** Restreint la génération à une classe spécifique. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;

  /** Restreint la génération à une matière spécifique. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  /** Restreint la génération à un enseignant spécifique. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  /** Restreint la génération à une salle spécifique. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;
}
