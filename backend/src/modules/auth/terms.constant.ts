/**
 * Version courante des CGU/politique de confidentialité (voir
 * frontend/app/cgu/page.tsx et frontend/app/confidentialite/page.tsx).
 * `RegisterDto.acceptedTermsVersion` doit correspondre exactement à cette
 * valeur — sinon l'inscription est refusée plutôt que d'enregistrer une
 * acceptation qui ne correspond plus au texte réellement affiché.
 *
 * IMPORTANT : à incrémenter (date du jour) à chaque changement de contenu
 * substantiel des deux pages, et à répliquer manuellement dans
 * frontend/lib/terms-version.ts (pas de paquet partagé entre les deux
 * projets dans ce dépôt).
 */
export const CURRENT_TERMS_VERSION = '2026-08-11';
