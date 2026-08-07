# Parcours utilisateurs par rôle — Plateforme GET

Document produit pour l'Expression des Besoins métier, à partir des inventaires techniques déjà réalisés (`backend-inventory.md`, `frontend-inventory.md`, `data-model-inventory.md`, `roles-auth-inventory.md`, `docs-tests-inventory.md`), au 2026-08-05. Aucune information n'est inventée : toute affirmation renvoie à un fichier (et une ligne quand disponible) déjà cité dans ces inventaires. Quand une information n'a pas pu être établie avec certitude, la mention **« Point à confirmer avec le métier ou l'équipe de développement »** est utilisée explicitement.

Le système compte 5 rôles applicatifs réels (`STUDENT`, `SCHOOL_ADMIN`, `TEACHER`, `MINISTRY`, `ADMIN_GET`, source : `roles-auth-inventory.md` §1) plus l'état « visiteur non authentifié ». Le rôle `STUDENT` recouvre deux parcours fonctionnellement très différents — **candidat** (aucune inscription active) et **étudiant inscrit** (au moins une `StudentEnrollment` active) — distingués côté frontend par `isEnrolled` (`frontend-inventory.md`, portail student, ligne 141) : ils sont donc documentés séparément ci-dessous, portant le total à 7 parcours.

**Avertissement transverse sur les traces d'audit** : `AuditInterceptor` journalise **automatiquement toute requête HTTP** de la plateforme (métadonnées uniquement : userId, action déduite du verbe HTTP, ressource déduite de l'URL, ip, userAgent, status — jamais le corps de la requête/réponse), pour tous les rôles et tous les modules, y compris les routes publiques (`backend-inventory.md`, contexte global et module `audit`). Cette trace globale n'est donc pas répétée à chaque section ci-dessous sauf quand une journalisation *métier* additionnelle et spécifique existe (ex. `ApplicationTimeline`).

**Avertissement transverse sur la protection des routes** : aucune protection serveur (middleware Next.js) n'existe côté frontend ; le seul rempart réel est le `RolesGuard` du backend (403 en cas d'accès non autorisé). Le cloisonnement par rôle observé ci-dessous (redirection vers le portail correspondant, masquage de menu) est un confort UX, pas un contrôle de sécurité (`roles-auth-inventory.md` §4, `frontend-inventory.md` lignes 5-16).

---

## 1. Visiteur non authentifié

**Objectif du rôle** : découvrir la plateforme GET, consulter l'offre de formation publique, créer un compte candidat ou se connecter à un compte existant.

**Point d'entrée** : `/` (landing page).

**Préconditions** : aucune — accès public, aucun jeton requis.

**Écrans accessibles** (toutes les routes ci-dessous sont `@Public()` côté API ou ne nécessitent aucune session) :
- `/` — landing page (vitrine, actualités, partenaires) — `frontend/app/page.tsx`.
- `/auth/login` — connexion — `frontend/app/auth/login/page.tsx`.
- `/auth/register` — création de compte (STUDENT uniquement) — `frontend/app/auth/register/page.tsx`.
- `/auth/forgot-password` — demande de réinitialisation — `frontend/app/auth/forgot-password/page.tsx`.
- `/auth/reset-password` — réinitialisation via jeton reçu par email — `frontend/app/auth/reset-password/page.tsx`.

**Actions possibles** :
- Consulter la configuration de la landing, les actualités publiées et les partenaires financiers actifs (`GET /landing/config`, `GET /landing/news?limit=3`, `GET /landing/partners`, `@Public()` — `landing.controller.ts:60-76`).
- Consulter le catalogue public des écoles (`GET /schools`, `GET /schools/:id`, `@Public()` — `school.controller.ts:99-100, 1118-1119`) et des offres de formation (`GET /offers`, `GET /offers/:id`, `GET /offers/school/:schoolId`, `@Public()` — `offer.controller.ts:44-45, 117-118, 219-220`). **Point d'attention** : aucun écran frontend dédié à la navigation publique de ce catalogue n'a été identifié en dehors de la landing elle-même — la recherche/filtrage d'offres n'existe que côté portail étudiant authentifié (`/dashboard/student/offers`) ; à confirmer si un parcours de consultation publique du catalogue est attendu avant inscription.
- Consulter les statistiques ministérielles publiques (`GET /ministry/public/stats`, `@Public()` — `ministry.controller.ts:230-231`) et la liste des années académiques (`GET /academic-years`, `@Public()` — `academic-year.controller.ts:24-25`) — aucun écran frontend identifié consommant directement ces deux endpoints hors dashboards authentifiés.
- Créer un compte (`POST /auth/register`, throttlé 5/min) — attribue **toujours** le rôle `STUDENT` (`auth.service.ts:45-51`), aucune autre voie d'auto-inscription n'existe.
- Se connecter (`POST /auth/login`, throttlé 5/min), avec défi MFA si le compte cible en dispose.
- Demander (`POST /auth/forgot-password`, throttlé 3/min) puis effectuer (`POST /auth/reset-password`, throttlé 5/min) une réinitialisation de mot de passe.

