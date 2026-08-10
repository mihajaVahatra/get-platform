import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Données pour créer une classe (groupe d'étudiants) au sein d'une école pour une année académique. */
export class CreateSchoolClassDto {
  /** Année académique à laquelle appartient la classe. */
  @IsUUID()
  academicYearId: string;

  /** Programme (filière/diplôme) associé à la classe, le cas échéant. */
  @IsOptional()
  @IsUUID()
  programId?: string;

  /** Nom de la classe (ex: "Terminale A"). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** Niveau/année d'études de la classe. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number;

  /** Effectif d'étudiants dans la classe (valeur informative, pas nécessairement synchronisée avec les inscriptions réelles). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  studentCount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Données pour mettre à jour une classe existante (tous les champs optionnels). */
export class UpdateSchoolClassDto extends PartialType(CreateSchoolClassDto) {}
