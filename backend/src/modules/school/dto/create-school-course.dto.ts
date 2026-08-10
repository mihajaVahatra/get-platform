import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Données pour créer un cours dispensé par une école (rattaché à un programme, un niveau et un enseignant). */
export class CreateSchoolCourseDto {
  /** Enseignant responsable du cours. */
  @IsUUID()
  teacherId: string;

  /** Code court identifiant le cours (ex: "MATH101"). */
  @IsString()
  code: string;

  /** Matière enseignée. */
  @IsUUID()
  subjectId: string;

  /** Description libre du contenu du cours. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  /** Programme (filière/diplôme) auquel appartient le cours. */
  @IsUUID()
  programId: string;

  /** Niveau/année du programme concerné par ce cours. */
  @IsInt()
  @Min(1)
  programLevel: number;

  /** Groupe/section d'étudiants concerné, si le cours est dédoublé en groupes. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  group?: string;

  /** Nombre de crédits académiques attribués au cours. */
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  credits?: number;

  /** Salle par défaut du cours (texte libre, distinct du modèle Room). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  room?: string;

  /** Description libre de l'horaire du cours. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schedule?: string;

  /** Indique si le cours est visible/publié aux étudiants. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/** Données pour mettre à jour un cours existant (tous les champs optionnels). */
export class UpdateSchoolCourseDto extends PartialType(CreateSchoolCourseDto) {}
