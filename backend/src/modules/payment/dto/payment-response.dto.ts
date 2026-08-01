import { ApiProperty } from '@nestjs/swagger';

export class PaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  method: string;

  @ApiProperty({
    enum: [
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'REFUNDED',
      'CANCELLED',
    ],
  })
  status: string;

  @ApiProperty()
  providerRef?: string;

  @ApiProperty()
  receiptUrl?: string;

  @ApiProperty()
  paidAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  application?: {
    id: string;
    offer: {
      id: string;
      title: string;
      school: {
        id: string;
        name: string;
      };
    };
  };

  @ApiProperty()
  transaction?: {
    id: string;
    providerTransactionId: string;
    status: string;
  };
}
