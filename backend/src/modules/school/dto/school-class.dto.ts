import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateSchoolClassDto {
  @IsUUID()
  academicYearId: string;

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  studentCount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSchoolClassDto extends PartialType(CreateSchoolClassDto) {}
