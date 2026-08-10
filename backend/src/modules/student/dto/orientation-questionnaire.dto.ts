import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * Réponses au questionnaire d'orientation utilisées pour générer des
 * suggestions de formations/écoles (voir StudentService.generateOrientationSuggestions).
 */
export class OrientationQuestionnaireDto {
  @ApiProperty({ example: ['finance', 'management', 'marketing'] })
  @IsArray()
  @IsString({ each: true })
  interests: string[];

  @ApiProperty({ example: ['analytical', 'communication', 'leadership'] })
  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @ApiProperty({ example: ['manager', 'consultant', 'entrepreneur'] })
  @IsArray()
  @IsString({ each: true })
  careerGoals: string[];

  @ApiPropertyOptional({ example: ['BAC+5', 'BAC+3'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDiplomas?: string[];

  @ApiPropertyOptional({ example: 'finance' })
  @IsOptional()
  @IsString()
  preferredDomain?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  interestedInInternational?: boolean;
}
