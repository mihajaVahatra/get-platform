import { IsEmail, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class EnrollStudentDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsUUID()
  @IsOptional()
  programId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  programLevel?: number;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}
