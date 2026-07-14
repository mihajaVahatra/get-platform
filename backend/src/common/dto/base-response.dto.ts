import { ApiProperty } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class BaseResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation successful' })
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty({ type: MetaDto, required: false })
  meta?: MetaDto;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  timestamp: Date;

  @ApiProperty({ example: 200 })
  statusCode: number;
}
