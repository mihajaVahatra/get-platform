import { IsEmail, IsInt, IsUUID, Min } from 'class-validator';

export class EnrollStudentDto {
  @IsEmail()
  email: string;

  @IsUUID()
  programId: string;

  @IsInt()
  @Min(1)
  level: number;

  @IsUUID()
  academicYearId: string;
}
