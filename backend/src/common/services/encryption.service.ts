import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

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
   * Encrypts sensitive data using AES-256-GCM
   * Returns: iv:authTag:encrypted (all in hex)
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
   * Decrypts sensitive data
   * Expected format: iv:authTag:encrypted
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
