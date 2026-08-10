import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée sous laquelle la liste des rôles autorisés est stockée via Reflector. */
export const ROLES_KEY = 'roles';

/**
 * Décorateur de route/contrôleur restreignant l'accès à une liste de rôles.
 * Les rôles déclarés ici sont lus par un guard (ex: RolesGuard) qui les compare
 * au rôle de l'utilisateur authentifié présent dans la requête.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
