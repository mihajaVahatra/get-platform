import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateSchoolProgramDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(80)
  diploma: string;

  @IsInt()
  @Min(1)
  @Max(8)
  durationYears: number;
}

export class UpdateSchoolProgramDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  diploma?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  durationYears?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
