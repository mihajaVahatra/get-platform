import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class SetTravelBufferDto {
  @IsUUID()
  schoolAId: string;

  @IsUUID()
  schoolBId: string;

  @IsInt()
  @Min(0)
  @Max(480)
  minutesBuffer: number;
}
