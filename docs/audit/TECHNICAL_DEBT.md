# Dette technique — Plateforme GET

Classée par domaine. L'effort suit l'échelle : XS < 2h · S = 2h-1j · M = 1-3j · L = 3-7j · XL > 7j.

| Domaine | Dette | Conséquence | Priorité | Effort |
|---|---|---|---|---|
| **Frontend — fonctionnalités** | Espace Admin GET (6 écrans) 100 % mocké, sans appel API, endpoints backend manquants | Le rôle le plus élevé de la plateforme ne peut rien administrer réellement | P0/P1 | XL |
| **Frontend — fonctionnalités** | Espace Professeur (1559 lignes) 100 % mocké alors que l'API `teaching` existe et fonctionne | Effort perdu côté backend, aucune valeur livrée aux enseignants | P0/P1 | L (câblage seul) |
| **Frontend — fonctionnalités** | Gestion académique École (étudiants/profs/cours/planning/paramètres) mockée, sauvegarde `localStorage` | Aucune collaboration multi-utilisateur possible, données non partagées, non persistées | P0/P1 | XL |
| **Backend — fonctionnalités** | `forgotPassword` ne délivre jamais le jeton | Flux de récupération de compte totalement bloqué | P0 | S–M |
| **Backend — fonctionnalités** | Upload de documents étudiants ne stocke aucun fichier réel | Perte silencieuse des pièces d'admission | P0 | S |
| **Backend — fonctionnalités** | Passerelle de paiement 100 % simulée (`Math.random`) | Aucun paiement réel possible ; les statistiques financières sont fictives | P1 | L |
| **Backend — fonctionnalités** | Génération de reçu/rapport = texte brut typé PDF/Excel/CSV | Fichiers téléchargés corrompus/illisibles | P1 | M |
| **Backend — fonctionnalités** | Notifications (email/SMS/push) 100 % simulées, préférences non persistées | Aucun email/SMS n'atteint jamais un utilisateur réel (y compris les confirmations de paiement, rappels) | P1 | L (intégration fournisseur) |
| **Backend — qualité de type** | 402 erreurs ESLint (`no-unsafe-*`), quasi-totalité liée à `user: any` / `data: any` | Aucune garantie de type à l'exécution sur les objets les plus sensibles (utilisateur authentifié) ; régressions silencieuses probables | P2 | M (typage progressif module par module) |
| **Backend — architecture** | Pas de couche repository/DTO de sortie séparée : les services retournent directement les entités Prisma (parfois avec relations imbriquées entières, ex. `user: true` dans `PaymentService.getPayment`) | Risque de sur-exposition de champs à mesure que le schéma évolue ; couplage fort entre schéma DB et contrat API public | P2 | M |
| **Backend — duplication** | Logique `ensureCanManageX`/`ensureCanAccessX` réimplémentée indépendamment dans `offer.service.ts`, `application.service.ts`, `school.controller.ts`, `teaching.service.ts` | Chaque nouvelle ressource doit réinventer le contrôle de propriété ; risque d'oubli sur un futur module | P2 | S (factoriser un guard/décorateur générique `@RequireOwnership`) |
| **Frontend — architecture** | Composants monolithiques (1134, 1559 lignes) écrits en JSX condensé sur une seule ligne | Illisibles, impossibles à tester unitairement, diffs Git illisibles | P2 | L |
| **Frontend — duplication** | Trois implémentations différentes d'un « annuaire personnes » (`people-directory.tsx`, `school-management-view.tsx`, `student-import-directory.tsx`) avec des types incompatibles | Trois sources de vérité à maintenir pour une même fonctionnalité | P2 | M |
| **Frontend — duplication** | Deux pages d'inscription (`/register`, `/auth/register`) et vraisemblablement deux pages de connexion (`/login`, `/auth/login`) | Divergence silencieuse des règles de validation, code mort accessible par URL directe | P1 | S |
| **Frontend — données** | `react-query` installé mais non utilisé ; chaque page réimplémente son propre `useEffect`/`useState`/`try-catch` | Pas de cache, pas de déduplication, code répétitif | P2 | M |
| **Frontend — build** | 8 erreurs TypeScript bloquant `next build` | Aucun déploiement possible | P0 | S |
| **Configuration** | `.env.example` (racine) incomplet par rapport aux variables réellement lues par le code | Onboarding cassé pour tout nouveau développeur suivant la documentation | P1 | XS |
| **Configuration** | Aucune validation des variables d'environnement au démarrage (`ConfigModule.forRoot` sans schéma Joi/zod) | Une variable manquante (ex. `PAYMENT_WEBHOOK_SECRET`) échoue silencieusement à l'usage plutôt qu'au démarrage | P2 | S |
| **DevOps** | Aucun pipeline CI (lint/typecheck/test/build) | Les régressions actuelles (build cassé, 402 erreurs lint) auraient été bloquées en amont par une CI minimale | P1 | S |
| **DevOps** | Aucun Dockerfile applicatif (seuls Postgres/Redis/MinIO sont conteneurisés) | Pas d'environnement de déploiement reproductible | P2 | M |
| **Tests** | Couverture quasi nulle (1 test trivial backend, 0 frontend) | Aucune garantie de non-régression sur l'authentification, les paiements, les autorisations | P0/P1 | Voir `TEST_GAPS.md` |
| **Hygiène dépôt** | `backend/package.json.bak` suivi par git ; `backend/prisma/check.ts` script de debug non suivi mais présent sur disque | Bruit, confusion pour un nouvel arrivant | P3 | XS |
| **Dépendances** | 26 vulnérabilités *high* (backend, essentiellement dev), 12 *high* (frontend, `postcss`/`sharp`/`next`) | Dette de sécurité différée, corrections majeures potentiellement disruptives | P2 | S–M |
| **Observabilité** | `console.log`/`console.error` (25 backend, 13 frontend) au lieu d'un logger structuré avec corrélation | Diagnostic d'incident en production très difficile | P2 | S |
| **Performance (mineure)** | Pagination en mémoire buggée sur le filtre ville des offres | Résultats de recherche incorrects sur pages > 1 | P1 | XS |
| **Performance (mineure)** | Pas de cache sur les listings publics (`/schools`, `/offers`) alors que Redis est déjà provisionné dans `docker-compose.yml` | Charge base de données évitable dès que le trafic augmentera | P3 | S |
