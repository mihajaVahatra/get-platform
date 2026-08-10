import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/**
 * Données pour créer un créneau horaire générique (time slot) défini au niveau de l'école,
 * servant de trame réutilisable pour la génération d'emploi du temps (distinct de CourseSlot
 * qui représente l'occupation effective d'un créneau par un cours précis).
 */
export class CreateSchoolTimeSlotDto {
  /** Jour de la semaine, 1 (lundi) à 7 (dimanche). */
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  /** Heure de début au format HH:mm (24h). */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "L'heure de début doit être au format HH:mm",
  })
  startTime: string;

  /** Heure de fin au format HH:mm (24h). */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "L'heure de fin doit être au format HH:mm",
  })
  endTime: string;

  /** Libellé optionnel du créneau (ex: "Créneau 1"). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  /** Active ou désactive le créneau sans le supprimer. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Données pour mettre à jour un créneau horaire existant (tous les champs optionnels). */
export class UpdateSchoolTimeSlotDto extends PartialType(CreateSchoolTimeSlotDto) {}
