import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

export class InitiatePaymentDto {
  @ApiPropertyOptional({ example: 'app-123', description: 'Application ID' })
  @IsOptional()
  @IsString()
  applicationId?: string;

  @ApiProperty({ example: 4500000 })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ enum: ['ORANGE_MONEY', 'MVOLA', 'CARD', 'BANK_TRANSFER'] })
  @IsIn(['ORANGE_MONEY', 'MVOLA', 'CARD', 'BANK_TRANSFER'])
  method: string;
}
