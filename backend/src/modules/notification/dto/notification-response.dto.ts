import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  data?: any;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  readAt?: Date;

  @ApiProperty()
  sentAt?: Date;

  @ApiProperty({
    example: 'SENT',
    description:
      'SENT, SIMULATED (aucun prestataire réel intégré), STORED (in-app) ou FAILED',
  })
  status: string;

  @ApiPropertyOptional()
  failureReason?: string;

  @ApiProperty()
  createdAt: Date;
}
