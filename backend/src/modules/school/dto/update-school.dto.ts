import { PartialType } from '@nestjs/swagger';
import { CreateSchoolDto } from './create-school.dto';

/** Données pour mettre à jour une école existante (tous les champs de CreateSchoolDto rendus optionnels). */
export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {}
