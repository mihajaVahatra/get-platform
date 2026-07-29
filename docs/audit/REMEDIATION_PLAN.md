# Plan de correction priorisé — Plateforme GET

Quatre étapes, dans l'ordre. Chaque ligne renvoie aux IDs détaillés dans `CODE_AUDIT_REPORT.md` et `SECURITY_FINDINGS.md`.

## Priorité 0 — Sécurité et blocages immédiats

| Ordre | ID | Action | Fichiers | Gravité | Effort | Dépendance | Validation |
|---|---|---|---|---|---|---|---|
| 1 | CRIT-02 | Corriger les 8 erreurs TypeScript qui font échouer `next build` (typage `DialogTrigger`/`asChild`, normaliser les `string \| null` avant `setState`) | `app/dashboard/ministry/reports/page.tsx`, `app/dashboard/student/{offers,applications,payments}/page.tsx` | Critique | S | Aucune | `npm run build` (frontend) se termine avec le code 0 |
| 2 | CRIT-08 | Faire lire `NEXT_PUBLIC_API_URL` par `apiClient` au lieu de `localhost` codé en dur | `frontend/lib/api-client.ts` | Critique | XS | Aucune | Build + requête réseau réussie depuis un environnement non local |
| 3 | CRIT-07 / SEC-01 | Rendre `applicationId` obligatoire dans `initiatePayment`, ou calculer le montant serveur pour tout motif de paiement | `backend/src/modules/payment/payment.service.ts`, `initiate-payment.dto.ts` | Critique | XS | Aucune | Test : `POST /payments/initiate` sans `applicationId` doit être rejeté (400) |
| 4 | CRIT-01 | Brancher `forgotPassword` sur un vrai canal d'envoi (au minimum `NotificationService`, à terme un fournisseur email réel) + table de jetons à usage unique | `backend/src/modules/auth/auth.service.ts` | Critique | M | Fournisseur email réel (voir HIGH-03) | Test manuel/E2E : un utilisateur reçoit effectivement un lien exploitable |
| 5 | CRIT-03 | Remplacer l'URL fabriquée par un stockage réel (`StorageService` étendu aux documents non-image, avec vérification de signature binaire) | `backend/src/modules/student/student.service.ts`, `common/services/storage.service.ts` | Critique | S | SEC-10 (valider le contenu réel, pas juste le mimetype déclaré) | Test : le document uploadé est téléchargeable après upload |
| 6 | HIGH-04 / SEC-02 | Ajouter `@Public()` sur `GET /ministry/public/stats` (ou retirer la mention « sans authentification » de la doc si le comportement restreint est volontaire) | `backend/src/modules/ministry/ministry.controller.ts` | Élevée | XS | Aucune | Appel anonyme réussi (200) |
| 7 | — | Marquer clairement dans l'UI (bannière « démo / non connecté ») les écrans Admin GET, Professeur et Gestion académique École tant qu'ils ne sont pas branchés, pour ne pas induire les utilisateurs en erreur en attendant CRIT-04/05/06 | `frontend/components/{admin-portal,teacher-portal,school-portal}/*` | Critique (transparence) | XS | Aucune | Revue visuelle |

## Priorité 1 — Stabilisation

| Ordre | ID | Action | Fichiers | Gravité | Effort | Dépendance | Validation |
|---|---|---|---|---|---|---|---|
| 8 | CRIT-05 | Câbler `teacher-portal.tsx` sur l'API `teacher/courses/*` déjà fonctionnelle | `frontend/components/teacher-portal/teacher-portal.tsx` | Critique | L | Aucune côté backend | Un professeur voit ses vrais cours/étudiants |
| 9 | HIGH-01 | Décider et implémenter une intégration de paiement réelle (Orange Money/Mvola/carte) ou documenter explicitement le mode démo en production | `backend/src/modules/payment/providers/*` | Élevée | L | Contrats fournisseurs externes | Paiement réel de bout en bout en environnement de test fournisseur |
| 10 | HIGH-02 | Générer un vrai PDF pour les reçus/rapports (ex. `pdfkit`) | `payment.service.ts`, `ministry.service.ts` | Élevée | M | Aucune | Fichier téléchargé s'ouvre correctement dans un lecteur PDF/Excel |
| 11 | HIGH-03 | Brancher un fournisseur email/SMS réel, persister les préférences de notification en base | `notification.service.ts`, migration Prisma (table préférences) | Élevée | L | Fournisseur externe | Un email de test est réellement reçu |
| 12 | HIGH-09 | Supprimer ou rediriger `/login` et `/register` vers `/auth/*` ; corriger le code mort `document.cookie = accessToken=...` | `frontend/app/{login,register}/page.tsx` | Élevée | S | Aucune | Routes orphelines supprimées ou redirigées |
| 13 | MED-10 | Corriger la pagination en mémoire du filtre ville des offres (filtrer en SQL via relation `school`) | `backend/src/modules/offer/offer.service.ts` | Moyenne | S | Aucune | `meta.total` cohérent avec le nombre réel de résultats filtrés |
| 14 | MED-08 / MED-09 | Remplacer les statistiques figées à zéro par de vraies agrégations | `school.controller.ts`, `notification.controller.ts` | Moyenne | S | Aucune | Les chiffres reflètent les données réelles |
| 15 | HIGH-06 | Compléter `.env.example` (racine) avec toutes les variables réellement requises | `/.env.example` | Élevée | XS | Aucune | Un nouvel environnement démarre avec le seul `.env.example` complété |
| 16 | — | Mettre en place une CI minimale (lint + typecheck + build + test) sur chaque PR, pour bloquer toute régression du type CRIT-02 à l'avenir | `.github/workflows/ci.yml` (à créer) | Élevée | S | Aucune | Le pipeline échoue si un des points ci-dessus régresse |
| 17 | Voir `TEST_GAPS.md` | Écrire les tests critiques (auth, autorisations, isolation multi-établissement, paiement, upload) | `backend/src/**/*.spec.ts` | Élevée | L | Aucune | Suite verte, couverture des scénarios listés dans `TEST_GAPS.md` |

