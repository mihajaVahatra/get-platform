import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/** Données pour créer une année académique d'une école, avec sa période d'ouverture des inscriptions. */
export class CreateSchoolAcademicYearDto {
  /** Libellé de l'année académique (ex: "2025-2026"). */
  @IsString()
  @MaxLength(30)
  label: string;

  /** Date/heure d'ouverture des inscriptions pour cette année. */
  @IsDateString()
  enrollmentOpensAt: string;

  /** Date/heure de fermeture des inscriptions pour cette année. */
  @IsDateString()
  enrollmentClosesAt: string;

  /** Marque cette année comme étant l'année académique active de l'école. */
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

/** Données pour mettre à jour une année académique existante (tous les champs optionnels). */
export class UpdateSchoolAcademicYearDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  label?: string;

  @IsOptional()
  @IsDateString()
  enrollmentOpensAt?: string;

  @IsOptional()
  @IsDateString()
  enrollmentClosesAt?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
