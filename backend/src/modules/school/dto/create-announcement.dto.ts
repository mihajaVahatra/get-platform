import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @IsString()
  @IsIn(['ALL_STUDENTS', 'CLASSES', 'STUDENTS', 'TEACHERS'])
  targetType: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classes?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  teacherIds?: string[];
}
