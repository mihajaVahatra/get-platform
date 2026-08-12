import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { MfaService } from './mfa/mfa.service';
import { NotificationService } from '../notification/notification.service';
import { AuthService } from './auth.service';
import { CURRENT_TERMS_VERSION } from './terms.constant';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    pendingRegistration: { upsert: jest.Mock };
    refreshSession: { create: jest.Mock; updateMany: jest.Mock };
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let config: { get: jest.Mock };
  let mfaService: { verifyCode: jest.Mock };
  let notificationService: { sendRawEmail: jest.Mock };
  let encryption: { encrypt: jest.Mock; decrypt: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'user@get.mg',
    password: 'hashed-password',
    mfaEnabled: false,
    sessionVersion: 0,
    isActive: true,
    role: { name: 'STUDENT' },
    student: { firstName: 'Jean', lastName: 'Rakoto' },
    schoolAdmin: null,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(baseUser),
        update: jest.fn().mockResolvedValue(baseUser),
      },
      pendingRegistration: {
        upsert: jest.fn().mockResolvedValue({
          id: 'pending-1',
          email: 'candidat@get.mg',
          firstName: 'Jean',
        }),
      },
      refreshSession: {
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-jwt'),
      verify: jest.fn(),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };
    mfaService = { verifyCode: jest.fn() };
    notificationService = {
      sendRawEmail: jest.fn().mockResolvedValue(undefined),
    };
    encryption = {
      encrypt: jest.fn((value: string) => `enc:${value}`),
      decrypt: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      mfaService as unknown as MfaService,
      notificationService as unknown as NotificationService,
      encryption as unknown as EncryptionService,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe('register — acceptation des CGU', () => {
    it('refuse une inscription si la version des CGU acceptée ne correspond pas à la version courante', async () => {
      await expect(
        service.register({
          email: 'candidat@get.mg',
          password: 'SecurePass123!',
          firstName: 'Jean',
          lastName: 'Rakoto',
          phone: '0341234567',
          acceptedTermsVersion: '2020-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.pendingRegistration.upsert).not.toHaveBeenCalled();
    });

    it('enregistre la version acceptée et l’horodatage lorsqu’elle correspond à la version courante', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // pas de compte existant pour cet email

      await service.register({
        email: 'candidat@get.mg',
        password: 'SecurePass123!',
        firstName: 'Jean',
        lastName: 'Rakoto',
        phone: '0341234567',
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
      });

      expect(prisma.pendingRegistration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining()/expect.any() sont typés `any` par @types/jest
          create: expect.objectContaining({
            acceptedTermsVersion: CURRENT_TERMS_VERSION,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() est typé `any` par @types/jest
            acceptedTermsAt: expect.any(Date),
          }),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining()/expect.any() sont typés `any` par @types/jest
          update: expect.objectContaining({
            acceptedTermsVersion: CURRENT_TERMS_VERSION,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() est typé `any` par @types/jest
            acceptedTermsAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('login — "se souvenir de moi"', () => {
    it('signe les tokens avec rememberMe=true par défaut (case non transmise)', async () => {
      const result = await service.login({
        email: 'user@get.mg',
        password: 'SecurePass123!',
      });

      expect(result.mfaRequired).toBe(false);
      expect((result as { rememberMe: boolean }).rememberMe).toBe(true);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ rememberMe: true }),
        expect.anything(),
      );
    });

    it('propage rememberMe=false dans le payload des tokens quand la case est décochée', async () => {
      const result = await service.login({
        email: 'user@get.mg',
        password: 'SecurePass123!',
        remember: false,
      });

      expect((result as { rememberMe: boolean }).rememberMe).toBe(false);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ rememberMe: false }),
        expect.anything(),
      );
    });

    it('embarque rememberMe dans le challenge MFA quand le MFA est activé', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        mfaEnabled: true,
      });

      const result = await service.login({
        email: 'user@get.mg',
        password: 'SecurePass123!',
        remember: false,
      });

      expect(result.mfaRequired).toBe(true);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mfa_challenge',
          rememberMe: false,
        }),
        expect.anything(),
      );
    });
  });

  describe('refreshTokens — préserve le choix "se souvenir de moi"', () => {
    it('reconduit rememberMe=false d’un token de rafraîchissement qui le portait', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        sessionVersion: 0,
        rememberMe: false,
      });

      const result = await service.refreshTokens('some-refresh-token');

      expect(result.rememberMe).toBe(false);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ rememberMe: false }),
        expect.anything(),
      );
    });

    it('retombe sur rememberMe=true si le token de rafraîchissement ne le portait pas (rétrocompatibilité)', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        sessionVersion: 0,
      });

      const result = await service.refreshTokens('some-refresh-token');

      expect(result.rememberMe).toBe(true);
    });
  });
});
