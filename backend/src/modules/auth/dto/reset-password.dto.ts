import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Réinitialisation de mot de passe via token reçu par email. */
export class ResetPasswordDto {
  @IsString()
  token: string;

  // Borne haute alignée sur RegisterDto.password : bcrypt.hash tronque
  // silencieusement tout au-delà de 72 octets sans erreur ni avertissement —
  // sans cette limite, un mot de passe plus long semblerait accepté mais
  // seuls ses 72 premiers octets compteraient réellement à la vérification
  // (faille corrigée suite à l'audit sécurité).
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  )
  newPassword: string;
}
