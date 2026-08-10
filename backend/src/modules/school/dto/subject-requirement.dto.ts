import { PartialType } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

/**
 * Données pour définir un besoin d'enseignement (subject requirement) : le volume horaire
 * hebdomadaire requis pour une matière donnée sur une année académique donnée.
 * Sert d'entrée à la génération automatique de l'emploi du temps.
 */
export class CreateSubjectRequirementDto {
  /** Matière concernée par le besoin. */
  @IsUUID()
  subjectId: string;

  /** Année académique concernée par le besoin. */
  @IsUUID()
  academicYearId: string;

  /** Volume horaire hebdomadaire requis pour cette matière. */
  @IsInt()
  @Min(1)
  @Max(40)
  hoursPerWeek: number;
}

/** Données pour mettre à jour un besoin d'enseignement existant (tous les champs optionnels). */
export class UpdateSubjectRequirementDto extends PartialType(CreateSubjectRequirementDto) {}

/** Données pour affecter un enseignant à un besoin d'enseignement (matière/année) spécifique. */
export class AssignTeacherToRequirementDto {
  @IsUUID()
  teacherId: string;
}
