import { PartialType } from '@nestjs/swagger';
import { CreateCompetitionDto } from './create-competition.dto';

/** Données de mise à jour d'un concours : tous les champs de création, optionnels. */
export class UpdateCompetitionDto extends PartialType(CreateCompetitionDto) {}
