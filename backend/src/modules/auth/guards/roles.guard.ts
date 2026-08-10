import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

interface RequestWithRole {
  user?: { role?: string };
}

/**
 * Guard d'autorisation par rôle métier. Doit être utilisé après
 * JwtAuthGuard (dans `@UseGuards(JwtAuthGuard, RolesGuard)`) car il lit
 * `request.user.role`, peuplé par JwtStrategy. Les rôles autorisés sont
 * déclarés via le décorateur `@Roles(...)` sur la méthode ou le contrôleur.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * @returns `true` si la route est `@Public()`, si aucun rôle n'est
   * exigé (`@Roles` absent), ou si `user.role` figure dans la liste des
   * rôles requis (union sur handler + classe, le plus spécifique gagnant
   * via `getAllAndOverride`). `false` (→ 403) si un utilisateur est requis
   * mais absent, ou si son rôle ne correspond à aucun rôle autorisé.
   */
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<RequestWithRole>();
    if (!user) {
      return false;
    }
    // On suppose que user.role est une chaîne (le nom du rôle)
    return requiredRoles.some((role) => user.role === role);
  }
}
