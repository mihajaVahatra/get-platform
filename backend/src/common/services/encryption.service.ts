import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Service de chiffrement symétrique (AES-256-GCM) pour les données sensibles au repos
 * (ex: secrets, identifiants tiers). La clé est lue depuis la variable d'environnement
 * `ENCRYPTION_KEY` (hexadécimal 32 octets) au démarrage du service.
 */
@Injectable()
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  /**
   * Charge et valide la clé de chiffrement depuis la configuration.
   * Nettoie les guillemets et le préfixe `0x` éventuels, puis vérifie qu'il s'agit
   * bien d'une clé hexadécimale de 32 octets (64 caractères hex) ; lève une erreur
   * bloquante au démarrage sinon, pour éviter de démarrer avec un chiffrement invalide.
   */
  constructor(private config: ConfigService) {
    const configuredSecret = this.config.get<string>('ENCRYPTION_KEY');
    const secret = configuredSecret
      ?.trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/^0x/i, '');
    if (!secret) {
      throw new Error('ENCRYPTION_KEY is not defined in environment variables');
    }
    if (!/^[a-fA-F0-9]{64}$/.test(secret)) {
      throw new Error('ENCRYPTION_KEY must be a 32-byte hexadecimal key');
    }
    this.key = Buffer.from(secret, 'hex');
  }

  /**
   * Chiffre une chaîne en clair avec AES-256-GCM (IV aléatoire à chaque appel).
   * @param text Texte en clair à chiffrer.
   * @returns Chaîne au format `iv:authTag:encrypted` (tout en hexadécimal).
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as any).getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Déchiffre une chaîne précédemment produite par `encrypt`.
   * @param encryptedData Chaîne au format `iv:authTag:encrypted` (hexadécimal).
   * @returns Le texte en clair d'origine.
   * @throws {Error} Si le format ne comporte pas exactement 3 segments, ou si le
   * tag d'authentification GCM ne correspond pas (donnée altérée ou mauvaise clé).
   */
  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    (decipher as any).setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