**Données consultées** : contenu public de la landing, catalogue écoles/offres publiques, statistiques ministérielles publiques.

**Données modifiables** : aucune, hormis la création de son propre compte (email, mot de passe, identité déclarée dans `RegisterDto`).

**Restrictions** :
- Aucun accès à `/dashboard/*` sans authentification réussie (redirection côté client vers `/auth/login`, `dashboard/layout.tsx` lignes 109-121).
- Le formulaire d'inscription ne permet de créer que des comptes `STUDENT` — les comptes `SCHOOL_ADMIN`, `TEACHER`, `MINISTRY`, `ADMIN_GET` ne peuvent être provisionnés que côté serveur (seed ou flux d'administration non exposé publiquement, `roles-auth-inventory.md` §1).

**Notifications** : aucune (pas de compte) — un email de réinitialisation est envoyé en cas de demande valide (canal potentiellement simulé en environnement de développement/QA, voir `roles-auth-inventory.md` §3.6).

**Résultats possibles** :
- Inscription réussie → cookies de session posés immédiatement, redirection codée en dur vers `/dashboard/student` (`frontend/app/auth/register/page.tsx` ligne ~90).
- Connexion réussie sans MFA → cookies posés, redirection par rôle (`destinations[user.role]`, `LoginScreen.tsx:83`).
- Connexion avec MFA activé → réponse `{mfaRequired:true, challengeToken}` sans cookie, seconde étape `POST /auth/mfa/login-verify`.
- Demande de réinitialisation → réponse **toujours générique** (« si un compte existe... »), qu'un compte existe ou non — protection anti-énumération (`auth.service.ts:211-217`).

**Cas d'erreur connus** :
- Verrouillage de compte après 5 tentatives de connexion échouées (15 minutes de blocage) — `auth.service.ts:350-371`.
- CTA « Je suis une école / institution » de la landing pointant vers le même formulaire d'inscription, qui ne crée que des comptes étudiants — incohérence documentée (`frontend-inventory.md` ligne 25, 177).
- Aucune vérification d'email (`isVerified`) n'est appliquée au moment de la connexion malgré l'existence du champ en base (`roles-auth-inventory.md` §3.1).

**Traces générées** : journalisation automatique (`AuditLog`, action `REGISTER`/`LOGIN`/`LOGOUT` selon la route) même en l'absence de session préalable, car ces routes sont publiques mais interceptées comme toute requête API.

---

## 2. STUDENT — candidat (aucune inscription active)

**Objectif du rôle** : constituer un dossier candidat complet, rechercher des offres de formation, candidater, suivre l'avancement de ses candidatures, régler les frais une fois accepté.

**Point d'entrée** : `/dashboard` → redirection automatique vers `/dashboard/student` (`frontend/app/dashboard/page.tsx`), qui affiche `CandidateDashboard` tant qu'aucune `StudentEnrollment` n'existe (`frontend/app/dashboard/student/page.tsx` ligne 187-188).

**Préconditions** : compte `STUDENT` authentifié (cookie JWT valide, `user.isActive=true`, `sessionVersion` à jour) ; `enrollments.length === 0`.

