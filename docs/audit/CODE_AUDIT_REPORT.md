# Audit technique — Plateforme GET (Grandes Écoles de Tananarivo)

**Date de l'audit :** 2026-07-29
**Portée :** code source, architecture, frontend, backend, API, base de données, auth/autorisations, sécurité, performances, qualité, dépendances, tests, configuration, déploiement, maintenabilité.
**Hors périmètre (non traité, conformément au mandat) :** budget, financement, modèle économique, marketing, acquisition, partenariats commerciaux.
**Méthode :** lecture exhaustive du code source (84 fichiers backend, cartographie complète des 35 routes du dashboard frontend + lecture ciblée des composants), exécution de lint/typecheck/build/test/audit sur les deux applications, recherche de secrets, de données mockées et de code mort. Aucune modification n'a été appliquée au code applicatif. Voir `AUDIT_PROGRESS.md` pour le détail de la couverture.

---

## A. Résumé exécutif technique

Le backend (NestJS + Prisma + PostgreSQL) est **structurellement sain** : modules bien séparés par domaine, DTOs validés, guards JWT/Roles cohérents, vérifications de propriété (ownership) systématiques dans les services sensibles (offres, candidatures, écoles, paiements, cours). C'est un socle correct pour un futur produit.

Le problème majeur de ce dépôt n'est pas la qualité du code écrit, mais **l'écart entre ce qui existe réellement et ce que l'interface donne à croire** :

- La quasi-totalité des écrans **Admin GET** (établissements, utilisateurs, inscriptions, transactions, rapports) et **Professeur**, ainsi qu'une grande partie de la gestion académique **École** (étudiants, professeurs, cours, emploi du temps, paramètres), sont des **composants React à données 100 % codées en dur**, sans le moindre appel à l'API (`grep apiClient` = 0 occurrence sur des fichiers de 1134, 1559 et plusieurs centaines de lignes). Les boutons « Ajouter », « Enregistrer », etc. n'ont souvent aucun gestionnaire d'événement.
- Des fonctionnalités critiques présentées comme actives sont en réalité **des simulations** : la réinitialisation de mot de passe ne délivre jamais son jeton nulle part (fonctionnalité totalement bloquée), l'upload de documents étudiants ne stocke aucun fichier réel, la passerelle de paiement est un mock à succès aléatoire, les reçus/rapports exportés sont du texte brut déguisé en PDF/Excel.
- Le build de production du frontend (`next build`) **échoue actuellement** à cause de 8 erreurs TypeScript réelles.
- La couverture de tests automatisés est quasi nulle (1 test trivial côté backend, 0 côté frontend) alors que le projet gère des données personnelles et des paiements.

Le socle technique est réutilisable, mais l'état fonctionnel réel du produit est très en retrait par rapport à l'interface visible. Une bonne partie de l'effort restant n'est pas du « durcissement » mais du **branchement pur et simple de l'UI existante sur des API déjà présentes et déjà sécurisées** (ex. `TeachingController` fonctionne très bien, mais l'écran Professeur ne l'appelle jamais).

**Note globale : 41/100**

