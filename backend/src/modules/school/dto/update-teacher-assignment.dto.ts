import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

/** Données pour mettre à jour l'affectation d'un enseignant existant dans une école (tous les champs optionnels). */
export class UpdateTeacherAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  /** Active/désactive l'affectation de l'enseignant à l'école. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) subjectIds?: string[];
}