**Écrans accessibles** (protection : `@Roles('STUDENT')` sur l'ensemble du contrôleur `students`, `student.controller.ts:68-69`) :
| Route | Fichier |
|---|---|
| `/dashboard/student` (vue candidat) | `frontend/app/dashboard/student/page.tsx`, fonction `CandidateDashboard` |
| `/dashboard/student/profile` | `frontend/app/dashboard/student/profile/page.tsx` |
| `/dashboard/student/documents` | `frontend/app/dashboard/student/documents/page.tsx` |
| `/dashboard/student/offers` | `frontend/app/dashboard/student/offers/page.tsx` |
| `/dashboard/student/applications` | `frontend/app/dashboard/student/applications/page.tsx` |
| `/dashboard/student/payments` | `frontend/app/dashboard/student/payments/page.tsx` |
| `/dashboard/student/messages` | `frontend/app/dashboard/student/messages/page.tsx` |
| `/dashboard/student/settings` | `frontend/app/dashboard/student/settings/page.tsx` |

**Actions possibles** :
- Éditer son profil (identité, adresse, parcours bac, aspirations) — `PUT /students/me` (`student.controller.ts:111-138`).
- Uploader un avatar (jpeg/png/webp ≤5 Mo) — `POST /students/me/avatar` (`:142-194`).
- Déposer des documents (CV, LETTER, ID, DIPLOMA, PHOTO, OTHER) et les supprimer (soft delete) — `POST`/`DELETE /students/me/documents` (`:306-403`).
- Répondre au questionnaire d'orientation et consulter les suggestions d'offres calculées — `POST`/`GET /students/me/orientation` (`:407-460`).
- Rechercher/filtrer les offres publiques et voir si une candidature existe déjà — `GET /offers`, `GET /applications/me` (`frontend/app/dashboard/student/offers/page.tsx` lignes 62-74).
- Candidater à une ou plusieurs offres en un seul envoi — `POST /applications` (`application.controller.ts:53-55`).
- Suivre le statut de ses candidatures, y compris liste d'attente, avec filtres — `GET /applications/me` (`:85-87`).
- Une fois une candidature `ACCEPTED` : initier un paiement des frais, consulter l'historique, télécharger un reçu — `POST /payments/initiate`, `GET /payments`, `GET /payments/:id/receipt` (`payment.controller.ts:44-46,123-125,163-165`).
- Utiliser la messagerie interne (hors Ministère) — `/messages/*`.
- Changer son mot de passe et son thème — `PATCH /students/me/password`, `PATCH /students/me/theme` (`:525-559`).

**Données consultées** : son propre profil et compteurs (`GET /students/me`, `GET /students/me/stats`), documents déposés, offres publiques, ses candidatures, ses paiements.

**Données modifiables** : profil, documents, réponses au questionnaire d'orientation, candidatures (soumission uniquement — aucune route d'annulation de candidature identifiée côté API ; **point à confirmer avec le métier**), mot de passe, thème.

**Restrictions** :
- Accès strictement scopé à « ses propres » ressources (`me/*`), aucune visibilité sur les dossiers d'autres candidats.
- Le passage à `ACCEPTED`/`ENROLLED` bascule automatiquement l'expérience vers la vue « étudiant inscrit » dès qu'une `StudentEnrollment` existe.

**Notifications** : reçoit une notification à chaque changement de statut de sa candidature (`NotificationService.sendApplicationStatusUpdate`, `application.service.ts:30-49`), ainsi qu'une notification s'il est promu depuis la liste d'attente (`:572-585`).

**Résultats possibles** :
- Candidature classée `submitted` / `failed` / `alreadyApplied` selon l'offre (`application.service.ts`, testé dans `application.service.spec.ts`).
- Paiement initié → `PENDING`, expire après 15 minutes si non confirmé (`payment.service.ts:78`).
- Paiement confirmé (webhook) → passage automatique de la candidature à `ENROLLED` et création d'une `StudentEnrollment`, dans la même transaction (`payment.service.ts:133-247`).

**Cas d'erreur connus** :
- Candidature refusée si l'offre est fermée, si la date limite (`applicationDeadline`) est dépassée, ou en cas de doublon (unicité `[studentId, offerId]`).
- Paiement refusé si la candidature n'appartient pas à l'étudiant, n'est pas encore `ACCEPTED`, ou si un paiement `PENDING`/`PROCESSING`/`COMPLETED` existe déjà pour cette candidature.
- Remplacement d'une soumission (hors périmètre candidat mais partagé avec la vue inscrite) refusé si déjà notée.
- Aucune vérification de deadline confirmée par un test dédié à ce jour (`docs-tests-inventory.md` §6, point 8) — statut du contrôle à reconfirmer.

