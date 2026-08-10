import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Données pour créer un programme (filière de formation menant à un diplôme) proposé par une école. */
export class CreateSchoolProgramDto {
  /** Nom du programme (ex: "Licence en Informatique"). */
  @IsString()
  @MaxLength(120)
  name: string;

  /** Diplôme délivré à l'issue du programme. */
  @IsString()
  @MaxLength(80)
  diploma: string;

  /** Durée du programme en années. */
  @IsInt()
  @Min(1)
  @Max(8)
  durationYears: number;
}

/** Données pour mettre à jour un programme existant (tous les champs optionnels). */
export class UpdateSchoolProgramDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  diploma?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  durationYears?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
