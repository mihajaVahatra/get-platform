import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
  IsEmail,
  IsPhoneNumber,
} from 'class-validator';

export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class SendNotificationDto {
  @ApiProperty({ example: 'user-123' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ example: 'Welcome to GET!' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Your account has been successfully created.' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  data?: any;

  @ApiPropertyOptional({
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ example: 'WELCOME' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, any>;
}