**Traces générées** : `AuditLog` automatique sur chaque requête (dont action `PAYMENT` sur `payments/initiate`) ; `ApplicationTimeline` horodatée à chaque changement de statut de candidature, y compris en cas d'échec d'inscription (offre sans programme).

---

## 3. STUDENT — inscrit (au moins une inscription active)

**Objectif du rôle** : suivre sa scolarité au quotidien (cours, notes, devoirs, emploi du temps), rester en lien avec son établissement, régler d'éventuels frais additionnels.

**Point d'entrée** : `/dashboard/student` (corps principal, dès que `enrollments.length > 0`).

**Préconditions** : compte `STUDENT` authentifié avec au moins une `StudentEnrollment.status = ACTIVE`.

**Écrans accessibles** :
| Route | Fichier | Statut observé |
|---|---|---|
| `/dashboard/student` (accueil inscrit) | `frontend/app/dashboard/student/page.tsx` | **Données 100 % statiques codées en dur** (emploi du temps, devoirs, cours/notes, événements, 4 KPI) — non représentatif des données réelles (`frontend-inventory.md` lignes 146, 169, 195) |
| `/dashboard/student/courses` | `frontend/app/dashboard/student/courses/page.tsx` | Fonctionnel, connecté |
| `/dashboard/student/assignments` | `frontend/app/dashboard/student/assignments/page.tsx` | Fonctionnel |
| `/dashboard/student/grades` | `frontend/app/dashboard/student/grades/page.tsx` | Fonctionnel |
| `/dashboard/student/schedule` | `frontend/app/dashboard/student/schedule/page.tsx` | Fonctionnel |
| `/dashboard/student/documents` | `frontend/app/dashboard/student/documents/page.tsx` | Fonctionnel |
| `/dashboard/student/payments` | `frontend/app/dashboard/student/payments/page.tsx` | Fonctionnel |
| `/dashboard/student/messages` | `frontend/app/dashboard/student/messages/page.tsx` | Fonctionnel |
| `/dashboard/student/news` | `frontend/app/dashboard/student/news/page.tsx` | Fonctionnel |
| `/dashboard/student/profile`, `/settings` | idem candidat | Fonctionnel |
| `/dashboard/student/library`, `/opportunities` | `components/student-portal/portal-view.tsx` (`ComingSoon`) | **Écrans d'attente explicites, aucun contenu métier** |
| `/dashboard/student/parcours` | `components/student-portal/portal-view.tsx` | **100 % de données statiques codées en dur**, bouton « Télécharger mon relevé » sans action câblée |

**Actions possibles** :
- Consulter la liste de ses cours inscrits (`GET /students/me/courses`), ses notes (`GET /students/me/grades`), son emploi du temps (`GET /students/me/schedule`).
- Consulter les devoirs d'un cours et y déposer une soumission (pdf/jpg/png/doc/docx ≤5 Mo), tant qu'elle n'est pas déjà notée — `GET`/`POST /students/me/courses/:id/assignments`, `/me/assignments/:id/submit` (`student.controller.ts:210-281`).
- Consulter les actualités de son établissement et les marquer comme lues — `GET`/`PUT /notifications/:id/read` via `SchoolNewsFeed`.
- Régler des frais additionnels si applicable, consulter l'historique de paiement.
- Messagerie interne, changement de mot de passe/thème.

**Données consultées** : cours et notes strictement limités à ceux où une `CourseEnrollment` réelle existe (vérifié, `student.service.spec.ts`) ; créneaux (`CourseSlot`) des cours inscrits.

**Données modifiables** : soumissions de devoirs (avant notation), profil, mot de passe, thème.

**Restrictions** : isolation stricte par inscription réelle — aucun accès aux notes/emploi du temps de cours auxquels l'étudiant n'est pas inscrit, même dans la même école.

**Notifications** : actualités école (marquage lu), notifications de paiement/candidature héritées du parcours candidat si applicable.

**Résultats possibles** : soumission déposée ou remplacée (si non notée) ; consultation de notes/emploi du temps à jour.

