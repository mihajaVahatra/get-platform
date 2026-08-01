# Progression de l'audit — Plateforme GET

Cet audit a été mené en une seule passe continue, mais le dépôt étant conséquent (84 fichiers backend, 70 fichiers frontend), ce document précise le niveau réel de couverture par zone, conformément à la règle « ne jamais présenter un audit partiel comme un audit complet ».

## Couverture exhaustive (lecture ligne à ligne intégrale)

- **Backend — 100 % des modules** : `auth` (service, controller, guards, stratégie JWT, MFA), `student`, `school`, `offer`, `application`, `payment` (service, controller, providers, DTO), `message`, `notification`, `ministry`, `audit`, `teaching`, `prisma`, ainsi que tout `backend/src/common` (décorateurs, DTO de base, filtres, intercepteurs, services `storage`/`encryption`), `main.ts`, `app.module.ts`.
- **Base de données** : schéma Prisma complet (619 lignes, 30 modèles) lu intégralement ; `seed.ts` lu intégralement ; migrations vérifiées via `prisma migrate status` (à jour).
- **Configuration** : `.env.example` (racine), `docker-compose.yml`, `.gitignore` (racine + backend + frontend), noms de variables présentes dans `backend/.env`/`frontend/.env.local` (valeurs non lues, uniquement les noms).
- **Frontend — flux d'authentification** : `/auth/login`, `/auth/register`, `/register` (orpheline), `/login` (orpheline), `lib/api-client.ts`, `app/dashboard/layout.tsx` (protection de route et sidebars par rôle).
- **Frontend — cartographie complète** : les 35 routes sous `app/dashboard/**` ont toutes été identifiées, et pour chacune, le composant réellement rendu a été résolu et vérifié quant à la présence ou l'absence d'appels `apiClient` (script automatisé + vérification manuelle croisée).
- **Frontend — composants représentatifs lus intégralement** : `people-directory.tsx`, `school-management-view.tsx`, `student-import-directory.tsx`, `student-portal/portal-view.tsx`, `app/register/page.tsx`, `app/auth/register/page.tsx`, `app/login/page.tsx`.
- **Commandes exécutées et vérifiées** : lint/typecheck/build/test/audit backend et frontend, `prisma validate`/`migrate status`, `next build` réel (pas seulement `tsc`), recherche de secrets sur tout le dépôt suivi par git, recherche de marqueurs de conflit, recherche de fichiers de sauvegarde/backup.

## Couverture partielle (constat établi par preuve indirecte fiable, pas par lecture intégrale)

- **`admin-management-view.tsx` (1134 lignes)** et **`teacher-portal.tsx` (1559 lignes)** : le constat « 0 appel API, données mockées » est établi avec certitude (`grep -c "apiClient\."` = 0, échantillons de tableaux codés en dur vérifiés en tête de fichier), mais l'intégralité des ~2700 lignes cumulées n'a pas été relue ligne à ligne — il est possible que des sous-fonctionnalités locales supplémentaires (validations de formulaire, logique d'affichage conditionnelle) existent sans en changer la conclusion globale (aucune de ces vues n'écrit ni ne lit de données réelles).
- **`ministry-dashboard.tsx` (538 lignes)** : même méthode (en-tête + comptage d'appels API = 0), lecture non intégrale.
- **`components/ui/*` (primitives shadcn/Radix)** : non auditées individuellement (bibliothèque de composants standard, hors périmètre métier), sauf pour diagnostiquer l'erreur TypeScript `DialogTrigger`/`asChild` (CRIT-02), où le point d'usage a été examiné mais pas l'implémentation interne du composant `Dialog`.
- **Tests e2e backend (`test/app.e2e-spec.ts`)** : lu mais **non exécuté**, par prudence, pour ne pas risquer d'altérer les données de la base PostgreSQL locale actuellement connectée (qui contient les données de seed).
- **Contenu réel des variables d'environnement** (`backend/.env`, `frontend/.env.local`) : seuls les **noms** des variables ont été extraits (`grep -oE "^[A-Z_]+"`), jamais les valeurs, conformément à la consigne de ne jamais afficher de secret.

## Non couvert (hors périmètre de cette passe)

- Tests de charge/performance réels (aucune base de données à volume réaliste disponible pour les mesurer).
- Audit d'accessibilité instrumenté (Lighthouse/axe) — évalué uniquement par lecture du JSX/attributs ARIA.
- Test en boîte noire (requêtes HTTP réelles contre une instance démarrée) — l'ensemble des constats d'autorisation/IDOR de ce rapport proviennent d'une **analyse statique du code**, pas d'une exploitation confirmée en exécution. La section J du rapport principal le précise explicitement.
- Historique Git détaillé au-delà des 20 derniers commits consultés (`git log --oneline -20`) et de l'état `git status` courant.

## Anomalies déjà identifiées

Voir `CODE_AUDIT_REPORT.md` (sections D à G) pour la liste complète et numérotée. Résumé quantitatif : 8 critiques, 11 élevées, 12 moyennes, ~10 faibles/informationnelles.

## Vérifications encore utiles pour une itération future

- Exécuter les tests e2e backend contre une base de test dédiée et jetable (jamais contre la base de développement actuelle).
- Lire intégralement `admin-management-view.tsx` et `teacher-portal.tsx` avant de les découper, afin de récupérer toute logique d'affichage éventuellement réutilisable pendant le vrai câblage API.
- Vérifier en boîte noire (Postman/HTTPie) les scénarios de contournement RBAC listés en section J une fois un environnement de test dédié disponible, pour transformer les constats d'analyse statique en preuves d'exécution.
