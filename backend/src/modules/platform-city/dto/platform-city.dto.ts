import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Données pour créer une ville de la plateforme (platform city).
 * Ces villes alimentent les listes déroulantes de sélection de ville
 * (ex : localisation d'une école) ailleurs dans l'application.
 */
export class CreatePlatformCityDto {
  /** Nom de la ville, doit être unique. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** Active ou désactive la ville sans la supprimer. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Données pour mettre à jour une ville (tous les champs optionnels). */
export class UpdatePlatformCityDto extends PartialType(CreatePlatformCityDto) {}