**Cas d'erreur connus** :
- L'écran d'accueil et l'écran « Mon parcours » affichent des données **entièrement fictives et déconnectées** des vraies données disponibles par ailleurs (`/schedule`, `/assignments`, `/courses`, `/grades`) — risque de confusion utilisateur signalé explicitement dans `frontend-inventory.md` (points 3 et 169).
- Écrans « Bibliothèque » et « Stages & emplois » sont des placeholders assumés, sans valeur métier actuelle.
- Plusieurs boutons sans gestionnaire d'événement repérés sur ces écrans (bouton « Télécharger mon relevé », icône cloche, bouton « Voir tout » des widgets) — `frontend-inventory.md` §« Incohérences de navigation », point 2.
- Remplacement de soumission refusé si déjà notée (`Conflict`).

**Traces générées** : `AuditLog` automatique sur toute requête API.

---

## 4. SCHOOL_ADMIN

**Objectif du rôle** : gérer l'ensemble du cycle de vie d'un établissement partenaire — offres de formation, candidatures reçues, étudiants inscrits, professeurs, cours, emploi du temps, paiements reçus, communication, paramétrage.

**Point d'entrée** : `/dashboard/school`.

**Préconditions** : compte `SCHOOL_ADMIN` rattaché à **une seule école** via la relation 1-1 `SchoolAdmin.schoolId` (`roles-auth-inventory.md` §1) ; l'école de l'admin est toujours déduite du token, jamais d'un paramètre client (`ADR-002`, `docs-tests-inventory.md`).

**Écrans accessibles** (17 fichiers `page.tsx`) :
`/dashboard/school`, `/applications`, `/applications/[id]`, `/classes`, `/communications`, `/courses`, `/documents`, `/messages`, `/offers`, `/offers/[id]`, `/offers/new`, `/payments`, `/reports`, `/schedule`, `/settings`, `/students`, `/teachers` (chemins détaillés dans `frontend-inventory.md`, portail school).

**Actions possibles** (protection : `@Roles('SCHOOL_ADMIN')` route par route, scope `me/*`) :
- CRUD complet sur les offres de formation, avec ouverture/fermeture aux candidatures — `offer.controller.ts:85-220`, `frontend/app/dashboard/school/offers*`.
- Traitement complet d'un dossier de candidature : planifier un test (`schedule-test`), un entretien (`schedule-interview`), enregistrer un score (`score`), changer le statut (machine à états stricte) — `application.controller.ts:272-352`, écran le plus riche du portail (`applications/[id]/page.tsx`, 788 lignes).
- Inscrire un étudiant (ou en masse) à un programme/année, modifier/retirer une inscription — `POST /schools/me/students/enroll[/bulk]`, `PATCH /schools/me/students/:studentId` (`school.controller.ts:531-567`).
- CRUD filières, années académiques école, matières, prérequis d'admission, classes, salles, créneaux-types, créneaux de cours (avec détection de conflit salle/professeur), génération automatique de planning.
- Gérer les professeurs affectés à l'école (création, édition, affectation aux besoins horaires).
- Créer et diffuser des annonces ciblées (classes/étudiants/professeurs) et des communications.
- Consulter les paiements reçus par l'école (résumé + détail transactionnel paginé, `ADR-002`), les rapports (pipeline candidatures, taux de conversion, tendance, export CSV).
- Consulter les documents déposés par les étudiants de l'école, filtrés par classe/type.

**Données consultées/modifiables** : strictement limitées à son école — chaque requête vérifie l'appartenance de la ressource à `schoolAdmin.schoolId`, y compris pour les 2 routes sans `@Roles` déclaratif (`PUT /schools/:id`, `POST /schools/:id/logo`), où le contrôle est fait manuellement dans le service.

**Restrictions** :
- Aucun accès aux modules `ministry`, `audit`, `users`, `settings`, `competitions`, `financial-partners`, ni aux données d'une autre école (vérifié par tests `offer.service.spec.ts`, `application.service.spec.ts` — refus explicite d'un admin d'une autre école).
- Ne gère qu'une seule école (pas de multi-établissement pour un même compte `SCHOOL_ADMIN`).

**Notifications** :
- Envoie des notifications de changement de statut/rappel de deadline aux candidats (`status-update`, `reminder`, `@Roles('ADMIN_GET','SCHOOL_ADMIN')`).
- Reçoit une notification automatique lorsqu'un créneau de cours de son école change (le professeur concerné est aussi notifié) — `school.service.ts:1478-1488`.
- **Point de vigilance sécurité documenté** : les endpoints `status-update`/`reminder` ne vérifieraient pas systématiquement que la candidature/offre concernée appartient bien à l'école de l'admin appelant (`docs/security-audit-backlog.md`, priorité élevée, cité dans `roles-auth-inventory.md` §5) — à confirmer/corriger.

