import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

/** Données pour affecter un enseignant à une école (création d'un rattachement enseignant/école). */
export class AssignTeacherDto {
  /** Identifiant de l'enseignant (compte utilisateur) à affecter. */
  @IsUUID()
  teacherId: string;

  /** Département/filière d'affectation au sein de l'école. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  /** Spécialité de l'enseignant dans ce contexte. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;
  /** Matières que l'enseignant est habilité à enseigner dans cette école. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) subjectIds?: string[];
}
