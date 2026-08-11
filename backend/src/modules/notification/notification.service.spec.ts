import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from './dto/send-notification.dto';
import { NotificationService } from './notification.service';

type SendResult = {
  success: boolean;
  reason?: string;
  notificationId?: string;
  providerResult?: { status: string };
};

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: {
    user: { findUnique: jest.Mock };
    notification: { create: jest.Mock };
    notificationPreference: { upsert: jest.Mock };
  };
  let config: { get: jest.Mock };
  let encryption: { decrypt: jest.Mock };

  const defaultPreferences = {
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    categories: ['WELCOME'],
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
      notificationPreference: {
        upsert: jest
          .fn()
          .mockResolvedValue({ userId: 'user-1', ...defaultPreferences }),
      },
    };
    config = { get: jest.fn().mockReturnValue(undefined) };
    encryption = { decrypt: jest.fn().mockReturnValue('+261340000000') };
    service = new NotificationService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      encryption as unknown as EncryptionService,
    );
  });

  describe('préférences', () => {
    it('crée des préférences par défaut persistées au premier accès', async () => {
      const result = await service.getUserPreferences('user-1');

      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: {},
        create: { userId: 'user-1' },
      });
      expect(result).toEqual(defaultPreferences);
    });

    it('persiste réellement les préférences modifiées, pas juste en mémoire', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      const updated = {
        emailEnabled: false,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        categories: ['PAYMENT_CONFIRMED'],
      };
      prisma.notificationPreference.upsert.mockResolvedValue({
        userId: 'user-1',
        ...updated,
      });

      const result = await service.updatePreferences('user-1', updated);

      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: updated,
        create: { userId: 'user-1', ...updated },
      });
      expect(result).toEqual({ success: true, preferences: updated });
    });
  });

  describe('SMS et push — pas de prestataire réel intégré', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@get.mg',
        student: { phone: 'encrypted-phone' },
      });
    });

    it('marque le SMS comme SIMULATED, jamais SENT, en l’absence de prestataire réel', async () => {
      const result = (await service.send({
        userId: 'user-1',
        type: NotificationType.SMS,
        title: 'Test',
        body: 'Corps',
      })) as SendResult;

      expect(result.providerResult?.status).toBe('SIMULATED');
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SIMULATED' }),
        }),
      );
    });

    it('marque le push comme SIMULATED, jamais SENT', async () => {
      const result = (await service.send({
        userId: 'user-1',
        type: NotificationType.PUSH,
        title: 'Test',
        body: 'Corps',
      })) as SendResult;

      expect(result.providerResult?.status).toBe('SIMULATED');
    });

    it('refuse un SMS simulé en production sans ALLOW_SIMULATED_SMS et trace l’échec', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'production' : undefined,
      );

      await expect(
        service.send({
          userId: 'user-1',
          type: NotificationType.SMS,
          title: 'Test',
          body: 'Corps',
        }),
      ).rejects.toThrow(/Aucun prestataire SMS réel intégré/);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'FAILED',
          failureReason: expect.stringContaining(
            'Aucun prestataire SMS réel intégré',
          ),
        }),
      });
    });

    it('autorise le SMS simulé en production si ALLOW_SIMULATED_SMS=true', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'ALLOW_SIMULATED_SMS') return 'true';
        return undefined;
      });

      const result = (await service.send({
        userId: 'user-1',
        type: NotificationType.SMS,
        title: 'Test',
        body: 'Corps',
      })) as SendResult;

      expect(result.success).toBe(true);
      expect(result.providerResult?.status).toBe('SIMULATED');
    });

    it('refuse le push simulé en production sans ALLOW_SIMULATED_PUSH', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'production' : undefined,
      );

      await expect(
        service.send({
          userId: 'user-1',
          type: NotificationType.PUSH,
          title: 'Test',
          body: 'Corps',
        }),
      ).rejects.toThrow(/Aucun prestataire PUSH réel intégré/);
    });
  });

  describe('traçabilité des échecs', () => {
    it('trace en base un échec SMS dû à un numéro illisible, puis relance l’erreur', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@get.mg',
        student: { phone: 'encrypted-phone' },
      });
      encryption.decrypt.mockImplementation(() => {
        throw new Error('bad key');
      });

      await expect(
        service.send({
          userId: 'user-1',
          type: NotificationType.SMS,
          title: 'Test',
          body: 'Corps',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          failureReason: expect.any(String),
        }),
      });
    });

    it('n’enregistre aucune notification si le canal est désactivé par préférence', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@get.mg',
      });
      prisma.notificationPreference.upsert.mockResolvedValue({
        userId: 'user-1',
        ...defaultPreferences,
        emailEnabled: false,
      });

      const result = (await service.send({
        userId: 'user-1',
        type: NotificationType.EMAIL,
        title: 'Test',
        body: 'Corps',
      })) as SendResult;

      expect(result).toEqual({ success: false, reason: 'Channel disabled' });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
