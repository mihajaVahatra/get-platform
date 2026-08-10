import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Authentifie les appels machine-à-machine (n8n) via une clé statique dans
 * l'en-tête `x-api-key`, volontairement séparée du JWT utilisateur et des
 * rôles applicatifs — aucun compte admin n'est réutilisé pour ces appels.
 */
@Injectable()
export class ServiceApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  /**
   * Vérifie que l'en-tête `x-api-key` de la requête correspond à `INTEGRATION_API_KEY`.
   * Utilise une comparaison à temps constant (`crypto.timingSafeEqual`) pour éviter
   * qu'une attaque par mesure de timing ne permette de deviner la clé caractère par
   * caractère. Lève une `UnauthorizedException` dans tous les cas d'échec.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-api-key'];
    const expected = this.config.get<string>('INTEGRATION_API_KEY');

    if (!expected) {
      throw new UnauthorizedException('Intégration non configurée');
    }
    if (typeof provided !== 'string') {
      throw new UnauthorizedException('Clé API manquante');
    }

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Clé API invalide');
    }

    return true;
  }
}
