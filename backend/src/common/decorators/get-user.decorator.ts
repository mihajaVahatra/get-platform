import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur de paramètre injectant l'utilisateur authentifié (attaché à `request.user`
 * par la stratégie d'authentification) dans un handler de contrôleur.
 * - Sans argument : retourne l'objet utilisateur complet.
 * - Avec un nom de propriété (`data`) : retourne uniquement cette propriété de l'utilisateur.
 * - Retourne `null` si aucun utilisateur n'est présent sur la requête (route non protégée).
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    if (data) {
      return user[data];
    }

    return user;
  },
);
