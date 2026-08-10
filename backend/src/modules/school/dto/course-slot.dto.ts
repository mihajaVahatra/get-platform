import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min, Matches } from 'class-validator';

/** Données pour créer un créneau horaire (slot) associé à un cours dans l'emploi du temps. */
export class CreateCourseSlotDto {
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

  /** Salle où se déroule le cours pour ce créneau. */
  @IsString()
  @IsNotEmpty()
  room: string;
}

/** Données pour mettre à jour un créneau horaire existant (tous les champs optionnels). */
export class UpdateCourseSlotDto extends PartialType(CreateCourseSlotDto) {}
