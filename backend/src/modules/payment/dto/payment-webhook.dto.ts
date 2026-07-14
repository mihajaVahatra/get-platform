import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, IsNumber } from 'class-validator';

export class PaymentWebhookDto {
  @ApiProperty({ example: 'MOCK-abc123' })
  @IsString()
  providerReference: string;

  @ApiProperty({ enum: ['SUCCESS', 'FAILED', 'PENDING'] })
  @IsIn(['SUCCESS', 'FAILED', 'PENDING'])
  status: string;

  @ApiProperty({ example: 'TX-12345' })
  @IsString()
  providerTransactionId: string;

  @ApiPropertyOptional({ example: 4500000 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  rawData?: any;
}
