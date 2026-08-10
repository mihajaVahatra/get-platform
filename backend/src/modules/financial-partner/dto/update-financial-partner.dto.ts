import { PartialType } from '@nestjs/swagger';
import { CreateFinancialPartnerDto } from './create-financial-partner.dto';

/** Données de mise à jour d'un partenaire financier : tous les champs de création, optionnels. */
export class UpdateFinancialPartnerDto extends PartialType(
  CreateFinancialPartnerDto,
) {}
