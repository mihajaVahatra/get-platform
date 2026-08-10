import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Vérification d'email par token de lien (JWT signé, type `email_verify`). */
export class VerifyEmailDto {
  @ApiProperty({ description: 'Token reçu dans le lien de vérification' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
