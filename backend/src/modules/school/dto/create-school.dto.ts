import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsUrl, IsEnum } from 'class-validator';

export enum SchoolType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export class CreateSchoolDto {
  @ApiProperty({ example: 'ESMIA - École Supérieure de Management' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Training in management and international business' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: SchoolType, default: SchoolType.PRIVATE })
  @IsEnum(SchoolType)
  type: SchoolType;

  @ApiPropertyOptional({ example: 'Antananarivo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Analamanga' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'contact@esmia.mg' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+261341234567' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'https://www.esmia.mg' })
  @IsOptional()
  @IsUrl()
  website?: string;
}
