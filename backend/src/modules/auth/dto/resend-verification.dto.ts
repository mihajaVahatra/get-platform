import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'jean.rakoto@email.com' })
  @IsEmail()
  email: string;
}
