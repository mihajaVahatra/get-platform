import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './student.controller';

describe('ChangePasswordDto (student)', () => {
  it('accepte un nouveau mot de passe conforme de longueur normale', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'OldPass123!',
      newPassword: 'SecurePass123!',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('refuse un nouveau mot de passe de plus de 32 caractères (bcrypt tronque silencieusement au-delà de 72 octets)', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'OldPass123!',
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
