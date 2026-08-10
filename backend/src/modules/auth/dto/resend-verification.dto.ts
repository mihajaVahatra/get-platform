import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Demande de renvoi du lien/code de vérification d'email. */
export class ResendVerificationDto {
  @ApiProperty({ example: 'jean.rakoto@email.com' })
  @IsEmail()
  email: string;
}
