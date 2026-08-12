import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { MFA_EXEMPT_KEY } from '../../../common/decorators/mfa-exempt.decorator';

interface RequestWithMfaUser {
  user?: { role?: string; mfaEnabled?: boolean };
}

/**
 * Rôles à privilèges élevés (voir le même ensemble utilisé par
 * `@Roles(...)` sur les endpoints /auth/mfa/*) : ce sont les comptes les
 * plus sensibles de la plateforme (accès multi-établissements/national),
 * donc les seuls pour qui le MFA passe d'optionnel à obligatoire.
 */
const MFA_REQUIRED_ROLES = ['ADMIN_GET', 'SCHOOL_ADMIN', 'MINISTRY'];

/**
 * Garde-fou global : un compte à rôle privilégié qui n'a pas encore activé
 * le MFA ne peut atteindre que les endpoints strictement nécessaires pour
 * l'activer (`@MfaExempt()` — /auth/me, /auth/mfa/enable, /auth/mfa/verify)
 * ou les endpoints déjà `@Public()` (login, refresh, logout : sinon un
 * compte non enrôlé ne pourrait même pas se connecter ou se déconnecter).
 * Tout le reste renvoie 403 tant que le MFA n'est pas actif — voir
 * AuthController.enableMfa/verifyMfa pour le parcours d'activation.
 *
 * Doit être enregistré après JwtAuthGuard (voir AppModule) : il lit
 * `request.user`, peuplé par JwtStrategy.
 */
@Injectable()
export class MfaEnforcedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isMfaExempt = this.reflector.getAllAndOverride<boolean>(
      MFA_EXEMPT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isMfaExempt) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithMfaUser>();
    if (!user || !MFA_REQUIRED_ROLES.includes(user.role ?? '')) {
      return true;
    }

    if (user.mfaEnabled) {
      return true;
    }

    throw new ForbiddenException(
      "L'authentification à deux facteurs (MFA) est obligatoire pour ce rôle. " +
        'Active-la via /auth/mfa/enable puis /auth/mfa/verify avant de continuer.',
    );
  }
}
