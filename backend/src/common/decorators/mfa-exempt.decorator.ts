import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée sous laquelle le marqueur "exempté d'imposition MFA" est stocké via Reflector. */
export const MFA_EXEMPT_KEY = 'mfaExempt';

/**
 * Décorateur de route/contrôleur exemptant un endpoint de MfaEnforcedGuard.
 * Réservé aux endpoints qu'un compte à rôle privilégié doit pouvoir
 * atteindre pour consulter son propre statut MFA et terminer son
 * enrôlement (voir MfaEnforcedGuard) — jamais à des endpoints métier.
 */
export const MfaExempt = () => SetMetadata(MFA_EXEMPT_KEY, true);
