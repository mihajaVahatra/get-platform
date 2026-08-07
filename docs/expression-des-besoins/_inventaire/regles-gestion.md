# Catalogue des règles de gestion — Plateforme GET

> Document produit pour l'Expression des Besoins, à partir de l'analyse statique du code source consignée dans `backend-inventory.md`, `data-model-inventory.md` et `roles-auth-inventory.md` (générés le 2026-08-05). Chaque règle est reformulée en langage métier et sourcée par fichier (et ligne quand disponible). Aucune règle n'est inventée : lorsque le comportement exact n'est pas confirmé par le code lu, la règle est marquée **À CONFIRMER** et le doute est explicité en clair plutôt que comblé par une hypothèse.
>
> **Lecture des statuts** :
> - **OBSERVÉE** : comportement lu directement dans le code (service, DTO, schéma) et/ou confirmé par un test.
> - **PARTIELLEMENT OBSERVÉE** : comportement partiellement lu, un aspect (déclencheur exact, portée, acteur) reste incertain.
> - **À CONFIRMER** : point explicitement signalé comme flou ou manquant dans l'inventaire source ; à valider avec le métier ou l'équipe de développement.
>
> **Point de vigilance transverse (non répété ligne à ligne)** : le schéma Prisma ne définit **aucun `enum` natif** — tous les champs `status`/`type`/`gender`/`theme`/`method`/`targetType`, etc. sont des `String` libres en base, sans contrainte `CHECK`, validés uniquement côté API (`class-validator`). Ce constat s'applique potentiellement à toutes les règles ci-dessous portant sur une valeur d'énumération ; il n'est reformulé individuellement que pour les écarts notables et documentés (voir GET-RG-105 à GET-RG-107).

---

