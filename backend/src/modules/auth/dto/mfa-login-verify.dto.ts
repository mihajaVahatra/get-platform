import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Étape 2 du login MFA (POST /auth/mfa/login-verify). */
export class MfaLoginVerifyDto {
  @ApiProperty({ description: 'Jeton de challenge MFA reçu après le login' })
  @IsString()
  challengeToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
