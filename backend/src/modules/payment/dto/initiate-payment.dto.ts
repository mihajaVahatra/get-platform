import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({
    example: '5d965c6d-7324-4c5b-ac04-5846f20bba66',
    description: 'Candidature concernée par le paiement',
  })
  @IsUUID()
  applicationId: string;

  @ApiProperty({ enum: ['ORANGE_MONEY', 'MVOLA', 'CARD', 'BANK_TRANSFER'] })
  @IsIn(['ORANGE_MONEY', 'MVOLA', 'CARD', 'BANK_TRANSFER'])
  method: string;
}
