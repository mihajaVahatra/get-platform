import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignTeacherDto {
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) subjectIds?: string[];
}
