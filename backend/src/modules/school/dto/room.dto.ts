import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ROOM_TYPES = ['STANDARD', 'LAB', 'AMPHI', 'SPORT'] as const;

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  capacity?: number;

  @IsOptional()
  @IsIn(ROOM_TYPES)
  type?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
