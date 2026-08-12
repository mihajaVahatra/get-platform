/**
 * Version courante des CGU/politique de confidentialité (voir
 * app/cgu/page.tsx et app/confidentialite/page.tsx). Envoyée par le
 * formulaire d'inscription (POST /auth/register) — le backend refuse toute
 * version différente de backend/src/modules/auth/terms.constant.ts.
 *
 * IMPORTANT : à incrémenter (date du jour) à chaque changement de contenu
 * substantiel des deux pages, et à répliquer manuellement côté backend (pas
 * de paquet partagé entre les deux projets dans ce dépôt).
 */
export const CURRENT_TERMS_VERSION = '2026-08-11';
