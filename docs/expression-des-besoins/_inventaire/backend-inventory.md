# Inventaire fonctionnel backend GET (NestJS)

> Généré par analyse statique du code source, le 2026-08-05. Toute affirmation est sourcée par fichier (et ligne quand pertinent). Les zones non vérifiables depuis le code sont marquées « à confirmer ».

## Contexte global

- **Préfixe API** : `api` (`app.setGlobalPrefix('api')`) — `backend/src/main.ts:78`.
- **CORS** : origines = `FRONTEND_URL` (liste séparée par virgules), méthodes GET/POST/PUT/DELETE/PATCH, `credentials: true` — `main.ts:41-47`.
- **Sécurité HTTP** : `x-powered-by` désactivé, headers `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (prod only) — `main.ts:24-37`.
- **Pipes globaux** : `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — `main.ts:60-66`.
- **Filtres/Intercepteurs globaux** : `AllExceptionsFilter` (enveloppe uniforme `{success:false,message,timestamp,path,statusCode}`, restitue les messages détaillés de class-validator) — `common/filters/all-exceptions.filter.ts` ; `ResponseInterceptor` (enveloppe `{success,data,message,timestamp,statusCode}` sauf `StreamableFile` ou réponse déjà enveloppée) — `common/interceptors/response.interceptor.ts` ; `LoggingInterceptor` (log méthode/URL/durée/IP) ; `AuditInterceptor` (journalise automatiquement chaque requête, voir module Audit).
- **Garde globale JWT** : `JwtAuthGuard` posé en `APP_GUARD` — **toute route est protégée par défaut**, doit être explicitement `@Public()` pour être accessible sans JWT (changement de posture de sécurité documenté en commentaire) — `app.module.ts:60-70`. `ThrottlerGuard` global également (`limit:100/60s` par défaut, throttles spécifiques sur `auth`).
- **Fichiers protégés** : servis via un routeur authentifié `/uploads` (redirection vers URL S3 présignée courte durée) plutôt que directement — `main.ts:52-56`, `common/middleware/protected-uploads.middleware.ts`.
- **Stockage** : S3-compatible (MinIO/R2/AWS), deux buckets (privé/public) — `common/services/storage.service.ts`. URLs présignées valables 60s (`PRESIGNED_URL_TTL_SECONDS`).
- **Chiffrement** : AES-256-GCM pour données sensibles (téléphone, CIN étudiant, secret MFA) via `EncryptionService`, clé hex 32 octets obligatoire en env — `common/services/encryption.service.ts`.
- **Swagger/OpenAPI** : oui, `@nestjs/swagger`. `DocumentBuilder` avec titre « ERP GET API », tags (auth, students, schools, offers, applications, payments, ministry, notifications, audit), auth Bearer JWT, exposé sur `/api/docs` si `NODE_ENV !== production` ou `ENABLE_SWAGGER=true` — `main.ts:82-121`. La plupart des contrôleurs utilisent `@ApiTags/@ApiOperation/@ApiResponse/@ApiBody`, mais tous les modules n'en sont pas dotés au même niveau de détail (à confirmer module par module — non vérifié exhaustivement).
- **Rôles (seed)** : `STUDENT` (défaut), `ADMIN_GET`, `SCHOOL_ADMIN`, `MINISTRY`, `TEACHER` — `prisma/seed.ts:16-44`. Comptes de démo créés avec mots de passe en clair dans le seed (admin@get.mg, schooladmin@get.mg, ministere@mesupres.gov.mg, prof.rakoto@espa.mg, test@gmail.com, etc.) — données de démonstration uniquement, seed refusé en production sauf `ALLOW_DEMO_SEED=true` (`seed.ts:8-13`).
- **Modèle d'autorisation** : `@Public()` (bypass JWT), `@Roles(...)` + `RolesGuard` (comparaison stricte `user.role === role`, un seul rôle par utilisateur) — `common/decorators/public.decorator.ts`, `common/decorators/roles.decorator.ts`, `auth/guards/roles.guard.ts`.
- **Session JWT** : payload `{sub, email, role, sessionVersion}`, access token courte durée (15 min par défaut) + refresh token (7j) posés en cookies httpOnly ; révocation de session par incrément de `sessionVersion` en base à la déconnexion (un JWT valide mais avec `sessionVersion` obsolète est rejeté) — `auth/strategies/jwt.strategy.ts`, `auth/auth.service.ts`.

---

## Module: auth

**Finalité métier apparente** : inscription/connexion des étudiants et comptes staff, gestion de session (cookies JWT + refresh), MFA (TOTP) pour les comptes à privilèges, réinitialisation de mot de passe.

**Endpoints**

| Méthode | Route | Guards/Rôles | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|---|
| POST | /api/auth/register | `@Public()`, throttle 5/min | RegisterDto | Crée un compte STUDENT + profil Student, pose cookies de session | auth.controller.ts:74-90 |
| POST | /api/auth/login | `@Public()`, throttle 5/min | LoginDto | Vérifie identifiants, verrouillage après 5 échecs (15 min), déclenche défi MFA si activé, sinon pose cookies | auth.controller.ts:93-112 |
| POST | /api/auth/mfa/login-verify | `@Public()`, throttle 5/min | MfaLoginVerifyDto | Valide le code TOTP du défi de connexion, pose cookies | auth.controller.ts:115-131 |
| GET | /api/auth/me | JwtAuthGuard | — | Retourne l'utilisateur courant (id, email, role, gender, nom, mfaEnabled) | auth.controller.ts:133-148 |
| POST | /api/auth/logout | `@Public()` (volontaire) | — | Décode le cookie en best-effort, incrémente `sessionVersion` (révocation), efface les cookies | auth.controller.ts:150-180 |
| POST | /api/auth/forgot-password | `@Public()`, throttle 3/min | `{email}` | Envoie (si compte existant) un email avec lien de reset (JWT 1h), réponse générique anti-énumération | auth.controller.ts:183-192 |
| POST | /api/auth/reset-password | `@Public()`, throttle 5/min | ResetPasswordDto | Vérifie le token `type:'reset'`, met à jour le mot de passe (bcrypt) | auth.controller.ts:195-211 |
| POST | /api/auth/mfa/enable | JwtAuthGuard+RolesGuard, `ADMIN_GET,SCHOOL_ADMIN,MINISTRY` | — | Génère secret TOTP + QR code (secret chiffré en base) | auth.controller.ts:214-222 |
| POST | /api/auth/mfa/verify | idem, throttle 5/min | `{code}` | Vérifie le code TOTP et active MFA | auth.controller.ts:224-235 |
| POST | /api/auth/mfa/disable | idem, throttle 5/min | `{code}` | Vérifie le code puis désactive MFA (supprime le secret) | auth.controller.ts:237-248 |

**Règles de gestion identifiées**
- Verrouillage de compte après 5 tentatives échouées, 15 minutes — `auth.service.ts:350-371`.
- Un jeton à usage unique (`type: reset`/`mfa_challenge`) ne peut jamais être utilisé comme access token (vérifié explicitement) — `jwt.strategy.ts:26-31`.
- Révocation de session serveur via `sessionVersion` (incrémenté au logout) — `jwt.strategy.ts:63-68`, `auth.service.ts:198-203`.
- Cookies `sameSite:'lax'` par défaut, `'none'` opt-in via `CROSS_SITE_COOKIES=true` pour déploiements multi-domaines — `auth.controller.ts:48-56`.
- MFA : secret TOTP chiffré AES-256-GCM en base ; refus explicite si déchiffrement impossible plutôt que comparaison hasardeuse — `mfa.service.ts:101-111`.
- `forgotPassword` renvoie toujours le même message (compte existant ou non) pour ne pas révéler l'existence d'un email — `auth.service.ts:211-217`.

