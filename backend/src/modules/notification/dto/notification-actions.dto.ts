import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsUUID } from 'class-validator';

export class SendWelcomeEmailDto {
  @ApiProperty({ example: 'user-123' })
  @IsUUID()
  userId: string;
}

export class SendPaymentConfirmationDto {
  @ApiProperty({ example: 'user-123' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'pay-123' })
  @IsUUID()
  paymentId: string;

  @ApiProperty({ example: 4500000 })
  amount: number;
}

export class SendStatusUpdateDto {
  @ApiProperty({ example: 'user-123' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'app-123' })
  @IsUUID()
  applicationId: string;

  @ApiProperty({ example: 'ACCEPTED' })
  @IsString()
  status: string;
}

export class SendReminderDto {
  @ApiProperty({ example: 'user-123' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'offer-123' })
  @IsUUID()
  offerId: string;

  @ApiProperty({ example: '2026-03-15T00:00:00.000Z' })
  @IsDateString()
  deadline: string;
}
