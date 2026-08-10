import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/** Identifiants de connexion (POST /auth/login). */
export class LoginDto {
  @ApiProperty({ example: 'jean.rakoto@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;
}
