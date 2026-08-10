import { IsString, Matches, MinLength } from 'class-validator';

/** Réinitialisation de mot de passe via token reçu par email. */
export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  )
  newPassword: string;
}
