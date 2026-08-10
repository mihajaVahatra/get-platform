import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Données requises pour créer une année scolaire. */
export class CreateAcademicYearDto {
  /** Libellé de l'année scolaire (ex: "2025-2026"), doit être unique. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  label: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  /** Si vrai, désigne cette année comme l'année scolaire courante (une seule à la fois). */
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

/** Données de mise à jour d'une année scolaire : tous les champs de création, optionnels. */
export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {}
