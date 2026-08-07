import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateFeeBracketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @IsNumber()
  @Min(0)
  minFees: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxFees?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeeBracketDto extends PartialType(CreateFeeBracketDto) {}
