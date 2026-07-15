import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsString } from 'class-validator';

export class NotificationPreferencesDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  emailEnabled: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  smsEnabled: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  pushEnabled: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  inAppEnabled: boolean;

  @ApiProperty({ example: ['APPLICATION_SUBMITTED', 'PAYMENT_CONFIRMED', 'STATUS_CHANGED'] })
  @IsArray()
  @IsString({ each: true })
  categories: string[];
}
