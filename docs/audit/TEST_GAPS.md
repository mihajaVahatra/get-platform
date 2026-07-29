# Analyse des tests — Plateforme GET

## Tests existants

| Type de test | Fichier | Contenu | Qualité |
|---|---|---|---|
| Unitaire backend | `backend/src/app.controller.spec.ts` | Vérifie que `AppController.getHello()` renvoie `"Hello World!"` | Boilerplate généré par `nest new`, aucune valeur métier |
| E2E backend | `backend/test/app.e2e-spec.ts` | Boilerplate par défaut (`GET /` → 200) | Non exécuté dans cet audit (nécessite une base dédiée isolée ; l'exécuter contre la base locale actuelle aurait risqué d'altérer des données de démonstration) |
| Frontend | Aucun | — | Aucun outil de test (Jest/Vitest/Testing Library/Playwright/Cypress) n'est présent dans `frontend/package.json` |

**Résultat des commandes :**
- `cd backend && npm test` → 1 suite, 1 test, ✅ passe.
- `cd backend && npm run test:e2e` → non exécuté (voir ci-dessus).
- Frontend : aucune commande de test disponible.

## Évaluation qualitative

Le pourcentage de couverture n'est pas la question ici : il est proche de zéro sur les comportements qui comptent. Aucun test n'existe sur :
- l'authentification (login, verrouillage anti brute-force, expiration de jeton, MFA) ;
- les autorisations et l'isolation multi-établissement (le point fort du backend actuel — voir CODE_AUDIT_REPORT §J — repose entièrement sur du code non testé, donc non protégé contre une régression future) ;
- le cycle de vie des candidatures (soumission, changement de statut, doublon) ;
- les paiements (montant, webhook, idempotence) ;
- les téléversements de fichiers ;
- la création/modification d'établissements et d'offres ;
- l'administration (rôle `ADMIN_GET`) ;
- les cas limites et la gestion d'erreurs (ex. offre fermée, candidature en double, jeton expiré).

## Tests prioritaires manquants

| # | Scénario | Niveau | Fichier de test recommandé | Priorité |
|---|---|---|---|---|
| 1 | Login échoue après 5 tentatives invalides puis se débloque après 15 minutes | Unitaire/intégration | `backend/src/modules/auth/auth.service.spec.ts` | P0 |
| 2 | Un compte désactivé (`isActive=false`) perd l'accès immédiatement même avec un jeton valide | Intégration | `backend/src/modules/auth/strategies/jwt.strategy.spec.ts` | P0 |
| 3 | Un étudiant ne peut pas consulter/modifier la candidature d'un autre étudiant | Intégration (e2e) | `backend/test/application-isolation.e2e-spec.ts` | P0 |
| 4 | Une école ne peut pas modifier une offre ou une candidature d'une autre école | Intégration (e2e) | `backend/test/school-isolation.e2e-spec.ts` | P0 |
| 5 | `POST /payments/initiate` sans `applicationId` doit être rejeté (régression sur CRIT-07) | Unitaire | `backend/src/modules/payment/payment.service.spec.ts` | P0 |
| 6 | Le webhook de paiement rejette une signature invalide et accepte une signature valide (HMAC) | Unitaire | `backend/src/modules/payment/payment.service.spec.ts` | P0 |
| 7 | Le webhook de paiement est idempotent (un même événement rejoué ne double pas la confirmation) | Unitaire | `backend/src/modules/payment/payment.service.spec.ts` | P1 |
| 8 | `forgotPassword`/`resetPassword` : un jeton ne peut être utilisé qu'une seule fois et expire correctement | Unitaire | `backend/src/modules/auth/auth.service.spec.ts` | P0 (après correction de CRIT-01) |
| 9 | Upload de document : type de fichier refusé si le contenu réel ne correspond pas à l'extension déclarée | Unitaire | `backend/src/modules/student/student.service.spec.ts` | P1 (après correction de CRIT-03) |
| 10 | `RolesGuard` refuse l'accès si le rôle ne correspond pas, autorise sinon | Unitaire | `backend/src/modules/auth/guards/roles.guard.spec.ts` | P1 |
| 11 | Soumission de candidature : refus si offre fermée, refus si doublon, acceptation sinon | Unitaire | `backend/src/modules/application/application.service.spec.ts` | P1 |
| 12 | Changement de statut de candidature : refus si l'appelant n'appartient pas à l'école propriétaire de l'offre | Unitaire | `backend/src/modules/application/application.service.spec.ts` | P0 |
| 13 | Création d'école : réservé à `ADMIN_GET`, rejeté pour tout autre rôle | Unitaire | `backend/src/modules/school/school.service.spec.ts` | P1 |
| 14 | Formulaire de connexion frontend : affiche une erreur sur identifiants invalides, redirige sur succès | Composant | `frontend/app/auth/login/__tests__/login.test.tsx` | P1 |
| 15 | Formulaire d'inscription frontend : validation des règles de mot de passe alignées avec le backend | Composant | `frontend/app/auth/register/__tests__/register.test.tsx` | P2 |
| 16 | `dashboard/layout.tsx` redirige vers `/auth/login` si `/auth/me` échoue | Composant | `frontend/app/dashboard/__tests__/layout.test.tsx` | P1 |
| 17 | Cas limite : candidature après la date limite de l'offre (`applicationDeadline`) doit être refusée — **aucune vérification de deadline n'a été trouvée dans `ApplicationService.submitApplications`, à corriger avant même d'écrire le test** | Unitaire | `backend/src/modules/application/application.service.spec.ts` | P1 (constat de bug potentiel additionnel à vérifier) |

## Stratégie recommandée

1. **Court terme (P0) :** tests d'intégration NestJS (`@nestjs/testing` + base de test dédiée via Docker) ciblant exclusivement l'authentification, les autorisations/isolation multi-établissement et les paiements — c'est le socle qui protège aujourd'hui les données des utilisateurs, il doit être verrouillé par des tests avant toute autre priorité.
2. **Moyen terme (P1) :** tests unitaires sur chaque service métier (candidatures, offres, écoles), tests de composants frontend sur les formulaires critiques (login, register, candidature, paiement).
3. **Après le câblage des écrans actuellement mockés (CRIT-04/05/06) :** ajouter des tests d'intégration correspondants — inutile de tester du code qui n'existe pas encore côté backend pour ces écrans.
4. Ne pas viser un pourcentage de couverture global comme objectif en soi : prioriser les scénarios listés ci-dessus, qui touchent à l'argent, aux données personnelles et à l'isolation entre établissements.
