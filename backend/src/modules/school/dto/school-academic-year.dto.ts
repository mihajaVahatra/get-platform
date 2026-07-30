import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSchoolAcademicYearDto {
  @IsString()
  @MaxLength(30)
  label: string;

  @IsDateString()
  enrollmentOpensAt: string;

  @IsDateString()
  enrollmentClosesAt: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateSchoolAcademicYearDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  label?: string;

  @IsOptional()
  @IsDateString()
  enrollmentOpensAt?: string;

  @IsOptional()
  @IsDateString()
  enrollmentClosesAt?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
