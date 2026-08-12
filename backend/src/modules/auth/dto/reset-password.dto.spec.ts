import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  it('accepte un mot de passe conforme de longueur normale', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'token-1',
      newPassword: 'SecurePass123!',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('refuse un mot de passe de plus de 32 caractères (bcrypt tronque silencieusement au-delà de 72 octets)', async () => {
    // 33 caractères : dépasse la borne, bien avant même d'approcher les 72
    // octets où bcrypt.hash tronquerait silencieusement l'entrée sans
    // erreur — la limite applicative doit intervenir en premier.
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'token-1',
      newPassword: 'A'.repeat(30) + '1a!',
    });

    const errors = await validate(dto);

    expect(
      errors.some(
        (e) => e.property === 'newPassword' && e.constraints?.maxLength,
      ),
    ).toBe(true);
  });
});
