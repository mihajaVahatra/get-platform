import { PartialType } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateSubjectRequirementDto {
  @IsUUID()
  subjectId: string;

  @IsUUID()
  academicYearId: string;

  @IsInt()
  @Min(1)
  @Max(40)
  hoursPerWeek: number;
}

export class UpdateSubjectRequirementDto extends PartialType(CreateSubjectRequirementDto) {}

export class AssignTeacherToRequirementDto {
  @IsUUID()
  teacherId: string;
}
