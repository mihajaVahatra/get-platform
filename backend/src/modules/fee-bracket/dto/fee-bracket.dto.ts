import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * Données pour créer une tranche de frais (fee bracket).
 * Une tranche de frais définit un intervalle de montant (minFees/maxFees)
 * utilisé notamment comme filtre de recherche d'offres de formation.
 */
export class CreateFeeBracketDto {
  /** Libellé affiché de la tranche (ex: "0 - 100 000 Ar"), doit être unique. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  /** Borne minimale de la tranche. */
  @IsNumber()
  @Min(0)
  minFees: number;

  /** Borne maximale de la tranche (optionnelle : absence = tranche ouverte). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxFees?: number;

  /** Ordre d'affichage relatif des tranches (croissant). */
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  /** Active ou désactive la tranche sans la supprimer. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Données pour mettre à jour une tranche de frais (tous les champs optionnels). */
export class UpdateFeeBracketDto extends PartialType(CreateFeeBracketDto) {}