## Domaine — Comptes & authentification

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-001 | Comptes & authentification | Un compte est verrouillé automatiquement pendant 15 minutes après 5 tentatives de connexion échouées consécutives. | 5 échecs de connexion consécutifs sur le même compte | Le compteur d'échecs est remis à zéro après une connexion réussie | `auth.service.ts:350-371` | OBSERVÉE |
| GET-RG-002 | Comptes & authentification | Un jeton à usage unique (réinitialisation de mot de passe, défi MFA) ne peut jamais être accepté comme jeton d'accès à l'API. | Présentation d'un JWT porteur d'un champ `type` (`reset`/`mfa_challenge`) sur une route protégée | Aucune | `jwt.strategy.ts:26-31` | OBSERVÉE |
| GET-RG-003 | Comptes & authentification | La déconnexion révoque immédiatement, côté serveur, toutes les sessions actives de l'utilisateur (incrémentation de `sessionVersion`) ; un jeton émis avant reste syntaxiquement valide mais est rejeté. | `POST /auth/logout` | Décodage best-effort du cookie ; route accessible même avec un token déjà expiré | `jwt.strategy.ts:63-68` ; `auth.service.ts:198-203` ; `auth.controller.ts:150-180` | OBSERVÉE |
| GET-RG-004 | Comptes & authentification | Les cookies de session sont `SameSite=Lax` par défaut ; un mode `SameSite=None` (cross-site) est activable explicitement pour les déploiements où frontend et backend sont sur des domaines distincts. | Déploiement multi-domaines (`CROSS_SITE_COOKIES=true`) | Aucune | `auth.controller.ts:48-56` | OBSERVÉE |
| GET-RG-005 | Comptes & authentification | Le secret MFA (TOTP) est chiffré (AES-256-GCM) avant stockage ; en cas d'impossibilité de déchiffrement, le système refuse explicitement plutôt que de comparer une valeur hasardeuse. | Vérification d'un code MFA | Échec de déchiffrement → refus explicite, pas de fallback silencieux | `mfa.service.ts:101-111` | OBSERVÉE |
| GET-RG-006 | Comptes & authentification | La demande de réinitialisation de mot de passe renvoie toujours le même message générique, que le compte existe ou non, pour empêcher l'énumération de comptes. | `POST /auth/forgot-password` | Aucune | `auth.service.ts:211-217` | OBSERVÉE |
| GET-RG-007 | Comptes & authentification | L'inscription publique (`POST /auth/register`) attribue systématiquement le rôle STUDENT ; aucun autre rôle n'est accessible par ce canal. | Inscription en libre-service | Les comptes ADMIN_GET/SCHOOL_ADMIN/MINISTRY/TEACHER sont provisionnés hors de ce flux (seed, ou action serveur dont le mécanisme exact n'a pas été localisé) | `roles-auth-inventory.md §1, §3.1` ; `auth.service.ts:45-51` | PARTIELLEMENT OBSERVÉE |
| GET-RG-008 | Comptes & authentification | Le mot de passe doit comporter 8 à 32 caractères avec au moins une majuscule, une minuscule, un chiffre et un caractère spécial ; règle uniforme à l'inscription, la réinitialisation et le changement de mot de passe. | Création/modification de mot de passe | Aucune | `roles-auth-inventory.md §3.1` ; `student.controller.ts:47-58` | OBSERVÉE |
| GET-RG-009 | Comptes & authentification | L'authentification à deux facteurs (MFA/TOTP) n'est proposée qu'aux rôles à privilèges (ADMIN_GET, SCHOOL_ADMIN, MINISTRY) ; STUDENT et TEACHER n'y ont pas accès. | Activation MFA | Aucune | `auth.controller.ts:214-248` ; `roles-auth-inventory.md §3.3` | OBSERVÉE |
| GET-RG-010 | Comptes & authentification | La session applicative repose sur un access token court (15 min) et un refresh token (7 jours), tous deux posés en cookies `httpOnly`. | Connexion réussie | Aucune | `roles-auth-inventory.md §3.2` | OBSERVÉE |
| GET-RG-011 | Comptes & authentification | Toute route de l'API est protégée par authentification JWT par défaut ; elle doit être explicitement marquée `@Public()` pour être accessible sans jeton. | Toute requête HTTP | Routes listées `@Public()` (catalogue public, login, webhook paiement, etc.) | `app.module.ts:60-70` ; `backend-inventory.md — Contexte global` | OBSERVÉE |
| GET-RG-012 | Comptes & authentification | Le contrôle par rôle (`RolesGuard`) n'est pas appliqué globalement : une route authentifiée sans décorateur `@Roles` explicite reste accessible à tout utilisateur connecté, quel que soit son rôle. | Route sans `@Roles` | Ex. `notifications/me`, `notifications/preferences` accessibles à tous rôles connectés | `roles-auth-inventory.md §3.4, §2` | OBSERVÉE — point de vigilance |
| GET-RG-013 | Comptes & authentification | Un refresh token est émis et posé en cookie à chaque connexion, mais aucune route de rafraîchissement (`/auth/refresh`) n'existe : l'utilisateur est déconnecté de force après 15 minutes d'inactivité API malgré un refresh token valide 7 jours. | Expiration de l'access token (15 min) | Aucune — incohérence de conception à trancher | `roles-auth-inventory.md §3.7, §4.3` | À CONFIRMER |
| GET-RG-014 | Comptes & authentification | La déconnexion reste accessible même avec un jeton déjà expiré, pour garantir dans tous les cas le nettoyage des cookies côté client. | `POST /auth/logout` avec cookie expiré | Aucune | `auth.controller.ts:150-180` ; `roles-auth-inventory.md §3.5` | OBSERVÉE |
| GET-RG-015 | Comptes & authentification | Le jeton de réinitialisation de mot de passe n'est pas invalidé après utilisation : il reste exploitable jusqu'à son expiration naturelle (1h), même après avoir déjà servi. | Réutilisation d'un lien de reset dans l'heure suivant son émission | Aucune | `roles-auth-inventory.md §3.6` | OBSERVÉE — vigilance sécurité |
| GET-RG-016 | Comptes & authentification | Les routes sensibles d'authentification sont limitées en fréquence (5 req/min login/register/mfa/reset-password, 3/min forgot-password), en plus de la limite globale de 100 req/min. | Appels répétés | Aucune | `backend-inventory.md — Contexte global` ; `roles-auth-inventory.md §3.8` | OBSERVÉE |
| GET-RG-017 | Comptes & authentification | La vérification d'email (`isVerified`) existe en base mais n'est pas contrôlée à la connexion : un compte non vérifié peut se connecter normalement. | Connexion d'un compte avec `isVerified=false` | Aucune | `roles-auth-inventory.md §3.1` | OBSERVÉE — écart fonctionnel probable |
| GET-RG-018 | Comptes & authentification | Le mot de passe est haché avec bcrypt (facteur de coût 10) avant stockage, jamais conservé en clair. | Création/modification de mot de passe | Aucune | `roles-auth-inventory.md §3.1` | OBSERVÉE |

## Domaine — Rôles & autorisation

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-019 | Rôles & autorisation | Un utilisateur ne porte qu'un seul rôle applicatif à la fois ; le contrôle d'accès compare l'égalité stricte entre le rôle de l'utilisateur et le(s) rôle(s) requis. | Toute vérification d'autorisation | Aucune | `roles.guard.ts` ; `backend-inventory.md — Contexte global` | OBSERVÉE |
| GET-RG-020 | Rôles & autorisation | Seuls 5 rôles sont reconnus (STUDENT, ADMIN_GET, SCHOOL_ADMIN, MINISTRY, TEACHER) ; seul STUDENT est accessible via l'inscription publique. | Attribution d'un rôle à un compte | Aucune voie de création manuelle de compte staff identifiée dans le code applicatif | `roles-auth-inventory.md §1` | PARTIELLEMENT OBSERVÉE |
| GET-RG-021 | Rôles & autorisation | Un SCHOOL_ADMIN est rattaché à une seule école via une relation 1-1 (`SchoolAdmin.schoolId`) ; son périmètre d'action est celui de cette école uniquement. | Toute action `me/*` d'un SCHOOL_ADMIN | Aucune | `data-model-inventory.md — SchoolAdmin` | OBSERVÉE |
| GET-RG-022 | Rôles & autorisation | Le rôle MINISTRY n'a jamais accès aux données nominatives (détail de candidature, de paiement) ; ses accès sont limités aux agrégats statistiques et à la conformité des établissements. | Tentative d'accès à une ressource nominative par un compte MINISTRY | Accès autorisé aux statistiques agrégées et à la conformité | `application.controller.ts:242-244` ; `payment.service.spec.ts` ; `ministry-access-policy.spec.ts` | OBSERVÉE |
| GET-RG-023 | Rôles & autorisation | Le rôle MINISTRY est explicitement exclu de la messagerie interne. | Tentative d'accès aux routes `/messages` par un compte MINISTRY | Aucune | `message.controller.ts:47` ; `message.controller.spec.ts` | OBSERVÉE |
| GET-RG-024 | Rôles & autorisation | La route `GET /audit/me` (« mes propres logs ») est en réalité réservée à ADMIN_GET par héritage du contrôle de classe, malgré son intitulé suggérant un accès personnel pour tout utilisateur. | Appel à `GET /audit/me` par un rôle non-ADMIN_GET | Aucune | `audit.controller.ts:29-30, 135` ; `roles-auth-inventory.md §2, §4.4` | OBSERVÉE — incohérence à trancher |
| GET-RG-025 | Rôles & autorisation | La mise à jour d'un établissement (`PUT /schools/:id`) et l'upload de son logo ne sont protégés que par l'authentification (pas de `@Roles` déclaratif) ; le contrôle réel de propriété (ADMIN_GET ou admin de cette école précise) est effectué manuellement dans le service. | Appel à `PUT /schools/:id` | Aucune | `school.controller.ts:195-196, 250-251` ; `roles-auth-inventory.md §2` | PARTIELLEMENT OBSERVÉE |
| GET-RG-026 | Rôles & autorisation | Un administrateur plateforme (ADMIN_GET) ne peut pas désactiver son propre compte via la gestion des utilisateurs. | `PATCH /users/:id/status` ciblant son propre compte | Aucune | `user.service.ts:74-76` | OBSERVÉE |
| GET-RG-027 | Rôles & autorisation | La pagination de la liste des utilisateurs est bornée entre 1 et 100 résultats par page, quelle que soit la valeur demandée. | `GET /users` avec `limit` hors bornes | Aucune | `user.service.ts:14-15` | OBSERVÉE |

## Domaine — Établissements

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-028 | Établissements | Un étudiant peut être inscrit activement dans plusieurs écoles simultanément (double diplôme, cursus parallèle) : une ligne `StudentEnrollment` distincte existe par couple (étudiant, école). | Inscription d'un étudiant déjà inscrit ailleurs | Aucune — comportement voulu, confirmé par test dédié | `school.service.ts:649-651` ; `schema.prisma:129` ; `application.service.spec.ts` | OBSERVÉE |
| GET-RG-029 | Établissements | Une inscription (`enrollStudent`) est refusée si la période d'inscription de l'école est fermée, si la filière visée est introuvable ou archivée, ou si le niveau demandé dépasse la durée du programme. | `POST me/students/enroll` | Aucune | `school.service.ts:658-674` | OBSERVÉE |
| GET-RG-030 | Établissements | Le `slug` d'un établissement est unique sur l'ensemble de la plateforme. | Création/modification d'école | Aucune | `data-model-inventory.md — School` | OBSERVÉE |
| GET-RG-031 | Établissements | Le nom d'une filière est unique au sein d'une même école (deux écoles peuvent partager un nom de filière). | Création de filière | Aucune | `data-model-inventory.md — SchoolProgram` | OBSERVÉE |
| GET-RG-032 | Établissements | Le libellé d'une année académique d'école (ex. « 2026-2027 ») est unique au sein d'une même école. | Création d'année académique école | Aucune | `data-model-inventory.md — SchoolAcademicYear` | OBSERVÉE |
| GET-RG-033 | Établissements | Le modèle `SchoolAcademicYear` (par école, orienté admissions) est distinct du modèle `AcademicYear` central (référence du moteur de planification) : les deux notions ne doivent pas être confondues. | Toute manipulation d'année académique | Aucune | `data-model-inventory.md — SchoolAcademicYear, AcademicYear` | OBSERVÉE — vigilance terminologique |
| GET-RG-034 | Établissements | Le libellé d'inscription (`enrolledYear`) est calculé automatiquement depuis programme/niveau/année ; il ne doit jamais être saisi librement. | Création/mise à jour d'une inscription | Aucune | `data-model-inventory.md — StudentEnrollment` | OBSERVÉE |
| GET-RG-035 | Établissements | Un professeur ne peut avoir qu'une seule affectation active par école (`@@unique([teacherId, schoolId])`), même s'il peut être affecté à plusieurs écoles différentes. | Affectation d'un professeur à une école | Aucune | `data-model-inventory.md — TeacherSchool` | OBSERVÉE |
| GET-RG-036 | Établissements | Le nom d'une salle et le nom d'une matière sont chacun uniques au sein d'une même école. | Création de salle/matière | Aucune | `data-model-inventory.md — Room, SchoolSubject` | OBSERVÉE |

## Domaine — Formations & offres

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-037 | Formations & offres | La création d'une offre est refusée si l'école est introuvable, si la filière indiquée n'appartient pas à cette école, si une exigence référencée est invalide, ou si l'admin appelant n'est pas propriétaire de l'école. | `POST /offers` | Aucune | `offer.service.ts:15-31, 208` | OBSERVÉE |
| GET-RG-038 | Formations & offres | La durée d'une offre de formation doit être comprise entre 6 et 60 mois. | Création/modification d'offre | Aucune | `create-offer.dto.ts:32-36` | OBSERVÉE |
| GET-RG-039 | Formations & offres | Le tarif d'une offre doit être ≥ 0 ; la devise par défaut est MGA. | Création/modification d'offre | Aucune | `create-offer.dto.ts` | OBSERVÉE |
| GET-RG-040 | Formations & offres | Une offre dont la date limite de candidature (`applicationDeadline`) est dépassée n'accepte plus de nouvelle candidature, même si elle reste marquée ouverte (`isOpen=true`). | Soumission de candidature après la deadline | Aucune | `application.service.ts:74-79` | OBSERVÉE |
| GET-RG-041 | Formations & offres | Le `slug` d'une offre est unique sur l'ensemble de la plateforme. | Création/modification d'offre | Aucune | `data-model-inventory.md — Offer` | OBSERVÉE |
| GET-RG-042 | Formations & offres | Seul le propriétaire de l'offre (SCHOOL_ADMIN de l'école) ou ADMIN_GET peut ouvrir/fermer une offre aux candidatures ou la supprimer. | `PATCH /offers/:id/status`, `DELETE /offers/:id` | Aucune | `offer.controller.ts:179-197` ; `offer.service.spec.ts` | OBSERVÉE |

