import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class SubmitApplicationDto {
  @ApiProperty({ example: ['offer-1', 'offer-2', 'offer-3'] })
  @IsArray()
  @IsUUID('all', { each: true })
  offerIds: string[];
}

export class BulkApplicationResponseDto {
  @ApiProperty({ type: [String] })
  submitted: string[];

  @ApiProperty({ type: [String] })
  failed: string[];

  @ApiProperty({ type: [String] })
  alreadyApplied: string[];
}
