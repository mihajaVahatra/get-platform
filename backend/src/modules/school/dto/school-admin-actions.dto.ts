import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Données pour créer une matière (subject) enseignable au sein d'une école. */
export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathématiques' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}

/** Données pour activer/désactiver une matière. */
export class UpdateSubjectDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;
}

/** Données pour créer une condition d'admission (pièce justificative ou critère) requise par une école. */
export class CreateSchoolRequirementDto {
  @ApiProperty({ example: 'Relevé de notes du Baccalauréat' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Nature de l'exigence (ex: "DOCUMENT"), texte libre. */
  @ApiPropertyOptional({ example: 'DOCUMENT' })
  @IsOptional()
  @IsString()
  type?: string;

  /** Diplôme concerné par cette exigence, le cas échéant. */
  @ApiPropertyOptional({ example: 'Licence' })
  @IsOptional()
  @IsString()
  diploma?: string;

  /** Indique si l'exigence est obligatoire (true) ou simplement recommandée (false). */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

/** Données pour mettre à jour une condition d'admission existante (tous les champs optionnels). */
export class UpdateSchoolRequirementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Données pour modifier l'inscription d'un étudiant (changement de programme, de niveau ou de statut). */
export class UpdateSchoolStudentEnrollmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  /** Statut de l'inscription : active, abandonnée (retrait) ou terminée (diplômé). Champ obligatoire. */
  @ApiProperty({ enum: ['ACTIVE', 'WITHDRAWN', 'GRADUATED'] })
  @IsIn(['ACTIVE', 'WITHDRAWN', 'GRADUATED'])
  status: 'ACTIVE' | 'WITHDRAWN' | 'GRADUATED';
}
