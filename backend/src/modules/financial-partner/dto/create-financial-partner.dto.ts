import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUrl,
  IsIn,
  MaxLength,
} from 'class-validator';

export const FINANCIAL_PARTNER_TYPES = [
  'BANK',
  'MOBILE_MONEY',
  'INSURANCE',
  'SCHOLARSHIP',
  'OTHER',
] as const;

export class CreateFinancialPartnerDto {
  @ApiProperty({ example: 'BNI Madagascar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: FINANCIAL_PARTNER_TYPES, default: 'OTHER' })
  @IsOptional()
  @IsIn(FINANCIAL_PARTNER_TYPES)
  type?: string;

  @ApiPropertyOptional({ example: 'contact@bni.mg' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+261 20 22 123 45' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'https://www.bni.mg' })
  @IsOptional()
  @IsUrl()
  website?: string;
}
