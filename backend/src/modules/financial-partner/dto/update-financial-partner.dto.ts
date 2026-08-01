import { PartialType } from '@nestjs/swagger';
import { CreateFinancialPartnerDto } from './create-financial-partner.dto';

export class UpdateFinancialPartnerDto extends PartialType(
  CreateFinancialPartnerDto,
) {}