## Domaine — Candidatures

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-043 | Candidatures | Le statut d'une candidature suit une machine à états stricte (`APPLICATION_STATUS_TRANSITIONS`) ; REJECTED et CANCELLED sont des états terminaux sans transition ultérieure possible. | Toute tentative de changement de statut | Garde ajoutée explicitement (suite audit QA) pour empêcher un REJECTED → ACCEPTED direct | `update-application-status.dto.ts:34-98` ; `application.service.ts:376-389` | OBSERVÉE |
| GET-RG-044 | Candidatures | Un étudiant ne peut candidater qu'une seule fois à une même offre (`@@unique([studentId, offerId])`). | Deuxième candidature du même étudiant à la même offre | Classée « alreadyApplied » sur candidature groupée plutôt qu'erreur bloquante | `schema.prisma:775` ; `application.service.ts:81-87` | OBSERVÉE |
| GET-RG-045 | Candidatures | Le passage au statut ACCEPTED est contrôlé par la capacité de l'offre (`offer.capacity`), calculée sur le cumul ACCEPTED + ENROLLED. | Tentative de passage à ACCEPTED alors que la capacité est atteinte | Refus (erreur métier) | `application.service.ts:395-413` ; `application.service.spec.ts` | OBSERVÉE |
| GET-RG-046 | Candidatures | Le passage à ACCEPTED ou ENROLLED déclenche automatiquement, dans la même transaction, l'inscription réelle de l'étudiant (`StudentEnrollment` + synchro des inscriptions de cours) : jamais de candidature ACCEPTED/ENROLLED sans tentative d'inscription associée. | Passage à ACCEPTED/ENROLLED | En cas d'échec (offre sans programme, pas d'année académique courante), l'échec est tracé explicitement dans `ApplicationTimeline` plutôt qu'ignoré silencieusement | `application.service.ts:415-527` | OBSERVÉE |
| GET-RG-047 | Candidatures | Lorsqu'une place se libère après acceptation (désistement ou refus), le candidat le plus ancien en liste d'attente (WAITLISTED) est automatiquement promu ACCEPTED. | Désistement/refus d'un candidat déjà ACCEPTED | Aucune promotion si la liste d'attente est vide | `application.service.ts:530-567` | OBSERVÉE |
| GET-RG-048 | Candidatures | Chaque changement de statut de candidature est journalisé systématiquement dans l'audit, avec l'état avant et après. | Tout changement de statut | Aucune | `application.service.ts:587-599` | OBSERVÉE |
| GET-RG-049 | Candidatures | Le rôle MINISTRY n'a pas accès aux détails nominatifs d'une candidature (dossier, documents), seulement aux statistiques agrégées. | Tentative d'accès de MINISTRY au détail/documents | Aucune | `application.controller.ts:242-244` ; `application.controller.spec.ts` | OBSERVÉE |
| GET-RG-050 | Candidatures | Le niveau de cursus (`programLevel`) est systématiquement forcé à « Année 1 » lors de l'inscription automatique déclenchée par une candidature acceptée, quel que soit le contexte (transfert, admission parallèle). | Inscription automatique post-candidature | Aucune exception codée | `backend-inventory.md — module application, « Points à confirmer »` | À CONFIRMER |

## Domaine — Admissions (concours, exigences, conformité)

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-051 | Admissions | Le statut d'un concours d'admission est contraint à PLANNED, OPEN, IN_PROGRESS, COMPLETED ou CANCELLED. | Création/modification d'un concours | Aucune matrice de transition explicite trouvée (validation de valeur seule, pas de contrôle de séquence) | `create-competition.dto.ts:15-21` | PARTIELLEMENT OBSERVÉE |
| GET-RG-052 | Admissions | Toute modification ou suppression d'un concours vérifie d'abord son existence (404 sinon). | `PATCH/DELETE /competitions/:id` | Aucune | `competition.service.ts:102` | OBSERVÉE |
| GET-RG-053 | Admissions | Aucune route d'inscription candidat à un concours n'a été identifiée : le lien entre concours et candidature (offre) n'est pas établi dans le code analysé. | — | — | `backend-inventory.md — module competition` | À CONFIRMER |
| GET-RG-054 | Admissions | Le nom d'une exigence documentaire (`SchoolRequirement`) est unique au sein d'une même école ; son `type` (ex. DOCUMENT) n'est pas formalisé par un enum, seule une valeur d'exemple a été observée. | Création d'exigence | Aucune | `data-model-inventory.md — SchoolRequirement` | OBSERVÉE — voir GET-RG-106 |
| GET-RG-055 | Admissions | Une exigence documentaire n'est liée qu'une seule fois à une offre donnée ; son caractère obligatoire peut être ajusté pour ce couple (offre, exigence) indépendamment du caractère obligatoire global de l'exigence. | Association exigence-offre | Aucune | `data-model-inventory.md — OfferRequirement` | OBSERVÉE |
| GET-RG-056 | Admissions | Le contrôle de conformité d'une école (`ComplianceCheck`) est historisé : chaque évaluation crée un nouvel enregistrement sans jamais écraser le précédent ; par défaut, seul le dernier contrôle par école est restitué. | `PUT /ministry/compliance/:schoolId` | Un paramètre `latestOnly=false` restitue l'historique complet | `ministry.service.ts:301-407` | OBSERVÉE |
| GET-RG-057 | Admissions | Toutes les statistiques exposées au Ministère sont des agrégats institutionnels (établissement/région/filière) ; aucune donnée nominative d'étudiant n'est jamais restituée à ce rôle. | Tout endpoint du module `ministry` | Aucune | `ministry-stats.dto.ts:3-7` ; `ministry-access-policy.spec.ts` ; `report-exporter.spec.ts` | OBSERVÉE |

## Domaine — Inscriptions

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-058 | Inscriptions | Un étudiant ne peut avoir qu'une seule ligne `StudentEnrollment` par école ; le statut de cette inscription évolue dans le temps plutôt que de créer une nouvelle ligne. | Toute opération d'inscription/désinscription | Aucune — cohérent avec la règle multi-écoles (GET-RG-028) | `schema.prisma:129 (@@unique([studentId, schoolId]))` | OBSERVÉE |
| GET-RG-059 | Inscriptions | Un étudiant ne peut être inscrit qu'une seule fois à un même cours (`@@unique([courseId, studentId])`). | Inscription à un cours | Aucune | `data-model-inventory.md — CourseEnrollment` | OBSERVÉE |
| GET-RG-060 | Inscriptions | Le statut d'une inscription école (`StudentEnrollment.status`) est l'une des valeurs ACTIVE, WITHDRAWN, GRADUATED. | Toute inscription | Aucune | `data-model-inventory.md — StudentEnrollment` | OBSERVÉE |
| GET-RG-061 | Inscriptions | Une soumission de devoir déjà notée (`grade` renseigné) ne peut plus être remplacée par l'étudiant. | Nouvelle tentative de dépôt sur un devoir déjà corrigé | Aucune | `student.service.ts:92-99` | OBSERVÉE |
| GET-RG-062 | Inscriptions | Le profil étudiant est considéré complet lorsqu'au moins 70 % des 8 champs clés du profil sont renseignés. | Calcul de `profileCompleted` | Aucune | `student.service.ts:258-273` | OBSERVÉE |
| GET-RG-063 | Inscriptions | Un étudiant ne peut recevoir qu'une seule note par évaluation, et ne déposer qu'un seul rendu par devoir. | Notation / dépôt de devoir | Aucune | `data-model-inventory.md — Grade, AssignmentSubmission` | OBSERVÉE |

## Domaine — Documents

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-064 | Documents | Le téléphone et le numéro CIN de l'étudiant sont obligatoirement chiffrés avant stockage ; en cas d'échec de chiffrement, la requête est refusée plutôt que de stocker la donnée en clair. | Mise à jour du profil étudiant | Aucune | `student.service.ts:228-248` | OBSERVÉE |
| GET-RG-065 | Documents | Le type d'un document déposé est contraint à CV, LETTER, ID, DIPLOMA, PHOTO ou OTHER ; les anciens types CIN/BAC ont été migrés vers ID/DIPLOMA. | Upload de document | Aucune | `upload-document.dto.ts` ; `seed.ts` (commentaire de migration) | OBSERVÉE |
| GET-RG-066 | Documents | La suppression d'un document par l'étudiant est un soft delete (le fichier reste tracé en base, marqué supprimé). | `DELETE me/documents/:id` | Aucune | `data-model-inventory.md — Document` | OBSERVÉE |
| GET-RG-067 | Documents | L'upload d'avatar est limité aux formats jpeg/png/webp et 5 Mo maximum ; les pièces jointes de message sont limitées selon leur type (5 Mo image/document, 20 Mo vidéo). | Upload de fichier | Aucune | `student.controller.ts:142-194` ; `storage.service.ts` | OBSERVÉE |

## Domaine — Paiements

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-068 | Paiements | Un paiement ne peut être initié que si la candidature appartient bien à l'étudiant demandeur et que son statut est ACCEPTED. | `POST /payments/initiate` | Aucune | `payment.service.ts:37-44` | OBSERVÉE |
| GET-RG-069 | Paiements | Le montant du paiement n'est jamais fourni par le client : il est systématiquement dérivé de `offer.tuitionFees` et refusé si ≤ 0. | Initiation de paiement | Aucune | `payment.service.ts:46-50` | OBSERVÉE |
| GET-RG-070 | Paiements | Un second paiement ne peut être initié pour la même candidature tant qu'un paiement PENDING, PROCESSING ou COMPLETED existe déjà (anti double paiement). | Nouvelle tentative de paiement sur une candidature déjà en cours | Aucune | `payment.service.ts:52-65` | OBSERVÉE |
| GET-RG-071 | Paiements | Une commission de 5 % du montant est calculée automatiquement à l'initiation du paiement. | Initiation de paiement | Aucune | `payment.service.ts:79` | OBSERVÉE |
| GET-RG-072 | Paiements | Un paiement initié expire 15 minutes après sa création (`expiresAt`). | Initiation de paiement | Aucun mécanisme observé ne fait effectivement passer le statut à un état « expiré » après ce délai | `payment.service.ts:78` | PARTIELLEMENT OBSERVÉE |
| GET-RG-073 | Paiements | Le webhook fournisseur doit présenter une signature HMAC valide calculée sur les octets bruts de la requête ; traité de façon idempotente si le paiement est déjà COMPLETED, rejeté si le montant transmis ne correspond pas au paiement enregistré. | Réception d'un webhook de paiement | Rejet si secret/signature absents ou paiement introuvable | `payment.service.ts:443-455` | OBSERVÉE |
| GET-RG-074 | Paiements | La confirmation d'un paiement (COMPLETED) déclenche, dans une seule transaction, le passage de la candidature à ENROLLED, l'upsert de l'inscription, la synchro des inscriptions de cours et la création de la `Transaction` technique associée. | Webhook confirmant un paiement | En cas d'échec de l'inscription, l'échec est tracé explicitement dans `ApplicationTimeline` plutôt que silencieux | `payment.service.ts:133-247` | OBSERVÉE |
| GET-RG-075 | Paiements | La référence d'un paiement (`reference`) est unique sur l'ensemble de la plateforme. | Création de paiement | Aucune | `data-model-inventory.md — Payment` | OBSERVÉE |
| GET-RG-076 | Paiements | Le statut d'un paiement suit le cycle PENDING → PROCESSING → COMPLETED/FAILED, puis éventuellement REFUNDED ; un état EXPIRED semble prévu (champ `expiresAt`) mais n'est implémenté nulle part dans le code lu. | — | — | `data-model-inventory.md — Payment (enums)` | À CONFIRMER |

## Domaine — Notifications

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-077 | Notifications | Avant tout envoi, le service vérifie l'existence de l'utilisateur destinataire et que le canal visé est activé dans ses préférences. | `NotificationService.send()` | Aucune | `notification.service.ts:83-99` | OBSERVÉE |
| GET-RG-078 | Notifications | Les canaux EMAIL, SMS et PUSH sont intégralement simulés dans le code lu ; seul le canal IN_APP est réellement persistant et fiable. | Tout envoi EMAIL/SMS/PUSH | Un fournisseur réel pourrait être branché en configuration de production, non vérifié dans cette passe | `notification.service.ts:143-219` | À CONFIRMER |
| GET-RG-079 | Notifications | L'envoi d'un SMS échoue si l'étudiant destinataire n'a pas de numéro de téléphone renseigné. | Envoi SMS | Aucune | `notification.service.ts:143-219` | OBSERVÉE |
| GET-RG-080 | Notifications | Les préférences de notification de l'utilisateur ne sont pas persistées en base : la lecture renvoie des valeurs par défaut codées en dur, la mise à jour n'a aucun effet durable. | `GET/PUT /notifications/preferences` | Aucune | `notification.service.ts:225-268` | OBSERVÉE — fonctionnalité incomplète |
| GET-RG-081 | Notifications | La notification IN_APP est systématiquement stockée en base ; c'est le seul canal garanti de bout en bout. | Tout envoi de notification | Aucune | `backend-inventory.md — module notification` | OBSERVÉE |
| GET-RG-082 | Notifications | Les notifications liées à une annonce sont créées directement en base sans passer par `NotificationService.send()`, donc sans vérification des préférences de canal ; seul IN_APP est utilisé pour les annonces. | Diffusion d'une annonce | Aucune | `announcement.service.ts:15-21` | OBSERVÉE — à confirmer si voulu |

## Domaine — Planification / emploi du temps

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-083 | Planification | La création/modification d'un créneau de cours vérifie systématiquement l'absence de conflit de salle et la disponibilité du professeur ; une contrainte d'exclusion en base (`no_teacher_double_booking`) sert de filet de sécurité en cas de concurrence, traduite en message métier lisible. | Création/modification de `CourseSlot` | Aucune | `school.service.ts:1404-1465` ; `teacher-availability.service.ts:182-188` | OBSERVÉE |
| GET-RG-084 | Planification | La génération automatique de planning respecte le volume horaire hebdomadaire requis, priorise les besoins ayant le plus d'heures, garantit qu'une même classe n'a jamais deux séances simultanées, est idempotente, et remonte explicitement en « non résolu » les cas bloquants. | `POST me/schedule/generate` | Cas bloquants listés explicitement plutôt que planning silencieusement incomplet | `schedule-generation.service.ts:126-215` | OBSERVÉE |
| GET-RG-085 | Planification | La modification ou suppression d'un créneau de cours notifie automatiquement le professeur concerné (in-app). | Modification/suppression de `CourseSlot` | Aucune | `school.service.ts:1478-1488` | OBSERVÉE |
| GET-RG-086 | Planification | Une indisponibilité professeur est déclarée soit de façon récurrente (`dayOfWeek`), soit ponctuelle (`date`), jamais les deux simultanément. | Déclaration d'indisponibilité | Aucune | `teacher-availability.dto.ts:16-24` | OBSERVÉE |
| GET-RG-087 | Planification | Les horaires de créneaux et d'indisponibilités doivent respecter le format strict `HH:mm`. | Toute saisie d'horaire | Aucune | `teacher-availability.dto.ts:13, 27-32` | OBSERVÉE |
| GET-RG-088 | Planification | Le temps de trajet minimal déclaré entre deux écoles pour un professeur doit être compris entre 0 et 480 minutes (8h max). | Déclaration d'un temps de trajet | Aucune | `teacher-travel-buffer.dto.ts:10-13` | OBSERVÉE |
| GET-RG-089 | Planification | Un professeur n'est disponible sur un créneau que si (1) aucune indisponibilité déclarée ne chevauche, (2) aucun autre `CourseSlot` du même jour ne chevauche, (3) pour un créneau dans une autre école le même jour, l'écart avec le créneau le plus proche respecte le temps de trajet minimal déclaré entre les deux écoles. | Création de créneau / vérification de disponibilité | Aucune | `teacher-availability.service.ts:106-166` | OBSERVÉE |
| GET-RG-090 | Planification | Les temps de trajet entre deux écoles sont systématiquement normalisés par ordre alphabétique des identifiants d'école, pour éviter les doublons symétriques. | Enregistrement d'un temps de trajet | Aucune | `schema.prisma:494 (commentaire)` | OBSERVÉE |
| GET-RG-091 | Planification | Un seul professeur peut être affecté à un besoin horaire donné ; un professeur encore affecté à un besoin ne peut pas être supprimé de la plateforme. | Affectation d'un professeur / suppression d'un professeur affecté | Aucune | `data-model-inventory.md — TeacherAssignment (onDelete: Restrict)` | OBSERVÉE |
| GET-RG-092 | Planification | Une classe ne peut exprimer qu'un seul besoin horaire par matière (`@@unique([classId, subjectId])`). | Création de besoin horaire | Aucune | `data-model-inventory.md — SubjectRequirement` | OBSERVÉE |

## Domaine — Messagerie

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-093 | Messagerie | Un message ne peut comporter plus de 5 pièces jointes. | Envoi de message | Aucune | `message.service.ts:11, 32-36` | OBSERVÉE |
| GET-RG-094 | Messagerie | Un utilisateur ne peut pas s'envoyer un message à lui-même. | Envoi de message avec émetteur = destinataire | Aucune | `message.service.ts:42-45` | OBSERVÉE |
| GET-RG-095 | Messagerie | Une conversation directe entre deux utilisateurs est identifiée par une clé déterministe (`directKey`) ; sa création (conversation + participants + message + pièces jointes) est atomique. | Premier message entre deux utilisateurs | Aucune | `message.service.ts:50-73` | OBSERVÉE |

## Domaine — Audit

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-096 | Audit | Toute requête HTTP de l'API est journalisée automatiquement (action déduite du verbe HTTP, ressource déduite de l'URL), sans intervention module par module. | Toute requête HTTP | Aucune | `audit.interceptor.ts:76-143` | OBSERVÉE |
| GET-RG-097 | Audit | Le journal d'audit ne conserve jamais le corps de la requête ou de la réponse, seulement des métadonnées (utilisateur, action, ressource, IP, user-agent, statut), pour éviter toute fuite de secrets. | Toute écriture d'audit | Aucune | `audit.interceptor.ts:39-42` | OBSERVÉE |
| GET-RG-098 | Audit | Un échec d'écriture du journal d'audit n'interrompt jamais la requête métier en cours. | Erreur lors de l'écriture d'un log d'audit | Aucune | `audit.interceptor.ts:53, 68` | OBSERVÉE |
| GET-RG-099 | Audit | Aucune politique de rétention ou de purge des journaux d'audit n'a été identifiée : les logs s'accumulent indéfiniment en l'état actuel. | — | — | `backend-inventory.md — module audit` | À CONFIRMER |

