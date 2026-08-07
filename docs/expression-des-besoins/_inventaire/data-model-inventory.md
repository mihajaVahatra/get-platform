# Dictionnaire de données fonctionnel — Plateforme GET

Source unique : `backend/prisma/schema.prisma` (55 modèles, aucun `enum` Prisma natif).
Compléments d'enum "fonctionnels" tracés vers leur source exacte : commentaire dans `schema.prisma`, `enum` TypeScript ou tableau `IsIn(...)` dans un DTO backend (`backend/src/modules/**/dto/*.dto.ts`), ou valeur observée dans `backend/prisma/seed.ts`. Rien n'est inventé : chaque valeur listée est citée avec sa source.

> **Constat structurant** : le schéma ne définit **aucun type `enum` Prisma**. Tous les champs de statut/type (`status`, `type`, `gender`, `theme`, `targetType`, `plan`, `method`…) sont des `String` avec `@default(...)`, dont les valeurs valides sont soit documentées en commentaire, soit validées uniquement côté API (`class-validator`), soit non validées du tout au niveau base (aucune contrainte `CHECK`). C'est un point à clarifier dans l'Expression des Besoins (risque de valeurs incohérentes en base).

---

## 1. Tableau de synthèse des 55 modèles

| # | Modèle | Domaine fonctionnel | Finalité (1 phrase) | Sensibilité apparente |
|---|--------|---------------------|----------------------|------------------------|
| 1 | User | Identité & accès | Compte de connexion unique (identifiants, sécurité, session) pour tout acteur de la plateforme | Critique (identifiants, secret MFA) |
| 2 | Role | Identité & accès | Rôle applicatif (STUDENT, ADMIN_GET, SCHOOL_ADMIN, MINISTRY, TEACHER) déterminant les permissions | Faible |
| 3 | Student | Étudiants | Profil détaillé d'un candidat/étudiant (identité civile, aspirations, compétences) | Élevée (CIN, naissance, contact) |
| 4 | StudentEnrollment | Étudiants & Établissements | Inscription active d'un étudiant dans une école, une filière et une année donnée | Modérée |
| 5 | School | Établissements | Fiche d'un établissement d'enseignement supérieur partenaire de GET | Faible |
| 6 | SchoolProgram | Établissements | Filière/parcours diplômant proposé par une école | Faible |
| 7 | SchoolAcademicYear | Établissements | Année scolaire propre à une école, avec fenêtre d'inscription | Faible |
| 8 | Competition | Établissements | Concours d'entrée organisé par une école | Faible |
| 9 | FinancialPartner | Partenariats | Partenaire financier (banque, mobile money, assurance, bourse) affiché aux candidats | Faible |
| 10 | LandingNewsPost | Communication publique | Article d'actualité affiché sur la page vitrine (landing) | Faible |
| 11 | SchoolAdmin | Établissements & accès | Rattachement d'un utilisateur au rôle de gestionnaire d'une école, avec permissions fines | Modérée |
| 12 | Teacher | Personnel enseignant | Profil d'un professeur, indépendant de son établissement d'affectation | Modérée |
| 13 | TeacherSchool | Personnel enseignant | Affectation d'un professeur à une école (un prof peut enseigner dans plusieurs écoles) | Faible |
| 14 | SchoolSubject | Pédagogie | Matière enseignée, propre à une école | Faible |
| 15 | TeacherSchoolSubject | Pédagogie | Qualification d'un professeur pour une matière dans une école donnée | Faible |
| 16 | AcademicYear | Planification | Année scolaire centrale (plateforme), référence des besoins horaires | Faible |
| 17 | Room | Planification | Salle physique d'un établissement | Faible |
| 18 | SchoolClass | Planification | Classe/promotion d'une école pour une année scolaire | Modérée (studentCount) |
| 19 | SubjectRequirement | Planification | Besoin horaire d'une classe pour une matière (avant affectation d'un prof) | Faible |
| 20 | TeacherAssignment | Planification | Professeur retenu pour couvrir un besoin horaire donné | Faible |
| 21 | SchoolTimeSlot | Planification | Créneau horaire valide dans la grille d'une école | Faible |
| 22 | TeacherAvailability | Planification | Indisponibilité déclarée par un professeur (récurrente ou ponctuelle) | Modérée (motif personnel) |
| 23 | TeacherTravelBuffer | Planification | Temps de trajet minimal qu'un professeur doit avoir entre deux écoles | Faible |
| 24 | Course | Pédagogie / cours | Cours dispensé par un professeur dans une école, avec ses paramètres pédagogiques | Faible |
| 25 | CourseSlot | Planification | Créneau hebdomadaire récurrent effectivement occupé par un cours | Faible |
| 26 | CourseEnrollment | Pédagogie / cours | Inscription d'un étudiant à un cours précis | Modérée |
| 27 | CourseChapter | Pédagogie / cours | Chapitre d'un cours, unité de structuration du contenu | Faible |
| 28 | CourseResource | Pédagogie / cours | Ressource pédagogique (support, vidéo…) rattachée à un chapitre | Faible |
| 29 | Evaluation | Pédagogie / évaluation | Épreuve notée programmée dans un cours | Modérée |
| 30 | Assignment | Pédagogie / évaluation | Devoir à rendre par les étudiants d'un cours | Faible |
| 31 | AssignmentSubmission | Pédagogie / évaluation | Rendu d'un devoir par un étudiant, avec note et feedback | Modérée (résultat scolaire) |
| 32 | Grade | Pédagogie / évaluation | Note d'un étudiant à une évaluation | Modérée (résultat scolaire) |
| 33 | SchoolSubscription | Établissements / facturation | Abonnement payant d'une école à la plateforme GET | Élevée (montant, statut paiement) |
| 34 | Offer | Admissions | Offre de formation ouverte aux candidatures | Faible |
| 35 | SchoolRequirement | Admissions | Pièce/critère exigé par une école pour candidater | Faible |
| 36 | OfferRequirement | Admissions | Association entre une offre et les exigences qui s'y appliquent | Faible |
| 37 | Application | Admissions | Candidature d'un étudiant à une offre de formation | Élevée (score, décision) |
| 38 | ApplicationTimeline | Admissions | Historique horodaté des changements de statut d'une candidature | Modérée |
| 39 | Payment | Paiement | Paiement effectué par un étudiant (frais de dossier/scolarité) | Élevée (données financières) |
| 40 | Transaction | Paiement | Trace technique d'une transaction auprès d'un prestataire de paiement | Élevée (données financières) |
| 41 | Refund | Paiement | Remboursement associé à un paiement | Élevée (données financières) |
| 42 | Document | Étudiants / admissions | Pièce justificative déposée par un étudiant (CV, CIN, diplôme…) | Élevée (pièce d'identité) |
| 43 | Notification | Communication | Notification envoyée à un utilisateur (email/SMS/push/in-app) | Modérée |
| 44 | Announcement | Communication | Annonce diffusée par une école ou un professeur à un public ciblé | Faible |
| 45 | AnnouncementRecipient | Communication | Trace de diffusion d'une annonce à un destinataire précis, liée à sa notification | Faible |
| 46 | Message | Communication | Message privé échangé entre deux utilisateurs | Modérée (correspondance privée) |
| 47 | MessageAttachment | Communication | Pièce jointe à un message | Modérée |
| 48 | Conversation | Communication | Fil de discussion entre deux utilisateurs (clé directe unique) | Faible |
| 49 | ConversationParticipant | Communication | Participant à une conversation, avec son dernier horodatage de lecture | Faible |
| 50 | NotificationTemplate | Communication | Modèle réutilisable de notification (sujet, corps, variables) | Faible |
| 51 | MinistryReport | Ministère / reporting | Rapport statistique généré pour le Ministère de tutelle | Modérée (données agrégées) |
| 52 | ComplianceCheck | Ministère / conformité | Contrôle de conformité réalisé sur une école | Modérée |
| 53 | AuditLog | Sécurité / audit | Journal d'audit des actions effectuées sur la plateforme | Élevée (IP, avant/après) |
| 54 | Image | Technique / média | Fichier image générique (avatar, logo, bannière…) rattaché à une entité | Faible |
| 55 | SystemConfig | Technique / configuration | Paramètre de configuration global de la plateforme, potentiellement chiffré | Élevée si `isEncrypted=true` |

---

## 2. Fiches détaillées par modèle

### Domaine — Identité & accès

#### User (`@@map("users")`)
**Définition** : compte de connexion unique pour tout acteur de GET (étudiant, professeur, admin d'école, admin GET, ministère) ; sert de socle d'authentification, un profil métier (Student/Teacher/SchoolAdmin) s'y greffe en 1-1 optionnel.
**Champs clés** :
- `email` (obligatoire, `@unique`) — identifiant de connexion.
- `password` (obligatoire) — hash du mot de passe.
- `roleId` (optionnel, FK `Role`) — rôle applicatif ; un utilisateur peut exister sans rôle.
- `isActive` (obligatoire, défaut `true`) — compte activé ou désactivé.
- `isVerified` (obligatoire, défaut `false`) — email vérifié.
- `lastLogin`, `lastFailedLoginAt` (optionnels) — traçabilité de connexion.
- `refreshToken` (optionnel) — jeton de rafraîchissement de session.
- `mfaSecret` (optionnel), `mfaEnabled` (obligatoire, défaut `false`) — authentification à deux facteurs.
- `failedLoginAttempts` (obligatoire, défaut `0`) — compteur pour verrouillage anti brute-force.
- `sessionVersion` (obligatoire, défaut `0`) — incrémenté à chaque déconnexion explicite ; permet de révoquer côté serveur un JWT déjà émis (mécanisme documenté en commentaire dans le schéma).
- `gender` (obligatoire, défaut `"MALE"`) — valeurs `MALE`/`FEMALE` (commentaire schéma).
- `theme` (obligatoire, défaut `"system"`) — préférence d'affichage `light`/`dark`/`system` (commentaire schéma).
- `deletedAt` (optionnel) — indice de **soft-delete**.
**Enums** : `gender` (MALE, FEMALE — commentaire schéma) ; `theme` (light, dark, system — commentaire schéma).
**Relations** : 1-1 optionnelle vers `Student`, `Teacher`, `SchoolAdmin` (le même User ne porte normalement qu'un seul profil métier) ; N-1 vers `Role` ; 1-N vers `Notification`, `AuditLog` ; 1-N vers `Message` (émis/reçus, deux relations nommées) ; N-N vers `Conversation` via `ConversationParticipant`.
**Contraintes** : `email` unique (un compte = un email).
**Cycle de vie** : `isActive`/`isVerified` (booléens d'état) + `deletedAt` (soft-delete) + `createdAt`/`updatedAt`.

#### Role (`@@map("roles")`)
**Définition** : référentiel des rôles applicatifs (ex. STUDENT, ADMIN_GET, SCHOOL_ADMIN, MINISTRY, TEACHER, tels que créés par `seed.ts`).
**Champs clés** : `name` (obligatoire, `@unique`) — code du rôle ; `description` (optionnel) ; `isDefault` (obligatoire, défaut `false`) — rôle attribué par défaut (STUDENT dans le seed).
**Enums** : aucun formel — le référentiel de rôles est une table, pas un enum ; les valeurs observées dans `seed.ts` sont `STUDENT`, `ADMIN_GET`, `SCHOOL_ADMIN`, `MINISTRY`, `TEACHER`.
**Relations** : 1-N vers `User`.
**Contraintes** : `name` unique.
**Cycle de vie** : pas de soft-delete, pas de statut.

### Domaine — Étudiants

#### Student (`@@map("students")`)
**Définition** : profil détaillé d'un candidat ou étudiant (identité, contact, parcours bac, aspirations), distinct du compte `User`.
**Champs clés** :
- `userId` (obligatoire, `@unique`, FK `User`, cascade) — un seul profil étudiant par compte.
- `firstName`, `lastName` (obligatoires).
- `phone`, `birthDate`, `cin`, `bacYear`, `bacType`, `address`, `city`, `region`, `bio`, `avatarUrl` (optionnels).
- `country` (obligatoire, défaut `"Madagascar"`).
- `interests`, `skills`, `aspirations` (tableaux de chaînes, optionnels par nature).
- `profileCompleted` (obligatoire, défaut `false`) — indicateur de complétude du profil.
- `deletedAt` (optionnel) — **soft-delete**.
**Enums** : aucun.
**Relations** : 1-1 vers `User` ; 1-N vers `StudentEnrollment` (un étudiant peut être inscrit dans **plusieurs écoles simultanément** — double diplôme/cursus parallèle, cf. commentaire schéma), `Document`, `Application`, `Payment`, `CourseEnrollment`, `AssignmentSubmission`, `Grade`.
**Contraintes** : `userId` unique.
**Cycle de vie** : `deletedAt` (soft-delete) + `createdAt`/`updatedAt` ; pas de champ `status` propre — l'état d'inscription vit dans `StudentEnrollment.status`.

#### StudentEnrollment (`@@map("student_enrollments")`)
**Définition** : inscription d'un étudiant dans un établissement précis, pour une filière, un niveau et une année académique donnés — une ligne par couple (étudiant, école), symétrique de `TeacherSchool` côté professeurs.
**Champs clés** :
- `studentId`, `schoolId`, `programId`, `academicYearId` (tous obligatoires, FK).
- `programLevel` (obligatoire, `Int`) — année du cursus (ex. Licence 2).
- `enrolledYear` (obligatoire) — libellé calculé automatiquement depuis programme/niveau/année ; **ne doit pas être saisi librement** (commentaire schéma).
- `status` (obligatoire, défaut `"ACTIVE"`).
**Enums** : `status` — `ACTIVE | WITHDRAWN | GRADUATED` (commentaire explicite dans le schéma).
**Relations** : N-1 vers `Student`, `School` (relation nommée `EnrolledStudents`), `SchoolProgram`, `SchoolAcademicYear`.
**Contraintes** : `@@unique([studentId, schoolId])` — **un étudiant ne peut avoir qu'une seule inscription active par école** (mais peut en avoir dans plusieurs écoles). Index `[schoolId, status]`.
**Cycle de vie** : `status` porte le cycle de vie (ACTIVE → WITHDRAWN/GRADUATED), pas de `deletedAt`.

#### Document (`@@map("documents")`)
**Définition** : pièce justificative déposée par un étudiant (CV, pièce d'identité, diplôme, photo…), avec circuit de vérification.
**Champs clés** :
- `studentId` (obligatoire, FK, cascade).
- `type` (obligatoire) — voir enum.
- `name`, `fileUrl`, `fileSize`, `mimeType` (obligatoires) — métadonnées du fichier.
- `isVerified` (obligatoire, défaut `false`), `verifiedBy` (optionnel, id texte libre — pas de FK réelle), `verifiedAt` (optionnel) — circuit de vérification.
- `deletedAt` (optionnel) — **soft-delete**.
**Enums** : `type` — `CV | LETTER | ID | DIPLOMA | PHOTO | OTHER` (validé côté DTO `UploadDocumentDto`, `backend/src/modules/student/dto/upload-document.dto.ts`). Un commentaire dans `seed.ts` précise que d'anciens types `CIN`/`BAC` ont été migrés vers `ID`/`DIPLOMA`.
**Relations** : N-1 vers `Student`.
**Contraintes** : index `[studentId, type]`.
**Cycle de vie** : `isVerified` (non vérifié → vérifié) + `deletedAt` (soft-delete) ; pas de `createdAt` classique, seulement `uploadedAt`.

### Domaine — Établissements & offre de formation

#### School (`@@map("schools")`)
**Définition** : fiche d'un établissement d'enseignement supérieur partenaire de la plateforme GET.
**Champs clés** : `name` (obligatoire) ; `slug` (obligatoire, `@unique`) — identifiant public/URL ; `type` (obligatoire, défaut `"PRIVATE"`) ; `city` (obligatoire) ; `address`, `region`, `contactEmail`, `contactPhone`, `website`, `logo`, `description` (optionnels) ; `country` (obligatoire, défaut `"Madagascar"`) ; `isActive` (obligatoire, défaut `true`) ; `deletedAt` (optionnel, **soft-delete**).
**Enums** : `type` — `PUBLIC | PRIVATE` (enum TS `SchoolType`, `backend/src/modules/school/dto/create-school.dto.ts`, défaut `PRIVATE`).
**Relations** : 1-N très large — `StudentEnrollment` (relation nommée `EnrolledStudents`), `SchoolAdmin`, `Offer`, `SchoolRequirement`, `TeacherSchool`, `Course`, `Announcement`, `SchoolProgram`, `SchoolAcademicYear`, `SchoolSubject`, `Competition`, `Room`, `SchoolClass`, `SubjectRequirement`, `SchoolTimeSlot`, `ComplianceCheck` ; 1-1 vers `SchoolSubscription` ; 1-N (x2, relations nommées `TravelBufferSchoolA`/`TravelBufferSchoolB`) vers `TeacherTravelBuffer`.
**Contraintes** : `slug` unique.
**Cycle de vie** : `isActive` + `deletedAt` (soft-delete).

#### SchoolProgram (`@@map("school_programs")`)
**Définition** : filière/parcours diplômant proposé par une école (ex. « Licence Informatique »).
**Champs clés** : `name`, `diploma` (obligatoires) ; `durationYears` (obligatoire, `Int`) ; `isActive` (obligatoire, défaut `true`).
**Enums** : aucun.
**Relations** : N-1 vers `School` ; 1-N vers `StudentEnrollment`, `Offer`, `Course`, `Competition`, `SchoolClass`.
**Contraintes** : `@@unique([schoolId, name])` — un nom de filière est unique par école ; index `[schoolId, isActive]`.
**Cycle de vie** : `isActive` uniquement, pas de `deletedAt`.

#### SchoolAcademicYear (`@@map("school_academic_years")`)
**Définition** : année scolaire propre à une école, orientée admissions (fenêtre d'inscription), distincte du modèle `AcademicYear` central utilisé pour la planification pédagogique (précisé en commentaire schéma).
**Champs clés** : `label` (obligatoire, ex. « 2026-2027 ») ; `enrollmentOpensAt`, `enrollmentClosesAt` (obligatoires) ; `isCurrent` (obligatoire, défaut `false`).
**Enums** : aucun.
**Relations** : N-1 vers `School` ; 1-N vers `StudentEnrollment`.
**Contraintes** : `@@unique([schoolId, label])` ; index `[schoolId, isCurrent]`.
**Cycle de vie** : `isCurrent` marque l'année active ; pas de `deletedAt`.

#### Competition (`@@map("competitions")`)
**Définition** : concours d'entrée organisé par une école, éventuellement rattaché à une filière.
**Champs clés** : `name` (obligatoire) ; `description`, `examDate`, `registrationDeadline`, `capacity`, `programId` (optionnels) ; `status` (obligatoire, défaut `"PLANNED"`) ; `isActive` (obligatoire, défaut `true`) ; `deletedAt` (optionnel, **soft-delete**).
**Enums** : `status` — `PLANNED | OPEN | IN_PROGRESS | COMPLETED | CANCELLED` (constante `COMPETITION_STATUSES`, `backend/src/modules/competition/dto/create-competition.dto.ts`).
**Relations** : N-1 vers `School` ; N-1 optionnelle vers `SchoolProgram` (`onDelete: SetNull`).
**Contraintes** : index `[schoolId, status]`.
**Cycle de vie** : `status` (cycle PLANNED → OPEN → IN_PROGRESS → COMPLETED/CANCELLED) + `isActive` + `deletedAt`.

#### FinancialPartner (`@@map("financial_partners")`)
**Définition** : partenaire financier (banque, opérateur mobile money, assurance, programme de bourse) mis en avant auprès des candidats.
**Champs clés** : `name` (obligatoire) ; `description`, `logo`, `contactEmail`, `contactPhone`, `website` (optionnels) ; `type` (obligatoire, défaut `"OTHER"`) ; `isActive` (obligatoire, défaut `true`) ; `deletedAt` (optionnel, **soft-delete**).
**Enums** : `type` — `BANK | MOBILE_MONEY | INSURANCE | SCHOLARSHIP | OTHER` (constante `FINANCIAL_PARTNER_TYPES`, `backend/src/modules/financial-partner/dto/create-financial-partner.dto.ts`).
**Relations** : aucune relation Prisma (entité autonome, vitrine).
**Contraintes** : index `[type]`.
**Cycle de vie** : `isActive` + `deletedAt`.

#### LandingNewsPost (`@@map("landing_news_posts")`)
**Définition** : article d'actualité affiché sur la page publique (landing) de GET.
**Champs clés** : `type` (obligatoire, défaut `"ACTUALITÉ"`, texte libre ≤ 40 caractères — pas d'enum formel côté DTO) ; `title`, `body` (obligatoires) ; `imageUrl` (optionnel) ; `isPublished` (obligatoire, défaut `true`) ; `displayOrder` (obligatoire, défaut `0`) ; `publishedAt` (obligatoire, défaut `now()`) ; `deletedAt` (optionnel, **soft-delete**).
**Enums** : aucun formel — `type` est une chaîne libre (`CreateLandingNewsPostDto`, `backend/src/modules/landing/dto/landing-news.dto.ts`), valeur observée par défaut : `ACTUALITÉ`.
**Relations** : aucune.
**Contraintes** : index `[isPublished, displayOrder]`.
**Cycle de vie** : `isPublished` (brouillon/publié) + `deletedAt`.

#### SchoolAdmin (`@@map("school_admins")`)
**Définition** : rattachement d'un utilisateur au rôle de gestionnaire d'une école précise, avec ses permissions.
**Champs clés** : `userId` (obligatoire, `@unique`, FK `User`, cascade) — un seul rattachement admin par compte ; `schoolId` (obligatoire, FK, cascade) ; `permissions` (tableau de chaînes, ex. `OFFERS_MANAGE`, `STUDENTS_MANAGE`, `PAYMENTS_VIEW` observés dans `seed.ts`).
**Enums** : aucun formel pour `permissions` — liste libre observée dans le seed.
**Relations** : 1-1 vers `User` ; N-1 vers `School`.
**Contraintes** : `userId` unique (un admin gère une seule école dans ce modèle).
**Cycle de vie** : pas de statut, pas de soft-delete.

#### SchoolSubscription (`@@map("school_subscriptions")`)
**Définition** : abonnement payant d'une école à la plateforme GET (modèle présent mais **aucune logique métier trouvée dans `backend/src/modules`**, ni seedé — probablement fonctionnalité de facturation non encore implémentée).
**Champs clés** : `schoolId` (obligatoire, `@unique`, FK, cascade) — une école a au plus un abonnement ; `plan` (obligatoire, texte libre, aucun enum trouvé) ; `startDate` (obligatoire, défaut `now()`) ; `endDate` (optionnel) ; `isActive` (obligatoire, défaut `true`) ; `amount` (obligatoire) ; `paymentStatus` (obligatoire, texte libre, aucun enum trouvé).
**Enums** : aucun identifié dans le code (`plan`, `paymentStatus` non validés par DTO trouvé).
**Relations** : 1-1 vers `School`.
**Contraintes** : `schoolId` unique.
**Cycle de vie** : `isActive` + `endDate` (fin d'abonnement) + `paymentStatus`.

#### Offer (`@@map("offers")`)
**Définition** : offre de formation d'une école, ouverte aux candidatures des étudiants.
**Champs clés** : `title` (obligatoire) ; `slug` (obligatoire, `@unique`) ; `diploma` (obligatoire) ; `programId` (optionnel, FK `SchoolProgram`) ; `duration` (obligatoire, `Int`, en mois) ; `tuitionFees` (obligatoire) ; `currency` (obligatoire, défaut `"MGA"`) ; `prerequisites` (tableau de chaînes) ; `capacity`, `applicationDeadline`, `description` (optionnels) ; `academicYear` (obligatoire, **texte libre**, non lié à `SchoolAcademicYear` par FK) ; `isOpen` (obligatoire, défaut `true`) ; `isFeatured` (obligatoire, défaut `false`) ; `deletedAt` (optionnel, **soft-delete**).
**Enums** : aucun.
**Relations** : N-1 vers `School`, `SchoolProgram` (optionnel) ; 1-N vers `Application`, `OfferRequirement`.
**Contraintes** : `slug` unique ; index `[schoolId, isOpen, createdAt]`.
**Cycle de vie** : `isOpen` (ouverte/fermée aux candidatures) + `deletedAt`.

#### SchoolRequirement (`@@map("school_requirements")`)
**Définition** : pièce ou critère qu'une école peut exiger des candidats (ex. « Relevé de bac »), réutilisable sur plusieurs offres.
**Champs clés** : `name` (obligatoire) ; `description` (optionnel) ; `type` (obligatoire, défaut `"DOCUMENT"`, texte libre — aucun enum formel trouvé, exemple observé `DOCUMENT`) ; `diploma` (optionnel) ; `isRequired` (obligatoire, défaut `true`) ; `isActive` (obligatoire, défaut `true`).
**Enums** : `type` non formalisé (exemple `DOCUMENT` dans `backend/src/modules/school/dto/school-admin-actions.dto.ts`).
**Relations** : N-1 vers `School` ; 1-N vers `OfferRequirement`.
**Contraintes** : `@@unique([schoolId, name])` ; index `[schoolId, isActive]`.
**Cycle de vie** : `isActive`.

#### OfferRequirement (`@@map("offer_requirements")`)
**Définition** : table de liaison associant une offre à une exigence, avec caractère obligatoire propre à ce couple.
**Champs clés** : `offerId`, `requirementId` (clé composite) ; `isRequired` (obligatoire, défaut `true`) — peut différer du `isRequired` global de l'exigence.
**Enums** : aucun.
**Relations** : N-1 vers `Offer`, `SchoolRequirement` (cascade).
**Contraintes** : `@@id([offerId, requirementId])` — une exigence n'est liée qu'une fois à une offre donnée.
**Cycle de vie** : aucun horodatage.

### Domaine — Admissions / candidatures

#### Application (`@@map("applications")`)
**Définition** : candidature d'un étudiant à une offre de formation précise ; pivot central du parcours d'admission.
**Champs clés** : `studentId`, `offerId` (obligatoires, FK) ; `status` (obligatoire, défaut `"PENDING"`) ; `score` (optionnel) ; `testResults` (optionnel, `Json`) ; `interviewDate`, `interviewLink` (optionnels) ; `decisionDate`, `decisionReason` (optionnels) ; `submittedAt` (obligatoire, défaut `now()`) ; `deletedAt` (optionnel, **soft-delete**).
**Enums** : `status` — enum TS `ApplicationStatus` (`backend/src/modules/application/dto/update-application-status.dto.ts`) : `PENDING`, `UNDER_REVIEW`, `PRESELECTED`, `TEST_SCHEDULED`, `TEST_COMPLETED`, `INTERVIEW_SCHEDULED`, `INTERVIEW_COMPLETED`, `ACCEPTED`, `REJECTED`, `WAITLISTED`, `ENROLLED`, `CANCELLED`. Une matrice `APPLICATION_STATUS_TRANSITIONS` dans le même fichier fige les transitions autorisées ; `REJECTED` et `CANCELLED` sont des **états terminaux** (garde ajoutée « suite à l'audit QA » selon le commentaire du code, pour empêcher qu'une candidature rejetée soit renvoyée directement à `ACCEPTED`).
**Relations** : N-1 vers `Student`, `Offer` ; 1-N vers `ApplicationTimeline`, `Payment`.
**Contraintes** : `@@unique([studentId, offerId])` — **un étudiant ne peut candidater qu'une fois par offre** ; index `[studentId, status]`, `[offerId, status]`.
**Cycle de vie** : machine à états explicite via `status` (voir enum ci-dessus) + `deletedAt`.

#### ApplicationTimeline (`@@map("application_timelines")`)
**Définition** : historique horodaté des changements de statut d'une candidature (audit métier du parcours candidat).
**Champs clés** : `applicationId` (obligatoire, FK, cascade) ; `status` (obligatoire, texte libre reprenant les valeurs d'`ApplicationStatus`) ; `note` (optionnel) ; `createdBy` (optionnel, **texte libre, pas de FK réelle vers `User`**).
**Enums** : reprend les valeurs de `ApplicationStatus` (non contraint formellement au niveau de ce modèle).
**Relations** : N-1 vers `Application`.
**Contraintes** : index `[applicationId, createdAt]`.
**Cycle de vie** : table d'événements, pas de statut propre.

### Domaine — Paiement

#### Payment (`@@map("payments")`)
**Définition** : paiement effectué par un étudiant, généralement rattaché à une candidature (frais de dossier/scolarité).
**Champs clés** : `applicationId` (optionnel, FK) ; `studentId` (obligatoire, FK) ; `amount` (obligatoire) ; `currency` (obligatoire, défaut `"MGA"`) ; `method` (obligatoire) ; `status` (obligatoire, défaut `"PENDING"`) ; `reference` (obligatoire, `@unique`) ; `providerRef` (optionnel) ; `commission` (obligatoire) ; `receiptUrl`, `paidAt`, `expiresAt` (optionnels).
**Enums** :
- `method` — `ORANGE_MONEY | MVOLA | CARD | BANK_TRANSFER` (`backend/src/modules/payment/dto/initiate-payment.dto.ts`).
- `status` — valeurs observées dans le code (`backend/src/modules/payment/payment.service.ts` et l'interface `PaymentProvider`) : `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED` (ce dernier observé dans `seed.ts`). Aucune contrainte formelle en base ; le champ `expiresAt` suggère un état `EXPIRED` prévu mais non implémenté dans le code actuel.
**Relations** : N-1 vers `Student`, `Application` (optionnelle) ; 1-1 vers `Transaction`, `Refund`.
**Contraintes** : `reference` unique ; index `[studentId, status]`, `[reference]`.
**Cycle de vie** : `status` (PENDING → PROCESSING → COMPLETED/FAILED, puis éventuellement REFUNDED) ; un commentaire du service précise qu'« une panne à mi-chemin ne doit jamais laisser un paiement COMPLETED » sans transaction associée (garantie transactionnelle).

#### Transaction (`@@map("transactions")`)
**Définition** : trace technique d'une opération auprès d'un prestataire de paiement (Orange Money, Mvola, carte…), rattachée à un `Payment`.
**Champs clés** : `paymentId` (obligatoire, `@unique`, FK, cascade) — une transaction par paiement dans le flux actuel ; `type` (obligatoire, valeur observée `PAYMENT`) ; `amount`, `provider`, `status` (obligatoires) ; `providerTransactionId` (optionnel) ; `rawResponse` (optionnel, `Json`) ; `completedAt` (optionnel).
**Enums** : `status` — valeur observée `SUCCESS` (`payment.service.ts`) ; pas de liste exhaustive trouvée dans le code.
**Relations** : 1-1 vers `Payment`.
**Contraintes** : `paymentId` unique.
**Cycle de vie** : `completedAt` marque la clôture.

#### Refund (`@@map("refunds")`)
**Définition** : remboursement d'un paiement (ex. désistement du candidat).
**Champs clés** : `paymentId` (obligatoire, `@unique`, FK, cascade) ; `amount` (obligatoire) ; `reason` (optionnel, ex. « Désistement du candidat » observé dans `seed.ts`) ; `status` (obligatoire, valeur observée `COMPLETED`) ; `processedAt` (optionnel).
**Enums** : `status` — valeur observée `COMPLETED` uniquement (pas d'enum exhaustif trouvé dans le code).
**Relations** : 1-1 vers `Payment`.
**Contraintes** : `paymentId` unique.
**Cycle de vie** : `processedAt` marque le traitement effectif.

### Domaine — Personnel enseignant

#### Teacher (`@@map("teachers")`)
**Définition** : profil d'un professeur, indépendant de son ou ses établissements d'affectation (un même professeur peut enseigner dans plusieurs écoles).
**Champs clés** : `userId` (obligatoire, `@unique`, FK `User`, cascade) ; `firstName`, `lastName`, `avatarUrl`, `phone` (tous optionnels).
**Enums** : aucun.
**Relations** : 1-1 vers `User` ; 1-N vers `TeacherSchool`, `Course`, `TeacherAssignment`, `CourseSlot`, `TeacherAvailability`, `TeacherTravelBuffer`.
**Contraintes** : `userId` unique.
**Cycle de vie** : pas de statut ni soft-delete propre au modèle.

#### TeacherSchool (`@@map("teacher_schools")`)
**Définition** : affectation d'un professeur à une école, avec une spécialité propre à cet établissement.
**Champs clés** : `teacherId`, `schoolId` (obligatoires, FK, cascade) ; `department`, `specialty` (optionnels) ; `isActive` (obligatoire, défaut `true`).
**Enums** : aucun.
**Relations** : N-1 vers `Teacher`, `School` ; 1-N vers `TeacherSchoolSubject`.
**Contraintes** : `@@unique([teacherId, schoolId])` — une seule affectation par couple prof/école ; index `[schoolId, isActive]`.
**Cycle de vie** : `isActive`.

#### SchoolSubject (`@@map("school_subjects")`)
**Définition** : matière enseignée, propre à une école (ex. « Informatique » à l'ESPA).
**Champs clés** : `name` (obligatoire) ; `isActive` (obligatoire, défaut `true`).
**Enums** : aucun.
**Relations** : N-1 vers `School` ; 1-N vers `TeacherSchoolSubject`, `Course`, `SubjectRequirement`.
**Contraintes** : `@@unique([schoolId, name])`.
**Cycle de vie** : `isActive`.

#### TeacherSchoolSubject (`@@map("teacher_school_subjects")`)
**Définition** : qualification d'un professeur pour enseigner une matière donnée dans l'école où il est affecté.
**Champs clés** : `teacherSchoolId`, `subjectId` (obligatoires, FK, cascade).
**Enums** : aucun.
**Relations** : N-1 vers `TeacherSchool`, `SchoolSubject`.
**Contraintes** : `@@unique([teacherSchoolId, subjectId])`.
**Cycle de vie** : aucun.

### Domaine — Moteur de planification

#### AcademicYear (`@@map("academic_years")`)
**Définition** : année scolaire centrale, créée par l'administrateur plateforme, référence pour les classes et besoins horaires — **distincte de `SchoolAcademicYear`** (par école, orientée admissions), comme précisé en commentaire dans le schéma.
**Champs clés** : `label` (obligatoire, `@unique`) ; `startDate`, `endDate` (obligatoires) ; `isCurrent` (obligatoire, défaut `false`).
**Enums** : aucun.
**Relations** : 1-N vers `SchoolClass`, `SubjectRequirement`.
**Contraintes** : `label` unique.
**Cycle de vie** : `isCurrent`.

#### Room (`@@map("rooms")`)
**Définition** : salle physique d'un établissement, utilisée par le moteur de planification.
**Champs clés** : `name` (obligatoire) ; `capacity` (optionnel) ; `type` (obligatoire, défaut `"STANDARD"`) ; `isActive` (obligatoire, défaut `true`).
**Enums** : `type` — `STANDARD | LAB | AMPHI | SPORT` (constante `ROOM_TYPES`, `backend/src/modules/school/dto/room.dto.ts`).
**Relations** : N-1 vers `School`.
**Contraintes** : `@@unique([schoolId, name])` ; index `[schoolId, isActive]`.
**Cycle de vie** : `isActive`.

#### SchoolClass (`@@map("school_classes")`)
**Définition** : classe/promotion d'une école pour une année scolaire donnée, éventuellement rattachée à une filière.
**Champs clés** : `name` (obligatoire) ; `academicYearId` (obligatoire, FK) ; `programId` (optionnel, FK, `onDelete: SetNull`) ; `level`, `studentCount` (optionnels) ; `isActive` (obligatoire, défaut `true`).
**Enums** : aucun.
**Relations** : N-1 vers `School`, `AcademicYear`, `SchoolProgram` ; 1-N vers `SubjectRequirement`.
**Contraintes** : `@@unique([schoolId, academicYearId, name])` ; index `[schoolId, academicYearId]`.
**Cycle de vie** : `isActive`.

#### SubjectRequirement (`@@map("subject_requirements")`)
**Définition** : besoin horaire d'une classe pour une matière (« cette classe a besoin de N h/semaine de cette matière »), volontairement découplé de l'affectation d'un professeur pour pouvoir exprimer les besoins avant de savoir qui les couvrira (commentaire schéma).
**Champs clés** : `classId`, `subjectId`, `academicYearId` (obligatoires, FK) ; `hoursPerWeek` (obligatoire, `Int`).
**Enums** : aucun.
**Relations** : N-1 vers `School`, `AcademicYear`, `SchoolClass`, `SchoolSubject` ; 1-1 optionnelle vers `TeacherAssignment` et vers `Course`.
**Contraintes** : `@@unique([classId, subjectId])` — un seul besoin par (classe, matière).
**Cycle de vie** : aucun statut propre ; sa couverture est indiquée par la présence ou non d'un `TeacherAssignment` lié.

#### TeacherAssignment (`@@map("teacher_assignments")`)
**Définition** : professeur retenu pour couvrir un besoin horaire donné ; le professeur doit déjà être qualifié pour la matière dans cette école (`TeacherSchoolSubject`), vérification faite en service (commentaire schéma).
**Champs clés** : `subjectRequirementId` (obligatoire, `@unique`, FK, cascade) ; `teacherId` (obligatoire, FK, `onDelete: Restrict` — empêche de supprimer un professeur encore affecté).
**Enums** : aucun.
**Relations** : 1-1 vers `SubjectRequirement` ; N-1 vers `Teacher`.
**Contraintes** : `subjectRequirementId` unique (un seul professeur par besoin).
**Cycle de vie** : aucun statut, création = affectation définitive jusqu'à suppression.

#### SchoolTimeSlot (`@@map("school_time_slots")`)
**Définition** : créneau horaire valide dans la grille propre à une école, indépendant de l'année scolaire (la grille change rarement, commentaire schéma).
**Champs clés** : `dayOfWeek` (obligatoire, `Int`) ; `startTime`, `endTime` (obligatoires, chaînes) ; `label` (optionnel) ; `isActive` (obligatoire, défaut `true`).
**Enums** : aucun.
**Relations** : N-1 vers `School`.
**Contraintes** : `@@unique([schoolId, dayOfWeek, startTime, endTime])` ; index `[schoolId, isActive]`.
**Cycle de vie** : `isActive`.

#### TeacherAvailability (`@@map("teacher_availabilities")`)
**Définition** : indisponibilité déclarée par un professeur — récurrente (`dayOfWeek`) ou ponctuelle (`date`) ; par défaut un professeur est considéré disponible, ce modèle ne liste que les **exceptions** (commentaire schéma).
**Champs clés** : `dayOfWeek` (optionnel), `date` (optionnel) — l'un ou l'autre selon le type d'indisponibilité ; `startTime`, `endTime` (obligatoires) ; `reason` (optionnel).
**Enums** : aucun.
**Relations** : N-1 vers `Teacher`.
**Contraintes** : index `[teacherId]`.
**Cycle de vie** : aucun.

#### TeacherTravelBuffer (`@@map("teacher_travel_buffers")`)
**Définition** : temps de trajet minimal déclaré par un professeur entre deux de ses écoles d'affectation, utilisé par le moteur de planification pour éviter des créneaux consécutifs infaisables.
**Champs clés** : `schoolAId`, `schoolBId` (obligatoires, FK, toujours normalisés par ordre alphabétique en service, commentaire schéma) ; `minutesBuffer` (obligatoire, `Int`).
**Enums** : aucun.
**Relations** : N-1 vers `Teacher`, `School` (x2, relations nommées `TravelBufferSchoolA`/`TravelBufferSchoolB`).
**Contraintes** : `@@unique([teacherId, schoolAId, schoolBId])`.
**Cycle de vie** : aucun.

### Domaine — Cours & contenus pédagogiques

#### Course (`@@map("courses")`)
**Définition** : cours dispensé par un professeur dans une école, avec ses paramètres pédagogiques et de communication.
**Champs clés** : `code`, `title`, `level` (obligatoires) ; `description`, `subjectId`, `programId`, `programLevel`, `group`, `room`, `schedule`, `welcomeMessage` (optionnels) ; `credits` (obligatoire, défaut `0`) ; `isPublished` (obligatoire, défaut `true`) ; `allowGroupMessages` (obligatoire, défaut `true`) ; `notifyOnPublish` (obligatoire, défaut `true`) ; `subjectRequirementId` (optionnel, `@unique`, FK) — renseigné uniquement pour les cours créés automatiquement par le moteur de génération (Phase 3), permet de retrouver/compléter le cours d'un besoin sans le dupliquer (commentaire schéma).
**Enums** : aucun (`level` est un texte libre, ex. « Licence 3 », « Master 1 »).
**Relations** : N-1 vers `School`, `Teacher` (`onDelete: Restrict`), `SchoolSubject` (optionnel), `SchoolProgram` (optionnel), `SubjectRequirement` (optionnel, 1-1) ; 1-N vers `CourseChapter`, `CourseEnrollment`, `Evaluation`, `Assignment`, `CourseSlot`, `Announcement`.
**Contraintes** : `@@unique([schoolId, code, group])` ; index `[teacherId, isPublished]`.
**Cycle de vie** : `isPublished` (brouillon/publié).

#### CourseSlot (`@@map("course_slots")`)
**Définition** : créneau hebdomadaire récurrent effectivement occupé par un cours, dénormalisant `teacherId` depuis `Course` pour permettre une contrainte anti-double-réservation au niveau base (commentaire schéma).
**Champs clés** : `dayOfWeek` (obligatoire, `Int`) ; `startTime`, `endTime`, `room` (obligatoires).
**Enums** : aucun.
**Relations** : N-1 vers `Course` (cascade), `Teacher` (cascade).
**Contraintes** : `@@unique([courseId, dayOfWeek, startTime, endTime, room])` ; index `[courseId]`, `[dayOfWeek, room, startTime, endTime]` (anti-collision salle), `[teacherId, dayOfWeek]` (anti-collision professeur).
**Cycle de vie** : aucun.

#### CourseEnrollment (`@@map("course_enrollments")`)
**Définition** : inscription d'un étudiant à un cours précis (distincte de `StudentEnrollment`, qui inscrit l'étudiant à l'école).
**Champs clés** : `courseId`, `studentId` (obligatoires, FK, cascade).
**Enums** : aucun.
**Relations** : N-1 vers `Course`, `Student`.
**Contraintes** : `@@unique([courseId, studentId])` ; index `[studentId]`.
**Cycle de vie** : aucun.

#### CourseChapter (`@@map("course_chapters")`)
**Définition** : chapitre d'un cours, unité de structuration séquentielle du contenu pédagogique.
**Champs clés** : `title` (obligatoire) ; `description` (optionnel) ; `position` (obligatoire, `Int`) ; `isPublished` (obligatoire, défaut `false`) ; `publishedAt` (optionnel).
**Enums** : aucun.
**Relations** : N-1 vers `Course` (cascade) ; 1-N vers `CourseResource`.
**Contraintes** : `@@unique([courseId, position])` — un seul chapitre par position dans un cours.
**Cycle de vie** : `isPublished` (brouillon/publié).

#### CourseResource (`@@map("course_resources")`)
**Définition** : ressource pédagogique (support, vidéo, slides…) rattachée à un chapitre de cours.
**Champs clés** : `title`, `url`, `type` (obligatoires).
**Enums** : `type` non formalisé côté DTO ; valeurs observées dans `seed.ts` : `PDF`, `SLIDES`, `VIDEO`.
**Relations** : N-1 vers `CourseChapter` (cascade).
**Contraintes** : index `[chapterId]`.
**Cycle de vie** : aucun.

#### Evaluation (`@@map("evaluations")`)
**Définition** : épreuve notée programmée dans un cours (contrôle continu, examen, TP…).
**Champs clés** : `title`, `type` (obligatoires) ; `scheduledAt` (optionnel) ; `coefficient` (obligatoire, défaut `1`).
**Enums** : `type` non formalisé côté DTO ; valeurs observées dans `seed.ts` : `CONTROLE_CONTINU`, `EXAMEN`, `TP`.
**Relations** : N-1 vers `Course` (cascade) ; 1-N vers `Grade`.
**Contraintes** : index `[courseId, scheduledAt]`.
**Cycle de vie** : aucun statut, `scheduledAt` distingue passé/à venir.

#### Assignment (`@@map("assignments")`)
**Définition** : devoir à rendre par les étudiants d'un cours.
**Champs clés** : `title` (obligatoire) ; `instructions`, `dueAt`, `publishedAt` (optionnels).
**Enums** : aucun.
**Relations** : N-1 vers `Course` (cascade) ; 1-N vers `AssignmentSubmission`.
**Contraintes** : index `[courseId, dueAt]`.
**Cycle de vie** : `publishedAt` (brouillon/publié) + `dueAt` (échéance).

#### AssignmentSubmission (`@@map("assignment_submissions")`)
**Définition** : rendu d'un devoir par un étudiant, avec correction (note et retour) optionnels.
**Champs clés** : `contentUrl` (optionnel) ; `submittedAt` (obligatoire, défaut `now()`) ; `grade` (optionnel) ; `feedback` (optionnel).
**Enums** : aucun.
**Relations** : N-1 vers `Assignment` (cascade), `Student` (cascade).
**Contraintes** : `@@unique([assignmentId, studentId])` — un seul rendu par étudiant et par devoir.
**Cycle de vie** : `grade`/`feedback` renseignés = corrigé, sinon en attente de correction.

#### Grade (`@@map("grades")`)
**Définition** : note obtenue par un étudiant à une évaluation précise.
**Champs clés** : `value` (obligatoire, `Float`) ; `comment` (optionnel).
**Enums** : aucun.
**Relations** : N-1 vers `Evaluation` (cascade), `Student` (cascade).
**Contraintes** : `@@unique([evaluationId, studentId])` — une seule note par étudiant et par évaluation ; index `[studentId]`.
**Cycle de vie** : aucun.

### Domaine — Communication

#### Notification (`@@map("notifications")`)
**Définition** : notification envoyée à un utilisateur (email, SMS, push ou in-app).
**Champs clés** : `type`, `title`, `body` (obligatoires) ; `data` (optionnel, `Json`) ; `isRead` (obligatoire, défaut `false`) ; `readAt`, `sentAt`, `deliveredAt` (optionnels).
**Enums** : `type` — `EMAIL | SMS | PUSH | IN_APP` (enum TS `NotificationType`, `backend/src/modules/notification/dto/send-notification.dto.ts`) ; un enum `NotificationPriority` (`LOW | MEDIUM | HIGH | CRITICAL`) existe côté DTO d'envoi mais **n'est pas un champ du modèle `Notification`** (paramètre de traitement, non persisté).
**Relations** : N-1 vers `User` (cascade) ; 1-1 optionnelle vers `AnnouncementRecipient`.
**Contraintes** : index `[userId, isRead]`.
**Cycle de vie** : `isRead` (lu/non lu) + `sentAt`/`deliveredAt` (statut d'envoi/livraison).

#### Announcement (`@@map("announcements")`)
**Définition** : annonce diffusée par une école ou un professeur à un public ciblé (tous les étudiants, des classes précises, les étudiants d'un cours…).
**Champs clés** : `authorId` (obligatoire, **texte libre, pas de FK réelle vers `User`**) ; `title`, `body`, `targetType` (obligatoires) ; `imageUrl` (optionnel) ; `courseId` (optionnel, FK, `onDelete: SetNull`) ; `targetClasses` (tableau de chaînes, défaut `[]`).
**Enums** : `targetType` — `ALL_STUDENTS | CLASSES | STUDENTS | TEACHERS | EVERYONE` (constante `IsIn(...)`, `backend/src/modules/school/dto/create-announcement.dto.ts`) ; une valeur supplémentaire `COURSE_STUDENTS` est utilisée par le module d'enseignement (`backend/src/modules/teaching/teaching.service.ts`) pour les annonces liées à un cours précis.
**Relations** : N-1 vers `School` (cascade), `Course` (optionnel) ; 1-N vers `AnnouncementRecipient`.
**Contraintes** : index `[schoolId, createdAt]`, `[courseId, createdAt]`.
**Cycle de vie** : aucun statut, diffusion immédiate à la création.

#### AnnouncementRecipient (`@@map("announcement_recipients")`)
**Définition** : trace de diffusion d'une annonce à un destinataire précis, reliée à la notification effectivement générée pour lui.
**Champs clés** : `userId` (obligatoire, texte libre — pas de FK Prisma vers `User` malgré le nom) ; `notificationId` (obligatoire, `@unique`, FK, cascade).
**Enums** : aucun.
**Relations** : N-1 vers `Announcement` (cascade) ; 1-1 vers `Notification`.
**Contraintes** : `@@unique([announcementId, userId])` — un destinataire ne reçoit qu'une fois la même annonce ; `notificationId` unique.
**Cycle de vie** : aucun.

#### Message (`@@map("messages")`)
**Définition** : message privé échangé entre deux utilisateurs, rattaché à une conversation directe.
**Champs clés** : `senderId`, `recipientId` (obligatoires, FK, cascade, relations nommées `SentMessages`/`ReceivedMessages`) ; `subject` (optionnel) ; `body` (obligatoire) ; `isRead` (obligatoire, défaut `false`) ; `readAt` (optionnel).
**Enums** : aucun.
**Relations** : N-1 vers `Conversation` (cascade), `User` (émetteur et destinataire) ; 1-N vers `MessageAttachment`.
**Contraintes** : index `[recipientId, isRead, createdAt]`, `[conversationId, createdAt]`, `[senderId, createdAt]`.
**Cycle de vie** : `isRead`.

#### MessageAttachment (`@@map("message_attachments")`)
**Définition** : pièce jointe à un message privé.
**Champs clés** : `url`, `fileName`, `mimeType`, `size`, `kind` (obligatoires).
**Enums** : `kind` — type TS `MessageAttachmentKind` = `'IMAGE' | 'DOCUMENT' | 'VIDEO'` (`backend/src/common/services/storage.service.ts`), avec des limites de taille associées (5 Mo pour image/document, 20 Mo pour vidéo).
**Relations** : N-1 vers `Message` (cascade).
**Contraintes** : index `[messageId]`.
**Cycle de vie** : aucun.

#### Conversation (`@@map("conversations")`)
**Définition** : fil de discussion directe entre deux utilisateurs, identifié par une clé combinant les deux identifiants.
**Champs clés** : `directKey` (obligatoire, `@unique`) — clé technique déterministe (paire d'utilisateurs triée) ; `lastMessageAt` (obligatoire, défaut `now()`).
**Enums** : aucun.
**Relations** : 1-N vers `Message` ; N-N vers `User` via `ConversationParticipant`.
**Contraintes** : `directKey` unique ; index `[lastMessageAt]`.
**Cycle de vie** : `lastMessageAt` sert de tri d'activité récente.

#### ConversationParticipant (`@@map("conversation_participants")`)
**Définition** : participation d'un utilisateur à une conversation, avec son dernier horodatage de lecture (base du compteur de messages non lus).
**Champs clés** : `lastReadAt` (optionnel).
**Enums** : aucun.
**Relations** : N-1 vers `Conversation` (cascade), `User` (cascade).
**Contraintes** : `@@id([conversationId, userId])` — un utilisateur participe une fois à une conversation ; index `[userId, conversationId]`.
**Cycle de vie** : `lastReadAt`.

#### NotificationTemplate (`@@map("notification_templates")`)
**Définition** : modèle réutilisable de notification (sujet, corps, variables), a priori pour l'envoi automatisé — **aucun usage trouvé dans le code des modules backend** au moment de l'analyse (modèle possiblement en attente d'implémentation).
**Champs clés** : `name` (obligatoire, `@unique`) ; `subject` (optionnel) ; `body`, `type` (obligatoires) ; `variables` (tableau de chaînes).
**Enums** : `type` non confirmé par le code (probable alignement avec `NotificationType` par analogie, non vérifié).
**Relations** : aucune.
**Contraintes** : `name` unique.
**Cycle de vie** : aucun.

### Domaine — Ministère / conformité / reporting

#### MinistryReport (`@@map("ministry_reports")`)
**Définition** : rapport statistique généré pour le Ministère de tutelle (national, régional ou sectoriel).
**Champs clés** : `name` (obligatoire) ; `description` (optionnel) ; `type`, `period` (obligatoires) ; `periodStart`, `periodEnd` (obligatoires) ; `data` (obligatoire, `Json`) ; `fileUrl`, `generatedBy` (optionnels, `generatedBy` en texte libre) ; `generatedAt` (obligatoire, défaut `now()`).
**Enums** : `type` — `NATIONAL | REGIONAL | SECTORIAL` (enum TS `ReportType`) ; `period` — `DAILY | WEEKLY | MONTHLY | QUARTERLY | ANNUAL` (enum TS `ReportPeriod`) ; deux enums complémentaires côté DTO de génération : `ExportFormat` (`PDF | EXCEL | CSV | JSON`) et `ReportSection` (`summary | applications | schools | geography | compliance`) — tous dans `backend/src/modules/ministry/dto/report-request.dto.ts`.
**Relations** : aucune relation Prisma directe.
**Contraintes** : aucune contrainte d'unicité.
**Cycle de vie** : aucun statut, `generatedAt` figeant la génération.

#### ComplianceCheck (`@@map("compliance_checks")`)
**Définition** : contrôle de conformité réalisé sur une école par le Ministère/l'administration GET.
**Champs clés** : `checkType` (obligatoire) ; `status` (obligatoire) ; `score` (optionnel) ; `remarks` (optionnel) ; `checkedBy` (optionnel, texte libre) ; `checkedAt` (obligatoire, défaut `now()`).
**Enums** : `status` — `PASSED | FAILED | PENDING` (enum TS `ComplianceStatus`, `backend/src/modules/ministry/dto/compliance-update.dto.ts`).
**Relations** : N-1 vers `School` (cascade).
**Contraintes** : index `[schoolId, checkedAt]`.
**Cycle de vie** : `status` (cycle PENDING → PASSED/FAILED).

### Domaine — Technique / transverse

#### AuditLog (`@@map("audit_logs")`)
**Définition** : journal d'audit des actions effectuées sur la plateforme (sécurité, traçabilité réglementaire).
**Champs clés** : `userId` (optionnel, FK, `onDelete: SetNull`) ; `action`, `resource` (obligatoires) ; `resourceId` (optionnel) ; `before`, `after` (optionnels, `Json`, état avant/après) ; `ip`, `userAgent` (optionnels) ; `status` (obligatoire) ; `errorMessage` (optionnel).
**Enums** : `action` — enum TS `AuditAction` : `LOGIN, LOGOUT, REGISTER, CREATE, UPDATE, DELETE, VIEW, PAYMENT, EXPORT, IMPORT` ; `resource` — enum TS `AuditResource` : `user, student, school, offer, application, payment, report, notification, system` (les deux dans `backend/src/modules/audit/dto/audit-log.dto.ts`) ; `status` — valeurs observées dans le code (`backend/src/modules/audit/audit.interceptor.ts`) : `SUCCESS`, `FAILED`.
**Relations** : N-1 optionnelle vers `User`.
**Contraintes** : index `[userId, createdAt]`.
**Cycle de vie** : événementiel, pas de statut évolutif (log immuable).

#### Image (`@@map("images")`)
**Définition** : fichier image générique (avatar, logo, illustration, bannière) rattaché de façon polymorphe à une entité de la plateforme.
**Champs clés** : `url`, `type`, `entityType`, `mimeType`, `size` (obligatoires) ; `entityId` (optionnel, référence polymorphe non contrainte par FK) ; `isPublic` (obligatoire, défaut `true`).
**Enums** :
- `type` — `AVATAR | LOGO | ILLUSTRATION | BANNER` (commentaire schéma **et** enum TS `ImageType`, `backend/src/common/services/storage.service.ts`).
- `entityType` — le commentaire du schéma liste `STUDENT, SCHOOL, ADMIN, MINISTRY, OFFER, SYSTEM`, mais l'enum TS `ImageEntityType` réellement utilisé en code en compte davantage : `STUDENT, TEACHER, SCHOOL, ADMIN, MINISTRY, OFFER, SYSTEM, ANNOUNCEMENT, LANDING_NEWS, FINANCIAL_PARTNER`. **Écart documenté** entre le commentaire du schéma (6 valeurs) et le code réel (10 valeurs) — point à clarifier dans l'EDB.
**Relations** : aucune relation Prisma (association par `entityType`/`entityId`, non typée en base).
**Contraintes** : index `[entityType, entityId]`.
**Cycle de vie** : `isPublic` (public/privé, ex. lien signé S3 pour documents protégés).

#### SystemConfig (`@@map("system_configs")`)
**Définition** : paramètre de configuration global de la plateforme, sous forme clé/valeur.
**Champs clés** : `key` (obligatoire, `@unique`) ; `value` (obligatoire, `Json`) ; `description` (optionnel) ; `isEncrypted` (obligatoire, défaut `false`) — indique que `value` doit être considérée comme un secret chiffré.
**Enums** : aucun.
**Relations** : aucune.
**Contraintes** : `key` unique.
**Cycle de vie** : aucun statut.

---

## 3. Liste complète des enums (formels et fonctionnels)

Aucun `enum` Prisma natif n'existe dans `schema.prisma`. La liste ci-dessous regroupe, avec leur source exacte, toutes les énumérations fonctionnelles identifiées :

| Enum / champ | Modèle(s) concerné(s) | Valeurs | Source |
|---|---|---|---|
| `gender` | User | MALE, FEMALE | commentaire `schema.prisma` L31 |
| `theme` | User | light, dark, system | commentaire `schema.prisma` L32 |
| `StudentEnrollment.status` | StudentEnrollment | ACTIVE, WITHDRAWN, GRADUATED | commentaire `schema.prisma` L124 |
| `SchoolType` | School | PUBLIC, PRIVATE (défaut PRIVATE) | `modules/school/dto/create-school.dto.ts` |
| `COMPETITION_STATUSES` | Competition | PLANNED, OPEN, IN_PROGRESS, COMPLETED, CANCELLED | `modules/competition/dto/create-competition.dto.ts` |
| `FINANCIAL_PARTNER_TYPES` | FinancialPartner | BANK, MOBILE_MONEY, INSURANCE, SCHOLARSHIP, OTHER | `modules/financial-partner/dto/create-financial-partner.dto.ts` |
| `ROOM_TYPES` | Room | STANDARD, LAB, AMPHI, SPORT | `modules/school/dto/room.dto.ts` |
| Document `type` | Document | CV, LETTER, ID, DIPLOMA, PHOTO, OTHER | `modules/student/dto/upload-document.dto.ts` |
| `ApplicationStatus` | Application, ApplicationTimeline | PENDING, UNDER_REVIEW, PRESELECTED, TEST_SCHEDULED, TEST_COMPLETED, INTERVIEW_SCHEDULED, INTERVIEW_COMPLETED, ACCEPTED, REJECTED, WAITLISTED, ENROLLED, CANCELLED | `modules/application/dto/update-application-status.dto.ts` (+ matrice de transitions `APPLICATION_STATUS_TRANSITIONS`) |
| Payment `method` | Payment | ORANGE_MONEY, MVOLA, CARD, BANK_TRANSFER | `modules/payment/dto/initiate-payment.dto.ts` |
| Payment `status` | Payment | PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED (EXPIRED prévu par le champ `expiresAt` mais non implémenté) | `modules/payment/payment.service.ts`, interface `PaymentProvider`, `seed.ts` |
| Transaction `status` | Transaction | SUCCESS (seule valeur observée) | `modules/payment/payment.service.ts` |
| Refund `status` | Refund | COMPLETED (seule valeur observée) | `seed.ts` |
| Evaluation `type` | Evaluation | CONTROLE_CONTINU, EXAMEN, TP (non formalisé côté DTO) | `seed.ts` |
| CourseResource `type` | CourseResource | PDF, SLIDES, VIDEO (non formalisé côté DTO) | `seed.ts` |
| Announcement `targetType` | Announcement | ALL_STUDENTS, CLASSES, STUDENTS, TEACHERS, EVERYONE, COURSE_STUDENTS | `modules/school/dto/create-announcement.dto.ts` + `modules/teaching/teaching.service.ts` |
| `MessageAttachmentKind` | MessageAttachment | IMAGE, DOCUMENT, VIDEO | `common/services/storage.service.ts` |
| `NotificationType` | Notification | EMAIL, SMS, PUSH, IN_APP | `modules/notification/dto/send-notification.dto.ts` |
| `NotificationPriority` | (paramètre d'envoi, non persisté sur Notification) | LOW, MEDIUM, HIGH, CRITICAL | `modules/notification/dto/send-notification.dto.ts` |
| `ReportType` | MinistryReport | NATIONAL, REGIONAL, SECTORIAL | `modules/ministry/dto/report-request.dto.ts` |
| `ReportPeriod` | MinistryReport | DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUAL | `modules/ministry/dto/report-request.dto.ts` |
| `ExportFormat` | (paramètre de génération de rapport) | PDF, EXCEL, CSV, JSON | `modules/ministry/dto/report-request.dto.ts` |
| `ReportSection` | (paramètre de génération de rapport) | summary, applications, schools, geography, compliance | `modules/ministry/dto/report-request.dto.ts` |
| `ComplianceStatus` | ComplianceCheck | PASSED, FAILED, PENDING | `modules/ministry/dto/compliance-update.dto.ts` |
| `AuditAction` | AuditLog `action` | LOGIN, LOGOUT, REGISTER, CREATE, UPDATE, DELETE, VIEW, PAYMENT, EXPORT, IMPORT | `modules/audit/dto/audit-log.dto.ts` |
| `AuditResource` | AuditLog `resource` | user, student, school, offer, application, payment, report, notification, system | `modules/audit/dto/audit-log.dto.ts` |
| AuditLog `status` | AuditLog | SUCCESS, FAILED | `modules/audit/audit.interceptor.ts` |
| `ImageType` | Image `type` | AVATAR, LOGO, ILLUSTRATION, BANNER | commentaire `schema.prisma` L1049 + `common/services/storage.service.ts` |
| `ImageEntityType` | Image `entityType` | STUDENT, TEACHER, SCHOOL, ADMIN, MINISTRY, OFFER, SYSTEM, ANNOUNCEMENT, LANDING_NEWS, FINANCIAL_PARTNER (le commentaire du schéma n'en liste que 6, sans TEACHER/ANNOUNCEMENT/LANDING_NEWS/FINANCIAL_PARTNER — écart à clarifier) | commentaire `schema.prisma` L1050 + `common/services/storage.service.ts` |
| SchoolRequirement `type` | SchoolRequirement | DOCUMENT (seule valeur d'exemple, non formalisée) | `modules/school/dto/school-admin-actions.dto.ts` |
| LandingNewsPost `type` | LandingNewsPost | ACTUALITÉ (défaut ; champ libre ≤ 40 caractères, non formalisé) | `schema.prisma` défaut + `modules/landing/dto/landing-news.dto.ts` |
| SchoolSubscription `plan` / `paymentStatus` | SchoolSubscription | aucune valeur ni enum trouvés dans le code (modèle non implémenté côté service) | — |
| NotificationTemplate `type` | NotificationTemplate | non confirmé par le code (aucun usage trouvé) | — |

---

## 4. Résumé de `backend/prisma/seed.ts`

Le script est protégé en production (`NODE_ENV=production` + `ALLOW_DEMO_SEED !== 'true'` → il lève une erreur), donc explicitement réservé à la démo/au développement.

**5 rôles créés** (`Role.upsert`) : `STUDENT` (rôle par défaut), `ADMIN_GET`, `SCHOOL_ADMIN`, `MINISTRY`, `TEACHER`.

**Établissements** : 1 école « ancre » (ESPA, slug `espa`) + 5 établissements supplémentaires (IST Mahajanga, INSCAE Antananarivo, Université de Toamasina, Université de Fianarantsoa, ISCAM Antananarivo) → **6 écoles** au total, toutes `PUBLIC` sauf ISCAM (`PRIVATE`).

**Comptes de démonstration nommés** (avec mot de passe en clair dans le script) :
- Admin GET : `admin@get.mg` / `Admin123!`
- School Admin (ESPA) : `schooladmin@get.mg` / `Mihaja@25!` (permissions : `OFFERS_MANAGE`, `STUDENTS_MANAGE`, `PAYMENTS_VIEW`)
- Ministère : `ministere@mesupres.gov.mg` / `Ministere123!`
- 2 professeurs nommés + **9 professeurs supplémentaires** (total **11 professeurs**), mot de passe commun `Professeur123!`
- Étudiant candidat test : `test@gmail.com` / `Student123!`
- Candidate non inscrite : `candidat@get.mg` / `Candidat123!`
- Étudiant inscrit : `enrolled@test.com` / `Enrolled123!`
- 9 étudiants nommés inscrits (mot de passe `Etudiant123!`)
- Cohortes générées : **étudiants inscrits supplémentaires** (mot de passe `Etudiant2026!`, emails au format `etu.<ecole>.<cursus>.<niveau>.<n>@get.mg`) et **55 candidats non inscrits** générés avec profils complets et candidatures (mot de passe `Candidat2026!`, emails `<prenom>.<nom><n>@get.mg`)

**Volumes générés (comptage effectif en fin de script)** : nombre d'écoles, de professeurs, de « types de cours » (~50, dont INFO101…COM401), d'étudiants inscrits (~10 nommés + cohortes générées), de candidats non inscrits (~55), d'offres de formation (4 initiales + 17 supplémentaires = **21 offres**), d'inscriptions aux cours, de notes et de candidatures sont affichés via `console.log` (comptage dynamique `prisma.*.count()`, pas de constante fixe).

**Autres données de démo créées** : filières (`SchoolProgram`) et années académiques (`SchoolAcademicYear`, labels `2025-2026` et `2026-2027`, cette dernière `isCurrent`) pour les 6 écoles ; matières (`SchoolSubject`) et affectations matière↔professeur (`TeacherSchoolSubject`) ; cours, créneaux (`CourseSlot`, avec logique anti-conflit horaire par professeur), chapitres et ressources (`CourseChapter`/`CourseResource`) ; évaluations et notes (`Evaluation`/`Grade`, contrôle continu noté, examen final laissé « à venir ») ; devoirs et rendus (`Assignment`/`AssignmentSubmission`, certains volontairement non corrigés) ; annonces de cours et d'école (`Announcement`) avec notifications associées ; documents étudiants (`Document`, couverture large sur tous les étudiants/candidats) ; paiements simulés avec transactions et remboursements (`Payment`/`Transaction`/`Refund`, statuts dérivés du statut de la candidature) ; messages privés de démonstration (`Message`/`Conversation`, insérés en SQL brut via `$executeRaw`).

**Modèles non alimentés par le seed** (aucune trace de `prisma.<model>.create/upsert` trouvée) : `FinancialPartner`, `Competition`, `LandingNewsPost`, `MinistryReport`, `ComplianceCheck`, `SystemConfig`, `AuditLog`, `Image`, `NotificationTemplate`, `SchoolSubscription`, `SchoolRequirement`/`OfferRequirement`.

---

## 5. Migrations chronologiques (`backend/prisma/migrations/`)

26 migrations (+ `migration_lock.toml`, provider `postgresql`), du 17/07/2026 au 04/08/2026 :

1. `20260717054435_init` — schéma initial de la plateforme.
2. `20260720091622_add_enrolled_school_to_student` — première modélisation de l'inscription (rattachement direct école/programme/année sur `Student`, avant refonte en `StudentEnrollment`).
3. `20260727100000_add_messages` — introduction de la messagerie privée (`Message`).
4. `20260727113000_add_message_conversations` — ajout du regroupement en conversations (`Conversation`, `ConversationParticipant`).
5. `20260728160000_add_pedagogical_content` — arrivée des contenus de cours (chapitres/ressources/évaluations/devoirs).
6. `20260728170000_add_teacher_school_assignments` — affectation des professeurs aux écoles (`TeacherSchool`).
7. `20260729120000_add_school_requirements` — exigences documentaires des écoles pour les offres.
8. `20260729210000_add_diploma_to_school_requirements` — ajout du diplôme concerné à une exigence.
9. `20260730140000_add_course_slots` — créneaux hebdomadaires effectifs des cours.
10. `20260730170000_add_announcements` — module d'annonces.
11. `20260730190000_add_school_programs_and_academic_years` — introduction des filières et années académiques par école.
12. `20260730200000_add_school_subjects_and_course_structure` — matières par école et structuration des cours.
13. `20260730210000_link_offer_to_program_and_enrollment_status` — rattachement d'une offre à une filière + statut d'inscription.
14. `20260730220000_add_course_announcements` — annonces liées à un cours précis.
15. `20260730230000_add_teacher_profile_fields` — enrichissement du profil professeur.
16. `20260731084824_add_user_theme_preference` — préférence de thème utilisateur.
17. `20260731131452_add_course_settings_fields` — paramètres de communication du cours (messages de groupe, notifications de publication…).
18. `20260801130000_add_competitions` — module concours.
19. `20260801140000_add_financial_partners` — module partenaires financiers.
20. `20260801150000_message_attachments_optional_subject` — pièces jointes aux messages + objet optionnel.
21. `20260801160000_add_landing_cms_and_announcement_photos` — CMS de la page vitrine (actualités) et photos d'annonces.
22. `20260802090000_add_scheduling_foundations` — fondations du moteur de planification (AcademicYear, Room, SchoolClass, SubjectRequirement, TeacherAssignment, SchoolTimeSlot).
23. `20260802120000_add_teacher_availability_and_travel_buffer` — disponibilités et temps de trajet des professeurs (Phase 2 du moteur de planification).
24. `20260802140000_add_course_subject_requirement_link` — lien entre un cours généré et le besoin horaire qu'il couvre (Phase 3, génération automatique).
25. `20260803140000_add_student_enrollment` — introduction du modèle `StudentEnrollment` (inscriptions multiples par étudiant).
26. `20260803140100_drop_student_enrollment_scalars` — suppression des champs d'inscription unique sur `Student` (bascule définitive vers `StudentEnrollment`), avec exigence d'un script de backfill préalable en production (commentaire dans la migration).
27. `20260804094045_add_session_version` — ajout de `sessionVersion` sur `User` pour la révocation de session côté serveur.

**Lecture fonctionnelle de la chronologie** : le schéma a démarré sur un cœur admissions/paiements classique (init → écoles/offres/candidatures/paiements), puis a ajouté successivement la messagerie, le contenu pédagogique et la gestion des professeurs, avant une refonte notable de l'inscription (un étudiant peut être inscrit dans plusieurs écoles) et la construction d'un véritable moteur de planification des emplois du temps en 3 phases distinctes (fondations → disponibilités/trajets → génération automatique liée aux besoins), pour finir sur des ajouts de sécurité (révocation de session) et de contenu marketing (CMS landing, concours, partenaires financiers).