**Modèles de données impliqués** : User, Role, Student.

**Notifications déclenchées** : email de réinitialisation de mot de passe via `NotificationService.send` (type EMAIL, priorité HIGH) — `auth.service.ts:237-245` (envoi simulé, voir module Notification).

**Tests présents** : `auth/guards/roles.guard.spec.ts` — vérifie que `@Public()` contourne le contrôle de rôle, et qu'une requête sans `user` est refusée si un rôle est requis.

**Points à confirmer / zones floues**
- Endpoint `refresh` (renouvellement d'access token) non trouvé dans le contrôleur — à confirmer si le refresh token cookie est utilisé ailleurs (pas de route `/auth/refresh` identifiée).
- Pas de test unitaire pour `AuthService` lui-même (seulement le guard de rôles).

---

## Module: student

**Finalité métier apparente** : espace étudiant — profil, documents, candidatures (consultation via applications module), cours suivis, devoirs, notes, emploi du temps, préférences de compte.

**Endpoints** (tous sous `/api/students`, `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('STUDENT')` au niveau contrôleur)

| Méthode | Route | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|
| GET | me | — | Profil complet (décrypté phone/cin, complétude calculée) | student.controller.ts:79-109 |
| PUT | me | UpdateStudentProfileDto | Met à jour profil, chiffre phone/cin, recalcule complétude | student.controller.ts:111-138 |
| POST | me/avatar | multipart (jpeg/png/webp ≤5Mo) | Upload avatar vers S3, met à jour avatarUrl | student.controller.ts:142-194 |
| GET | me/courses | — | Cours où l'étudiant est inscrit (CourseEnrollment) | student.controller.ts:198-208 |
| GET | me/courses/:courseId/assignments | — | Devoirs publiés du cours + soumission de l'étudiant (vérifie inscription réelle) | student.controller.ts:210-230 |
| POST | me/assignments/:assignmentId/submit | multipart (pdf/jpg/png/doc/docx ≤5Mo) | Dépose/remplace une soumission ; refusée si déjà notée | student.controller.ts:232-281 |
| GET | me/documents | — | Liste des documents non supprimés | student.controller.ts:285-304 |
| POST | me/documents | multipart + UploadDocumentDto | Upload document (CV, LETTER, ID, DIPLOMA, PHOTO, OTHER) | student.controller.ts:306-378 |
| DELETE | me/documents/:id | — | Soft delete d'un document | student.controller.ts:380-403 |
| POST | me/orientation | OrientationQuestionnaireDto | Enregistre intérêts/compétences/aspirations, calcule des suggestions d'offres | student.controller.ts:407-434 |
| GET | me/orientation | — | Relit les dernières suggestions (échoue si questionnaire jamais rempli) | student.controller.ts:436-460 |
| GET | me/stats | — | Compteurs candidatures par statut, documents, complétude profil | student.controller.ts:464-483 |
| GET | me/grades | — | Notes (évaluations + devoirs) par cours inscrit | student.controller.ts:487-502 |
| GET | me/schedule | — | Créneaux de cours (CourseSlot) des cours inscrits | student.controller.ts:506-521 |
| PATCH | me/password | ChangePasswordDto (regex forte) | Change le mot de passe après vérification de l'ancien | student.controller.ts:525-545 |
| PATCH | me/theme | UpdateThemeDto (`light|dark|system`) | Met à jour préférence de thème | student.controller.ts:547-559 |

**Règles de gestion identifiées**
- Une soumission déjà notée (`grade` non null) ne peut plus être remplacée — `student.service.ts:92-99`.
- Complétude de profil = ≥70% des 8 champs clés renseignés — `student.service.ts:258-273`.
- Chiffrement obligatoire du téléphone/CIN avant stockage ; échec de chiffrement = refus (`BadRequestException`) plutôt que stockage en clair — `student.service.ts:228-248`.
- Suggestions d'orientation : score simple par mots-clés (intérêts/diplôme préféré/domaine/international), triées, top 5 — `student.service.ts:406-463`.
- Mot de passe : min 8 caractères, majuscule, minuscule, chiffre, caractère spécial (regex) — `student.controller.ts:47-58`.

**Modèles de données impliqués** : Student, User, Document, CourseEnrollment, Course, Assignment, AssignmentSubmission, Evaluation, Grade, CourseSlot, Offer, School.

**Notifications déclenchées** : aucune émise directement par ce module (upload/soumission ne notifient pas explicitement dans le code lu).

**Tests présents** : `student.service.spec.ts` — refuse la liste des devoirs sans inscription réelle, refuse de remplacer une soumission déjà notée, dépose une soumission valide, isole notes/emploi du temps par inscription réelle, valide changement de mot de passe (échec si mot de passe actuel incorrect), met à jour la préférence de thème.

**Points à confirmer / zones floues**
- `à confirmer` : format exact de retour de `getProfile` côté schoolEnrollments (multi-écoles) côté frontend n'a pas été vérifié.

---

## Module: school

**Finalité métier apparente** : cœur de gestion d'un établissement — profil école, filières/programmes, années académiques, inscriptions étudiants, professeurs, cours, emploi du temps (moteur de planification), annonces, rapports, paiements reçus, salles/créneaux/classes.

C'est le plus gros module (`school.controller.ts` 1409 lignes, `school.service.ts` 1793 lignes, plus `scheduling.service.ts` et `schedule-generation.service.ts`).

**Endpoints principaux** (`/api/schools`) — total ~65 routes recensées

| Méthode | Route | Guards/Rôles | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|---|
| GET | / | `@Public()` | query | Liste publique des écoles (filtres) | school.controller.ts:99-100 |
| GET | students | ADMIN_GET | query | Vue admin plateforme de tous les étudiants inscrits | :130-132 |
| GET | programs | ADMIN_GET | query | Vue admin de tous les programmes | :154-156 |
| POST | / | ADMIN_GET | CreateSchoolDto | Crée un établissement | :171-173 |
| PUT | :id | JwtAuthGuard (sans RolesGuard explicite — à confirmer) | UpdateSchoolDto | Met à jour un établissement | :195-196 |
| DELETE | :id | ADMIN_GET | — | Suppression (soft delete probable) | :229-231 |
| POST | :id/logo | JwtAuthGuard | multipart | Upload logo école | :250-251 |
| GET | me | SCHOOL_ADMIN | — | Profil de l'école de l'admin connecté | :320-322 |
| GET | me/subjects / POST / PATCH :id | SCHOOL_ADMIN | — / nom | CRUD matières de l'école | :361-372 |
| GET | me/teachers/inactive, /search | SCHOOL_ADMIN | — | Recherche/liste profs désactivés | :363-365 |
| GET/POST/PATCH | me/programs[/:id] | SCHOOL_ADMIN | SchoolProgramDto | CRUD filières | :372-401 |
| GET/POST/PATCH | me/academic-years[/:id] | SCHOOL_ADMIN | SchoolAcademicYearDto | CRUD années académiques (école) | :402-431 |
| GET | me/documents | SCHOOL_ADMIN | — | Documents des étudiants de l'école | :432-465 |
| GET | me/students[/:studentId] | SCHOOL_ADMIN | — | Liste/détail étudiants inscrits | :466-530 |
| POST | me/students/enroll[/bulk] | SCHOOL_ADMIN | EnrollStudentDto | Inscrit un étudiant (ou en masse) à un programme/année | :531-567 |
| PATCH | me/students/:studentId | SCHOOL_ADMIN | — | Met à jour une inscription (statut, programme, niveau) | :556 |
| POST/GET | me/announcements | SCHOOL_ADMIN | CreateAnnouncementDto | Créer/lister annonces école | :568-618 |
| POST | me/announcements/:id/photo | SCHOOL_ADMIN | multipart | Photo d'annonce | :619-620 |
| GET | announcements/mine | STUDENT, TEACHER | — | Annonces reçues par l'utilisateur | :668-670 |
| POST/GET | announcements/broadcast | ADMIN_GET | `{title,body}` | Diffusion à toutes les écoles actives | :688-709 |
| GET | me/reports/pipeline, outcomes, trend, by-class, by-offer, export | SCHOOL_ADMIN | — | Rapports école (pipeline candidatures, taux, tendance, export CSV) | :720-811 |
| GET/POST/PATCH | me/teachers[/:teacherSchoolId] | SCHOOL_ADMIN | AssignTeacherDto | Affecter/gérer profs de l'école | :812-887 |
| GET/POST/PUT | me/courses[/:id] | SCHOOL_ADMIN | CreateSchoolCourseDto | CRUD cours | :888-946 |
| GET | me/schedule | SCHOOL_ADMIN | — | Emploi du temps de l'école | :947-961 |
| POST | me/schedule/generate | SCHOOL_ADMIN | GenerateScheduleDto | Génération automatique du planning | :962-982 |
| POST/PATCH/DELETE | me/courses/:courseId/slots[/:slotId] | SCHOOL_ADMIN | CourseSlotDto | CRUD créneaux de cours (anti-conflit) | :983-1053 |
| GET | me/payments | SCHOOL_ADMIN | — | Paiements reçus par l'école (paginé, filtrable) | :1054-1088 |
| GET/POST/PATCH | me/requirements[/:id] | SCHOOL_ADMIN | — | Prérequis d'admission de l'école | :1089-1117 |
| GET | :id | `@Public()` | — | Détail public d'une école | :1118-1119 |
| GET | me/stats | SCHOOL_ADMIN | — | Statistiques école | :1136-1138 |
| GET/POST/PATCH/DELETE | me/rooms[/:id] | SCHOOL_ADMIN | RoomDto | CRUD salles | :1204-1234 |
| GET/POST/PATCH/DELETE | me/time-slots[/:id] | SCHOOL_ADMIN | SchoolTimeSlotDto | CRUD créneaux-types | :1245-1275 |
| GET/POST/PATCH/DELETE | me/classes[/:id] | SCHOOL_ADMIN | SchoolClassDto | CRUD classes | :1286-1316 |
| POST/PATCH/DELETE | me/classes/:classId/requirements[/:id] | SCHOOL_ADMIN | SubjectRequirementDto | CRUD besoins horaires par matière/classe | :1327-1362 |
| PUT/DELETE | .../requirements/:id/teacher | SCHOOL_ADMIN | `{teacherId}` | Affecter/retirer un prof à un besoin | :1377-1396 |

**Règles de gestion identifiées**
- Un étudiant peut être inscrit **activement dans plusieurs écoles simultanément** (double diplôme/cursus parallèle) — une ligne `StudentEnrollment` par (étudiant, école) — `school.service.ts:649-651`, confirmé par `@@unique([studentId, schoolId])` dans `schema.prisma:129`.
- `enrollStudent` : refuse si période d'inscription (`enrollmentOpensAt/ClosesAt`) fermée, si programme introuvable/archivé, ou si le niveau demandé dépasse la durée du programme — `school.service.ts:658-674`.
- `createAnnouncement` : au moins un destinataire requis selon `targetType` (CLASSES/STUDENTS/TEACHERS) — `school.service.ts:826-840`.
- `createCourseSlot`/`updateCourseSlot` : vérifie absence de conflit de salle (`ensureNoRoomConflict`) et disponibilité du professeur (`TeacherAvailabilityService.assertTeacherFreeOrThrow`) avant création, avec contrainte d'exclusion en base (`no_teacher_double_booking`) traduite en erreur métier lisible en cas de course condition — `school.service.ts:1404-1465`.
- Génération automatique de planning (Phase 3, `schedule-generation.service.ts`) : place les séances en respectant hoursPerWeek/durée typique des créneaux, priorise les besoins avec le plus d'heures, garantit qu'une même classe n'a jamais deux séances simultanées (vérification propre au générateur, non couverte par les contraintes DB), idempotent (ne recrée pas de séances déjà placées), remonte en « non résolu » les cas bloquants (pas de prof affecté, classe sans filière, aucun créneau/salle actif, aucun créneau compatible) — `schedule-generation.service.ts:126-215`.
- Modification/suppression de créneau notifie le professeur concerné (in-app) — `school.service.ts:1478-1488`.

**Modèles de données impliqués** : School, SchoolProgram, SchoolAcademicYear, StudentEnrollment, SchoolAdmin, Teacher, TeacherSchool, SchoolSubject, TeacherSchoolSubject, AcademicYear, Room, SchoolClass, SubjectRequirement, TeacherAssignment, SchoolTimeSlot, TeacherAvailability, TeacherTravelBuffer, Course, CourseSlot, CourseEnrollment, Announcement, Payment, SchoolRequirement.

**Notifications déclenchées** : notification in-app au professeur lors d'ajout/modification/suppression de créneau (`notifyTeacherScheduleChange`) ; notifications aux destinataires d'une annonce via `AnnouncementService.createAndNotify` (transaction unique, une notification par destinataire) — `announcement/announcement.service.ts`.

**Tests présents** : `school.service.spec.ts` (inscription filtrée par filière/niveau, retrait d'inscriptions obsolètes, blocage de désactivation de cours avec inscriptions actives, liste des profs désactivés réaffectables) ; `schedule-generation.service.spec.ts` (non résolu si pas de prof/filière/créneau, création + placement, idempotence, pas de double-réservation classe, filtres matière/prof/salle).

**Points à confirmer / zones floues**
- `PUT :id` (mise à jour école) n'a pas de `RolesGuard`/`@Roles` visible, seulement `JwtAuthGuard` — à confirmer si un contrôle de propriété est fait en service (probable via `userId` mais non vérifié dans cette passe).
- `scheduling.service.ts` (357 lignes) non détaillé en profondeur — à confirmer son rôle exact vs `schedule-generation.service.ts`.

---

## Module: offer

**Finalité métier apparente** : gestion des offres de formation publiées par les écoles (catalogue public + gestion côté école/admin).

**Endpoints** (`/api/offers`)

| Méthode | Route | Guards/Rôles | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|---|
| GET | / | `@Public()` | query (filtres) | Catalogue public des offres | offer.controller.ts:44-45 |
| GET | mine | SCHOOL_ADMIN | — | Offres de l'école de l'admin connecté | :85-87 |
| GET | :id | `@Public()` | — | Détail public d'une offre | :117-118 |
| POST | / | SCHOOL_ADMIN, ADMIN_GET | CreateOfferDto | Crée une offre (vérifie école/filière/prérequis) | :132-134 |
| PUT | :id | SCHOOL_ADMIN, ADMIN_GET | UpdateOfferDto | Met à jour une offre | :156-158 |
| DELETE | :id | SCHOOL_ADMIN, ADMIN_GET | — | Supprime une offre | :179-181 |
| PATCH | :id/status | SCHOOL_ADMIN, ADMIN_GET | `{isOpen}` | Ouvre/ferme une offre aux candidatures | :195-197 |
| GET | school/:schoolId | `@Public()` | query | Offres publiques d'une école | :219-220 |

**Règles de gestion identifiées**
- Création : refuse si école introuvable, si la filière (`programId`) ne correspond pas à l'école, si un des `requirementIds` fournis est invalide, refuse à un admin d'école qui n'est pas propriétaire — `offer.service.ts:15-31, 208`.
- Durée : 6 à 60 mois (`@Min(6) @Max(60)`) — `create-offer.dto.ts:32-36`.
- Tarif ≥ 0, devise par défaut MGA.
- Suppression = soft delete probable (`deletedAt`), et toggle isOpen réservé au propriétaire.

**Modèles de données impliqués** : Offer, School, SchoolProgram, SchoolRequirement, OfferRequirement.

**Notifications déclenchées** : aucune identifiée directement dans ce module.

**Tests présents** : `offer.service.spec.ts` — refuse création pour école introuvable, refuse pour admin d'une autre école, refuse si filière ne correspond pas à l'école, crée si tout valide, empêche un admin d'une autre école de retirer/toggler une offre, filtre par ville au niveau base (pas en mémoire après pagination — test de non-régression perf/exactitude).

**Points à confirmer / zones floues** : aucune notification de publication d'offre trouvée (peut être un manque fonctionnel vs souhait métier — à confirmer avec le métier).

---

## Module: application

**Finalité métier apparente** : gestion du cycle de vie complet d'une candidature étudiante à une offre (soumission, présélection, test, entretien, décision, inscription automatique, liste d'attente).

**Endpoints** (`/api/applications`, `@UseGuards(JwtAuthGuard)` au niveau contrôleur + gardes fins par route)

| Méthode | Route | Rôles | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|---|
| POST | / | STUDENT | SubmitApplicationDto (offerIds[]) | Candidature multiple ; classe en submitted/failed/alreadyApplied | application.controller.ts:53-55 |
| GET | me | STUDENT | query | Candidatures de l'étudiant connecté | :85-87 |
| GET | school/me | SCHOOL_ADMIN | query | Candidatures reçues par l'école | :119-121 |
| GET | :id/documents | STUDENT, SCHOOL_ADMIN, ADMIN_GET | — | Documents liés à une candidature | :156-158 |
| GET | stats | MINISTRY, ADMIN_GET | query | Statistiques agrégées | :189-191 |
| GET | / | ADMIN_GET | query | Toutes les candidatures (admin plateforme) | :214-216 |
| GET | :id | STUDENT, SCHOOL_ADMIN, ADMIN_GET | — | Détail d'une candidature (accès contrôlé, exclut MINISTRY — voir test) | :242-244 |
| PUT | :id/status | SCHOOL_ADMIN, ADMIN_GET | UpdateApplicationStatusDto | Change le statut (machine à états stricte) | :272-274 |
| POST | :id/schedule-test | SCHOOL_ADMIN, ADMIN_GET | ScheduleTestDto | Planifie un test/concours | :302-304 |
| POST | :id/schedule-interview | SCHOOL_ADMIN, ADMIN_GET | ScheduleInterviewDto | Planifie un entretien | :326-328 |
| POST | :id/score | SCHOOL_ADMIN, ADMIN_GET | `{score}` | Enregistre un score | :350-352 |

**Règles de gestion identifiées**
- **Machine à états stricte** `APPLICATION_STATUS_TRANSITIONS` (PENDING → UNDER_REVIEW/PRESELECTED/TEST_SCHEDULED/INTERVIEW_SCHEDULED/ACCEPTED/REJECTED/WAITLISTED/CANCELLED, etc.) ; REJECTED et CANCELLED sont **terminaux** — `update-application-status.dto.ts:34-98`, appliquée dans `updateStatus` — `application.service.ts:376-389`.
- Une offre à `applicationDeadline` dépassée n'accepte plus de nouvelle candidature même si `isOpen=true` — `application.service.ts:74-79`.
- Unicité candidature par (étudiant, offre) — `schema.prisma:775` (`@@unique([studentId, offerId])`), vérifiée en service — `application.service.ts:81-87`.
- Passage à ACCEPTED contrôlé par la **capacité de l'offre** (`offer.capacity`), comptée sur ACCEPTED+ENROLLED — `application.service.ts:395-413`.
- Passage à ACCEPTED/ENROLLED déclenche une **inscription automatique** (`StudentEnrollment` upsert + synchro des inscriptions cours) de façon atomique (transaction) — jamais de statut ACCEPTED/ENROLLED sans tentative d'inscription réelle, avec traçabilité explicite en `ApplicationTimeline` même en cas d'échec (offre sans programme, pas d'année académique courante) — `application.service.ts:415-527`.
- Libération de place (désistement/refus après acceptation) déclenche la **promotion automatique** du candidat le plus ancien en liste d'attente (WAITLISTED → ACCEPTED) — `application.service.ts:530-567`.
- Journalisation systématique dans `AuditService` (before/after status) à chaque changement de statut — `application.service.ts:587-599`.
- Le rôle MINISTRY n'a pas accès aux détails nominatifs de candidature (voir test contrôleur/service).

**Modèles de données impliqués** : Application, ApplicationTimeline, Student, Offer, School, StudentEnrollment, SchoolProgram, SchoolAcademicYear, AuditLog.

**Notifications déclenchées** : `NotificationService.sendApplicationStatusUpdate` à chaque changement de statut (candidat concerné + candidat promu depuis liste d'attente), non bloquant si échec — `application.service.ts:30-49, 572-585`.

**Tests présents** : `application.service.spec.ts` — refuse candidature pour étudiant introuvable, classe correctement submitted/failed/alreadyApplied, refuse à un admin d'une autre école de statuer, met à jour sans inscrire si rejeté, inscrit automatiquement si accepté, ne reste jamais silencieux si offre sans programme, refuse REJECTED→ACCEPTED direct, refuse si capacité atteinte, permet double cursus (inscription dans une 2e école sans toucher la 1re), refuse au Ministry l'accès à un dossier nominatif. `application.controller.spec.ts` — exclut le rôle Ministry des détails/documents.

**Points à confirmer / zones floues** : niveau d'inscription toujours forcé à « Année 1 » lors de l'inscription automatique post-candidature (`programLevel: 1` en dur) — à confirmer si c'est la règle métier voulue pour tous les cas (transferts, admissions parallèles).

---

## Module: payment

**Finalité métier apparente** : paiement des frais de scolarité liés à une candidature acceptée (initiation, webhook fournisseur, reçu, historique), déclenchement de l'inscription réelle à la confirmation.

**Endpoints** (`/api/payments`)

| Méthode | Route | Rôles | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|---|
| POST | initiate | STUDENT | InitiatePaymentDto | Initie un paiement pour une candidature ACCEPTED | payment.controller.ts:44-46 |
| GET | stats | ADMIN_GET | query | Statistiques de paiement | :61-63 |
| GET | admin | ADMIN_GET | query | Liste admin de tous les paiements | :76-78 |
| GET | :id | STUDENT, ADMIN_GET | — | Détail d'un paiement | :103-105 |
| GET | / | STUDENT | query | Historique des paiements de l'étudiant | :123-125 |
| POST | webhook | `@Public()` | PaymentWebhookDto | Callback fournisseur, signature HMAC obligatoire | :145-146 |
| GET | :id/receipt | STUDENT, ADMIN_GET | — | Génère/retourne le reçu | :163-165 |
| POST | bank-account | STUDENT | `{bankId}` | Ouvre un compte bancaire partenaire (à confirmer portée réelle) | :182-184 |

**Règles de gestion identifiées**
- Paiement possible **uniquement** si la candidature appartient à l'étudiant ET est au statut ACCEPTED — `payment.service.ts:37-44`.
- **Le montant ne vient jamais du client** : toujours dérivé de `offer.tuitionFees`, refusé si ≤0 — `payment.service.ts:46-50`.
- Refus si un paiement PENDING/PROCESSING/COMPLETED existe déjà pour la candidature (empêche double paiement) — `payment.service.ts:52-65`.
- Commission calculée à 5% du montant (`amount * 0.05`) — `payment.service.ts:79`.
- Paiement expire 15 minutes après initiation (`expiresAt`) — `payment.service.ts:78`.
- Webhook : signature HMAC obligatoire (calculée sur les **octets bruts** de la requête, pas le JSON re-sérialisé, cf. `rawBody:true` dans `main.ts`), refusé si secret/signature absents — `payment.service.ts:443-455`. Idempotent si déjà COMPLETED. Montant du webhook doit correspondre au paiement enregistré, sinon rejeté (`BadRequestException`).
- Confirmation de paiement (COMPLETED) déclenche, **dans la même transaction** : passage de la candidature à ENROLLED, upsert `StudentEnrollment`, synchro des inscriptions de cours, création de `Transaction`, avec traçabilité explicite en `ApplicationTimeline` même si l'inscription échoue (offre sans programme) — `payment.service.ts:133-247`, symétrique à la règle vue dans le module `application`.

**Modèles de données impliqués** : Payment, Transaction, Refund, Application, Student, School, SchoolProgram, SchoolAcademicYear, StudentEnrollment.

**Notifications déclenchées** : aucune trouvée explicitement dans `payment.service.ts` (à confirmer si le module `notification` est appelé ailleurs, ex. depuis un job).

**Tests présents** : `payment.service.spec.ts` — refuse paiement pour étudiant introuvable, refuse pour candidature d'un autre étudiant, refuse si candidature pas encore acceptée, refuse un second paiement en cours/complété, calcule le montant depuis l'offre (jamais le client), refuse un webhook sans signature / signature invalide / paiement introuvable, confirme le paiement et inscrit automatiquement, ne reste jamais silencieux si inscription impossible, refuse au rôle Ministry le détail nominatif d'un paiement.

**Points à confirmer / zones floues** : `openBankAccount` (`POST bank-account`) très peu détaillé dans le grep effectué — portée fonctionnelle exacte à confirmer. Fournisseur de paiement réel = `MockPaymentProvider` (`providers/mock-payment.provider.ts`) — **paiements réels non branchés en l'état** (à confirmer : Orange Money/Mvola/carte listés en DTO mais implémentation mock uniquement identifiée).

---

## Module: ministry

**Finalité métier apparente** : tableau de bord de supervision pour le Ministère (statistiques agrégées, conformité des établissements, génération/export de rapports), **strictement anonymisé** (aucune donnée nominative étudiant).

**Endpoints** (`/api/ministry`, `@Roles('MINISTRY','ADMIN_GET')` au niveau contrôleur sauf mention)

| Méthode | Route | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|
| GET | dashboard | Vue d'ensemble agrégée (filtrable par période) | ministry.controller.ts:52 |
| GET | stats/applications | Stats candidatures (statut, région, filière) | :72 |
| GET | stats/schools | Stats par établissement | :97 |
| GET | stats/geographic | Répartition géographique | :113 |
| GET | compliance | Liste des contrôles de conformité (dernier par école ou historique) | :126 |
| PUT | compliance/:schoolId | Enregistre un nouveau contrôle de conformité | :145 |
| GET | reports | Liste des rapports générés | :167 |
| POST | reports/generate | Génère un rapport agrégé (snapshot) | :179 |
| GET | reports/:id | Détail d'un rapport | :200 |
| GET | reports/:id/export | Export PDF/Excel/CSV/JSON | :212 |
| GET | public/stats | `@Public()` — statistiques publiques | :230-231 |

**Règles de gestion identifiées**
- `getCompliance` : par défaut ne retourne que le **dernier contrôle par école** (`latestOnly`, défaut true) ; sinon historique paginé — `ministry.service.ts:301-367`.
- `updateCompliance` crée un nouvel enregistrement `ComplianceCheck` (historisation, pas d'écrasement) — `ministry.service.ts:369-407`.
- Toutes les statistiques sont des **agrégats institutionnels** (par établissement/région/filière), jamais de données nominatives — documenté explicitement dans les DTO Swagger (`ministry-stats.dto.ts:3-7`) et vérifié par test dédié.
- Formats d'export : PDF, EXCEL, CSV, JSON (`report-request.dto.ts:28-33`), rapports typés NATIONAL/REGIONAL/SECTORIAL, périodes DAILY→ANNUAL.

**Modèles de données impliqués** : Application, School, ComplianceCheck, MinistryReport (agrégats calculés, pas de lecture directe de Student/Payment nominatifs identifiée dans les méthodes lues).

**Notifications déclenchées** : aucune identifiée.

**Tests présents** : `ministry.service.spec.ts` — agrège les candidatures par établissement/programme sans lire de données élèves, retourne les inscriptions en compteurs uniquement, calcule l'état de conformité courant + filtre statut. `ministry-access-policy.spec.ts` — réserve les parcours/opérations financières individuels aux étudiants (Ministry exclu), réserve audit et envoi de notifications à l'administration. `report-exporter.spec.ts` — produit un PDF binaire valide et un JSON parseable à partir des seuls agrégats (pas de PII).

**Points à confirmer / zones floues** : aucune majeure — le module est bien couvert par des tests de politique d'accès explicites.

---

## Module: notification

**Finalité métier apparente** : point central d'envoi de notifications (email/SMS/push/in-app), lecture/marquage des notifications utilisateur, préférences.

**Endpoints** (`/api/notifications`, `@UseGuards(JwtAuthGuard)` niveau contrôleur)

| Méthode | Route | Rôles | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|---|
| POST | send | ADMIN_GET | SendNotificationDto | Envoi générique multi-canal | notification.controller.ts:55-57 |
| GET | me | — (tout utilisateur connecté) | query | Notifications de l'utilisateur, paginées, filtrables lu/non lu | :77 |
| PUT | :id/read | — | — | Marque une notification comme lue | :110 |
| PUT | me/read-all | — | — | Marque tout comme lu | :130 |
| GET | preferences | — | — | Préférences de notification | :149 |
| PUT | preferences | — | NotificationPreferencesDto | Met à jour les préférences | :162 |
| POST | welcome | ADMIN_GET | SendWelcomeEmailDto | Email de bienvenue | :185-187 |
| POST | payment-confirmation | ADMIN_GET | SendPaymentConfirmationDto | Confirmation de paiement | :203-205 |
| POST | status-update | ADMIN_GET, SCHOOL_ADMIN | SendStatusUpdateDto | Notification de changement de statut candidature | :225-227 |
| POST | reminder | ADMIN_GET, SCHOOL_ADMIN | SendReminderDto | Rappel de deadline | :253-255 |
| GET | platform-stats | ADMIN_GET | — | Statistiques plateforme (notifications) | :310-312 |
| GET | stats | ADMIN_GET, MINISTRY | — | Statistiques notifications | :324-326 |

**Règles de gestion identifiées**
- `send()` vérifie l'existence de l'utilisateur et si le canal est activé dans ses préférences avant envoi — `notification.service.ts:83-99`.
- **Envoi EMAIL/SMS/PUSH intégralement simulé** (`console.log` + `setTimeout`-like `delay`, pas d'intégration SendGrid/AWS SES/Twilio réelle identifiée) — `notification.service.ts:143-219`. SMS échoue si l'utilisateur (student) n'a pas de téléphone renseigné.
- **Préférences utilisateur non persistées** : `getUserPreferences` retourne des valeurs par défaut codées en dur, `updatePreferences` ne fait qu'un `console.log` sans écriture en base — `notification.service.ts:225-268` (commentaire du code : « Pour l'instant, on simule »).
- Notification IN_APP toujours stockée en base (`Notification` model), c'est le seul canal réellement persistant/fiable.

**Modèles de données impliqués** : Notification, User, Student (pour le téléphone SMS).

**Notifications déclenchées** : ce module *est* le point d'envoi ; consommé par auth (reset password), application (changement statut), school (annonces, changement créneau), teaching (annonces cours).

**Tests présents** : aucun fichier `*.spec.ts` trouvé pour `notification.service.ts`/`notification.controller.ts` — **absence de tests unitaires identifiée**.

**Points à confirmer / zones floues** : **canaux EMAIL/SMS/PUSH non branchés à un fournisseur réel** (simulation uniquement) — à confirmer si un provider réel existe en configuration de prod (`ENABLE_SWAGGER`, variables d'env non explorées ici) ou si c'est un gap fonctionnel à couvrir dans l'expression des besoins. Préférences utilisateur non persistées = fonctionnalité à considérer incomplète.

---

## Module: audit

**Finalité métier apparente** : journal d'audit transverse (toutes les requêtes API), consultation par les administrateurs plateforme.

**Endpoints** (`/api/audit`, `@Roles('ADMIN_GET')` niveau contrôleur)

| Méthode | Route | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|
| GET | / | Liste paginée/filtrable des logs | audit.controller.ts:39 |
| GET | resource/:resource/:id | Logs pour une ressource précise | :59 |
| GET | user/:userId | Logs d'un utilisateur | :89 |
| GET | stats | Statistiques d'audit | :116 |
| GET | me | Logs de l'utilisateur courant | :135 |

**Règles de gestion identifiées**
- Journalisation **automatique** de toute requête HTTP via `AuditInterceptor` (posé en intercepteur global dans `main.ts`) : action déduite de la méthode HTTP (GET→VIEW, POST→CREATE, PUT/PATCH→UPDATE, DELETE→DELETE), ressource déduite de l'URL (routes spéciales : login/register/logout, payments/initiate→action PAYMENT) — `audit.interceptor.ts:76-143`.
- **Ne journalise jamais le corps de la réponse/requête**, seulement les métadonnées (userId, action, resource, resourceId, ip, userAgent, status) — pour éviter la fuite de secrets (MFA, tokens, documents) et la boucle infinie sur les endpoints d'audit eux-mêmes — commentaire explicite `audit.interceptor.ts:39-42`.
- Échec de journalisation n'interrompt jamais la requête (`.catch(console.error)`) — `audit.interceptor.ts:53, 68`.
- Le service `AuditService.log()` est aussi appelé explicitement par le module `application` (avant/après statut) pour un enrichissement métier plus riche.

**Modèles de données impliqués** : AuditLog, User.

**Notifications déclenchées** : aucune.

**Tests présents** : aucun fichier spec dédié à `audit.service.ts`/`audit.controller.ts` trouvé.

**Points à confirmer / zones floues** : rétention/purge des logs d'audit non identifiée dans le code lu — à confirmer avec le métier (obligation légale de durée de conservation ?).

---

## Module: message

**Finalité métier apparente** : messagerie interne 1-à-1 entre utilisateurs de la plateforme (étudiants, profs, admins école, admin plateforme), avec pièces jointes, exclut explicitement le rôle Ministry.

**Endpoints** (`/api/messages`, `@Roles('STUDENT','SCHOOL_ADMIN','TEACHER','ADMIN_GET')` — **MINISTRY exclu**)

| Méthode | Route | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|
| GET | inbox | Messages reçus | message.controller.ts:52 |
| GET | sent | Messages envoyés | :63 |
| GET | unread-count | Compteur de non-lus | :74 |
| GET | conversations | Liste des conversations (1-à-1) | :83 |
| GET | conversations/:id | Fil de discussion | :98 |
| POST | / | Envoi d'un message (+pièces jointes) | :115 |
| PATCH | conversations/:id/read | Marque tout le fil comme lu | :155 |
| PATCH | :id/read | Marque un message comme lu | :167 |

**Règles de gestion identifiées**
- Maximum 5 pièces jointes par message — `message.service.ts:11, 32-36`.
- Impossible de s'envoyer un message à soi-même — `message.service.ts:42-45`.
- Modèle de conversation « directe » basé sur une clé déterministe (`directKey`) entre 2 utilisateurs, upsert atomique via SQL brut dans une transaction (création conversation + participants + message + pièces jointes) — `message.service.ts:50-73`.

**Modèles de données impliqués** : Message, MessageAttachment, Conversation, ConversationParticipant, User.

**Notifications déclenchées** : aucune identifiée (pas d'appel à `NotificationService` dans la portion lue).

**Tests présents** : `message.controller.spec.ts` — vérifie que le rôle Ministry est exclu des échanges nominatifs.

**Points à confirmer / zones floues** : absence apparente de notification lors de la réception d'un message (à confirmer si souhaité côté métier).

---

## Module: teaching

**Finalité métier apparente** : espace enseignant — profil, tableau de bord, gestion de ses cours (paramètres, chapitres/ressources pédagogiques, annonces, évaluations, notes, devoirs, soumissions).

**Endpoints** (4 sous-contrôleurs, tous `@Roles('TEACHER')`)

| Contrôleur | Routes clés | Résumé |
|---|---|---|
| `teacher/courses` | GET / ; GET schools, schedule, resources ; GET/PATCH :courseId[/settings] ; GET :courseId/students, evaluations, announcements ; POST announcements, evaluations, assignments, chapters ; PATCH/DELETE chapters[/:id] ; POST/PATCH/DELETE chapters/:id/resources[/:id] | Gestion complète du contenu pédagogique d'un cours | teaching.controller.ts:112-290 |
| `teacher` | GET profile, dashboard/summary ; PATCH profile, profile/password, profile/theme ; POST profile/avatar | Profil et tableau de bord enseignant | :292-368 |
| `teacher/evaluations` | GET :id/grades ; POST :id/grades | Notation d'une évaluation | :371-394 |
| `teacher/assignments` | PATCH :id/publish ; GET :id/submissions | Publication de devoirs, consultation des rendus | :397-417 |
| `teacher/submissions` | PATCH :id/grade | Notation d'une soumission | :420-430 |

**Règles de gestion identifiées**
- Toute action sur un cours/évaluation/devoir/soumission vérifie d'abord que la ressource appartient bien au professeur connecté (`course`, `evaluation`, `assignment`, `submission` — helpers privés) — `teaching.service.ts:126-191`.
- `saveGrade` refuse de noter un étudiant non inscrit au cours de l'évaluation — `teaching.service.ts:574` et test dédié.
- Annonce de cours notifie uniquement les étudiants réellement inscrits (`createAndNotify` via `AnnouncementService`, cohérent avec le module `school`).
- Ajout de ressource pédagogique refusé si ni lien ni fichier fourni — `teaching.service.ts:373`.

**Modèles de données impliqués** : Teacher, Course, CourseChapter, CourseResource, Evaluation, Grade, Assignment, AssignmentSubmission, Announcement, CourseSlot, TeacherSchool.

**Notifications déclenchées** : via `AnnouncementService.createAndNotify` pour les annonces de cours ; publication de chapitre/évaluation *possiblement* liée aux flags `notifyOnPublish`/`allowGroupMessages` du modèle `Course` — à confirmer l'usage exact de ces flags dans le service (non vérifié en détail).

**Tests présents** : `teaching.service.spec.ts` (13 cas — refus de notation hors inscription, profil réel avec email, agrégation dashboard, mise à jour profil isolée, MAJ chapitre après vérification cours, upload ressource après vérification chapitre, refus suppression ressource hors chapitre, créneaux/ressources filtrés par propriété, annonce limitée aux inscrits, refus accès notes hors cours du prof, liste complète des inscrits avec note nulle si absente, création devoir en brouillon, refus notation soumission hors cours du prof) ; `teaching.controller.spec.ts` (délégation profil/mot de passe/thème, refus upload avatar sans fichier, stockage avatar + MAJ profil).

**Points à confirmer / zones floues** : rôle exact des flags `Course.welcomeMessage`/`allowGroupMessages`/`notifyOnPublish` (présents en schéma mais logique d'utilisation non vérifiée en détail dans cette passe).

---

## Module: competition

**Finalité métier apparente** : gestion des concours d'admission organisés par une école (ex. concours d'entrée), administrés par la plateforme.

**Endpoints** (`/api/competitions`, `@Roles('ADMIN_GET')`)

| Méthode | Route | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|
| GET | / | Liste filtrable | competition.controller.ts:33 |
| POST | / | Création | :60 |
| PATCH | :id | Mise à jour | :66 |
| DELETE | :id | Suppression | :72 |

**Règles de gestion identifiées**
- Statuts contrôlés par enum : PLANNED, OPEN, IN_PROGRESS, COMPLETED, CANCELLED (`IsIn`) — `create-competition.dto.ts:15-21`.
- `ensureExists` avant update/delete (404 sinon) — `competition.service.ts:102`.

**Modèles de données impliqués** : Competition, School, SchoolProgram.

**Notifications déclenchées** : aucune identifiée.

**Tests présents** : aucun fichier spec trouvé pour ce module.

**Points à confirmer / zones floues** : pas de route publique/candidat pour s'inscrire à un concours identifiée dans ce module — à confirmer si l'inscription à un concours passe par un autre mécanisme (offer/application) ou est hors périmètre actuel.

---

## Module: financial-partner

**Finalité métier apparente** : gestion des partenaires financiers affichés sur la plateforme (banques, mobile money, assurance, bourses) — vitrine + administration.

**Endpoints** (`/api/financial-partners`, `@Roles('ADMIN_GET')` sauf lecture publique via module `landing`)

| Méthode | Route | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|
| GET | / | Liste (probablement filtrable) | financial-partner.controller.ts:46 |
| POST | / | Création | :71 |
| PATCH | :id | Mise à jour | :77 |
| DELETE | :id | Suppression | :83 |
| POST | :id/logo | Upload logo | :89 |

**Règles de gestion identifiées**
- Types contrôlés par enum : BANK, MOBILE_MONEY, INSURANCE, SCHOLARSHIP, OTHER — `create-financial-partner.dto.ts:12-18`.

**Modèles de données impliqués** : FinancialPartner.

**Notifications déclenchées** : aucune.

**Tests présents** : aucun fichier spec trouvé.

**Points à confirmer / zones floues** : lien exact avec le module `landing` (`getPartners()`) — à confirmer si les partenaires affichés publiquement sont filtrés par `isActive` uniquement (probable mais non vérifié en détail).

---

## Module: landing

**Finalité métier apparente** : contenu de la page d'accueil publique (configuration hero/stats/steps/actor-cards, actualités, partenaires).

**Endpoints** (`/api/landing`)

| Méthode | Route | Guards | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|
| GET | config | `@Public()` | Configuration de la landing page | landing.controller.ts:60-61 |
| GET | news | `@Public()` | Actualités publiées | :67-68 |
| GET | partners | `@Public()` | Partenaires financiers actifs | :75-76 |
| PUT | config/hero, stats, steps, actor-cards | ADMIN_GET | Édition des sections de la landing | :84-113 |
| GET | news/admin | ADMIN_GET | Liste admin (toutes actualités) | :120-121 |
| POST/PATCH/DELETE | news[/:id] | ADMIN_GET | CRUD actualités | :131-149 |
| POST | news/:id/photo | ADMIN_GET | Upload photo actualité | :158-159 |

**Règles de gestion identifiées**
- Configuration stockée en clé/valeur JSON (probablement via `SystemConfig`, à confirmer) par section (hero/stats/steps/actor-cards) — `landing.service.ts:44-73`.
- Actualités : type/titre/corps obligatoires, `isPublished`/`displayOrder` optionnels — `landing-news.dto.ts`.

**Modèles de données impliqués** : LandingNewsPost, FinancialPartner, (SystemConfig probable pour la config landing — à confirmer).

**Notifications déclenchées** : aucune.

**Tests présents** : aucun fichier spec trouvé pour ce module.

**Points à confirmer / zones floues** : stockage exact de la config landing (table dédiée vs `SystemConfig`) non vérifié en détail.

---

## Module: academic-year

**Finalité métier apparente** : gestion des années académiques de référence de la plateforme (distinctes de `SchoolAcademicYear` par école), utilisées par le moteur de planification (classes, besoins horaires).

**Endpoints** (`/api/academic-years`)

| Méthode | Route | Guards | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|
| GET | / | `@Public()` | Liste des années académiques | academic-year.controller.ts:24-25 |
| POST | / | ADMIN_GET | Création | :31-33 |
| PATCH | :id | ADMIN_GET | Mise à jour | :40-42 |
| DELETE | :id | ADMIN_GET | Suppression | :49-51 |

**Règles de gestion identifiées**
- `label` unique (`@@unique` en base + `assertLabelAvailable` en service) — `academic-year.service.ts:87`, `schema.prisma:365`.

**Modèles de données impliqués** : AcademicYear, SchoolClass, SubjectRequirement.

**Notifications déclenchées** : aucune.

**Tests présents** : aucun fichier spec trouvé.

**Points à confirmer / zones floues** : effet de `isCurrent=true` sur les autres années (désactivation automatique des autres ?) — non vérifié dans le détail de `create`/`update`.

---

## Module: teacher-availability

**Finalité métier apparente** : gestion des indisponibilités déclarées par les professeurs et des temps de trajet minimum entre écoles, utilisées par le moteur de planification pour éviter les conflits ; côté admin, recherche de profs et rapport global de conflits.

**Endpoints** (3 sous-contrôleurs)

| Contrôleur | Routes | Rôles | Résumé |
|---|---|---|---|
| `teacher/availability` | GET / ; POST / ; DELETE :id | TEACHER | Déclarer/lister/supprimer ses indisponibilités | teacher-availability.controller.ts:14-40 |
| `teacher/travel-buffers` | GET / ; POST / ; DELETE :id | TEACHER | Déclarer un temps de trajet minimal entre 2 de ses écoles | :43-70 |
| `teachers` | GET / ; GET :id/conflicts | ADMIN_GET | Recherche de profs, rapport de conflits | :74-90 |

**Règles de gestion identifiées**
- Indisponibilité récurrente (`dayOfWeek`) OU ponctuelle (`date`), jamais les deux (`@ValidateIf`) — `teacher-availability.dto.ts:16-24`.
- Format horaire strict `HH:mm` (regex) — `teacher-availability.dto.ts:13, 27-32`.
- `minutesBuffer` entre 0 et 480 minutes (8h max) — `teacher-travel-buffer.dto.ts:10-13`.
- **Algorithme `isTeacherFree`** : un professeur n'est libre sur un créneau que si (1) aucune indisponibilité déclarée ne chevauche, (2) aucun `CourseSlot` existant ne chevauche (même jour), (3) pour un créneau dans une **autre école** le même jour, l'écart avec le créneau le plus proche doit être ≥ `TeacherTravelBuffer.minutesBuffer` défini entre les deux écoles (sinon indisponible) — `teacher-availability.service.ts:106-166`.
- Contrainte d'exclusion base (`no_teacher_double_booking`) traduite en message métier lisible — `teacher-availability.service.ts:182-188`.
- Buffers normalisés par ordre alphabétique des ids d'école (`schoolAId < schoolBId`) — commentaire schéma `schema.prisma:494`.

**Modèles de données impliqués** : TeacherAvailability, TeacherTravelBuffer, Teacher, TeacherSchool, CourseSlot, School.

**Notifications déclenchées** : aucune directement (consommé par `school.service.ts` qui, lui, notifie le prof lors de changement de créneau).

**Tests présents** : aucun fichier spec dédié trouvé pour ce module (à confirmer — non identifié dans la recherche effectuée).

**Points à confirmer / zones floues** : aucune majeure, logique métier bien documentée en commentaires dans le code source lui-même.

---

## Module: user

**Finalité métier apparente** : administration des comptes utilisateurs de la plateforme (vue transverse tous rôles) par l'admin GET.

**Endpoints** (`/api/users`, `@Roles('ADMIN_GET')`)

| Méthode | Route | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|---|
| GET | / | query (search, roleName, isActive, page, limit) | Liste paginée des utilisateurs avec nom d'affichage et école | user.controller.ts:18 |
| PATCH | :id/status | UpdateUserStatusDto `{isActive}` | Active/désactive un compte | user.controller.ts:40 |

**Règles de gestion identifiées**
- Un administrateur **ne peut pas désactiver son propre compte** — `user.service.ts:74-76`.
- Limite de pagination forcée entre 1 et 100 — `user.service.ts:14-15`.

**Modèles de données impliqués** : User, Role, Student, Teacher, SchoolAdmin.

**Notifications déclenchées** : aucune.

**Tests présents** : aucun fichier spec trouvé.

**Points à confirmer / zones floues** : pas de route de création manuelle de compte staff (SCHOOL_ADMIN/TEACHER/MINISTRY) trouvée dans ce module — à confirmer comment ces comptes sont provisionnés en dehors du seed (peut-être via un autre module non couvert, ou manuellement en base — à vérifier avec le métier).

---

## Module: system-settings

**Finalité métier apparente** : paramètres globaux de la plateforme (nom, contact, adresse) éditables par l'admin.

**Endpoints** (`/api/settings`, `@Roles('ADMIN_GET')`)

| Méthode | Route | DTO entrée | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|
| GET | / | — | Paramètres courants (avec valeurs par défaut si absents) | system-settings.controller.ts:17 |
| PUT | / | UpdatePlatformSettingsDto | Met à jour les paramètres (upsert) | system-settings.controller.ts:23 |

**Règles de gestion identifiées**
- `platformName` obligatoire (≤120 car.), `contactEmail`/`contactPhone`/`address` optionnels — `update-platform-settings.dto.ts`.
- Stocké en clé unique `platform.settings` dans `SystemConfig` (JSON), upsert simple — `system-settings.service.ts:6, 24-30`.

**Modèles de données impliqués** : SystemConfig.

**Notifications déclenchées** : aucune.

**Tests présents** : aucun fichier spec trouvé.

**Points à confirmer / zones floues** : aucune majeure.

---

## Module: admin-dashboard

**Finalité métier apparente** : tableau de bord synthétique pour l'admin plateforme (KPIs globaux).

**Endpoints** (`/api/admin/dashboard-summary`, `@Roles('ADMIN_GET')`)

| Méthode | Route | Résumé fonctionnel | Fichier:ligne |
|---|---|---|---|
| GET | / | Résumé KPI global | admin-dashboard.controller.ts:16 |

**Règles de gestion identifiées**
- Distingue explicitement `enrolledStudents` (nombre d'inscriptions actives — un étudiant en double cursus compte 2 fois) de `distinctEnrolledStudents` (nombre réel d'étudiants distincts) — `admin-dashboard.service.ts:19-30`, cohérent avec la règle multi-écoles vue dans `school`/`application`.
- Taux d'acceptation calculé = acceptées/total, arrondi à 1 décimale, 0 si aucune candidature — `admin-dashboard.service.ts:46-48`.
- Chiffre d'affaires = somme des paiements COMPLETED uniquement — `admin-dashboard.service.ts:34-37`.

**Modèles de données impliqués** : School, StudentEnrollment, Student, Application, Payment.

**Notifications déclenchées** : aucune.

**Tests présents** : aucun fichier spec trouvé.

**Points à confirmer / zones floues** : aucune majeure.

---

## Module: announcement

**Finalité métier apparente** : service transverse (pas de contrôleur propre) centralisant la création d'annonce + notification des destinataires, consommé par `school` et `teaching`.

**Endpoints** : aucun contrôleur propre — service interne exposé aux modules `school` (annonces école/diffusion plateforme) et `teaching` (annonces de cours).

**Règles de gestion identifiées**
- `createAndNotify` : opération **transactionnelle unique** (création `Announcement` + `Notification` par destinataire + `AnnouncementRecipient` de liaison) remplaçant trois implémentations dupliquées non transactionnelles antérieures — commentaire explicite `announcement.service.ts:15-21`.
- Dédoublonnage des destinataires (`new Set(recipientUserIds)`) avant création — `announcement.service.ts:31`.
- Un seul aller-retour DB (`createMany`) par lot de notifications plutôt qu'un insert par destinataire.

**Modèles de données impliqués** : Announcement, Notification, AnnouncementRecipient.

**Notifications déclenchées** : crée directement une `Notification` de type `IN_APP` par destinataire (pas de passage par `NotificationService.send`, donc pas de vérification des préférences utilisateur pour ce canal — à confirmer si voulu).

**Tests présents** : `announcement.service.spec.ts` — crée une notification par destinataire unique et relie chacune à son annonce dans une transaction ; ne crée aucune notification si la liste de destinataires est vide.

**Points à confirmer / zones floues** : les notifications d'annonce contournent `NotificationService.send()` (pas de vérification de préférence de canal ni de canal EMAIL/SMS pour les annonces) — à confirmer si c'est voulu (IN_APP uniquement pour les annonces).

---

## Module: prisma

**Finalité métier apparente** : module d'infrastructure exposant `PrismaService` (client Prisma) à toute l'application, sans logique métier propre.

**Endpoints** : aucun.

**Modèles de données impliqués** : tous (couche d'accès aux données).

**Tests présents** : aucun.

**Points à confirmer / zones floues** : sans objet.

---

## Résumé de la tâche

21 modules analysés (contrôleurs, services, DTO, règles métier, notifications, tests), soit environ 220 endpoints recensés au total (le module `school` en concentre à lui seul ~65, `application`/`payment`/`ministry`/`teaching` étant également détaillés en profondeur ; `prisma`/`announcement` n'exposent aucun endpoint HTTP propre).
