import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @IsEmail()
  recipientEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20000)
  body: string;
}