## Domaine — Annonces / communication transverse

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-100 | Annonces | La création d'une annonce (école ou cours) et la génération des notifications à chaque destinataire s'effectuent dans une seule transaction atomique, remplaçant d'anciennes implémentations dupliquées non transactionnelles. | Création d'annonce | Aucune | `announcement.service.ts:15-21` | OBSERVÉE |
| GET-RG-101 | Annonces | Les destinataires d'une annonce sont dédoublonnés avant création des notifications, évitant les envois multiples au même utilisateur. | Création d'annonce | Aucune | `announcement.service.ts:31` | OBSERVÉE |
| GET-RG-102 | Annonces | La création d'une annonce ciblée (CLASSES/STUDENTS/TEACHERS) exige au moins un destinataire résolu selon le type de cible choisi. | Création d'annonce | Le type EVERYONE/ALL_STUDENTS ne nécessite pas de sélection explicite | `school.service.ts:826-840` | OBSERVÉE |

## Domaine — Administration & configuration système

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-103 | Administration système | Les paramètres globaux de la plateforme sont stockés sous une clé unique (`platform.settings`) en JSON dans `SystemConfig`, avec une opération de type upsert. | `PUT /settings` | Aucune | `system-settings.service.ts:6, 24-30` | OBSERVÉE |
| GET-RG-104 | Administration système | Le nom de la plateforme (`platformName`) est obligatoire et limité à 120 caractères ; les autres champs de contact sont optionnels. | Mise à jour des paramètres plateforme | Aucune | `update-platform-settings.dto.ts` | OBSERVÉE |