| Domaine | Note /10 | Justification courte |
|---|---|---|
| Architecture | 6 | Séparation modulaire NestJS propre, DTO/guards cohérents ; mais aucune séparation service/repository, logique de propriété dupliquée par service. |
| Qualité du code | 4 | Backend fonctionnel mais 402 erreurs ESLint (essentiellement `any` non typés) ; frontend très verbeux, composants de 1000+ lignes en une seule ligne de JSX, dupliqué. |
| Frontend | 3 | Plus de la moitié des écrans de tableau de bord sont des maquettes non connectées ; build cassé. |
| Backend/API | 6 | Endpoints cohérents, validation globale, contrôle d'accès par ressource correct ; mais plusieurs endpoints renvoient des données simulées/fake sans le signaler. |
| Base de données | 7 | Schéma Prisma cohérent, contraintes uniques et index pertinents, soft delete appliqué où c'est utile, migrations à jour. |
| Authentification | 5 | JWT + cookies httpOnly + bcrypt + verrouillage anti brute-force correctement implémentés, MAIS le flux « mot de passe oublié » est cassé (jeton jamais transmis à l'utilisateur). |
| Autorisations | 7 | Contrôle de propriété systématique (école, candidature, paiement, cours) ; un défaut de contrat sur `/ministry/public/stats`. |
| Sécurité | 5 | Bonnes pratiques présentes (headers, CORS restreint, HMAC webhook, chiffrement AES-256-GCM) mais montant de paiement contrôlable côté client, secrets par défaut de démo, dépendances vulnérables. |
| Performance | 5 | Pas de problème mesurable sur le vrai trafic (trop peu de données réelles/mockées) ; pagination en mémoire buggée sur les offres, N+1 potentiel non observé à ce stade. |
| Tests | 1 | Un seul test trivial généré par défaut ; aucun test métier, aucun test frontend. |
| Configuration | 5 | `.env.example` (racine) incomplet par rapport aux variables réellement requises ; pas de validation des variables au démarrage. |
| DevOps | 4 | `docker-compose.yml` correct pour le dev (Postgres/Redis/MinIO) ; aucune CI/CD, aucun Dockerfile applicatif, aucun healthcheck applicatif. |
| Maintenabilité | 4 | Nommage cohérent côté backend ; composants frontend monolithiques en JSX sur une seule ligne, très difficiles à faire évoluer ou tester. |

---

## B. Stack et architecture détectées

### Technologies

| Couche | Technologie | Version | Répertoire | État |
|---|---|---|---|---|
| Backend | NestJS | ^11.0.1 | `backend/src` | Compile, démarre |
| ORM | Prisma | ^5.22.0 | `backend/prisma` | Schéma valide, 6 migrations appliquées |
| BDD | PostgreSQL | 15 (docker) | — | Connectée en local |
| Auth | Passport-JWT, bcrypt, speakeasy (MFA TOTP) | — | `backend/src/modules/auth` | Fonctionnel sauf reset password |
| Stockage fichiers | Système de fichiers local (`./uploads`) + MinIO prévu (docker-compose) mais non branché | — | `common/services/storage.service.ts` | Partiellement utilisé |
| Frontend | Next.js (App Router, Turbopack) | ^16.2.12 | `frontend/app` | Build cassé (voir C) |
| UI | React 19, Radix UI, shadcn, Tailwind v4 | — | `frontend/components` | OK |
| Data fetching | axios + @tanstack/react-query (react-query importé mais quasiment pas utilisé dans les pages examinées — appels axios directs à la place) | — | `frontend/lib/api-client.ts` | baseURL codée en dur |
| Formulaires | react-hook-form + zod | — | — | OK, dupliqué sur pages orphelines |
| Cache/queue | Redis (docker-compose) | — | — | Provisionné, non utilisé par le code applicatif |
| CI/CD | Aucun | — | — | Absent |
| Conteneurisation | `docker-compose.yml` (Postgres, Redis, MinIO) | — | racine | Pas de Dockerfile pour backend/frontend eux-mêmes |

### Points d'entrée

- Backend : `backend/src/main.ts` → préfixe global `/api`, Swagger sur `/api/docs`.
- Frontend : `frontend/app/page.tsx` (landing), `/auth/login`, `/auth/register`, `/dashboard/*`.

### Diagramme d'architecture réelle

```
Navigateur
   |
   v
Next.js (App Router, tout en 'use client')
   |  axios (withCredentials) --baseURL codée en dur http://localhost:3001/api
   v
NestJS API (/api, préfixe global)
   |  Guards: JwtAuthGuard (cookie httpOnly OU Bearer) + RolesGuard
   |
   +--> PrismaService --> PostgreSQL (schéma complet, 30+ modèles)
   |
   +--> StorageService --> disque local ./uploads (avatars, logos)
   |        (MinIO provisionné dans docker-compose mais jamais utilisé par le code)
   |
   +--> MockPaymentProvider (aucun fournisseur réel : pas d'Orange Money / Mvola / carte)
   |
   +--> "Envoi" email/SMS/push --> console.log uniquement (aucun fournisseur réel)
```

### Flux frontend ↔ backend ↔ base

Environ **40 %** des écrans du dashboard (Admin GET en totalité, Professeur en totalité, gestion académique École) **ne suivent pas ce flux** : ils affichent des tableaux et formulaires dont les données sont des constantes JavaScript locales au composant, sans jamais toucher `apiClient`, donc sans jamais toucher l'API ni la base. Voir section O pour le détail exhaustif.

---

## C. Résultats des commandes

| Commande | Résultat | Erreurs | Cause | Action recommandée |
|---|---|---|---|---|
| `cd backend && npm run lint` | ❌ Échec | 402 erreurs / 22 warnings ESLint | Usage massif de `@GetUser() user: any` et de `data: any` propagé dans toute la couche service (`no-unsafe-*`) | Typer `RequestUser` (voir REMEDIATION_PLAN, M1) |
| `cd backend && npx tsc --noEmit` | ✅ OK | 0 | — | — |
| `cd backend && npm run build` (`nest build`) | ✅ OK | 0 | — | — |
| `cd backend && npm test` (jest) | ✅ OK | 1 suite / 1 test (boilerplate `app.controller.spec.ts`) | Aucun test métier écrit | Voir `TEST_GAPS.md` |
| `cd backend && npm audit` | ⚠️ 26 vulnérabilités **high** | Chaîne `brace-expansion`/`minimatch` (ESLint/Jest), `fast-uri` | Dépendances de **dev** (lint/test), pas de risque en production directe | `npm audit fix` sans `--force` ; réévaluer la MAJ ESLint 10 séparément |
| `cd backend && npx prisma validate` | ✅ OK | — | — | — |
| `cd backend && npx prisma migrate status` | ✅ « Database schema is up to date » | — | — | — |
| `cd frontend && npm run lint` | ❌ Échec | 29 erreurs / 25 warnings | `any` explicites, hooks appelés avant déclaration (`react-hooks/immutability`), apostrophes non échappées | Voir `TECHNICAL_DEBT.md` |
| `cd frontend && npx tsc --noEmit` | ❌ Échec | 8 erreurs réelles (`asChild` sur des primitives Radix, `string \| null` non assignable à `string`, `Set<unknown>`) | Composants UI (`DialogTrigger`) mal typés, `useState` initialisé sans gérer les valeurs `null` de l'API | Corriger avant toute mise en prod (P0) |
| `cd frontend && npm run build` (`next build`) | ❌ **Échec** (« Failed to type check », `Next.js build worker exited with code: 1 ») | 8 erreurs TS bloquantes (mêmes que ci-dessus) | Le build de production Next.js échoue réellement, ce n'est pas qu'un avertissement | **Bloquant avant toute mise en ligne — Priorité 0** |
| `cd frontend && npm audit` | ⚠️ 12 vulnérabilités **high** | `postcss`/`sharp` via `next`, `brace-expansion`/`minimatch` via ESLint | Correctif disponible seulement via `next` majeur (breaking) | Planifier une mise à jour Next.js dédiée avec tests de non-régression |
| `git grep -niE "password|secret|api_key|private_key"` (hors `dto`/placeholders) | ✅ Aucun secret en clair trouvé dans le code source suivi par git | — | `.env`, `.env.local` correctement ignorés par `.gitignore` et non trackés | — |

---

## D. Anomalies critiques

### CRIT-01 — Réinitialisation de mot de passe totalement non fonctionnelle
- **Catégorie :** correctness / fonctionnalité critique
- **Fichier :** `backend/src/modules/auth/auth.service.ts`, méthode `forgotPassword` (lignes 119-143)
- **Constat :** le jeton de réinitialisation est généré (`this.jwt.sign(...)`) puis explicitement jeté (`void resetToken;`). Aucun email, SMS ou canal quelconque n'est déclenché. L'endpoint renvoie toujours un message générique de succès.
- **Preuve technique :**
  ```ts
  const resetToken = this.jwt.sign({ sub: user.id, type: 'reset' }, { expiresIn: '1h' });
  // Le token doit être envoyé par un fournisseur d'e-mail. Ne jamais le logger.
  void resetToken;
  return { message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.' };
  ```
- **Cause probable :** intégration email jamais branchée (le `NotificationService` simule déjà l'envoi d'email par `console.log`, mais `AuthService.forgotPassword` ne l'appelle même pas).
- **Impact technique :** aucun.
- **Impact fonctionnel :** un utilisateur qui oublie son mot de passe ne peut **jamais** le récupérer via le produit. Seule une intervention manuelle en base est possible.
- **Scénario :** un étudiant candidat oublie son mot de passe en pleine période de candidature → blocage total, perte potentielle de candidats.
- **Correction recommandée :** appeler `NotificationService.send()` (ou un vrai fournisseur email) avec un lien contenant le jeton ; stocker un hash du jeton en base avec expiration et statut « utilisé » pour empêcher la réutilisation.
- **Effort :** S (branchement sur le service de notification existant) à M (si envoi email réel + table de jetons).
- **Dépendances :** nécessite un fournisseur email réel (voir HIGH-03).
- **Priorité :** P0.

### CRIT-02 — Le build de production frontend échoue
- **Catégorie :** build / architecture
- **Fichiers :** `frontend/app/dashboard/ministry/reports/page.tsx:124`, `frontend/app/dashboard/student/offers/page.tsx:77,246`, `frontend/app/dashboard/student/applications/page.tsx:143`, `frontend/app/dashboard/student/payments/page.tsx:216`
- **Constat :** `npm run build` (donc `next build`) échoue avec « Failed to type check » ; le compilateur Next.js interrompt le build. Confirmé par exécution directe (voir section C).
- **Preuve technique :** sortie de build :
  ```
  ./app/dashboard/ministry/reports/page.tsx:124:26
  Type error: Type '{ children: Element; asChild: true; }' is not assignable to type 'IntrinsicAttributes & Props<unknown>'.
  Next.js build worker exited with code: 1
  ```
- **Cause probable :** composant `DialogTrigger` (Radix/shadcn) mal typé ou mal wrappé pour accepter `asChild` ; états React initialisés en `string` mais alimentés par des valeurs `string | null` provenant de l'API sans garde.
- **Impact technique :** aucun déploiement de production possible en l'état (`next build` est l'étape obligatoire de tout déploiement Vercel/Docker/serveur Node).
- **Impact fonctionnel :** blocage total de la mise en production.
- **Scénario :** toute tentative de build CI/CD ou de déploiement échoue immédiatement.
- **Correction recommandée :** corriger le typage du composant `DialogTrigger` (`asChild` doit être supporté par le composant `Props<unknown>` utilisé) ; garder les états avec `string | null` explicite ou normaliser les valeurs `null` en `''` avant `setState`.
- **Effort :** S.
- **Dépendances :** aucune.
- **Priorité :** P0.

### CRIT-03 — Les documents téléversés par les étudiants ne sont jamais réellement stockés
- **Catégorie :** correctness / perte de données
- **Fichier :** `backend/src/modules/student/student.service.ts`, méthode `uploadDocument` (lignes 195-220)
- **Constat :** le contenu réel du fichier (`file.buffer`) est reçu par Multer puis **jamais écrit sur disque ni envoyé à un stockage** ; seule une URL fabriquée par concaténation de chaînes est enregistrée en base.
- **Preuve technique :**
  ```ts
  const fileUrl = `https://storage.get.mg/documents/${student.id}/${Date.now()}-${file.originalname}`;
  return this.prisma.document.create({ data: { studentId: student.id, type: dto.type, name: dto.name || file.originalname, fileUrl, fileSize: file.size, mimeType: file.mimetype } });
  ```
  Le domaine `storage.get.mg` n'existe dans aucune configuration du projet ; `StorageService` (qui, lui, écrit réellement sur `./uploads` et fonctionne pour l'avatar/le logo) n'est **pas utilisé** ici.
- **Cause probable :** développement incomplet — `StorageService.uploadImage` a été implémenté et branché pour avatar/logo mais l'équivalent pour les documents (CV, diplôme, pièce d'identité) n'a jamais été fini.
- **Impact technique :** toute tentative de téléchargement de document renverra une 404 (le fichier n'existe nulle part).
- **Impact fonctionnel :** un étudiant peut « téléverser » son CV, son diplôme, sa pièce d'identité — l'école ne recevra jamais ces documents. C'est un flux d'admission cassé silencieusement (aucune erreur n'est renvoyée à l'utilisateur, qui croit avoir réussi).
- **Scénario :** un candidat dépose ses pièces justificatives avant la date limite de candidature ; l'école ouvre le dossier, aucun document n'est accessible ; le candidat est potentiellement rejeté à tort.
- **Correction recommandée :** remplacer par un appel à `StorageService` (ou équivalent générique pour documents non-image, avec vérification de type MIME réel comme le fait déjà `assertSafeImage`).
- **Effort :** S.
- **Dépendances :** étendre `StorageService` aux PDF/DOC (validation de contenu, pas seulement extension déclarée).
- **Priorité :** P0.

### CRIT-04 — Le tableau de bord Admin GET est entièrement factice (0 appel API)
- **Catégorie :** functional / fake feature
- **Fichier :** `frontend/components/admin-portal/admin-management-view.tsx` (1134 lignes), utilisé par `app/dashboard/admin/{schools,users,enrollments,reports,transactions,settings}/page.tsx`
- **Constat :** `grep -c "apiClient\." admin-management-view.tsx` = **0**. Les 6 routes de l'espace Admin GET (Établissements, Utilisateurs, Inscriptions & Admissions, Transactions, Rapports, Paramètres) pointent toutes vers ce composant unique, dont toutes les données (listes d'écoles, d'utilisateurs, de transactions) sont des tableaux JavaScript codés en dur.
- **Preuve technique :** import et rendu identiques sur 6 pages différentes, ex. `frontend/app/dashboard/admin/users/page.tsx` :
  ```tsx
  import { AdminManagementView } from '@/components/admin-portal/admin-management-view';
  export default function AdminUsersPage() { return <AdminManagementView view="users" />; }
  ```
  Aucune des 6 pages ni le composant partagé n'importent `apiClient`.
- **Cause probable :** maquette haute-fidélité livrée avant le branchement API, jamais terminée.
- **Impact technique :** aucune donnée réelle n'est jamais lue ni écrite pour ces écrans.
- **Impact fonctionnel :** l'administrateur GET (rôle le plus élevé de la plateforme) ne peut **strictement rien administrer** : impossible de créer/désactiver une école, de gérer un utilisateur, de consulter une vraie transaction. À noter aussi côté backend : il n'existe **aucun endpoint** de listing/gestion des utilisateurs (`UserController` inexistant), donc même en branchant le frontend il manquerait l'API.
- **Scénario :** l'équipe GET se connecte en production pour créer une nouvelle école partenaire : rien ne fonctionne, tout est apparence.
- **Correction recommandée :** (1) créer les endpoints backend manquants (CRUD utilisateurs, listing transactions agrégées, inscriptions) avec RBAC `ADMIN_GET` ; (2) réécrire `AdminManagementView` en le découpant par vue et en le connectant à `apiClient` + `react-query`.
- **Effort :** XL (fonctionnalité complète à construire des deux côtés).
- **Dépendances :** nécessite d'abord de définir le contrat API manquant.
- **Priorité :** P0 pour la transparence (retirer ou étiqueter clairement « démo » en attendant), P1/P2 pour la vraie implémentation.

### CRIT-05 — L'espace Professeur est entièrement factice malgré une API backend réelle et sécurisée
- **Catégorie :** functional / fake feature / incohérence architecturale
- **Fichiers :** `frontend/components/teacher-portal/teacher-portal.tsx` (1559 lignes, 0 appel `apiClient`, tableaux `courses`, `students`, `grades` codés en dur lignes 46/60/103) vs `backend/src/modules/teaching/{teaching.controller,teaching.service}.ts` (API réelle, avec vérification d'appartenance multi-établissement correcte).
- **Constat :** le backend expose un module `teaching` complet et correctement sécurisé (`GET /teacher/courses`, détail de cours, chapitres, ressources, liste des étudiants inscrits, avec vérification que le cours appartient bien à un établissement où le professeur est actif). Le frontend Professeur (`/dashboard/teacher`) n'appelle **jamais** cette API : il affiche des cours, étudiants et notes inventés.
- **Preuve technique :** `grep -c "apiClient\." components/teacher-portal/teacher-portal.tsx` → `0`. Comparer avec `backend/src/modules/teaching/teaching.service.ts:31-56` (`courses()`) qui exécute une vraie requête Prisma avec jointure `school.teacherAssignments`.
- **Cause probable :** développement backend/frontend mené en parallèle sans intégration finale (cf. l'historique git : `feat(pedagogy): add secured teacher course APIs` et `feat(teacher): add professor portal interface` sont deux commits distincts, jamais reliés).
- **Impact fonctionnel :** un professeur ne peut ni consulter ses vrais cours, ni ses vrais étudiants, ni publier un vrai chapitre — alors que l'API pour le faire existe et fonctionne.
- **Scénario :** un enseignant essaie de publier le support de cours de la semaine : le clic n'envoie rien au serveur, les autres utilisateurs ne verront jamais ce contenu.
- **Correction recommandée :** brancher `teacher-portal.tsx` sur `/teacher/courses/*` — c'est en grande partie un travail de câblage, l'API existe déjà.
- **Effort :** L (câblage d'un composant de 1559 lignes, à découper).
- **Dépendances :** aucune côté backend.
- **Priorité :** P0/P1 (rapport effort/valeur excellent : l'API existe déjà).

### CRIT-06 — Gestion académique École (étudiants/professeurs/cours/emploi du temps/paramètres) 100 % factice, sauvegarde en `localStorage`
- **Catégorie :** functional / fake feature / persistance simulée
- **Fichiers :** `frontend/components/school-portal/people-directory.tsx`, `school-management-view.tsx`, `student-import-directory.tsx`
- **Constat :** ces trois composants alimentent les routes `/dashboard/school/{students,teachers,courses,schedule,settings}`. Aucun n'appelle `apiClient`. Les listes (« Rasolonjatoavo Tiana », « Dr. Rakotomalala L. », etc.) sont des tableaux constants. Le bouton « Ajouter un étudiant/professeur/cours » n'a **aucun** gestionnaire `onClick`. L'édition de fiche (`ProfileModal`) sauvegarde dans `window.localStorage` (`people-directory.tsx:56-57`), pas en base. Le compteur « Affichage 1 à 6 sur 2 456 étudiants » est une chaîne littérale codée en dur.
- **Preuve technique :**
  ```ts
  // people-directory.tsx:57
  function saveFields(key, fields, setFields) { setFields(fields); window.localStorage.setItem(key, JSON.stringify(fields)); }
  ```
  L'import/export CSV de `student-import-directory.tsx` fonctionne réellement… mais uniquement en mémoire React (`setStudents`) : après rafraîchissement de la page, les étudiants « importés » disparaissent, aucune requête `POST` n'est envoyée au backend.
- **Cause probable :** même cause que CRIT-04/05, prototype visuel jamais connecté.
- **Impact fonctionnel :** un administrateur d'école croit gérer ses étudiants, professeurs et cours réels ; en réalité rien n'est partagé entre utilisateurs, rien ne survit à un rafraîchissement de page (sauf la copie locale au navigateur d'un seul utilisateur), et rien n'atteint jamais la base de données malgré des modèles Prisma (`Student`, `Course`, `TeacherSchool`, `CourseEnrollment`) parfaitement adaptés à cet usage.
- **Scénario :** deux administrateurs de la même école ouvrent l'écran « Étudiants » sur deux postes différents : ils voient des listes différentes, aucune modification de l'un n'est visible par l'autre.
- **Correction recommandée :** construire les endpoints CRUD manquants côté `student`/`school` module (listing des étudiants d'une école, gestion des affectations professeur) et connecter ces trois composants.
- **Effort :** XL.
- **Priorité :** P0 pour la transparence immédiate, P1/P2 pour la vraie implémentation.

### CRIT-07 — Montant de paiement contrôlable par le client
- **Catégorie :** sécurité / intégrité financière
- **Fichier :** `backend/src/modules/payment/payment.service.ts`, méthode `initiatePayment` (lignes 24-43)
- **Constat :** le montant du paiement est repris tel quel du corps de la requête (`let amount = dto.amount;`) et n'est recalculé côté serveur (`amount = application.offer.tuitionFees`) que **si** `dto.applicationId` est fourni. Or `applicationId` est optionnel dans `InitiatePaymentDto` (`@IsOptional()`).
- **Preuve technique :**
  ```ts
  let amount = dto.amount;
  if (dto.applicationId) {
    const application = await this.prisma.application.findUnique({ where: { id: dto.applicationId }, include: { offer: true } });
    ...
    amount = application.offer.tuitionFees;
  }
  // sinon amount reste = dto.amount, fourni par le client
  ```
- **Cause probable :** le champ `amount` a été prévu pour couvrir un cas générique (paiement hors candidature), mais aucune validation métier de ce cas n'a été implémentée.
- **Impact technique :** création possible d'enregistrements `Payment` avec n'importe quel montant (`@Min(100)` seule contrainte), ce qui pollue les statistiques `PaymentService.getStats()` consultées par le Ministère/Admin.
- **Impact fonctionnel :** un utilisateur authentifié peut initier un paiement de 100 MGA (minimum autorisé) sans lien avec une candidature réelle, ou tenter de faire valider un montant arbitraire si un flux métier venait à faire confiance à ce montant en aval.
- **Scénario :** `POST /payments/initiate` avec `{ amount: 100, method: "MVOLA" }` (sans `applicationId`) crée un paiement valide de 100 MGA au nom de l'étudiant connecté.
- **Correction recommandée :** interdire l'initiation d'un paiement sans `applicationId` (ou définir une liste blanche explicite des motifs de paiement hors candidature, avec montant calculé serveur dans tous les cas).
- **Effort :** XS.
- **Priorité :** P0.

### CRIT-08 — `apiClient` pointe en dur vers `localhost`, la variable d'environnement dédiée est ignorée
- **Catégorie :** configuration / déploiement
- **Fichier :** `frontend/lib/api-client.ts:4`
- **Constat :**
  ```ts
  export const apiClient = axios.create({ baseURL: 'http://localhost:3001/api', ... });
  ```
  alors que `frontend/.env.local` définit `NEXT_PUBLIC_API_URL`, jamais lu par ce fichier.
- **Cause probable :** variable déclarée en prévision du déploiement mais câblage oublié.
- **Impact fonctionnel :** dans n'importe quel environnement autre que le poste de développement local (staging, production, preview Vercel), **tous les appels API échoueront** (CORS/connexion refusée vers `localhost:3001` qui n'existe pas côté client du navigateur de l'utilisateur final).
- **Scénario :** déploiement sur un domaine public → écran blanc / toutes les requêtes échouent silencieusement en erreur réseau.
- **Correction recommandée :** `baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'`.
- **Effort :** XS.
- **Priorité :** P0 (bloquant tout déploiement).

---

## E. Anomalies élevées

| ID | Titre | Fichier(s) | Résumé | Effort |
|---|---|---|---|---|
| HIGH-01 | Passerelle de paiement 100 % simulée | `backend/src/modules/payment/providers/mock-payment.provider.ts` | `confirmPayment` utilise `Math.random() > 0.1` pour décider du succès ; aucune intégration Orange Money/Mvola/carte réelle malgré le DTO qui les liste comme méthodes valides. | L (intégration réelle) |
| HIGH-02 | Reçus et rapports exportés = texte brut avec Content-Type mensonger | `backend/src/modules/payment/payment.service.ts:208-225` (`generateReceipt`), `backend/src/modules/ministry/ministry.service.ts:492-518` (`exportReport`) | Le buffer renvoyé est `Buffer.from(\`RECEIPT...\`)`, texte brut, mais servi avec `type: 'application/pdf'` (ou Excel/CSV). Le fichier téléchargé sera corrompu/illisible dans le lecteur attendu. | M |
| HIGH-03 | Notifications (email/SMS/push) 100 % simulées ; préférences jamais persistées | `backend/src/modules/notification/notification.service.ts` | `sendEmail/sendSms/sendPush` ne font que `console.log` + délai artificiel ; `updatePreferences` ne touche jamais la base (`console.log` puis retour de succès) ; `getUserPreferences` renvoie toujours les mêmes valeurs par défaut. | L |
| HIGH-04 | `/ministry/public/stats` n'est pas public malgré son nom et sa documentation | `backend/src/modules/ministry/ministry.controller.ts:41-42,312-330` | Le contrôleur applique `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('MINISTRY','ADMIN_GET')` au niveau classe ; la route `public/stats` n'a pas de `@Public()` pour lever cette contrainte malgré son `@ApiOperation({summary: 'Public statistics (no authentication required)'})`. | XS |
| HIGH-05 | `openBankAccount` totalement factice | `backend/src/modules/payment/payment.service.ts:227-233` | Retourne un numéro de compte `Math.random()` et un statut `ACTIVE` sans aucune intégration bancaire. Endpoint documenté au même titre que les endpoints réels dans Swagger, sans avertissement. | M |
| HIGH-06 | `.env.example` (racine) incomplet | `/.env.example` vs `backend/src/modules/auth/auth.module.ts`, `payment.service.ts` | Il manque `DATABASE_URL`, `JWT_REFRESH_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION`. `PAYMENT_WEBHOOK_SECRET` est documenté mais absent du `.env` local actuel (le webhook de paiement est donc systématiquement rejeté en local). | XS |
| HIGH-07 | 26 vulnérabilités « high » (backend) / 12 (frontend) via `npm audit` | `backend/package-lock.json`, `frontend/package-lock.json` | Chaînes `brace-expansion`/`minimatch` (outillage ESLint/Jest), `fast-uri`, `postcss`/`sharp` (via Next.js). Impact direct en production limité (majoritairement `devDependencies`) mais doit être traité avant durcissement final. | S–M |
| HIGH-08 | Couverture de tests quasi nulle sur les flux critiques | tout le dépôt | 1 test trivial backend, 0 test frontend. Aucun test sur authentification, autorisations, paiement, upload, changement de statut de candidature. | Voir `TEST_GAPS.md` |
| HIGH-09 | Pages `/login` et `/register` orphelines, code mort et buggé | `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx` | Aucun lien interne ne pointe vers ces routes (la page d'accueil et toutes les autres pages pointent vers `/auth/login` et `/auth/register`), mais elles restent accessibles par URL directe. `/register` contient un bug réel : `const { accessToken, user } = response.data.data;` puis `document.cookie = \`accessToken=${accessToken}...\`` — le backend `/auth/register` ne renvoie **jamais** `accessToken` dans le corps (uniquement `{ user }`, le vrai jeton est posé en cookie `httpOnly` côté serveur sous le nom `access_token`), donc ce code écrit systématiquement un cookie `accessToken=undefined`, inutile et trompeur. | S |
| HIGH-10 | Propagation de l'objet utilisateur brut (`any`) dans tous les contrôleurs | `backend/src/modules/auth/strategies/jwt.strategy.ts:42-47`, tous les contrôleurs via `@GetUser() user: any` | `JwtStrategy.validate()` retourne l'entité Prisma `User` complète (incluant `password` haché et `mfaSecret` chiffré) fusionnée dans `request.user`. Aucune fuite confirmée dans le code actuel (chaque contrôleur reconstruit une réponse explicite), mais le typage `any` supprime toute protection du compilateur contre un futur `return user` accidentel. | S |
| HIGH-11 | Comptes de démonstration à mots de passe prévisibles | `backend/prisma/seed.ts` | `admin@get.mg / Admin123!`, `ministere@mesupres.gov.mg / Ministere123!`, etc. Le script refuse de s'exécuter en production sauf si `ALLOW_DEMO_SEED=true` est positionné explicitement — bonne pratique — mais aucun garde-fou n'existe si cette variable est un jour mal positionnée en prod. | XS (documentation/procédure) |

---

## F. Anomalies moyennes

| ID | Titre | Fichier(s) | Résumé |
|---|---|---|---|
| MED-01 | 402 erreurs ESLint backend (essentiellement `no-unsafe-*`) | tout `backend/src` | Quasi tous les services utilisent `data: any` ou consomment un `user: any`, désactivant les vérifications TypeScript à l'exécution la plus utile. |
| MED-02 | Pas de `middleware.ts` Next.js | `frontend/` (absent) | La protection des routes est 100 % côté client (`dashboard/layout.tsx` redirige après l'appel `/auth/me`). L'API reste protégée côté serveur donc pas de fuite de données, mais UX incohérente (flash de contenu, pas de SSR protégé) et absence de défense en profondeur. |
| MED-03 | `PAYMENT_WEBHOOK_SECRET` absent de l'environnement local actuel | `backend/.env` | `assertValidWebhookSignature` rejette systématiquement (`Signature webhook manquante`) tant que la variable n'est pas positionnée — le flux de confirmation de paiement est donc actuellement inopérant même avec le mock provider. |
| MED-04 | Jeton de réinitialisation de mot de passe réutilisable jusqu'à expiration | `backend/src/modules/auth/auth.service.ts` (`resetPassword`) | Aucune table de suivi des jetons utilisés/révoqués ; un jeton intercepté reste valable 1h même après un premier usage. |
| MED-05 | Pas de contrainte anti-doublon sur les paiements en cours | `prisma/schema.prisma` (modèle `Payment`) | Un étudiant peut initier plusieurs paiements `PROCESSING` pour la même candidature (pas de contrainte unique conditionnelle), créant des enregistrements orphelins. |
| MED-06 | Fichiers de développement non nettoyés dans le dépôt | `backend/package.json.bak` (suivi par git), `backend/prisma/check.ts` (non suivi, script de debug ad hoc) | Bruit dans l'historique/dépôt, risque de confusion pour un nouvel arrivant. |
| MED-07 | Deux formulaires d'inscription dupliqués avec règles légèrement différentes | `frontend/app/register/page.tsx` vs `frontend/app/auth/register/page.tsx` | Schémas Zod redondants (l'un sans confirmation de mot de passe/CGU, l'autre avec) ; risque de divergence silencieuse si l'un est modifié sans l'autre. |
| MED-08 | Statistiques d'école figées à zéro | `backend/src/modules/school/school.controller.ts:287-307` (`getMySchoolStats`) | Renvoie `{ totalOffers: 0, openOffers: 0, totalApplications: 0, ... }` codé en dur au lieu d'agréger réellement — alors que `OfferService`/`ApplicationService` exposent déjà les données nécessaires. |
| MED-09 | Statistiques de notifications par canal figées à zéro | `backend/src/modules/notification/notification.controller.ts:301-331` (`getStats`) | `byType: { EMAIL: 0, SMS: 0, PUSH: 0, IN_APP: 0 }` codé en dur. |
| MED-10 | Pagination en mémoire buggée sur le filtre ville des offres | `backend/src/modules/offer/offer.service.ts:80-120` | Quand `city` est fourni, le filtrage est fait après la pagination SQL (`items.filter(...)` en mémoire) : `meta.total`/`totalPages` deviennent incorrects dès que la page filtrée diffère de la page brute (le code le reconnaît lui-même en commentaire : « approximate »). |
| MED-11 | 8 erreurs TypeScript bloquant le build frontend | voir CRIT-02 | Rattaché ici pour la liste de correctifs techniques précis (voir détail C et CRIT-02). |
| MED-12 | Aucune vérification de la date limite de candidature (`Offer.applicationDeadline`) | `backend/src/modules/application/application.service.ts:21-69` (`submitApplications`) | Seuls `isOpen` et `deletedAt: null` sont vérifiés avant d'accepter une candidature ; le champ `applicationDeadline` existe dans le modèle `Offer` mais n'est jamais comparé à la date courante — une candidature peut donc être déposée après la date limite affichée si l'école n'a pas manuellement fermé l'offre (`isOpen=false`). |

---

## G. Anomalies faibles et observations

| ID | Titre | Détail |
|---|---|---|
| LOW-01 | `console.log`/`console.error` en production | 25 occurrences backend, 13 frontend, sans logger structuré ni correlation ID (le `Logger` NestJS n'est utilisé que dans 2 fichiers : `AllExceptionsFilter`, `LoggingInterceptor`). |
| LOW-02 | Liens morts `href="#"` | `frontend/app/auth/register/page.tsx:271,275` (CGU / politique de confidentialité). |
| LOW-03 | Avertissements ESLint « accessed before declared » | `student/payments/page.tsx`, `student/profile/page.tsx` : dette de lisibilité (le React Compiler désactive la mémoïsation), aucun bug d'exécution confirmé (les fonctions sont appelées dans un `useEffect`, donc après leur assignation). |
| LOW-04 | Images non optimisées dans `/public` | Plusieurs PNG ~2 Mo (`landing-students-campus.png`, `register-campus-students.png`, `login-*-illustration.png`) chargées en `background-image` CSS, sans passer par `next/image`, ni compression WebP. |
| LOW-05 | `README.md` backend = boilerplate NestJS par défaut | Ne documente ni les scripts spécifiques au projet (`prisma migrate`, seed, docker-compose) ni les rôles/comptes de démonstration. |
| INFO-01 | `docker-compose.yml` ne fournit ni Dockerfile applicatif ni orchestration complète | Bon point de départ pour l'environnement de dev (Postgres/Redis/MinIO) mais MinIO n'est jamais réellement utilisé par le code (`StorageService` écrit sur disque local). |
| INFO-02 | En-têtes de sécurité HTTP correctement posés | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS conditionné à la prod — bonne pratique à saluer (`backend/src/main.ts:16-32`). |

---

## H. Audit frontend

### H.1 Routage et navigation

Il n'existe pas de `middleware.ts` Next.js : toute protection de route est effectuée côté client dans `frontend/app/dashboard/layout.tsx`, via un appel `GET /auth/me` déclenché dans un `useEffect`, avec redirection vers `/auth/login` en cas d'échec. **Cela ne constitue pas une faille de sécurité** (les données sensibles restent protégées côté API par les guards NestJS), mais cela veut dire que :
- le HTML/JS de chaque page est envoyé au navigateur avant toute vérification d'identité (contenu statique uniquement, pas de donnée) ;
- **aucune page ne vérifie que le rôle courant correspond au segment d'URL visité** (`dashboard/layout.tsx` choisit la sidebar selon `userRole`, mais rend `children` — c.-à-d. la page demandée — quel que soit le rôle). Si un étudiant tape manuellement `/dashboard/admin/users`, le layout affichera la sidebar Étudiant autour du composant `AdminManagementView` : comme ce composant ne fait aucun appel API réel (CRIT-04), aucune fuite de donnée ne se produit aujourd'hui, mais dès que ces écrans seront branchés à de vraies API, ce jour-là **le contrôle d'accès reposera uniquement sur les 403 du backend**, sans filet de sécurité côté UI (ce qui est acceptable *si et seulement si* chaque nouvel endpoint est bien protégé par `RolesGuard`, ce qui est vrai à ce jour).

Deux routes orphelines existent en doublon des vraies pages d'authentification (voir HIGH-09) : `/login` et `/register`.

Inventaire (extrait représentatif — 35 routes dashboard recensées) :

| Route | Rôle attendu | Protection réelle | Backend associé | État |
|---|---|---|---|---|
| `/dashboard/student` | STUDENT | Client (`/auth/me`) | `GET /students/me`, `/students/me/stats` | Réel |
| `/dashboard/student/applications` | STUDENT | Client | `GET/POST /applications` | Réel |
| `/dashboard/student/offers` | STUDENT | Client | `GET /offers` | Réel |
| `/dashboard/student/payments` | STUDENT | Client | `GET/POST /payments` | Réel |
| `/dashboard/student/profile` | STUDENT | Client | `GET/PUT /students/me` | Réel |
| `/dashboard/student/messages` | STUDENT | Client | `GET /messages/*` | Réel |
| `/dashboard/student/{courses,documents,grades,library,news,opportunities,parcours,schedule,settings}` | STUDENT | Client | **Aucun** (`StudentPortalView`) | **Mock** (page « Cet espace est prêt à être connecté » pour 3 d'entre elles ; données inventées pour les autres) |
| `/dashboard/school` (accueil) | SCHOOL_ADMIN | Client | à vérifier au cas par cas | Partiel |
| `/dashboard/school/offers`, `/dashboard/school/offers/[id]` | SCHOOL_ADMIN | Client | `GET/POST/PUT /offers` | Réel |
| `/dashboard/school/{students,teachers,courses,schedule,settings}` | SCHOOL_ADMIN | Client | **Aucun** | **Mock** (voir CRIT-06) |
| `/dashboard/teacher` | TEACHER | Client | **Aucun côté frontend** (API réelle existante côté backend, non appelée) | **Mock** (voir CRIT-05) |
| `/dashboard/admin/*` (6 routes) | ADMIN_GET | Client | **Aucun côté frontend, endpoints backend inexistants** | **Mock** (voir CRIT-04) |
| `/dashboard/ministry` (accueil) | MINISTRY | Client | **Aucun** (`ministry-dashboard.tsx`, 538 lignes, 0 appel API alors que `GET /ministry/dashboard` existe et fonctionne) | **Mock** |
| `/dashboard/ministry/compliance` | MINISTRY | Client | `GET/PUT /ministry/compliance` | Réel |
| `/dashboard/ministry/reports` | MINISTRY | Client | `GET /ministry/reports`, `/ministry/reports/generate` | Réel (mais export = texte brut, voir HIGH-02) |
| `/login`, `/register` | — | Client | idem `/auth/*` | Orphelines/doublons (HIGH-09) |

### H.2 Composants

- Composants massivement monolithiques : `admin-management-view.tsx` (1134 lignes), `teacher-portal.tsx` (1559 lignes), souvent écrits en JSX sur une seule ligne extrêmement dense (voir `people-directory.tsx` ligne 31, ~2500 caractères sur une ligne), rendant la relecture, le diff Git et les tests quasiment impossibles.
- Duplication forte entre `school-management-view.tsx`/`people-directory.tsx`/`student-import-directory.tsx` : trois implémentations différentes d'un même « annuaire personnes » avec des types `Person`/lignes de tableau incompatibles.
- Aucun état de chargement/erreur cohérent sur les écrans mockés (puisqu'il n'y a pas d'appel réseau, il n'y a rien à attendre).
- Pas de composants réellement réutilisables pour les tableaux de données (chaque écran réécrit sa propre table HTML).

### H.3 Gestion des données

- Sur les écrans réellement connectés (candidatures, offres, paiements, profil, messages), le pattern est cohérent : `useEffect` + `apiClient.get(...)` + `useState`, gestion d'erreur via `toast.error` + `console.error`. Correct pour un stade POC, mais sans `react-query` malgré la dépendance installée (pas de cache, pas de déduplication de requêtes, pas de retry/backoff, pas d'annulation de requête au démontage).
- Intercepteur global de déconnexion sur 401 (`api-client.ts:13-23`) : redirige immédiatement vers `/auth/login`, y compris si un composant fait un appel non critique en tâche de fond — comportement correct mais pourrait provoquer une redirection intempestive en cas d'expiration de jeton pendant une saisie longue.

### H.4 Formulaires

| Formulaire | Route | API utilisée | Validation frontend | Validation backend | Persistance réelle | État |
|---|---|---|---|---|---|---|
| Connexion | `/auth/login` | `POST /auth/login` | zod (email, password requis) | `class-validator` (`IsEmail`, `IsString`) | ✅ | Réel |
| Inscription | `/auth/register` | `POST /auth/register` | zod (règles mot de passe alignées avec le backend) | `class-validator` (regex identique) | ✅ | Réel |
| Inscription (orpheline) | `/register` | `POST /auth/register` | zod (règles légèrement différentes, sans confirmation) | idem | ✅ mais code de post-traitement buggé (HIGH-09) | Doublon buggé |
| Mot de passe oublié | `/auth/forgot-password` (à vérifier) | `POST /auth/forgot-password` | — | — | ❌ **aucun envoi réel** | **Cassé** (CRIT-01) |
| Profil étudiant | `/dashboard/student/profile` | `PUT /students/me` | react-hook-form | `class-validator` | ✅ (chiffrement AES du téléphone/CIN) | Réel |
| Candidature (postuler à une offre) | `/dashboard/student/offers` | `POST /applications` | contrôle de doublon | contrôle de doublon + offre ouverte | ✅ | Réel |
| Paiement | `/dashboard/student/payments` | `POST /payments/initiate` | montant/méthode | montant recalculé **seulement si `applicationId`** (CRIT-07) | ✅ (mais fournisseur mock) | Partiellement réel |
| Créer/modifier une offre (école) | `/dashboard/school/offers` | `POST/PUT /offers` | react-hook-form | `class-validator` + vérification de propriété école | ✅ | Réel |
| Ajouter un étudiant/professeur/cours (école) | `/dashboard/school/{students,teachers,courses}` | **aucune** | — | — | ❌ | **Bouton sans action** (CRIT-06) |
| Créer une école / gérer un utilisateur (admin) | `/dashboard/admin/*` | **aucune** | — | — | ❌ | **Fake** (CRIT-04) |

### H.5 Interface selon les rôles

Aucun rendu de contenu d'une autre école/d'un autre utilisateur n'a été constaté sur les écrans réellement connectés (le backend filtre systématiquement par propriétaire). Le seul écart de contrat identifié est `/ministry/public/stats` (HIGH-04). Les menus latéraux sont correctement conditionnés par rôle (`dashboard/layout.tsx`), mais comme relevé en H.1, rien n'empêche la **navigation manuelle** vers l'URL d'un autre rôle — sans conséquence de fuite de données aujourd'hui car les écrans concernés sont soit mockés, soit protégés côté API.

### H.6 Responsive et accessibilité

- Les sidebars basculent en `hidden ... lg:flex`, donc **aucune navigation latérale n'est fournie sous le seuil `lg`** (mobile/tablette) sur la plupart des layouts (`dashboard/layout.tsx`) — aucun menu hamburger de repli identifié dans le code lu.
- Boutons d'action fréquemment réduits à une icône sans `aria-label` (ex. `MoreHorizontal`, `Edit3` dans les tableaux d'annuaire).
- Bon point : le composant `ProfileModal` pose `role="dialog"`, `aria-modal="true"`, `aria-label` — accessibilité correcte sur cet écran précis.
- Contrastes de texte globalement corrects (palette violet/slate avec un bon ratio), non vérifiés instrumentalement (pas d'outil Lighthouse exécuté dans cet audit hors-ligne).

---

## I. Audit backend et API

Voir `API_INVENTORY.md` pour l'inventaire complet endpoint par endpoint.

Points marquants :
- **Cohérence REST correcte** : ressources nommées au pluriel, verbes HTTP appropriés, codes de statut standards via `ResponseInterceptor`/`AllExceptionsFilter` uniformes (`{ success, data, message, timestamp, statusCode }`).
- **Pagination** : présente sur la plupart des listes (`page`/`limit`/`meta.total`), sauf le bug de filtrage en mémoire des offres par ville (MED-10).
- **Validation** : `ValidationPipe` global avec `whitelist: true, forbidNonWhitelisted: true, transform: true` — bonne pratique qui élimine par défaut les risques de mass assignment sur les champs non déclarés dans les DTO.
- **Contrôle d'accès par ressource** : chaque service sensible (`offer`, `application`, `school`, `payment`, `teaching`) implémente sa propre méthode `ensureCanManage*`/`ensureCanAccess*` qui revérifie systématiquement la propriété en base (pas de confiance aveugle dans le rôle du JWT). C'est le point fort le plus notable de ce backend.
- **Absence d'endpoints structurants** : pas de `UserController` (listing/gestion des utilisateurs), pas d'endpoint école pour lister/gérer ses propres étudiants et professeurs autrement que via `teaching` (côté professeur) — cohérent avec le constat que les écrans Admin/École correspondants sont mockés côté frontend : **le vide est des deux côtés**.
- **Endpoints simulés non signalés comme tels dans Swagger** : `/payments/bank-account`, `/payments/:id/receipt`, `/ministry/reports/:id/export` sont documentés au même niveau que les endpoints réels.

---

## J. Audit authentification et autorisations

### Mécanisme réel

- Mots de passe hachés avec `bcrypt`, facteur de coût `10` (`auth.service.ts:47,153`) — correct, un facteur `12` serait recommandé au-delà de 2024 pour du matériel moderne mais `10` reste acceptable.
- JWT signé avec secret dédié pour l'access token (`JWT_SECRET`, 15 min par défaut) et un **secret distinct** pour le refresh token (`JWT_REFRESH_SECRET`, 7 jours) — bonne pratique.
- Transport du jeton : cookie `httpOnly`, `sameSite: 'lax'`, `secure` conditionné à `NODE_ENV === 'production'` — combinaison correcte contre le vol XSS de jeton et raisonnablement robuste contre le CSRF (SameSite=Lax bloque les requêtes POST cross-site). Un fallback `Authorization: Bearer` est également supporté (`JwtStrategy`).
- Verrouillage anti brute-force : 5 tentatives puis blocage 15 minutes (`checkLoginAttempts`), stocké en base (`failedLoginAttempts`, `lastFailedLoginAt`) — fonctionnel, mais laisse fuiter un timing différent entre « compte inconnu » et « mot de passe invalide » (les deux renvoient le même message `UnauthorizedException('Identifiants invalides')`, ce qui est correct et volontairement anti-enumeration).
- `forgotPassword` ne fuite pas l'existence d'un compte (message générique renvoyé dans tous les cas) — bonne pratique — **mais le flux est cassé fonctionnellement** (CRIT-01).
- MFA TOTP (speakeasy) disponible pour les rôles `ADMIN_GET`, `SCHOOL_ADMIN`, `MINISTRY` ; secret stocké chiffré (AES-256-GCM) en base. Fonctionnel mais **non obligatoire** (aucun contrôle n'empêche un compte admin de rester sans MFA).
- `RolesGuard` se base sur `request.user.role`, lui-même recalculé à chaque requête depuis la base via `JwtStrategy.validate()` (pas de confiance dans la revendication `role` embarquée dans le JWT signé au login) — bon réflexe qui empêche un jeton émis avant un changement de rôle de rester valide avec l'ancien rôle.
- Déconnexion : `POST /auth/logout` efface les cookies côté client, mais **le token JWT reste valide côté serveur jusqu'à expiration naturelle** (pas de liste de révocation/blacklist). Un jeton volé avant la déconnexion resterait exploitable jusqu'à son expiration (15 min pour l'access token, ce qui limite fortement le risque).
- Désactivation de compte (`user.isActive = false`) : bien vérifiée à chaque requête dans `JwtStrategy.validate()` (`if (!user || !user.isActive) throw UnauthorizedException`) → un compte désactivé perd l'accès **immédiatement**, y compris avec un jeton encore valide. Bon point.

### Vulnérabilités identifiées

- CRIT-01 (reset password cassé).
- MED-04 (jeton de reset réutilisable jusqu'à expiration, pas de révocation après premier usage).
- Aucune politique de rotation de refresh token observée (le même refresh token reste valable 7 jours sans renouvellement glissant), ce qui est un choix acceptable pour un POC mais à muscler avant une mise en production réelle (rotation + détection de réutilisation).

### Matrice des rôles (résumé — détail exhaustif dans le tableau ci-dessous)

| Action | Étudiant | École (admin) | Professeur | Ministère | Admin GET |
|---|---|---|---|---|---|
| Consulter/modifier son propre profil | ✅ | ✅ | — | — | — |
| Postuler à une offre | ✅ | — | — | — | — |
| Consulter une candidature | ✅ (la sienne) | ✅ (de son école) | — | ✅ (toutes) | ✅ (toutes) |
| Changer le statut d'une candidature | ❌ | ✅ (de son école) | ❌ | ❌ | ✅ |
| Créer/modifier une offre | ❌ | ✅ (de son école) | ❌ | ❌ | ✅ |
| Créer/modifier une école | ❌ | ✅ (la sienne, modification seulement) | ❌ | ❌ | ✅ (création+suppression) |
| Gérer les cours (créer un chapitre, publier) | ❌ | *(via écran mocké, non fonctionnel)* | ✅ (ses cours affectés) | ❌ | ❌ |
| Consulter les paiements | ✅ (les siens) | *(aucun endpoint dédié école)* | ❌ | ✅ (stats) | ✅ (stats + tout paiement) |
| Consulter les logs d'audit | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gérer la conformité d'une école | ❌ | ❌ (lecture seule non exposée) | ❌ | ✅ | ✅ |
| Gérer les utilisateurs de la plateforme | ❌ | ❌ | ❌ | ❌ | ❌ *(aucun endpoint n'existe, même pour Admin GET)* |

### Scénarios de contournement testés (analyse statique du code, pas d'exécution en boîte noire)

1. **Étudiant accède au profil d'un autre étudiant** : impossible — `StudentController` n'expose que `/students/me*`, aucune route `/students/:id`.
2. **Étudiant modifie une autre candidature** : `updateStatus` exige `@Roles('SCHOOL_ADMIN','ADMIN_GET')`, un étudiant reçoit 403 avant même l'exécution du service. ✅ protégé.
3. **Étudiant modifie son propre rôle** : `UpdateStudentProfileDto` ne contient pas de champ `role` et `ValidationPipe({forbidNonWhitelisted:true})` rejette tout champ additionnel. ✅ protégé.
4. **École consulte les candidats d'une autre école** : `ApplicationService.getSchoolApplications` filtre systématiquement par `admin.schoolId` récupéré en base à partir de l'utilisateur connecté (pas du corps de requête). ✅ protégé.
5. **École modifie une formation d'une autre école** : `OfferService.ensureCanManageSchool` revérifie `user.schoolAdmin.schoolId === schoolId`. ✅ protégé.
6. **École modifie une candidature hors périmètre** : `ApplicationService.ensureCanManageApplication` revérifie `application.offer.schoolId`. ✅ protégé.
7. **Professeur consulte une candidature non attribuée** : sans objet (le module `teaching` ne touche pas aux candidatures) — pas de vecteur identifié.
8. **Professeur prend une décision finale non autorisée** : `TeachingController` n'expose aucune route de décision de candidature. ✅ protégé par absence de surface.
9. **Ministère modifie des données en lecture seule** : le Ministère peut appeler `PUT /ministry/compliance/:schoolId` (action prévue et légitime pour ce rôle) ; aucune route de modification hors de son périmètre documenté n'a été trouvée accessible au rôle `MINISTRY` seul (les routes de modification d'offres/écoles exigent `SCHOOL_ADMIN`/`ADMIN_GET`).
10. **Admin standard accède aux fonctions super-admin** : un seul niveau de rôle `ADMIN_GET` existe, pas de distinction super-admin — non applicable en l'état.
11. **Utilisateur désactivé réutilise une ancienne session** : bloqué immédiatement par `JwtStrategy.validate()` (voir ci-dessus). ✅ protégé.
12. **Utilisateur modifie un identifiant dans l'URL (IDOR)** : systématiquement revérifié côté service pour les ressources sensibles (`application`, `offer`, `school`, `payment`) — voir CRIT-07 pour la seule brèche identifiée (montant de paiement, pas un ID).
13. **Modification directe du corps de requête (mass assignment)** : globalement protégée par `whitelist:true/forbidNonWhitelisted:true` ; `SchoolService.update`/`OfferService.update` font toutefois un spread `{...dto}` direct dans `prisma.update` — sans risque supplémentaire tant que le DTO reste strict, mais fragile si un champ sensible venait à être ajouté au DTO sans réflexion (ex. `isActive`).
14. **Appel direct d'un endpoint protégé dans l'UI** : c'est le scénario qui **s'applique concrètement** aujourd'hui à l'inverse — de nombreux écrans UI n'appellent aucun endpoint alors que le backend, lui, est prêt (CRIT-05, CRIT-06) : un appel direct et légitime de ces endpoints (via Swagger `/api/docs` par ex.) fonctionne correctement avec les bons contrôles de rôle/propriété.

---

## K. Audit base de données

### Modèle réel (Prisma, PostgreSQL)

Schéma de 30 modèles couvrant : identité (`User`, `Role`), profils (`Student`, `Teacher`, `SchoolAdmin`), établissements (`School`, `TeacherSchool`, `SchoolSubscription`), pédagogie (`Course`, `CourseChapter`, `CourseResource`, `CourseEnrollment`, `Evaluation`, `Assignment`, `AssignmentSubmission`, `Grade`), admission (`Offer`, `Application`, `ApplicationTimeline`), paiement (`Payment`, `Transaction`, `Refund`), documents (`Document`, `Image`), communication (`Notification`, `NotificationTemplate`, `Message`, `Conversation`, `ConversationParticipant`), conformité/pilotage (`MinistryReport`, `ComplianceCheck`, `AuditLog`).

### Points positifs

- Contraintes uniques pertinentes : `User.email`, `School.slug`, `Offer.slug`, `Payment.reference`, `Course` (`schoolId, code, group`), `Application` (`studentId, offerId`), `CourseEnrollment` (`courseId, studentId`), `TeacherSchool` (`teacherId, schoolId`).
- Index posés sur les colonnes de filtrage fréquent : `Student.enrolledSchoolId`, `TeacherSchool([schoolId, isActive])`, `Course([teacherId, isPublished])`, `Application([studentId, status])`/`([offerId, status])`, `Payment([studentId, status])`/`([reference])`, `Message([recipientId, isRead, createdAt])`, `AuditLog([userId, createdAt])`.
- Suppression en cascade cohérente pour les entités dépendantes (`Student→Document`, `Application→ApplicationTimeline`, `Conversation→Message`), et `onDelete: Restrict` volontaire sur `Course.teacher` (empêche de supprimer un professeur qui a encore des cours actifs — bon réflexe d'intégrité).
- Suppression douce (`deletedAt`) appliquée aux entités qui en ont besoin fonctionnellement (`School`, `Offer`, `Application`, `Student`, `Document`, `Payment` n'en a pas mais n'en a pas besoin métier).
- Migrations à jour (`npx prisma migrate status` confirme 6 migrations appliquées, schéma synchronisé).

### Risques et manques

- **Pas de contrainte empêchant les doublons de paiement « en cours »** pour une même candidature (MED-05) — un index unique partiel `@@unique([applicationId], where: status IN ('PENDING','PROCESSING'))` n'est pas exprimable nativement en Prisma mais serait faisable via une contrainte SQL brute dans une migration.
- **Montants stockés en `Float`** (`Payment.amount`, `Offer.tuitionFees`, etc.) plutôt qu'en type décimal (`Decimal` Prisma / `NUMERIC` Postgres) : risque d'imprécision en virgule flottante sur des montants financiers, même si les montants manipulés (MGA, sans décimales usuelles) réduisent le risque pratique. Recommandé de migrer vers `Decimal` avant la mise en production réelle des paiements.
- **`AuditLog.before`/`after` en `Json`** sans limite de taille : si un futur endpoit journalise des payloads volumineux (ex. upload), la table `audit_logs` peut croître de façon incontrôlée (l'intercepteur `AuditInterceptor` journalise déjà `after: data`, potentiellement le corps complet de chaque réponse `GET` réussie — voir aussi section L, exposition de données dans les logs).
- **`Student.phone`/`Student.cin` chiffrés en base (AES-256-GCM)** — bon point rare à souligner, mais le decrypt a un `fallback` silencieux vers la valeur brute en cas d'échec de déchiffrement (`student.service.ts:62-70`), ce qui masque une éventuelle corruption/rotation de clé plutôt que de la signaler.
- Pas de table dédiée pour les préférences de notification (actuellement simulées, voir HIGH-03) ni pour les jetons de réinitialisation de mot de passe (MED-04).

### Performances SQL observées

- Pas de N+1 flagrant détecté dans les chemins examinés : les listes principales utilisent `include`/`Promise.all([findMany, count])`.
- `OfferService.findAll` filtre la ville en mémoire après pagination SQL — potentiel problème de performance à grande échelle en plus du bug fonctionnel déjà cité (MED-10).
- Plusieurs requêtes `$queryRaw` dans `ministry.service.ts`/`message.service.ts` sont proprement paramétrées (template Prisma `sql`), pas de risque d'injection, mais complexifient la maintenabilité par rapport à l'API Prisma standard.

### Index recommandés

- `Payment(applicationId, status)` — pour accélérer la détection de doublons proposée en MED-05.
- `Notification(userId, createdAt)` en complément de l'index existant `(userId, isRead)`, utile pour le tri chronologique déjà pratiqué dans `getUserNotifications`.

---

## L. Audit sécurité

Voir `SECURITY_FINDINGS.md` pour le détail avec preuves techniques par vulnérabilité, mappé OWASP.

Synthèse : aucune injection SQL/NoSQL, aucune faille XSS stockée évidente (React échappe par défaut, pas de `dangerouslySetInnerHTML` trouvé dans le code lu), CORS correctement restreint à `FRONTEND_URL`, en-têtes de sécurité posés. Les points faibles réels sont : le montant de paiement contrôlable côté client (CRIT-07), l'absence de vraie révocation de session, les comptes de démonstration à mots de passe prévisibles (garde-fou présent mais reposant sur une variable d'environnement), et la dette de dépendances (`npm audit`).

---

## M. Audit performances

### Frontend
- Pas de découpage de code observé au-delà du découpage par route Next.js par défaut (App Router) ; composants de plus de 1000 lignes chargés en un bloc.
- Images non optimisées (`LOW-04`).
- Pas de virtualisation de listes — non critique tant que les données sont mockées (quelques lignes), **deviendra nécessaire** dès que les vraies listes (2000+ étudiants selon le placeholder « 2 456 étudiants ») seront branchées.
- `react-query` installé mais non utilisé dans les pages examinées → pas de déduplication de requêtes ni de cache, chaque montage de composant relance ses `apiClient.get`.

### Backend
- Pas de traitement synchrone lourd identifié.
- Pas de cache applicatif (Redis provisionné dans `docker-compose.yml` mais jamais importé dans le code NestJS) alors que des endpoints à fort potentiel de cache existent (`/schools`, `/offers`, `/ministry/dashboard`).
- Upload en mémoire (`Multer` avec `FileInterceptor`, buffer en RAM, limite 5 Mo) : acceptable au volume actuel, à surveiller si le volume d'upload simultané augmente.

### Base de données
- Pagination par `skip/take` (offset) partout — deviendra coûteux à grande échelle sur les grandes tables (`Message`, `AuditLog`) ; une pagination par curseur serait préférable **après** le MVP, pas une urgence immédiate.
- Voir MED-10 pour le seul problème de pagination réellement bogué aujourd'hui.

### Classement

- **Nécessaire immédiatement (P0/P1) :** corriger MED-10 (résultats de recherche incorrects, pas seulement une question de perf).
- **Nécessaire avant production :** activer un cache sur les listings publics (`/schools`, `/offers`), adopter `react-query` pour éviter les appels redondants.
- **Utile après le MVP :** pagination par curseur sur `Message`/`AuditLog`, virtualisation de listes.
- **Optimisation prématurée à éviter :** tout travail de perf sur les écrans actuellement mockés (CRIT-04/05/06) tant qu'ils ne sont pas connectés à de vraies données.

---

## N. Audit tests

Voir `TEST_GAPS.md` pour le détail complet.

| Type de test | Nombre | Modules couverts | Qualité | Commande | Résultat |
|---|---|---|---|---|---|
| Unitaire backend | 1 | `AppController` (boilerplate) | Triviale (`getHello()`) | `npm test` (backend) | ✅ passe, sans valeur de couverture réelle |
| E2E backend | 1 fichier présent (`test/app.e2e-spec.ts`) | Non exécuté dans cet audit (nécessite une base dédiée) | Boilerplate par défaut | `npm run test:e2e` | Non exécuté (risque de modifier des données réelles sur la base locale connectée) |
| Unitaire/composant frontend | 0 | — | — | — | Aucun outil de test frontend configuré (`package.json` frontend ne référence ni Jest ni Vitest ni Testing Library) |
| E2E frontend | 0 | — | — | — | Aucun (pas de Playwright/Cypress) |

Aucun test ne couvre : authentification, autorisations/IDOR, isolation multi-établissement, candidatures, changements de statut, upload de fichiers, paiements. Pour une plateforme qui manipule des données personnelles et des transactions financières, c'est le écart le plus significatif après les fonctionnalités mockées.

---

## O. Fonctionnalités réelles contre fonctionnalités simulées

| Fonctionnalité | Interface présente | Backend présent | Base de données | Réel ou simulé | État |
|---|---|---|---|---|---|
| Inscription / Connexion | ✅ | ✅ | ✅ | Réel | Fonctionnel |
| Mot de passe oublié | ✅ | ✅ (partiel) | ✅ | **Simulé** | **Cassé** (CRIT-01) |
| Profil étudiant (lecture/écriture, avatar) | ✅ | ✅ | ✅ | Réel | Fonctionnel |
| Upload de documents étudiants (CV, diplôme…) | ✅ | ✅ (façade) | ✅ (métadonnées seulement) | **Simulé** | **Cassé** (CRIT-03, fichier jamais stocké) |
| Parcours d'orientation (questionnaire) | ✅ | ✅ | ✅ | Réel | Fonctionnel (algorithme de score simple mais réel) |
| Candidatures (postuler, suivi, statut) | ✅ | ✅ | ✅ | Réel | Fonctionnel |
| Offres de formation (consultation, gestion école) | ✅ | ✅ | ✅ | Réel | Fonctionnel |
| Paiement (initiation, historique) | ✅ | ✅ | ✅ | **Partiellement simulé** | Le flux existe mais la confirmation dépend d'un fournisseur mock aléatoire (HIGH-01) et le montant peut être manipulé (CRIT-07) |
| Reçu de paiement PDF | ✅ (bouton téléchargement) | ✅ (endpoint) | — | **Simulé** | Texte brut renvoyé en `.pdf` (HIGH-02) |
| Messagerie interne | ✅ | ✅ | ✅ | Réel | Fonctionnel |
| Notifications (email/SMS/push) | Partielle | ✅ (façade) | ✅ (in-app seulement) | **Simulé** | Aucun envoi réel, préférences non persistées (HIGH-03) |
| Statistiques Ministère (dashboard, conformité, rapports agrégés) | ✅ (compliance/reports) | ✅ | ✅ | Réel | Fonctionnel pour compliance/reports ; page d'accueil Ministère mockée |
| Export de rapports Ministère (PDF/Excel/CSV) | ✅ | ✅ (façade) | ✅ (métadonnées) | **Simulé** | Texte brut (HIGH-02) |
| Gestion des écoles, utilisateurs, transactions (Admin GET) | ✅ (visuellement complet) | ❌ (endpoints inexistants pour users/transactions) | ✅ (modèles existent) | **100 % simulé** | **Non fonctionnel** (CRIT-04) |
| Espace Professeur (cours, étudiants, notes) | ✅ (visuellement complet) | ✅ (API réelle, non appelée) | ✅ | **100 % simulé côté UI** | **Non fonctionnel malgré une API prête** (CRIT-05) |
| Gestion académique École (étudiants, professeurs, cours, emploi du temps) | ✅ (visuellement complet, import/export CSV fonctionnel en apparence) | ❌ (pas d'endpoint listing étudiants/profs d'une école côté admin école) | ✅ (modèles existent) | **100 % simulé, persistance `localStorage`** | **Non fonctionnel** (CRIT-06) |
| Compte bancaire étudiant | ✅ (bouton) | ✅ (façade) | — | **100 % simulé** | Numéro de compte aléatoire (HIGH-05) |
| Journal d'audit | ✅ (consultation) | ✅ | ✅ | Réel | Fonctionnel, alimenté automatiquement par `AuditInterceptor` |
| Ouverture de compte bancaire, `SchoolSubscription`, `NotificationTemplate` (modèles Prisma) | — | Partiel/aucun endpoint dédié | ✅ (table existe) | **Non exposé** | Modèle de données présent, aucune fonctionnalité applicative associée |

---

## P. Dette technique

Voir `TECHNICAL_DEBT.md` pour le détail par domaine et priorité.

---

## Q. Plan de correction priorisé

Voir `REMEDIATION_PLAN.md`.

---

## R. Quick wins (faible effort, fort impact)

1. **CRIT-08** — pointer `apiClient` sur `NEXT_PUBLIC_API_URL` (1 ligne).
2. **CRIT-07** — refuser `initiatePayment` sans `applicationId` (quelques lignes, `payment.service.ts`).
3. **HIGH-04** — ajouter `@Public()` sur `GET /ministry/public/stats` (1 ligne).
4. **HIGH-09** — supprimer les routes orphelines `/login` et `/register` (ou les rediriger vers `/auth/*`).
5. **MED-08 / MED-09** — remplacer les statistiques figées à zéro par de vraies agrégations Prisma déjà disponibles ailleurs dans le code (`OfferService`, `ApplicationService`).
6. **CRIT-02** — corriger les 8 erreurs TypeScript qui cassent `next build` (typage `DialogTrigger`, normalisation `string | null`).
7. **MED-06** — supprimer `backend/package.json.bak` du suivi git, ajouter `backend/prisma/check.ts` à `.gitignore` ou le committer intentionnellement dans un dossier `scripts/`.
8. **HIGH-06** — compléter `.env.example` (racine) avec toutes les variables réellement requises par le backend.

---

## S. Verdict final

**Prototype fonctionnel mais instable.**

Justification : le noyau réellement branché (authentification hors reset password, profil étudiant, candidatures, offres, paiement au sens flux — hors intégration bancaire réelle, messagerie, conformité/rapports Ministère) fonctionne de bout en bout avec un contrôle d'accès backend globalement solide. Mais une part très significative de la surface visible du produit — la totalité de l'espace Admin GET, la totalité de l'espace Professeur, la majorité de la gestion académique École, la réinitialisation de mot de passe, l'upload de documents, les reçus/rapports exportés — est soit non fonctionnelle, soit un mock visuel sans aucune connexion à la base de données. Le build de production frontend échoue actuellement. Ce n'est donc ni un MVP exploitable en l'état (trop de fonctions administratives centrales sont vides), ni un simple prototype instable au sens « bugué » (le code qui existe est globalement propre) — c'est un produit dont l'interface promet davantage que ce que le système délivre réellement aujourd'hui. Avec le plan de correction P0/P1 (`REMEDIATION_PLAN.md`), notamment le câblage de l'espace Professeur sur une API déjà prête, la trajectoire vers un MVP réellement exploitable est courte sur certains pans et longue sur d'autres (Admin GET, gestion académique École).