**Résultats possibles** : décision d'admission déclenchant une inscription automatique transactionnelle ; génération de planning automatique idempotente ; annonce diffusée avec notification par destinataire.

**Cas d'erreur connus** : `createAnnouncement` exige au moins un destinataire selon le type de ciblage ; `enrollStudent` refuse si la période d'inscription est fermée, le programme introuvable/archivé, ou le niveau demandé hors durée du programme ; conflit de créneau (salle ou professeur) refusé avec message métier lisible.

**Traces générées** : `AuditLog` automatique + `ApplicationTimeline` enrichie (avant/après statut) à chaque décision sur une candidature.

---

## 5. TEACHER

**Objectif du rôle** : gérer le contenu et le suivi pédagogique de ses cours (potentiellement dans plusieurs écoles), noter les étudiants, déclarer ses disponibilités.

**Point d'entrée** : `/dashboard/teacher`.

**Préconditions** : compte `TEACHER`, affecté à au moins une école via `TeacherSchool` (un même professeur peut enseigner dans plusieurs établissements).

**Écrans accessibles** : une seule route physique multiplexée par le paramètre `?view=` (dashboard par défaut, `courses`, `course-detail`, `students`, `evaluations`, `grades`, `schedule`, `availability`, `assignments`, `resources`, `messages`, `announcements`, `settings` — `frontend-inventory.md`, portail teacher).

**Actions possibles** (protection : 4 sous-contrôleurs `@Roles('TEACHER')`) :
- Consulter le tableau de bord (cours, étudiants, devoirs à corriger, évaluations à venir, messages non lus) — `GET /teacher/dashboard/summary`.
- Gérer le contenu pédagogique d'un cours : chapitres, ressources (lien ou fichier obligatoire), paramètres, annonces — `teaching.controller.ts:112-290`.
- Créer des évaluations et y saisir des notes, uniquement pour des étudiants réellement inscrits au cours concerné (`teaching.service.ts:574`).
- Créer des devoirs (en brouillon par défaut), consulter et corriger les soumissions.
- Déclarer des indisponibilités (récurrentes par jour de semaine ou ponctuelles par date, jamais les deux) et des temps de trajet minimum entre deux de ses écoles — `teacher-availability.controller.ts`.
- Éditer son profil, mot de passe, thème, avatar.

**Données consultées/modifiables** : uniquement les cours, évaluations, devoirs et soumissions dont il est propriétaire — vérification systématique avant toute action (`teaching.service.ts:126-191`).

**Restrictions** :
- Aucun accès aux autres écoles que celles où il est affecté, ni aux modules Ministère/Audit/Utilisateurs/Administration.
- Ne peut pas noter un étudiant non inscrit au cours de l'évaluation (`Forbidden`, testé).
- MFA non accessible à ce rôle (réservé à `ADMIN_GET`/`SCHOOL_ADMIN`/`MINISTRY`).

**Notifications** : les annonces de cours notifient uniquement les étudiants réellement inscrits (`AnnouncementService.createAndNotify`).

**Résultats possibles** : contenu publié visible par les étudiants inscrits ; note enregistrée et consultable par l'étudiant concerné ; conflit de créneau détecté et refusé (salle occupée, professeur déjà engagé ailleurs, ou hors buffer de trajet inter-écoles).

**Cas d'erreur connus** :
- Refus d'ajout de ressource pédagogique si ni lien ni fichier n'est fourni.
- Refus de suppression d'une ressource n'appartenant pas au chapitre indiqué.
- Refus d'upload d'avatar sans fichier joint.
- Rôle exact des indicateurs `Course.welcomeMessage`/`allowGroupMessages`/`notifyOnPublish` non vérifié en détail dans le code — **point à confirmer avec l'équipe de développement**.

**Traces générées** : `AuditLog` automatique sur toute requête API.

---

## 6. MINISTRY

**Objectif du rôle** : exercer la tutelle du Ministère sur le système d'enseignement supérieur — supervision agrégée, contrôle de conformité des établissements, production de rapports officiels — **sans jamais accéder à une donnée nominative individuelle**.

**Point d'entrée** : `/dashboard/ministry`.

**Préconditions** : compte `MINISTRY` authentifié.

