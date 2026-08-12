import { PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Données pour créer un événement calendaire d'une école (journée portes ouvertes, hackathon...). */
export class CreateSchoolEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  /** Date et heure de l'événement, au format ISO 8601 (ex. 2026-09-20T08:00:00.000Z). */
  @IsDateString()
  startAt: string;
}

/** Mise à jour partielle d'un événement existant (tous les champs optionnels). */
export class UpdateSchoolEventDto extends PartialType(CreateSchoolEventDto) {}