## Points de vigilance transverses (cohérence base / service / frontend)

| ID | Domaine | Règle de gestion (formulation métier) | Déclencheur | Exceptions/cas particuliers | Preuve (fichier:ligne) | Statut |
|---|---|---|---|---|---|---|
| GET-RG-105 | Vigilance transverse | Le schéma de données ne définit aucun `enum` Prisma natif : tous les champs de statut/type sont des chaînes libres en base, sans contrainte `CHECK` ; leur validité n'est garantie que côté API au moment de l'écriture, jamais au niveau de la base elle-même. | — | S'applique potentiellement à la quasi-totalité des champs de statut du catalogue ; non répété ligne à ligne sauf écarts notables (GET-RG-106, GET-RG-107) | `data-model-inventory.md — Constat structurant` | OBSERVÉE — risque structurel, recommandation : migrer vers de véritables enums Prisma ou ajouter des contraintes CHECK |
| GET-RG-106 | Vigilance transverse | Le champ `SchoolRequirement.type` n'est associé à aucun enum formalisé, ni en base ni côté DTO : une seule valeur d'exemple (`DOCUMENT`) a été observée, sans liste exhaustive de valeurs valides définie. | Création d'une exigence d'école | Aucune | `data-model-inventory.md — SchoolRequirement` ; `school-admin-actions.dto.ts` | OBSERVÉE — écart notable base/service |
| GET-RG-107 | Vigilance transverse | Le champ `Image.entityType` présente un écart documenté entre le commentaire du schéma Prisma (6 valeurs) et l'énumération TypeScript réellement utilisée en code (10 valeurs, ajoutant TEACHER, ANNOUNCEMENT, LANDING_NEWS, FINANCIAL_PARTNER) : la documentation du schéma est obsolète par rapport à l'implémentation. | Upload d'image associée à une entité | Aucune | `schema.prisma:1050 (commentaire)` vs `storage.service.ts (ImageEntityType)` | OBSERVÉE — écart notable, documentation du schéma à corriger |
| GET-RG-108 | Vigilance transverse | Le modèle `SchoolSubscription` existe en base avec des champs `plan`/`paymentStatus` non contraints par un enum identifié, mais aucune logique métier (service, contrôleur, seed) ne l'utilise dans le code analysé : la fonctionnalité de facturation des écoles semble non implémentée. | — | — | `data-model-inventory.md — SchoolSubscription` | À CONFIRMER (fonctionnalité prévue mais non livrée ?) |
| GET-RG-109 | Vigilance transverse | Le modèle `NotificationTemplate` existe en base mais aucun usage n'a été identifié dans le code des modules backend : il semble en attente d'implémentation. | — | — | `data-model-inventory.md — NotificationTemplate` | À CONFIRMER |

---

**Total : 109 règles de gestion recensées**, réparties sur 15 domaines (comptes & authentification : 18 ; rôles & autorisation : 9 ; établissements : 9 ; formations & offres : 6 ; candidatures : 8 ; admissions : 7 ; inscriptions : 6 ; documents : 4 ; paiements : 9 ; notifications : 6 ; planification : 10 ; messagerie : 3 ; audit : 4 ; annonces : 3 ; administration système : 2 ; vigilance transverse : 5).
