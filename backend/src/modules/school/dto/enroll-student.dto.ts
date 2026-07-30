import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnrollStudentDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  enrolledYear?: string;
}
