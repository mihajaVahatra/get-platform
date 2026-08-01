import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ example: 'Jean' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rakoto' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: '+261341234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '1998-05-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: '101234567' })
  @IsOptional()
  @IsString()
  cin?: string;

  @ApiPropertyOptional({ example: 2023 })
  @IsOptional()
  @IsInt()
  bacYear?: number;

  @ApiPropertyOptional({ example: 'S' })
  @IsOptional()
  @IsString()
  bacType?: string;

  @ApiPropertyOptional({ example: 'Antananarivo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Analakely' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Analamanga' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'Passionate about finance and management' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: ['finance', 'management', 'marketing'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ example: ['teamwork', 'leadership', 'analytical'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    example: ['become a chartered accountant', 'start my own business'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aspirations?: string[];
}
