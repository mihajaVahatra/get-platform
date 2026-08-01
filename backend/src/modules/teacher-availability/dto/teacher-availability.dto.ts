import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DeclareUnavailabilityDto {
  @ValidateIf((dto) => !dto.date)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ValidateIf((dto) => dto.dayOfWeek === undefined)
  @IsDateString()
  date?: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: "L'heure de début doit être au format HH:mm" })
  startTime: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: "L'heure de fin doit être au format HH:mm" })
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
