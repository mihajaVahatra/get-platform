import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

/**
 * Payload de soumission de candidature(s) par un étudiant : une candidature
 * est créée par offre listée dans `offerIds`.
 */
export class SubmitApplicationDto {
  @ApiProperty({ example: ['offer-1', 'offer-2', 'offer-3'] })
  @IsArray()
  @IsUUID('all', { each: true })
  offerIds: string[];
}

/**
 * Résultat de la soumission en masse : classe chaque offre traitée dans l'une
 * des trois listes (voir `ApplicationService.submitApplications`).
 */
export class BulkApplicationResponseDto {
  @ApiProperty({ type: [String] })
  submitted: string[];

  @ApiProperty({ type: [String] })
  failed: string[];

  @ApiProperty({ type: [String] })
  alreadyApplied: string[];
}
