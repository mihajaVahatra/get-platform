import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { EncryptionService } from '../../../common/services/encryption.service';

/**
 * Service MFA (TOTP, via speakeasy) : génération/vérification de secret,
 * activation/désactivation. Le secret TOTP est toujours chiffré au repos
 * (EncryptionService) et n'est jamais stocké ni comparé en clair, hormis
 * temporairement en mémoire lors de la vérification d'un code.
 */
@Injectable()
export class MfaService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  /**
   * Génère un nouveau secret TOTP pour l'utilisateur et le persiste chiffré
   * en base, avec `mfaEnabled: false` (le MFA n'est activé qu'après
   * verifyAndEnable). Écrase tout secret précédent.
   * @returns un QR code (data URL) à scanner et le secret en base32 pour
   * saisie manuelle dans une app d'authentification.
   */
  async generateSecret(userId: string) {
    const secret = speakeasy.generateSecret({
      name: `GET (${userId})`,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: this.encryption.encrypt(secret.base32),
        mfaEnabled: false,
      },
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      qrCode,
      secret: secret.base32,
    };
  }

  /**
   * Vérifie le code TOTP fourni contre le secret généré par generateSecret
   * et, si valide, active le MFA (`mfaEnabled: true`). Fenêtre de tolérance
   * de 2 pas (±60s) pour absorber le décalage d'horloge du client.
   * @throws BadRequestException si l'utilisateur est introuvable, si aucun
   * secret n'a été généré, ou si le code est invalide.
   */
  async verifyAndEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.mfaSecret) {
      throw new BadRequestException('MFA not configured');
    }

    const verified = speakeasy.totp.verify({
      secret: this.decryptMfaSecret(user.mfaSecret),
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      throw new BadRequestException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { success: true };
  }

  /**
   * Vérifie un code TOTP sans effet de bord (pas d'activation), utilisé à
   * la fois pour la connexion MFA (étape 2 du login) et pour confirmer
   * l'identité avant de désactiver le MFA.
   * @returns `false` (jamais d'exception) si l'utilisateur n'a pas de
   * secret MFA configuré ou si le code est invalide.
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: this.decryptMfaSecret(user.mfaSecret),
      encoding: 'base32',
      token: code,
      window: 2,
    });
  }

  /**
   * Désactive le MFA après re-vérification du code TOTP courant et efface
   * le secret stocké.
   * @throws BadRequestException si le code TOTP est invalide.
   */
  async disable(userId: string, code: string) {
    const verified = await this.verifyCode(userId, code);
    if (!verified) {
      throw new BadRequestException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: null,
        mfaEnabled: false,
      },
    });

    return { success: true };
  }

  private decryptMfaSecret(secret: string) {
    try {
      return this.encryption.decrypt(secret);
    } catch {
      // Ne jamais retourner un secret potentiellement non déchiffré : mieux
      // vaut refuser l'opération que de comparer un code TOTP à une valeur
      // dont on ne sait pas si elle est réellement le secret en clair.
      throw new BadRequestException(
        'Secret MFA illisible, contactez un administrateur',
      );
    }
  }
}
