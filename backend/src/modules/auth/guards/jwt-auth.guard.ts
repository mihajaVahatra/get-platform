import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Guard d'authentification JWT. Étend le guard Passport standard (stratégie
 * 'jwt', voir JwtStrategy) pour ajouter le contournement `@Public()` :
 * toute route/contrôleur marqué `@Public()` court-circuite la vérification
 * du token et est accessible sans authentification.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * @returns `true` sans vérifier de token si la route/le contrôleur est
   * `@Public()` ; sinon délègue à AuthGuard('jwt') qui exécute
   * JwtStrategy.validate et rejette avec 401 si le token est absent/invalide.
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
