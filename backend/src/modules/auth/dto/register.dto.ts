import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/** Données d'inscription étudiante (POST /auth/register). */
export class RegisterDto {
  @ApiProperty({ example: 'jean.rakoto@email.com' })
  @IsEmail()
  email: string;

  // Regex exigeant majuscule + minuscule + chiffre + caractère spécial,
  // en plus des bornes de longueur (8-32).
  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial',
    },
  )
  password: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Rakoto' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: '034 12 345 67' })
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire' })
  @IsString()
  @MaxLength(30)
  phone: string;

  // Doit correspondre exactement à CURRENT_TERMS_VERSION (voir
  // terms.constant.ts) — envoyée par le frontend au moment où l'utilisateur
  // coche la case d'acceptation, jamais déduite côté serveur.
  @ApiProperty({
    example: '2026-08-11',
    description:
      'Version des CGU/politique de confidentialité affichée au moment de l’acceptation',
  })
  @IsNotEmpty({ message: 'L’acceptation des CGU est obligatoire' })
  @IsString()
  acceptedTermsVersion: string;
}
