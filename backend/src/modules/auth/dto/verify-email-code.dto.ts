import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailCodeDto {
  @ApiProperty({ example: 'jean.rakoto@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Le code doit contenir 6 chiffres' })
  code: string;
}
