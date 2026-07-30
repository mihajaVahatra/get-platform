import { PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min, Matches } from 'class-validator';

export class CreateCourseSlotDto {
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "L'heure de début doit être au format HH:mm",
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "L'heure de fin doit être au format HH:mm",
  })
  endTime: string;

  @IsString()
  @IsNotEmpty()
  room: string;
}

export class UpdateCourseSlotDto extends PartialType(CreateCourseSlotDto) {}
