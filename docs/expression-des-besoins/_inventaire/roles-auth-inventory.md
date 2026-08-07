# Inventaire Rôles, Authentification et Sécurité — Plateforme GET

Document produit pour l'Expression des Besoins métier, à partir d'une analyse du code source réel (backend NestJS + Prisma, frontend Next.js) au 2026-08-05. Aucune valeur de secret n'est reproduite ici — uniquement les noms de variables d'environnement et leur usage.

---

## 1. Rôles réellement présents dans le système

Source : `backend/prisma/schema.prisma` (modèle `Role`, table `roles`, colonne `name` unique) + `backend/prisma/seed.ts` (lignes 16-44) + usage effectif dans les décorateurs `@Roles(...)` de tous les contrôleurs.

Le modèle `Role` est une table libre (`id`, `name`, `description`, `isDefault`), pas un `enum` Prisma — n'importe quelle chaîne pourrait théoriquement être insérée en base, mais dans les faits **seuls 5 rôles sont créés par le seed et reconnus par le code** (guards, frontend) :

| Rôle (valeur `name`) | Description en base (seed) | `isDefault` | Compte démo (seed) |
|---|---|---|---|
| `STUDENT` | Étudiant | oui (rôle par défaut à l'inscription publique) | plusieurs comptes de démonstration |
| `ADMIN_GET` | Administrateur GET | non | `admin@get.mg` |
| `SCHOOL_ADMIN` | Administrateur d'école | non | `schooladmin@get.mg` |
| `MINISTRY` | Administrateur Ministère | non | compte(s) créé(s) dans le seed |
| `TEACHER` | Professeur | non | compte(s) créé(s) dans le seed |

Remarques :
- `POST /auth/register` (inscription publique) attribue **toujours** le rôle `STUDENT` (`auth.service.ts:45-51`) — il n'existe aucune voie d'auto-inscription pour les autres rôles ; les comptes `ADMIN_GET`, `SCHOOL_ADMIN`, `MINISTRY`, `TEACHER` ne peuvent être créés que côté serveur (seed) ou par un flux d'administration non couvert par `auth.controller.ts` (à vérifier dans `user.controller.ts`/`school.controller.ts` — la création d'utilisateurs enseignants/admin d'école se fait via des services métier dédiés, pas via `/auth/register`).
- Chaque `User` a une relation optionnelle 1-1 avec `Student` ou `SchoolAdmin` (tables dédiées) qui portent les attributs métier spécifiques (ex. `schoolAdmin.schoolId` pour rattacher un admin à *une* école). Un `SCHOOL_ADMIN` est donc scoping à une seule école via cette relation, pas via un champ sur `User`/`Role`.
- Aucun rôle « super admin » distinct de `ADMIN_GET` n'existe. `ADMIN_GET` est de facto le rôle plateforme le plus privilégié (accès à tous les modules).

---

## 2. Matrice Rôle × Module backend

Établie à partir des décorateurs `@Roles(...)` / `@Public()` réellement posés (au niveau classe et/ou méthode) dans chaque `*.controller.ts`. **Attention** : dans la majorité des contrôleurs, le décorateur de classe pose uniquement `@UseGuards(JwtAuthGuard)` (authentification simple) et chaque **méthode** répète `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(...)` — la protection par rôle n'est donc pas garantie « par contrôleur » mais doit être vérifiée route par route. Le tableau ci-dessous résume le cas général observé ; « Partiel » signifie que certaines routes du module diffèrent du cas général.

Légende : ✅ accès complet · ➖ accès partiel (scope restreint : « ses propres » ressources / son école) · ❌ aucun accès · 🌐 public (pas d'authentification requise)

| Module (fichier contrôleur) | STUDENT | SCHOOL_ADMIN | TEACHER | MINISTRY | ADMIN_GET | Preuve (extrait) |
|---|---|---|---|---|---|---|
| `auth` (`auth.controller.ts`) | 🌐 register/login/logout/forgot/reset | 🌐 idem + ➖ MFA (enable/verify/disable) | 🌐 idem | 🌐 idem + ➖ MFA | 🌐 idem + ➖ MFA | `@Roles('ADMIN_GET','SCHOOL_ADMIN','MINISTRY')` uniquement sur `mfa/enable|verify|disable` (l. 216, 226, 239) |
| `students` (`student.controller.ts`) | ➖ (propre profil `me/*`) | ❌ | ❌ | ❌ | ❌ | `@Controller('students') @UseGuards(JwtAuthGuard,RolesGuard) @Roles('STUDENT')` classe entière (l. 68-69) |
| `schools` (`school.controller.ts`) | ➖ (annonces reçues) | ➖ (routes `me/*` = son école uniquement) | ➖ (annonces reçues) | ❌ | ✅ (CRUD écoles, listes globales, broadcast) | Ex. `@Get('students') @Roles('ADMIN_GET')` (l. 130-132) vs `@Get('me') @Roles('SCHOOL_ADMIN')` (l. 320-322) ; `GET /schools`, `GET /schools/:id` en `@Public()` (l. 99, 1118) |
| `offers` (`offer.controller.ts`) | 🌐 lecture publique | ➖ (`mine`, CRUD ses offres) | ❌ | ❌ | ✅ CRUD toutes offres | `@Roles('SCHOOL_ADMIN')` sur `GET /offers/mine` (l. 86-87) ; `@Roles('SCHOOL_ADMIN','ADMIN_GET')` sur create/update/delete/status (l. 133,157,180,196) ; listing + détail + par école en `@Public()` (l. 44,117,219) |
| `applications` (`application.controller.ts`) | ➖ (soumission, ses candidatures) | ➖ (candidatures de son école) | ❌ | ➖ (stats seules) | ✅ | Classe = `@UseGuards(JwtAuthGuard)` seul (l. 43) ; ex. `POST /applications @Roles('STUDENT')` (l. 55), `GET /applications/stats @Roles('MINISTRY','ADMIN_GET')` (l. 191), `GET /applications @Roles('ADMIN_GET')` (l. 216) |
| `payments` (`payment.controller.ts`) | ➖ (ses paiements, initiation) | ❌ | ❌ | ❌ | ✅ (stats, liste admin) | `@Roles('STUDENT')` sur `initiate`/liste/`bank-account` (l. 46,125,184) ; `@Roles('ADMIN_GET')` sur `stats`/`admin` (l. 63,78) ; `POST /payments/webhook` en `@Public()` (l. 145, webhook signé HMAC) |
| `ministry` (`ministry.controller.ts`) | ❌ | ❌ | ❌ | ✅ | ✅ | Classe entière `@Roles('MINISTRY','ADMIN_GET')` (l. 46-47) ; `GET /ministry/public/stats` en `@Public()` (l. 230-231) |
| `notifications` (`notification.controller.ts`) | ➖ (ses notifs `me`, préférences) | ➖ idem + `status-update`/`reminder` | ➖ (ses notifs `me`, préférences) | ➖ (ses notifs `me`, préférences) | ✅ (`send`, `welcome`, `payment-confirmation`, `platform-stats`) | Classe = `@UseGuards(JwtAuthGuard)` seul (l. 43) ; `@Roles('ADMIN_GET')` sur `send`/`welcome`/`payment-confirmation`/`platform-stats` (l. 57,187,205,312) ; `@Roles('ADMIN_GET','SCHOOL_ADMIN')` sur `status-update`/`reminder` (l. 227,255) ; `me`, `preferences`, `read`, `read-all` **sans** `@Roles` = accessibles à tout utilisateur authentifié quel que soit son rôle |
| `audit` (`audit.controller.ts`) | ❌ | ❌ | ❌ | ❌ | ✅ (y compris `GET /audit/me`) | Classe entière `@Roles('ADMIN_GET')` (l. 29-30), **aucune route de la classe ne redéfinit `@Roles`**, y compris `GET /audit/me` documentée « Get my own audit logs » (l. 135) — voir incohérence 4.5 |
| `messages` (`message.controller.ts`) | ✅ | ✅ | ✅ | ❌ | ✅ | Classe entière `@Roles('STUDENT','SCHOOL_ADMIN','TEACHER','ADMIN_GET')` (l. 47) — MINISTRY explicitement exclu de la messagerie |
| `competitions` (`competition.controller.ts`) | ❌ | ❌ | ❌ | ❌ | ✅ | Classe entière `@Roles('ADMIN_GET')` (l. 28-29) |
| `financial-partners` (`financial-partner.controller.ts`) | ❌ | ❌ | ❌ | ❌ | ✅ | Classe entière `@Roles('ADMIN_GET')` (l. 38-39) |
| `landing` (`landing.controller.ts`) | 🌐 lecture | 🌐 lecture | 🌐 lecture | 🌐 lecture | ✅ (édition config/news) | `config`, `news`, `partners` en `@Public()` (l. 60,67,75) ; toutes les routes d'édition `@Roles('ADMIN_GET')` |
| `academic-years` (`academic-year.controller.ts`) | 🌐 lecture | 🌐 lecture | 🌐 lecture | 🌐 lecture | ✅ (create/update/delete) | `GET` en `@Public()` (l. 24-25) ; POST/PATCH/DELETE `@Roles('ADMIN_GET')` (l. 32,41,50) |
| `teacher/*` (`teaching.controller.ts`, plusieurs classes dans le même fichier) | ❌ | ❌ | ✅ (ses cours, évaluations, devoirs) | ❌ | ❌ | 4 classes distinctes, toutes `@Roles('TEACHER')` (l. 113,293,370,396) |
| `teacher/availability`, `teacher/travel-buffers` (`teacher-availability.controller.ts`) | ❌ | ❌ | ✅ (ses disponibilités) | ❌ | ➖ (`GET /teachers`, `GET /teachers/:id/conflicts`) | 3 classes : `@Roles('TEACHER')` (l. 15,46) puis `@Roles('ADMIN_GET')` sur `/teachers` (l. 77) |
| `settings` (`system-settings.controller.ts`) | ❌ | ❌ | ❌ | ❌ | ✅ | Classe entière `@Roles('ADMIN_GET')` (l. 11) |
| `users` (`user.controller.ts`) | ❌ | ❌ | ❌ | ❌ | ✅ | Classe entière `@Roles('ADMIN_GET')` (l. 12) |
| `admin/dashboard-summary` (`admin-dashboard.controller.ts`) | ❌ | ❌ | ❌ | ❌ | ✅ | Classe entière `@Roles('ADMIN_GET')` (l. 10) |

**19 contrôleurs backend analysés** (18 modules métier + `auth`).

Points transverses relevés dans la matrice :
- `PUT /schools/:id` et `POST /schools/:id/logo` n'ont **aucun** `@Roles` (seulement `@UseGuards(JwtAuthGuard)`) : la restriction ADMIN_GET-ou-admin-de-cette-école-précise est faite **manuellement dans le corps de la méthode** (comparaison `user.role`/`user.schoolAdmin.schoolId`), pas par le `RolesGuard` déclaratif. Fonctionnellement correct mais rend la matrice « décorateurs seuls » incomplète pour ces 2 routes — un audit basé uniquement sur `@Roles` sous-estimerait la protection réelle.
- `GET /audit/me` : nommée « mes propres logs » mais héritant du `@Roles('ADMIN_GET')` de classe, donc **inaccessible aux STUDENT/TEACHER/SCHOOL_ADMIN/MINISTRY** malgré son intitulé — probable incohérence fonctionnelle (voir section 4).

---

## 3. Mécanisme d'authentification

**Technologie** : JWT stateless (bibliothèque `@nestjs/jwt` + stratégie Passport `passport-jwt`), transporté par **cookies `httpOnly`** (pas de `localStorage`) — extraction acceptée aussi via header `Authorization: Bearer` (utile pour Swagger/tests), voir `jwt.strategy.ts:14-21`.

### 3.1 Inscription (`POST /auth/register`, public, throttlé 5 req/min)
- Rôle imposé : `STUDENT` (aucun autre rôle accessible par ce canal).
- Règles de mot de passe (`RegisterDto`, class-validator) : 8-32 caractères, au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial parmi `@$!%*?&amp;` (regex identique utilisée pour le reset et le changement de mot de passe étudiant/enseignant).
- Hash : `bcrypt`, facteur de coût **10**.
- Émet immédiatement une paire de jetons (access + refresh) posés en cookies — pas d'étape de vérification d'email/compte avant connexion (`isVerified` existe en base mais n'est pas contrôlé au login dans `auth.service.ts`).

### 3.2 Connexion (`POST /auth/login`, public, throttlé 5 req/min)
- Vérifie verrouillage de compte (5 tentatives échouées → blocage 15 min, `checkLoginAttempts`/`incrementLoginAttempts`/`resetLoginAttempts`, champs `failedLoginAttempts`/`lastFailedLoginAt` sur `User`).
- Si `mfaEnabled=true` : renvoie `{ mfaRequired: true, challengeToken }` (JWT signé, type `mfa_challenge`, expiration 5 min) **sans poser aucun cookie de session** — la deuxième étape se fait via `POST /auth/mfa/login-verify`.
- Sinon : pose les cookies `access_token` (15 min) et `refresh_token` (7 jours), tous deux `httpOnly`, `path=/`, `sameSite=lax` par défaut (`sameSite=none` + `secure=true` si la variable `CROSS_SITE_COOKIES=true`, pour les déploiements frontend/backend sur domaines distincts).

### 3.3 MFA (TOTP, `speakeasy` + QR code)
- Réservé aux rôles `ADMIN_GET`, `SCHOOL_ADMIN`, `MINISTRY` (`@Roles('ADMIN_GET','SCHOOL_ADMIN','MINISTRY')` sur `mfa/enable|verify|disable`) — **STUDENT et TEACHER n'ont pas accès au MFA**.
- Secret TOTP chiffré en base (`EncryptionService`, AES-256-GCM, clé issue de `ENCRYPTION_KEY`) avant stockage dans `User.mfaSecret`.

### 3.4 Session / autorisation par requête
- `JwtAuthGuard` appliqué **globalement** (`APP_GUARD` dans `app.module.ts`) : toute route est protégée par défaut, doit être explicitement marquée `@Public()` pour être accessible sans jeton — changement de posture documenté en commentaire comme correction d'un défaut d'audit antérieur (auparavant, une route sans `@UseGuards` explicite pouvait devenir publique par oubli).
- `RolesGuard` **n'est pas** appliqué globalement : il doit être ajouté explicitement (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`) sur chaque contrôleur/méthode qui restreint par rôle. Une route authentifiée sans `@Roles` reste accessible à **tout** utilisateur connecté, quel que soit son rôle.
- `JwtStrategy.validate()` recharge l'utilisateur en base à chaque requête (`select` explicite excluant `password`/`mfaSecret` du payload retourné — voir SEC-07 ci-dessous) et vérifie :
  - `user.isActive` (sinon 401) ;
  - `payload.sessionVersion === user.sessionVersion` — mécanisme de **révocation de session côté serveur** : `sessionVersion` est incrémenté à chaque déconnexion explicite (`revokeSession`), rendant invalides tous les jetons émis avant.
  - rejet des jetons « à usage unique » (reset password, challenge MFA, porteurs d'un champ `type`) s'ils sont présentés comme jeton d'accès.

### 3.5 Déconnexion (`POST /auth/logout`, public volontairement)
- Décode le cookie `access_token` en mode best-effort (`ignoreExpiration: true`) pour incrémenter `sessionVersion` si possible, puis efface les deux cookies. Reste accessible même avec un jeton déjà expiré, pour garantir le nettoyage des cookies dans tous les cas.

### 3.6 Mot de passe oublié / réinitialisation
- `POST /auth/forgot-password` (public, throttlé 3 req/min) : génère un JWT `type: 'reset'` (**expiration 1h**), envoie un lien via `NotificationService` (canal email). Réponse **toujours générique** (« si un compte existe... »), y compris en cas d'échec d'envoi — protection contre l'énumération de comptes.
- `POST /auth/reset-password` (public, throttlé 5 req/min) : vérifie le jeton et son `type`, hash le nouveau mot de passe (mêmes règles de complexité que l'inscription).
- **Le jeton de reset n'est pas invalidé après usage** (pas de table de jetons à usage unique / de liste de révocation dédiée) — il reste valable jusqu'à expiration naturelle (1h) même après avoir servi une première fois.
- Le canal d'envoi d'email étant potentiellement « simulé » en environnement de développement/QA (mention explicite en commentaire renvoyant à un point HIGH-03 documenté ailleurs), le fonctionnement réel en production dépend du provider d'email effectivement branché — à vérifier hors code.

### 3.7 Rafraîchissement de session — **absent**
Un `refresh_token` (7 jours) est bien généré et posé en cookie à chaque connexion, **mais aucune route `/auth/refresh` n'existe** dans `auth.controller.ts`, et le frontend (`lib/api-client.ts`) ne tente aucun rafraîchissement silencieux : sur un `401` (donc notamment l'expiration de l'access token après 15 min), il redirige immédiatement vers `/auth/login`. Le refresh token est donc **émis mais jamais consommé** — voir incohérence 4.6.

### 3.8 Limitation de tentatives (throttling)
- Global : `ThrottlerModule` (`APP_GUARD`), 100 req/min par défaut sur toute l'API.
- Spécifique : `@Throttle({ limit: 5, ttl: 60_000 })` sur `register`, `login`, `mfa/login-verify`, `reset-password`, `mfa/verify`, `mfa/disable` ; `@Throttle({ limit: 3, ttl: 60_000 })` sur `forgot-password`.
- Verrouillage de compte applicatif distinct (5 échecs → 15 min de blocage), décrit en 3.2.

---

## 4. Incohérences frontend / backend détectées

Le frontend **ne dispose d'aucun `middleware.ts` Next.js**, d'aucun contexte `AuthContext`/hook `useAuth` dédié — recherche exhaustive (`useAuth`, `AuthContext`, `AuthProvider`, `middleware.ts`) infructueuse dans `frontend/app`, `frontend/components`, `frontend/lib`. La protection des routes est **entièrement côté client**, centralisée dans un **unique** `frontend/app/dashboard/layout.tsx` (pas un layout par rôle comme la structure de dossiers `dashboard/<role>/` pourrait le laisser penser — il n'y a qu'un seul `layout.tsx` à la racine `dashboard/`, aucun `layout.tsx` dans `dashboard/student/`, `dashboard/admin/`, etc.) :

1. **Pas de protection serveur (SSR/middleware)** : aucune page `dashboard/*` n'est protégée avant hydratation React. Le layout appelle `GET /auth/me` côté client dans un `useEffect`, redirige vers `/auth/login` en cas d'échec. Un contenu HTML minimal (état de chargement) est donc théoriquement envoyé même à un visiteur non authentifié, avant la redirection JS — pas une fuite de données (le contenu réel des pages `dashboard/*` fait ses propres appels API protégés côté backend), mais absence de défense en profondeur au niveau du framework. Le commentaire du code reconnaît explicitement cette limite : « le seul rempart restant étant le 403 du RolesGuard backend ».
2. **Cloisonnement inter-rôles géré par une table `ROLE_HOME` en dur côté client** (`dashboard/layout.tsx:57-63`) qui redirige tout utilisateur hors de la racine correspondant à son rôle (`/dashboard/student`, `/dashboard/school`, `/dashboard/teacher`, `/dashboard/admin`, `/dashboard/ministry`). Cette redirection est un confort UX et une deuxième ligne de défense, pas un contrôle de sécurité — un utilisateur `STUDENT` qui appellerait directement un endpoint réservé `SCHOOL_ADMIN` (via `fetch` manuel, hors UI) serait de toute façon bloqué par le `RolesGuard` backend, mais rien côté frontend n'empêche de charger une page `dashboard/admin/*` en HTML/JS avant l'échec des appels API (elle sera vidée de son contenu, pas bloquée en amont).
3. **Rafraîchissement de session** : `api-client.ts` ne fait aucune tentative de refresh silencieux sur `401` — comportement cohérent avec le backend qui n'expose pas d'endpoint de refresh (voir 3.7), mais cela signifie qu'un utilisateur est déconnecté de force toutes les 15 minutes d'inactivité API réelle (durée de vie de l'access token), malgré la présence d'un refresh token valide 7 jours qui n'est jamais utilisé. Incohérence de conception plutôt qu'un défaut de sécurité : soit le refresh token est un reliquat à supprimer, soit un flux de rafraîchissement manque encore à implémenter des deux côtés.
4. **`GET /audit/me`** (« mes logs d'audit ») restreinte côté backend à `ADMIN_GET` uniquement (héritage du `@Roles` de classe, aucune redéfinition de méthode) — aucune page frontend ne semble exposer cette fonctionnalité aux autres rôles, donc pas d'appel bloqué observé côté UI actuellement, mais le nom de l'endpoint suggère une intention plus large côté conception que ce que l'implémentation actuelle autorise.
5. Aucune incohérence détectée en revanche sur les grands modules métier (étudiants, écoles, offres, candidatures, paiements, ministère) : les routes protégées `SCHOOL_ADMIN` ne sont utilisées que par `components/school-portal/*` et pages `dashboard/school/*`, `TEACHER` uniquement par `components/teacher-portal/*` et `dashboard/teacher`, etc. — cohérence apparente entre la répartition des dossiers frontend et les rôles requis côté backend, sous réserve d'un audit exhaustif appel-par-appel non réalisé ici (volume trop important pour ce passage).

---

## 5. Synthèse des points de sécurité déjà documentés (`docs/audit/`)

Deux documents existants ont été consultés à titre de complément, pas comme vérité sur l'état actuel du code (des correctifs semblent avoir été appliqués depuis leur rédaction — voir avertissement ci-dessous) :

### `docs/audit/SECURITY_FINDINGS.md` (11 constats, base OWASP Top 10 / API Security Top 10)
- **SEC-01 (Critique)** — Montant de paiement contrôlable côté client : `POST /payments/initiate` accepterait un `amount` arbitraire quand `applicationId` est omis (`dto.applicationId` optionnel). Pertinent pour les besoins non fonctionnels « intégrité financière ».
- **SEC-02 (Élevée, probablement corrigé)** — `/ministry/public/stats` documentée publique mais protégée par le `@Roles` de classe. **Constat obsolète** : le code actuel montre `@Public()` explicitement posé sur cette route (`ministry.controller.ts:230-231`).
- **SEC-03 (Élevée)** — Reset de mot de passe présenté comme non fonctionnel faute de canal d'envoi réel ; le code actuel appelle bien `NotificationService.send(...)`, dont le canal email peut être simulé en dev/QA (mention HIGH-03) — statut de production à reconfirmer.
- **SEC-04 (Moyenne, probablement corrigé)** — Absence de révocation de session signalée ; le code actuel implémente `sessionVersion` (voir 3.4), qui répond précisément à ce point. **Constat obsolète.**
- **SEC-05 (Moyenne)** — Mots de passe de démonstration prévisibles et journalisés en clair dans `seed.ts` (`console.log`), protégés par un garde-fou `NODE_ENV=production` + `ALLOW_DEMO_SEED`.
- **SEC-06 (Élevée)** — Dépendances avec vulnérabilités connues (`npm audit`), majoritairement des `devDependencies`.
- **SEC-07 (Moyenne)** — Objet utilisateur complet (incluant hash bcrypt et secret MFA chiffré) chargé en `any` dans `JwtStrategy.validate()` et propagé à tous les contrôleurs via `@GetUser()` — risque latent si un contrôleur retournait un jour cet objet sans le reconstruire.
- **SEC-08 (Faible)** — `Content-Type` incohérent sur certains fichiers générés (reçus/rapports).
- **SEC-09 (Faible)** — URL d'API en dur (`http://localhost`) en fallback frontend, risque en cas de bascule production mal configurée.
- **SEC-10/SEC-11 (Information)** — Validation MIME déclarative (non signature binaire) pour les documents étudiants ; absence de jeton CSRF explicite, mitigée par `SameSite=Lax` + CORS restreint.

⚠️ **Avertissement méthodologique** : au moins deux constats (SEC-02, SEC-04) apparaissent déjà résolus dans le code actuellement en place, ce qui indique que ce document d'audit n'a pas été mis à jour après les corrections correspondantes. Il doit être utilisé comme liste de vigilance historique, pas comme état des lieux garanti à date.

### `docs/security-audit-backlog.md` (pré-audit du 28 juillet 2026, à finaliser avant mise en production)
- **Priorité élevée** — Isolation des notifications école : les endpoints `status-update`/`reminder` (`@Roles('ADMIN_GET','SCHOOL_ADMIN')`) ne vérifieraient pas que la candidature/offre concernée appartient bien à l'école de l'admin appelant — risque d'accès croisé inter-établissements.
- **Priorité moyenne** — Upload de documents étudiants : validation du seul MIME déclaré (pas de signature binaire réelle), et le fichier ne serait pas réellement déposé en stockage (URL construite sans upload effectif) — écho du point SEC-10.
- **Priorité moyenne** — Données sensibles (téléphone, CIN) pouvant être enregistrées en clair en cas d'échec de chiffrement, et présence de données personnelles dans les journaux applicatifs.
- Points déjà durcis selon ce même document : contrôles d'accès sur offres/candidatures/paiements, cookies `HttpOnly`, webhooks de paiement signés, rate limiting actif.

Un troisième document, `docs/audit/CODE_AUDIT_REPORT.md`, est référencé par `SECURITY_FINDINGS.md` (constats CRIT-01, CRIT-03, CRIT-08, HIGH-02, HIGH-03, MED-04) mais n'a pas été lu en détail dans le cadre de ce passage — à consulter pour le détail technique complet des points fonctionnels associés (reset password, stockage de documents, config URL frontend).

---

## Sécurité applicative transverse (pour mémoire, section besoins non fonctionnels)

- **Validation des entrées** : `ValidationPipe` global (`whitelist: true, forbidNonWhitelisted: true, transform: true`) + `class-validator` sur tous les DTO consultés.
- **En-têtes de sécurité** : posés manuellement dans `main.ts` (pas de package `helmet` détecté) — `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (uniquement en production), `x-powered-by` désactivé.
- **CORS** : origine(s) restreinte(s) à la variable `FRONTEND_URL` (liste séparée par virgules possible), `credentials: true`, méthodes explicites.
- **Chiffrement au repos** : `EncryptionService` (AES-256-GCM) utilisé au moins pour le secret MFA (`User.mfaSecret`), clé pilotée par `ENCRYPTION_KEY`.
- **Variables d'environnement sensibles identifiées par leur nom d'usage** (aucune valeur consultée ni reproduite) : `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `ENCRYPTION_KEY`, `PAYMENT_WEBHOOK_SECRET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_PUBLIC_BUCKET`, `S3_PUBLIC_URL`, `S3_REGION`, `S3_FORCE_PATH_STYLE`, `CROSS_SITE_COOKIES`, `FRONTEND_URL`, `APP_URL`, `ALLOW_MOCK_PAYMENT`, `ALLOW_DEMO_SEED`, `NODE_ENV`, `ENABLE_SWAGGER`, `PORT` ; côté frontend, `NEXT_PUBLIC_API_URL`. Les fichiers `.env` réels ne sont pas suivis par git (confirmé par le document d'audit existant).