## Priorité 2 — Maintenabilité

| Ordre | ID | Action | Fichiers | Effort |
|---|---|---|---|---|
| 18 | CRIT-06 | Concevoir et implémenter les endpoints manquants (listing étudiants/professeurs d'une école) puis brancher `school-portal/*` | backend + frontend | XL |
| 19 | CRIT-04 | Concevoir et implémenter la gestion des utilisateurs et des transactions (Admin GET) puis brancher `admin-management-view.tsx` (à découper en plusieurs composants) | backend + frontend | XL |
| 20 | MED-07 | Fusionner les deux schémas d'inscription en un seul composant partagé | `frontend/app/auth/register` | S |
| 21 | SEC-07 / HIGH-10 | Typer strictement `request.user` (interface `AuthenticatedUser`), restreindre les champs sélectionnés dans `JwtStrategy.validate()` | `jwt.strategy.ts`, tous les contrôleurs (`@GetUser() user: any` → type explicite) | M |
| 22 | MED-01 | Réduire les 402 erreurs ESLint `no-unsafe-*` module par module, en commençant par `auth`, `payment`, `application` (surface la plus sensible) | `backend/src/modules/**` | M (étalé) |
| 23 | — | Factoriser la logique `ensureCanManage*/ensureCanAccess*` dupliquée dans un guard ou un décorateur générique de propriété | `backend/src/common` | S |
| 24 | — | Découper les composants frontend monolithiques (`admin-management-view.tsx`, `teacher-portal.tsx`, `people-directory.tsx`) en sous-composants testables | `frontend/components/**` | L |
| 25 | — | Adopter `react-query` pour les appels déjà réels (candidatures, offres, paiements) | `frontend/app/dashboard/**` | M |
| 26 | MED-06 | Retirer `backend/package.json.bak` du suivi git, décider du sort de `backend/prisma/check.ts` (le committer dans `scripts/` ou l'ignorer explicitement) | racine du dépôt | XS |

## Priorité 3 — Optimisation

| Ordre | ID | Action | Fichiers | Effort |
|---|---|---|---|---|
| 27 | — | Ajouter un cache (Redis, déjà provisionné) sur `/schools`, `/offers`, `/ministry/dashboard` | backend | S |
| 28 | — | Passer `Payment.amount`/`Offer.tuitionFees` de `Float` à `Decimal` (migration Prisma) | `prisma/schema.prisma` + migration | M |
| 29 | — | Ajouter un index unique conditionnel anti-doublon de paiement en cours (MED-05) | migration SQL brute | S |
| 30 | — | Pagination par curseur sur `Message`/`AuditLog` pour anticiper la montée en charge | backend | M |
| 31 | — | Optimiser les images statiques (`next/image`, compression WebP) | `frontend/public/**` | S |
| 32 | — | Rehausser le facteur de coût bcrypt de 10 à 12 | `auth.service.ts` | XS |
| 33 | LOW-01 | Remplacer les `console.log`/`console.error` restants par le `Logger` NestJS structuré avec corrélation de requête | backend + frontend | S |

## Points explicitement écartés (à ne pas faire maintenant)

- Migration vers une architecture microservices ou Kubernetes — sans objet, la taille actuelle du projet ne le justifie pas.
- Virtualisation de listes frontend — inutile tant que les données correspondantes restent mockées (CRIT-04/05/06) ; à revisiter une fois ces écrans branchés sur de vraies données à volume réel.
- Réécriture complète du design system — les composants UI de base (`components/ui/*`, Radix/shadcn) sont sains, seul le contenu métier qui les entoure pose problème.
