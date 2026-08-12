import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

/** Identifiants de connexion (POST /auth/login). */
export class LoginDto {
  @ApiProperty({ example: 'jean.rakoto@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;

  // true (défaut) : cookies de session persistants (durée normale, voir
  // AuthController.setSessionCookies). false : cookies de session au sens
  // propre du terme — le navigateur les efface à sa fermeture, quelle que
  // soit la durée de vie du JWT sous-jacent. Voir AuthController pour le détail.
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