**Écrans accessibles** (3 pages seulement, cohérent avec le menu `MinistrySidebar`) :
| Route | Fichier |
|---|---|
| `/dashboard/ministry` | `frontend/app/dashboard/ministry/page.tsx` → `ministry-dashboard.tsx` |
| `/dashboard/ministry/reports` | `frontend/app/dashboard/ministry/reports/page.tsx` |
| `/dashboard/ministry/compliance` | `frontend/app/dashboard/ministry/compliance/page.tsx` |

**Actions possibles** (protection : `@Roles('MINISTRY','ADMIN_GET')` de classe sur `ministry.controller.ts`) :
- Consulter le tableau de bord agrégé national, filtrable par période (`GET /ministry/dashboard`).
- Consulter les statistiques par statut/région/filière de candidature, par établissement, la répartition géographique (`GET /ministry/stats/*`).
- Consulter l'état de conformité des établissements (dernier contrôle par école par défaut, historique sur demande) et enregistrer un nouveau contrôle — `GET`/`PUT /ministry/compliance[/:schoolId]`.
- Générer et télécharger des rapports typés (NATIONAL/REGIONAL/SECTORIAL), sur des périodes DAILY à ANNUAL, exportés en PDF/Excel/CSV/JSON — `POST /ministry/reports/generate`, `GET /ministry/reports/:id/export`.

**Données consultées** : exclusivement des agrégats institutionnels (par établissement, région, filière) — documenté explicitement côté DTO et **vérifié par test dédié** (`ministry.service.spec.ts` : aucun champ nominatif sélectionné en base, sortie scannée pour absence de `studentId`/`firstName`).

