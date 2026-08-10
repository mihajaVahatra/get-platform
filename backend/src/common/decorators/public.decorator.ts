import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée sous laquelle le marqueur "route publique" est stocké via Reflector. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Décorateur de route/contrôleur marquant un endpoint comme public.
 * Utilisé par les guards d'authentification (ex: JwtAuthGuard) pour court-circuiter
 * la vérification du token lorsqu'ils lisent cette métadonnée via le Reflector.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
