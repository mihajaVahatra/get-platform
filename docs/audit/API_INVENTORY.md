# Inventaire des API — Backend GET (préfixe global `/api`)

Légende **État** : ✅ Réel et connecté au frontend · 🟡 Réel côté backend, non appelé par le frontend actuel · 🟠 Simulé/mocké (existe mais ne fait pas ce qu'il prétend) · ⚪ Réel, non vérifié côté frontend dans cet audit.
Légende **Test** : aucun endpoint listé ci-dessous n'est couvert par un test automatisé (voir `TEST_GAPS.md`).

## `app` (racine)

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api` | Health/hello par défaut (boilerplate Nest) | Public | — | — | `AppService` | ⚪ |

## `auth`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | Créer un compte étudiant | Public (`@Public`), throttle 5/min | — | `RegisterDto` (email, password regex, prénom/nom) | `AuthService.register` | ✅ |
| POST | `/api/auth/login` | Connexion | Public, throttle 5/min | — | `LoginDto` | `AuthService.login` | ✅ |
| GET | `/api/auth/me` | Utilisateur courant | JWT | tout rôle | — | inline | ✅ |
| POST | `/api/auth/logout` | Déconnexion (efface cookies) | JWT implicite (aucun guard explicite, mais sans effet si non connecté) | — | — | inline | ✅ |
| POST | `/api/auth/forgot-password` | Demander une réinitialisation | Public, throttle 3/min | — | body `{email}` | `AuthService.forgotPassword` | 🟠 **le jeton n'est jamais délivré à l'utilisateur (CRIT-01)** |
| POST | `/api/auth/reset-password` | Réinitialiser avec jeton | Public, throttle 5/min | — | `ResetPasswordDto` | `AuthService.resetPassword` | 🟠 **atteignable uniquement si le jeton a fuité, ce qui ne se produit jamais en usage normal (CRIT-01)** |
| POST | `/api/auth/mfa/enable` | Générer secret MFA + QR | JWT | `ADMIN_GET, SCHOOL_ADMIN, MINISTRY` | — | `AuthService.enableMfa` | ✅ |
| POST | `/api/auth/mfa/verify` | Vérifier code et activer MFA | JWT | `ADMIN_GET, SCHOOL_ADMIN, MINISTRY` | body `{code}` | `AuthService.verifyMfa` | ✅ |
| POST | `/api/auth/mfa/disable` | Désactiver MFA | JWT | `ADMIN_GET, SCHOOL_ADMIN, MINISTRY` | body `{code}` | `AuthService.disableMfa` | ✅ |

## `students`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api/students/me` | Profil étudiant courant | JWT | `STUDENT` (vérifié en code, pas via `RolesGuard`) | — | `StudentService.getProfile` | ✅ |
| PUT | `/api/students/me` | Mettre à jour le profil | JWT | STUDENT | `UpdateStudentProfileDto` | `StudentService.updateProfile` | ✅ |
| POST | `/api/students/me/avatar` | Upload avatar | JWT | STUDENT | `FileInterceptor` (jpeg/png/webp, 5 Mo, signature binaire vérifiée) | `StorageService.uploadImage` | ✅ |
| GET | `/api/students/me/documents` | Liste des documents | JWT | STUDENT | — | `StudentService.getDocuments` | ✅ (métadonnées seulement) |
| POST | `/api/students/me/documents` | Upload document | JWT | STUDENT | `FileInterceptor` (mimetype déclaré, 5 Mo) | `StudentService.uploadDocument` | 🟠 **le fichier n'est jamais réellement stocké (CRIT-03)** |
| DELETE | `/api/students/me/documents/:id` | Supprimer un document (soft delete) | JWT | STUDENT | — | `StudentService.deleteDocument` | ✅ (métadonnées) |
| POST | `/api/students/me/orientation` | Soumettre le questionnaire d'orientation | JWT | STUDENT | `OrientationQuestionnaireDto` | `StudentService.submitOrientationQuestionnaire` | ⚪ |
| GET | `/api/students/me/orientation` | Suggestions d'orientation | JWT | STUDENT | — | `StudentService.getOrientationSuggestions` | ⚪ |
| GET | `/api/students/me/stats` | Statistiques personnelles | JWT | STUDENT | — | `StudentService.getStudentStats` | ✅ |

## `schools`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api/schools` | Liste paginée/filtrée des écoles | Public | — | query params | `SchoolService.findAll` | ⚪ |
| GET | `/api/schools/:id` | Détail d'une école | Public | — | — | `SchoolService.findOne` | ⚪ |
| POST | `/api/schools` | Créer une école | JWT | `ADMIN_GET` | `CreateSchoolDto` | `SchoolService.create` | 🟡 **backend fonctionnel, non appelé par l'écran Admin (CRIT-04)** |
| PUT | `/api/schools/:id` | Modifier une école | JWT | `ADMIN_GET` ou `SCHOOL_ADMIN` de cette école (vérifié en code) | `UpdateSchoolDto` | `SchoolService.update` | 🟡 non appelé par le frontend actuel |
| DELETE | `/api/schools/:id` | Supprimer (soft delete) une école | JWT | `ADMIN_GET` | — | `SchoolService.delete` | 🟡 non appelé |
| POST | `/api/schools/:id/logo` | Upload logo école | JWT | `ADMIN_GET` ou `SCHOOL_ADMIN` propriétaire | `FileInterceptor` (image, signature vérifiée) | `StorageService` | 🟡 non appelé |
| GET | `/api/schools/me` | École de l'admin école connecté | JWT | `SCHOOL_ADMIN` (vérifié en code) | — | `SchoolService.findOne` | ⚪ |
| GET | `/api/schools/me/stats` | Statistiques de l'école | JWT | `SCHOOL_ADMIN` | — | inline | 🟠 **renvoie des zéros codés en dur (MED-08)** |

## `offers`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api/offers` | Liste/filtre des offres | Public | — | query params | `OfferService.findAll` | ✅ |
| GET | `/api/offers/:id` | Détail d'une offre | Public | — | — | `OfferService.findOne` | ✅ |
| POST | `/api/offers` | Créer une offre | JWT | `SCHOOL_ADMIN, ADMIN_GET` (+ propriété école vérifiée) | `CreateOfferDto` | `OfferService.create` | ✅ |
| PUT | `/api/offers/:id` | Modifier une offre | JWT | idem + propriété | `UpdateOfferDto` | `OfferService.update` | ✅ |
| DELETE | `/api/offers/:id` | Supprimer (soft delete) | JWT | idem + propriété | — | `OfferService.delete` | ✅ |
| PATCH | `/api/offers/:id/status` | Ouvrir/fermer une offre | JWT | idem + propriété | body `{isOpen}` | `OfferService.toggleStatus` | ✅ |
| GET | `/api/offers/school/:schoolId` | Offres d'une école | Public | — | — | `OfferService.getOffersBySchool` | ⚪ |

## `applications`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| POST | `/api/applications` | Postuler à une/plusieurs offres | JWT | STUDENT (implicite via profil) | `SubmitApplicationDto` | `ApplicationService.submitApplications` | ✅ |
| GET | `/api/applications/me` | Mes candidatures | JWT | STUDENT | query pagination/statut | `ApplicationService.getStudentApplications` | ✅ |
| GET | `/api/applications/school/me` | Candidatures de mon école | JWT | `SCHOOL_ADMIN` | query | `ApplicationService.getSchoolApplications` | ⚪ |
| GET | `/api/applications/:id` | Détail d'une candidature | JWT | tout rôle authentifié (contrôle de propriété en service) | — | `ApplicationService.getApplicationById` | ✅ |
| PUT | `/api/applications/:id/status` | Changer le statut | JWT | `SCHOOL_ADMIN, ADMIN_GET` (+ propriété) | `UpdateApplicationStatusDto` | `ApplicationService.updateStatus` | ⚪ |
| POST | `/api/applications/:id/schedule-test` | Planifier un test | JWT | `SCHOOL_ADMIN, ADMIN_GET` (+ propriété) | body libre `{date,type,details}` (pas de DTO typé) | `ApplicationService.scheduleTest` | ⚪ |
| POST | `/api/applications/:id/schedule-interview` | Planifier un entretien | JWT | idem | `ScheduleInterviewDto` | `ApplicationService.scheduleInterview` | ⚪ |
| POST | `/api/applications/:id/score` | Enregistrer un score | JWT | idem | body libre `{score,comments}` | `ApplicationService.recordScore` | ⚪ |
| GET | `/api/applications/stats` | Statistiques candidatures | JWT | `MINISTRY, ADMIN_GET` | query | `ApplicationService.getStats` | ⚪ |

## `payments`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| POST | `/api/payments/initiate` | Initier un paiement | JWT | STUDENT | `InitiatePaymentDto` | `PaymentService.initiatePayment` | 🟠 **montant client-contrôlable hors `applicationId` (SEC-01/CRIT-07)** |
| GET | `/api/payments/:id` | Statut d'un paiement | JWT | propriétaire, `ADMIN_GET`, `MINISTRY` | — | `PaymentService.getPayment` | ✅ |
| GET | `/api/payments` | Historique de paiements | JWT | STUDENT (les siens) | pagination | `PaymentService.getHistory` | ✅ |
| POST | `/api/payments/webhook` | Callback fournisseur de paiement | Public + signature HMAC obligatoire | — | `PaymentWebhookDto` | `PaymentService.handleWebhook` | 🟡 **fonctionnel côté code, mais `PAYMENT_WEBHOOK_SECRET` absent de l'environnement local actuel → toujours rejeté (MED-03)** |
| GET | `/api/payments/:id/receipt` | Télécharger le reçu | JWT | propriétaire/admin/ministère | — | `PaymentService.generateReceipt` | 🟠 **texte brut renvoyé en `.pdf` (HIGH-02)** |
| POST | `/api/payments/bank-account` | Ouvrir un compte bancaire | JWT | STUDENT | body `{bankId}` | `PaymentService.openBankAccount` | 🟠 **100 % simulé (HIGH-05)** |
| GET | `/api/payments/stats` | Statistiques paiements | JWT | `MINISTRY, ADMIN_GET` | query | `PaymentService.getStats` | ⚪ |

## `messages`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api/messages/inbox` | Boîte de réception | JWT | tout rôle | pagination | `MessageService.getInbox` | ✅ |
| GET | `/api/messages/sent` | Messages envoyés | JWT | tout rôle | pagination | `MessageService.getSent` | ⚪ |
| GET | `/api/messages/unread-count` | Nombre de non lus | JWT | tout rôle | — | `MessageService.unreadCount` | ✅ |
| GET | `/api/messages/conversations` | Conversations directes | JWT | tout rôle | pagination | `MessageService.getConversations` | ✅ |
| GET | `/api/messages/conversations/:id` | Fil de conversation | JWT | participant (vérifié) | pagination | `MessageService.getThread` | ✅ |
| POST | `/api/messages` | Envoyer un message par email destinataire | JWT | tout rôle | `SendMessageDto` | `MessageService.send` | ✅ |
| PATCH | `/api/messages/conversations/:id/read` | Marquer un fil comme lu | JWT | participant (vérifié) | — | `MessageService.markThreadAsRead` | ✅ |
| PATCH | `/api/messages/:id/read` | Marquer un message comme lu | JWT | destinataire (vérifié) | — | `MessageService.markAsRead` | ⚪ |

## `notifications`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| POST | `/api/notifications/send` | Envoyer une notification | JWT | `ADMIN_GET, MINISTRY` | `SendNotificationDto` | `NotificationService.send` | 🟠 **email/SMS/push simulés (`console.log`) (HIGH-03)** |
| GET | `/api/notifications/me` | Mes notifications | JWT | tout rôle | query | `NotificationService.getUserNotifications` | ✅ (in-app seulement) |
| PUT | `/api/notifications/:id/read` | Marquer comme lue | JWT | propriétaire (vérifié) | — | `NotificationService.markAsRead` | ⚪ |
| PUT | `/api/notifications/me/read-all` | Tout marquer comme lu | JWT | tout rôle | — | `NotificationService.markAllAsRead` | ⚪ |
| GET | `/api/notifications/preferences` | Lire mes préférences | JWT | tout rôle | — | `NotificationService.getUserPreferences` | 🟠 **valeurs par défaut figées, jamais lues en base (HIGH-03)** |
| PUT | `/api/notifications/preferences` | Modifier mes préférences | JWT | tout rôle | `NotificationPreferencesDto` | `NotificationService.updatePreferences` | 🟠 **ne persiste rien (HIGH-03)** |
| POST | `/api/notifications/welcome` | Email de bienvenue | JWT | `ADMIN_GET` | body `{userId}` | `NotificationService.sendWelcomeEmail` | 🟠 simulé |
| POST | `/api/notifications/payment-confirmation` | Confirmation paiement | JWT | `ADMIN_GET` | body | `NotificationService.sendPaymentConfirmation` | 🟠 simulé |
| POST | `/api/notifications/status-update` | Mise à jour statut candidature | JWT | `ADMIN_GET, SCHOOL_ADMIN` | body | `NotificationService.sendApplicationStatusUpdate` | 🟠 simulé |
| POST | `/api/notifications/reminder` | Rappel deadline | JWT | `ADMIN_GET, SCHOOL_ADMIN` | body | `NotificationService.sendDeadlineReminder` | 🟠 simulé |
| GET | `/api/notifications/stats` | Statistiques notifications | JWT | `ADMIN_GET, MINISTRY` | — | inline | 🟠 **`byType` figé à zéro (MED-09)** |

## `ministry`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api/ministry/dashboard` | Tableau de bord national | JWT | `MINISTRY, ADMIN_GET` | query | `MinistryService.getDashboard` | 🟡 **réel côté backend, non appelé par la page d'accueil Ministère (CRIT-06-adjacent)** |
| GET | `/api/ministry/stats/applications` | Stats candidatures détaillées | JWT | `MINISTRY, ADMIN_GET` | query | `MinistryService.getApplicationStats` | ⚪ |
| GET | `/api/ministry/stats/schools` | Stats écoles | JWT | `MINISTRY, ADMIN_GET` | — | `MinistryService.getSchoolStats` | ⚪ |
| GET | `/api/ministry/stats/geographic` | Répartition géographique | JWT | `MINISTRY, ADMIN_GET` | — | `MinistryService.getGeographicStats` | ⚪ |
| GET | `/api/ministry/compliance` | Liste des contrôles de conformité | JWT | `MINISTRY, ADMIN_GET` | query | `MinistryService.getCompliance` | ✅ |
| PUT | `/api/ministry/compliance/:schoolId` | Enregistrer un contrôle de conformité | JWT | `MINISTRY, ADMIN_GET` | `ComplianceUpdateDto` | `MinistryService.updateCompliance` | ✅ |
| GET | `/api/ministry/reports` | Liste des rapports | JWT | `MINISTRY, ADMIN_GET` | query | `MinistryService.getReports` | ✅ |
| POST | `/api/ministry/reports/generate` | Générer un rapport | JWT | `MINISTRY, ADMIN_GET` | `GenerateReportDto` | `MinistryService.generateReport` | ✅ (métadonnées) |
| GET | `/api/ministry/reports/:id` | Détail d'un rapport | JWT | `MINISTRY, ADMIN_GET` | — | `MinistryService.getReport` | ✅ |
| GET | `/api/ministry/reports/:id/export` | Exporter un rapport | JWT | `MINISTRY, ADMIN_GET` | query `format` | `MinistryService.exportReport` | 🟠 **texte brut, quel que soit le format demandé (HIGH-02)** |
| GET | `/api/ministry/public/stats` | Statistiques publiques | **Documenté public, mais en réalité protégé** | `MINISTRY, ADMIN_GET` (hérité, absence de `@Public()`) | — | `MinistryService.getDashboard` (sous-ensemble) | 🟠 **contrat rompu (SEC-02)** |

## `audit`

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api/audit` | Logs d'audit filtrés | JWT | `ADMIN_GET, MINISTRY` | `AuditQueryDto` | `AuditService.getLogs` | ⚪ |
| GET | `/api/audit/resource/:resource/:id` | Logs d'une ressource | JWT | `ADMIN_GET, MINISTRY` | — | `AuditService.getLogsForResource` | ⚪ |
| GET | `/api/audit/user/:userId` | Logs d'un utilisateur | JWT | `ADMIN_GET, MINISTRY` | pagination | `AuditService.getLogsForUser` | ⚪ |
| GET | `/api/audit/stats` | Statistiques d'audit | JWT | `ADMIN_GET, MINISTRY` | — | `AuditService.getStats` | ⚪ |
| GET | `/api/audit/me` | Mes propres logs | JWT | `ADMIN_GET, MINISTRY` (restreint au niveau classe — un simple utilisateur ne peut donc pas consulter « ses » logs) | pagination | `AuditService.getLogsForUser` | ⚪ |

## `teacher/courses` (module `teaching`)

| Méthode | Endpoint | Fonction | Auth | Rôle | Validation | Service | État |
|---|---|---|---|---|---|---|---|
| GET | `/api/teacher/courses` | Mes cours (multi-établissement) | JWT | `TEACHER` (+ affectation active vérifiée) | — | `TeachingService.courses` | 🟡 **réel et sécurisé, mais jamais appelé par l'écran Professeur (CRIT-05)** |
| GET | `/api/teacher/courses/schools` | Mes établissements affectés | JWT | `TEACHER` | — | `TeachingService.schools` | 🟡 non appelé |
| GET | `/api/teacher/courses/:courseId` | Détail d'un cours | JWT | `TEACHER` + propriété | — | `TeachingService.detail` | 🟡 non appelé |
| GET | `/api/teacher/courses/:courseId/students` | Étudiants inscrits | JWT | `TEACHER` + propriété | — | `TeachingService.students` | 🟡 non appelé |
| POST | `/api/teacher/courses/:courseId/chapters` | Créer un chapitre | JWT | `TEACHER` + propriété | `ChapterDto` | `TeachingService.createChapter` | 🟡 non appelé |
| PATCH | `/api/teacher/courses/:courseId/chapters/:chapterId/publish` | Publier un chapitre | JWT | `TEACHER` + propriété | — | `TeachingService.publishChapter` | 🟡 non appelé |
| POST | `/api/teacher/courses/:courseId/chapters/:chapterId/resources` | Ajouter une ressource | JWT | `TEACHER` + propriété | `ResourceDto` | `TeachingService.addResource` | 🟡 non appelé |

## Endpoints manquants constatés (fonctionnalités frontend sans contrepartie backend)

| Fonctionnalité UI | Endpoint attendu | État |
|---|---|---|
| Gestion des utilisateurs (Admin GET) — lister, créer, désactiver un utilisateur/rôle | `GET/POST/PATCH /users` | **Inexistant** — aucun `UserController` dans le backend |
| Gestion des transactions agrégées (Admin GET) | `GET /admin/transactions` ou équivalent | **Inexistant** (seul `GET /payments/stats` existe, agrégé, pas le détail transactionnel attendu par l'écran) |
| Liste des étudiants/professeurs d'une école (vue École, hors module `teaching`) | `GET /schools/:id/students`, `GET /schools/:id/teachers` | **Inexistant** |
| Gestion des affectations professeur↔école côté interface École | `POST/PUT /schools/:id/teachers` | **Inexistant** (le modèle `TeacherSchool` existe, seul le seed le peuple) |

## Endpoints backend jamais appelés par le frontend actuel (fonctionnels mais orphelins)

`GET/POST/PUT/DELETE /schools*` (hors lecture publique), `GET /schools/me/stats`, tout `/teacher/courses/*`, `GET /ministry/dashboard`, `GET/PUT/GET /applications/school/me`, `/:id/status`, `/:id/schedule-test`, `/:id/schedule-interview`, `/:id/score`, `GET /applications/stats`, tout `/audit/*`, `POST /notifications/*` (canaux admin). Ce sont, à l'exception du groupe `teaching` (CRIT-05, priorité de câblage immédiate car zéro travail backend restant), des endpoints secondaires ou d'arrière-plan qu'il est normal de ne pas voir appelés depuis un écran grand public.