**Données modifiables** : uniquement les contrôles de conformité (`ComplianceCheck`), toujours créés en historisation (jamais d'écrasement).

**Restrictions** — module explicitement testé pour son exclusion des données individuelles :
- Aucun accès aux modules `students`, `payments` (détail nominatif), `messages`, `audit`, `notifications` (envoi).
- Exclu explicitement du détail nominatif d'une candidature (`GET /applications/:id`) et d'un paiement (`GET /payments/:id`) — vérifié par test (`application.service.spec.ts`, `payment.service.spec.ts`).
- Exclu explicitement de la messagerie interne (`@Roles` de classe sur `message.controller.ts`).

**Notifications** : aucune reçue ni envoyée par ce rôle dans le périmètre observé.

**Résultats possibles** : rapport généré (snapshot horodaté), export produit dans le format demandé (PDF réel vérifié par en-tête binaire `%PDF-`, pas de texte déguisé — `report-exporter.spec.ts`).

**Cas d'erreur connus** : aucun majeur identifié — module bien couvert par des tests de politique d'accès explicites (`ministry-access-policy.spec.ts`).

**Traces générées** : `AuditLog` automatique (action `VIEW`/`EXPORT`) sur chaque consultation/génération.

---

## 7. ADMIN_GET

**Objectif du rôle** : administrer la plateforme GET dans son ensemble — établissements, utilisateurs, paramètres système, contenu vitrine, référentiels transverses, supervision et audit global.

**Point d'entrée** : `/dashboard/admin`.

**Préconditions** : compte `ADMIN_GET` authentifié — rôle plateforme le plus privilégié, aucun rôle « super admin » distinct n'existe (`roles-auth-inventory.md` §1).

**Écrans accessibles** : 8 fichiers `page.tsx` physiques (`/dashboard/admin`, `/academic-years`, `/enrollments`, `/reports`, `/schools`, `/settings`, `/transactions`, `/users`) + 11 sous-écrans accessibles via `?section=` depuis la page racine (messages, activity, announcements, competitions, partners, landing-content, landing-news, teacher-conflicts, students, programs, notifications — détail complet dans `frontend-inventory.md`, portail admin).

**Actions possibles** (`@Roles('ADMIN_GET')` — le seul rôle avec accès ✅ à la quasi-totalité des modules) :
- CRUD complet des établissements (création, édition, désactivation) — `schools.controller.ts`.
- Gestion des comptes utilisateurs tous rôles confondus : liste paginée/filtrable, activation/désactivation (`GET /users`, `PATCH /users/:id/status`) — avec interdiction explicite de désactiver son propre compte (`user.service.ts:74-76`).
- Vue transverse plateforme : tous les étudiants inscrits (`GET /schools/students`), tous les programmes (`GET /schools/programs`), toutes les candidatures (`GET /applications`), toutes les transactions (`GET /payments/admin`), statistiques de paiement/candidature (`GET /payments/stats`, `GET /applications/stats`).
- Diffusion d'annonces à l'ensemble des écoles actives (`POST /schools/announcements/broadcast`).
- CRUD des concours (`competitions`), des partenaires financiers (`financial-partners`, avec upload de logo), des actualités et de la configuration de la landing page (hero/stats/steps/actor-cards), des années académiques plateforme (`academic-years`).
- Détection de conflits d'emploi du temps entre professeurs multi-écoles (`GET /teachers`, `GET /teachers/:id/conflicts`).
- Édition des paramètres globaux de la plateforme (`GET`/`PUT /settings`).
- Consultation du journal d'audit complet, filtrable (`GET /audit`, `GET /audit/resource/:resource/:id`, `GET /audit/user/:userId`, `GET /audit/stats`).
- Envoi de notifications génériques (multi-canal, email de bienvenue, confirmation de paiement, statistiques plateforme).
- Activation/désactivation de la MFA (TOTP) pour son propre compte.

**Données consultées/modifiables** : accès complet, non scopé, à l'ensemble des modules métier de la plateforme.

**Restrictions** :
- Ne peut pas désactiver son propre compte utilisateur (seule restriction identifiée sur ce rôle).
- `GET /audit/me` (« mes propres logs d'audit ») hérite du `@Roles('ADMIN_GET')` de classe — accessible uniquement à `ADMIN_GET` malgré son intitulé suggérant un usage transverse (incohérence documentée, `roles-auth-inventory.md` §2 et §4, point 4).

**Notifications** : peut déclencher l'envoi de notifications à tout utilisateur (`send`, `welcome`, `payment-confirmation`) ; reçoit les notifications qui lui sont propres via `GET /notifications/me` comme tout utilisateur connecté.

**Résultats possibles** : toute opération CRUD plateforme ; export de rapports ; changement d'état d'un compte utilisateur (avec effet immédiat sur ses accès, sous réserve du mécanisme `sessionVersion`).

**Cas d'erreur connus** :
- Champ de recherche global du tableau de bord admin (« Rechercher un étudiant, une école, un cours... ») visuellement présent mais **non câblé** (aucun `onChange`, aucun appel API) — `frontend-inventory.md` ligne 56, 170.
- Champ de recherche également masqué en dessous de la résolution `xl` (`hidden xl:block`), absent sur mobile/tablette — à confirmer si assumé côté produit.
- `PUT /schools/:id` et `POST /schools/:id/logo` sans `@Roles` déclaratif (contrôle fait manuellement en service) — fonctionnellement correct mais rend un audit basé sur les seuls décorateurs incomplet pour ces 2 routes.

**Traces générées** : `AuditLog` automatique sur toute action ; ce rôle est aussi le seul habilité à **consulter** l'ensemble du journal d'audit de la plateforme (`GET /audit`, `GET /audit/user/:userId`, `GET /audit/stats`).

---

## Synthèse

7 parcours documentés (visiteur, STUDENT candidat, STUDENT inscrit, SCHOOL_ADMIN, TEACHER, MINISTRY, ADMIN_GET) couvrant les 5 rôles applicatifs réels du système et les 2 états fonctionnels du rôle STUDENT. Points transverses à retenir pour la suite de l'Expression des Besoins :
1. Aucune protection de route côté serveur/framework (middleware Next.js absent) — le cloisonnement observé par rôle est un confort UX, la sécurité réelle repose entièrement sur le `RolesGuard` backend.
2. Le rôle MINISTRY est le plus strictement cadré du système (exclusion vérifiée par tests de toutes les données nominatives).
3. Plusieurs écrans du parcours « étudiant inscrit » (accueil, « Mon parcours », « Bibliothèque », « Stages & emplois ») ne reflètent pas encore de données réelles — à traiter comme une dette fonctionnelle plutôt qu'un choix produit assumé, sauf confirmation contraire du métier.
4. Aucune voie d'auto-inscription n'existe pour les rôles SCHOOL_ADMIN/TEACHER/MINISTRY/ADMIN_GET — leur provisioning exact (hors seed de démonstration) reste **à confirmer avec l'équipe de développement**.
