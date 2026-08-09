import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token reçu dans le lien de vérification' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
