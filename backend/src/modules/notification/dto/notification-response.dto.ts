import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty()
  createdAt: Date;
}
