import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsString()
  @MaxLength(120)
  platformName: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
