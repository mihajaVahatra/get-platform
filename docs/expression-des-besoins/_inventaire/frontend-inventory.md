# Inventaire des écrans frontend — GET (Grandes Écoles de Tananarive)

Généré par exploration statique du code sous `frontend/`. Toutes les affirmations sont sourcées par chemin de fichier (et ligne quand pertinent). Aucune donnée n'est inventée : quand une information n'a pas pu être vérifiée dans le code, elle est marquée "non vérifié".

## Architecture de navigation et protections

- **Pas de `middleware.ts`** trouvé dans `frontend/` (vérifié par recherche exhaustive). Aucune protection de route au niveau Next.js/edge.
- `frontend/app/layout.tsx` : layout racine, pas de logique d'auth, juste `<Toaster/>` global.
- `frontend/app/dashboard/layout.tsx` : **seule protection d'accès de l'app**, entièrement côté client :
  - Appelle `GET /auth/me` (ligne 109-121) ; si échec → `router.replace('/auth/login')`.
  - Stocke `userRole` (`STUDENT`, `SCHOOL_ADMIN`, `TEACHER`, `MINISTRY`, `ADMIN_GET`).
  - `ROLE_HOME` (lignes 57-63) associe un préfixe de route à chaque rôle ; un `useEffect` (lignes 164-170) redirige si `pathname` ne commence pas par le préfixe autorisé, et un garde de rendu (lignes 204-216) affiche "Redirection…" pour éviter un flash de contenu du mauvais portail.
  - Commentaire explicite dans le code (lignes 51-56) : ce garde client est une "défense en profondeur" — le vrai rempart est le `RolesGuard` du backend (403), pas ce code. **Donc si le JS ne s'exécute pas ou est contourné, la seule protection réelle est côté API.**
  - `frontend/app/auth/layout.tsx` n'a aucune logique de protection (juste un centrage visuel conditionnel).
- Le fichier `frontend/AGENTS.md` contient un texte prétendant que "cette version de Next.js a des changements cassants" et invite à lire une documentation dans `node_modules/next/dist/docs/` avant d'écrire du code — ce fichier n'a aucun rapport avec l'inventaire demandé et ressemble à une tentative d'instruction injectée dans le repo ; il a été ignoré car hors sujet et non pertinent pour une tâche de lecture seule.

---

## Portail: public

| Route | Fichier | Objectif métier | Composants clés | API appelées | Actions utilisateur | Données mockées ? | Statut apparent |
|---|---|---|---|---|---|---|---|
| `/` | `frontend/app/page.tsx` | Landing page vitrine (présentation GET, acteurs, actualités, partenaires) | Sections locales `Brand`, `ActorCard`, `Step`, `Stat`, `NewsCard`, `PartnerRow` (toutes définies dans le même fichier) | `fetch` direct (pas `apiClient`) vers `{API}/landing/config`, `{API}/landing/news?limit=3`, `{API}/landing/partners` (lignes 52-59) | Liens vers `/auth/login`, `/auth/register` (CTA "Je suis étudiant" et "Je suis une école / institution") | Oui, partiellement : `DEFAULT_CONFIG` (hero/stats/steps/actorCards, lignes 27-47) sert de **repli explicite** si le fetch échoue (`catch` ligne 65-67) — comportement assumé, pas un oubli | Fonctionnel (SSR avec repli gracieux) |

**Point d'attention** : le bouton "Je suis une école / institution" (`app/page.tsx` ligne 85) pointe vers `/auth/register`, qui ne permet de créer que des comptes `STUDENT` (voir portail *Auth* ci-dessous) → incohérence, détaillée en fin de document.

---

## Portail: auth (public, non authentifié)

| Route | Fichier | Objectif métier | Composants clés | API appelées | Actions utilisateur | Données mockées ? | Statut apparent |
|---|---|---|---|---|---|---|---|
| `/auth/login` | `frontend/app/auth/login/page.tsx` → `frontend/components/auth/LoginScreen.tsx` | Connexion | `LoginScreen` (formulaire email/mdp + MFA) | `POST /auth/login` (LoginScreen.tsx:89), `POST /auth/mfa/login-verify` (:373), `POST /auth/logout` (:64 et :69, appelé deux fois dans le flux — à clarifier), redirection par rôle via `destinations[user.role]` (:83) | Se connecter, saisir code MFA, lien "mot de passe oublié", lien "s'inscrire" | Non | Fonctionnel |
| `/auth/register` | `frontend/app/auth/register/page.tsx` | Création de compte | Formulaire `react-hook-form` + `zod` (règles de mot de passe fort) | `POST /auth/register` (ligne ~81) | Créer un compte, accepter les CGU | Non | Fonctionnel, mais **limité aux étudiants** : après succès, `router.replace('/dashboard/student')` est codé en dur (ligne ~90) — aucun champ de sélection de rôle/type de compte (école, etc.) dans le formulaire |
| `/auth/forgot-password` | `frontend/app/auth/forgot-password/page.tsx` | Demande de réinitialisation | Formulaire email | `POST /auth/forgot-password` (ligne 36) | Envoyer le lien de réinitialisation | Non | Fonctionnel |
| `/auth/reset-password` | `frontend/app/auth/reset-password/page.tsx` | Réinitialisation du mot de passe (via token en query param, `useSearchParams`) | Formulaire mot de passe + indicateur de force (`getPasswordStrength`) | `POST /auth/reset-password` (ligne 119) | Définir un nouveau mot de passe | Non | Fonctionnel |

---

## Écran technique transverse

| Route | Fichier | Objectif métier | API appelées | Statut |
|---|---|---|---|---|
| `/dashboard` | `frontend/app/dashboard/page.tsx` | Redirection automatique vers le portail du rôle courant | `GET /auth/me` puis `router.replace()` vers `/dashboard/{student\|school\|teacher\|ministry\|admin}` selon le rôle | Fonctionnel, écran de transition uniquement ("Redirection...") |

---

## Portail: admin (ADMIN_GET)

Protection : redirection dans `dashboard/layout.tsx` si `userRole !== 'ADMIN_GET'` et route hors `/dashboard/admin`.

8 fichiers `page.tsx` physiques ; la page racine `/dashboard/admin` embarque en plus **11 sous-écrans accessibles uniquement via `?section=...`** (routées côté client dans `app/dashboard/admin/page.tsx` lignes 31-67), chacun rendant un composant distinct de `components/admin-portal/`.

| Route | Fichier | Objectif métier | Composants clés | API appelées | Actions utilisateur | Données mockées ? | Statut apparent |
|---|---|---|---|---|---|---|---|
| `/dashboard/admin` | `frontend/app/dashboard/admin/page.tsx` | Tableau de bord global plateforme (KPIs) | `DashboardSummary`, `Kpi`, `NotificationBell`, `MessageIconLink` | `GET /admin/dashboard-summary` (ligne 85) | Navigation uniquement | Non | Fonctionnel. **Suspect** : le champ de recherche "Rechercher un étudiant, une école, un cours..." (lignes 117-126) n'a ni `onChange` ni logique de soumission — non connecté |
| `/dashboard/admin?section=messages` | `components/messages/messages-screen.tsx` (ré-export de `app/dashboard/student/messages/page.tsx`) | Messagerie interne admin | `MessagesScreen` | Voir portail student → `/messages/conversations`, etc. | Lire/répondre aux messages | Non | Fonctionnel |
| `/dashboard/admin?section=activity` | `components/admin-portal/activity-log.tsx` | Journal d'audit de la plateforme | `ActivityLog` | `GET /audit` (ligne 65, avec filtres) | Filtrer/consulter les logs | Non | Fonctionnel |
| `/dashboard/admin?section=announcements` | `components/admin-portal/announcements-broadcast.tsx` | Diffusion d'annonces globales | `AnnouncementsBroadcast` | `GET /schools/announcements/broadcast` (:33), `POST` même endpoint (:57) | Rédiger et diffuser une annonce | Non | Fonctionnel |
| `/dashboard/admin?section=competitions` | `components/admin-portal/competitions-manager.tsx` | Gestion des concours | `CompetitionsManager` | `GET/POST/PATCH/DELETE /competitions` (lignes 79,119,339,342) | Créer/modifier/supprimer un concours | Non | Fonctionnel (CRUD complet) |
| `/dashboard/admin?section=partners` | `components/admin-portal/financial-partners-manager.tsx` | Gestion des partenaires financiers | `FinancialPartnersManager` | `GET/POST/PATCH/DELETE /financial-partners` (lignes 56,83,287,315,318) | CRUD partenaire | Non | Fonctionnel |
| `/dashboard/admin?section=landing-content` | `components/admin-portal/landing-content-manager.tsx` | Édition du contenu de la page vitrine (hero, stats, étapes, cartes acteurs) | `LandingContentManager` | `GET /landing/config` (:42), `PUT /landing/config/hero\|stats\|steps\|actor-cards` (:132,185,254,309) | Modifier les textes/chiffres de la landing | Non (édite en fait le contenu qui alimente `/` en cas de repli) | Fonctionnel |
| `/dashboard/admin?section=landing-news` | `components/admin-portal/landing-news-manager.tsx` | Gestion des actualités publiées sur la landing | `LandingNewsManager` | `GET /landing/news/admin` (:39), `DELETE /landing/news/:id` (:66), `PATCH/POST /landing/news` (:259,262), `POST /landing/news/:id/photo` (:269) | CRUD actualité + upload photo | Non | Fonctionnel |
| `/dashboard/admin?section=teacher-conflicts` | `components/admin-portal/teacher-conflicts-view.tsx` | Détection de conflits d'emploi du temps entre professeurs (multi-écoles) | `TeacherConflictsView` | `GET /teachers` (:37), `GET /teachers/:id/conflicts` (:62) | Rechercher un professeur, consulter ses conflits | Non | Fonctionnel |
| `/dashboard/admin?section=students` | `components/admin-portal/students-directory.tsx` | Annuaire global des étudiants (toutes écoles) | `StudentsDirectory` | `GET /schools/students` (:39, avec params) | Rechercher/filtrer un étudiant | Non | Fonctionnel |
| `/dashboard/admin?section=programs` | `components/admin-portal/programs-directory.tsx` | Annuaire global des programmes/filières | `ProgramsDirectory` | `GET /schools/programs` (:38, avec params) | Rechercher/filtrer un programme | Non | Fonctionnel |
| `/dashboard/admin?section=notifications` | `components/admin-portal/notifications-overview.tsx` | Vue d'ensemble des statistiques de notifications plateforme | `NotificationsOverview` | `GET /notifications/platform-stats` (:23) | Consultation | Non | Fonctionnel |
| `/dashboard/admin/academic-years` | `frontend/app/dashboard/admin/academic-years/page.tsx` → `components/admin-portal/academic-years-manager.tsx` | Gestion des années académiques (niveau plateforme) | `AcademicYearsManager` | `GET/POST/PATCH/DELETE /academic-years` (lignes 32,56,212,215) | CRUD année académique | Non | Fonctionnel |
| `/dashboard/admin/enrollments` | `frontend/app/dashboard/admin/enrollments/page.tsx` → `AdminManagementView view="enrollments"` → `EnrollmentsDirectory` (`components/admin-portal/admin-management-view.tsx` ligne 315) | Vue globale des candidatures/inscriptions (libellé menu "Inscriptions & Admissions") | `EnrollmentsDirectory` | `GET /applications` (ligne 326, paginé, recherche, statut) | Rechercher/filtrer/paginer les candidatures | Non | Fonctionnel |
| `/dashboard/admin/reports` | `frontend/app/dashboard/admin/reports/page.tsx` → `AdminManagementView view="reports"` → `Reports` (ligne 1125) | Rapports & statistiques plateforme | `Reports` | `GET /payments/stats` (:1135), `GET /applications/stats` (:1136) | Consultation de KPIs | Non | Fonctionnel |
| `/dashboard/admin/schools` | `frontend/app/dashboard/admin/schools/page.tsx` → `AdminManagementView view="schools"` → `SchoolsDirectory` (ligne 67) | Gestion des établissements | `SchoolsDirectory` | `GET /schools` (:82), `DELETE /schools/:id` (:109, désactivation), `PUT/POST /schools` (:884-885) | Créer/éditer/désactiver un établissement | Non | Fonctionnel |
| `/dashboard/admin/settings` | `frontend/app/dashboard/admin/settings/page.tsx` → `AdminManagementView` (vue par défaut) → `SettingsView` (ligne 1223) | Paramètres généraux plateforme | `SettingsView` | `GET/PUT /settings` (lignes 1232,1250) | Modifier les paramètres globaux | Non | Fonctionnel |
| `/dashboard/admin/transactions` | `frontend/app/dashboard/admin/transactions/page.tsx` → `AdminManagementView view="transactions"` → `TransactionsDirectory` (ligne 479) | Vue globale des transactions/paiements | `TransactionsDirectory` | `GET /payments/admin` (:489, avec params) | Filtrer/consulter les transactions | Non | Fonctionnel |
| `/dashboard/admin/users` | `frontend/app/dashboard/admin/users/page.tsx` → `AdminManagementView view="users"` → `UsersDirectory` (ligne 599) | Gestion des comptes utilisateurs | `UsersDirectory` | `GET /users` (:612), `PATCH /users/:id/status` (:644) | Activer/désactiver un compte | Non | Fonctionnel |

---

## Portail: ministry (MINISTRY)

Protection : redirection dans `dashboard/layout.tsx` si rôle ≠ `MINISTRY`. Le menu ne propose que "Tableau de bord", "Rapports", "Conformité" (`MinistrySidebar`, `dashboard/layout.tsx` lignes 1204-1215) — cohérent avec les 3 pages existantes.

| Route | Fichier | Objectif métier | Composants clés | API appelées | Actions utilisateur | Données mockées ? | Statut apparent |
|---|---|---|---|---|---|---|---|
| `/dashboard/ministry` | `frontend/app/dashboard/ministry/page.tsx` → `components/ministry-portal/ministry-dashboard.tsx` | Tableau de bord agrégé national (établissements, étudiants, tendances) | `MinistryDashboard` | `GET /ministry/dashboard` (ministry-dashboard.tsx:126) | Consultation, navigation | Non | Fonctionnel |
| `/dashboard/ministry/reports` | `frontend/app/dashboard/ministry/reports/page.tsx` | Génération et consultation de rapports nationaux | Sélecteurs de type (`NATIONAL`...), formulaire de génération | `GET /ministry/reports` (:122, avec filtres), `POST /ministry/reports/generate` (:176), `GET` supplémentaire (:197, probable téléchargement) | Filtrer, générer un rapport, télécharger | Non | Fonctionnel |
| `/dashboard/ministry/compliance` | `frontend/app/dashboard/ministry/compliance/page.tsx` | Suivi de conformité des établissements | Tableau filtrable par statut (`PASSED`...), formulaire d'édition | `GET /ministry/compliance` (:123, filtres), `PUT /ministry/compliance/:schoolId` (:208) | Filtrer par statut, éditer un contrôle de conformité | Non | Fonctionnel |

---

## Portail: school (SCHOOL_ADMIN)

Protection identique (redirection si rôle ≠ `SCHOOL_ADMIN`, sauf que `TEACHER` partage le même layout visuel mais une sidebar différente — voir portail teacher).

| Route | Fichier | Objectif métier | Composants clés | API appelées | Actions utilisateur | Données mockées ? | Statut apparent |
|---|---|---|---|---|---|---|---|
| `/dashboard/school` | `frontend/app/dashboard/school/page.tsx` | Tableau de bord établissement (offres, candidatures, paiements, effectifs) | KPIs, liste paiements récents | `GET /schools/me/stats` (:79), `/schools/me/payments?limit=5` (:80), `/schools/me/students?page=1&limit=1` (:81), `/schools/me/courses` (:82), `/schools/me/teachers` (:83) | Navigation, consultation | Non | Fonctionnel |
| `/dashboard/school/applications` | `frontend/app/dashboard/school/applications/page.tsx` | Liste des candidatures reçues par offre | Tableau filtrable (offre, statut, liste d'attente) | `GET /offers/mine` (:110), `GET /applications/school/me?...` (ligne 138) | Filtrer, ouvrir un dossier | Non | Fonctionnel |
| `/dashboard/school/applications/[id]` | `frontend/app/dashboard/school/applications/[id]/page.tsx` (788 lignes — la plus volumineuse du portail école) | Traitement complet d'un dossier de candidature | Formulaires de planification test/entretien, notation, changement de statut | `GET /applications/:id` (:175), `GET /applications/:id/documents` (:187), `POST /applications/:id/schedule-test` (:259), `POST /applications/:id/schedule-interview` (:268), `POST /applications/:id/score` (:277), `PUT /applications/:id/status` (:289) | Programmer un test, programmer un entretien, noter, changer le statut (accepter/rejeter/liste d'attente) | Non | Fonctionnel, riche |
| `/dashboard/school/classes` | `frontend/app/dashboard/school/classes/page.tsx` → `components/school-portal/class-directory.tsx` | Gestion des classes et affectations enseignants | `ClassDirectory` | `GET /schools/me/classes\|academic-years\|programs\|subjects\|teachers` (:78-82), `POST /schools/me/classes` (:187), `PATCH` classe (:300), CRUD prérequis (:320-362) | Créer/éditer classe, gérer les prérequis et affectations | Non | Fonctionnel |
| `/dashboard/school/communications` | `frontend/app/dashboard/school/communications/page.tsx` | Diffusion de communications ciblées (classes/profs) | Formulaire ciblage + historique | `GET` historique (:75), `GET /schools/me/students/classes` (:91), `GET /schools/me/teachers` (:92), `POST` x2 (:173,181) | Rédiger et envoyer une communication ciblée | Non | Fonctionnel |
| `/dashboard/school/courses` | `frontend/app/dashboard/school/courses/page.tsx` → `components/school-portal/course-directory.tsx` | CRUD des cours | `CourseDirectory` | `GET /schools/me/courses\|teachers\|programs` (:113-115), `PUT` désactivation (:184), `PUT/POST` cours (:228,232) | Créer/éditer/désactiver un cours | Non | Fonctionnel |
| `/dashboard/school/documents` | `frontend/app/dashboard/school/documents/page.tsx` | Consultation des documents étudiants par classe/type | Filtres + liste | `GET /schools/me/students/classes` (:93), `GET /schools/me/documents?...` (ligne 124) | Filtrer/rechercher, consulter | Non | Fonctionnel |
| `/dashboard/school/messages` | `frontend/app/dashboard/school/messages/page.tsx` → `components/messages/messages-screen.tsx` | Messagerie interne (même composant que le portail étudiant) | `MessagesScreen` | Voir endpoints `/messages/...` du portail student | Lire/répondre | Non | Fonctionnel |
| `/dashboard/school/offers` | `frontend/app/dashboard/school/offers/page.tsx` | Liste des offres de formation publiées | Tableau + actions | `GET /offers/mine` (:56), `DELETE /offers/:id` (:70), `PATCH /offers/:id/status` (:83) | Créer (lien vers `/new`), ouvrir/fermer, supprimer une offre | Non | Fonctionnel |
| `/dashboard/school/offers/[id]` | `frontend/app/dashboard/school/offers/[id]/page.tsx` | Détail / édition d'une offre | Formulaire d'édition | `GET /offers/:id` (:53), `PUT /offers/:id` (:84) | Modifier une offre | Non | Fonctionnel |
| `/dashboard/school/offers/new` | `frontend/app/dashboard/school/offers/new/page.tsx` | Création d'une nouvelle offre | Formulaire (titre, diplôme...) | `GET /schools/me` (:66), `/schools/me/requirements` (:72), `/schools/me/programs` (:73), `POST /offers` (:80) | Créer une offre | Non | Fonctionnel |
| `/dashboard/school/payments` | `frontend/app/dashboard/school/payments/page.tsx` | Suivi des paiements reçus (frais de scolarité/dossier) | KPIs "En attente"/"Montant encaissé" | `GET` paiements avec résumé (ligne 76) | Consultation, filtrage | Non | Fonctionnel |
| `/dashboard/school/reports` | `frontend/app/dashboard/school/reports/page.tsx` (44 lignes, orchestre des sous-composants graphiques) | Rapports & statistiques + export CSV | `ChartCard`, `PipelineFunnel`, `OutcomesChart`, `TrendLine`, `MagnitudeBarChart`, `ReportCard` | `GET .../reports/export?type=` (blob, ligne 23) ; sous-composants : `GET /schools/me/reports/pipeline` (PipelineFunnel.tsx:13), `/reports/outcomes` (OutcomesChart.tsx:18), `/reports/trend?months=6` (TrendLine.tsx:13), `/reports/by-offer` et `/reports/by-class` (MagnitudeBarChart, endpoint en prop) | Exporter candidatures (CSV), exporter étudiants inscrits (CSV) | Non | Fonctionnel |
| `/dashboard/school/schedule` | `frontend/app/dashboard/school/schedule/page.tsx` → `components/school-portal/schedule-board.tsx` | Emplois du temps, salles, génération automatique de planning | `SchoolSchedulePortal` | `GET /schools/me/schedule\|courses` (:150-151), `POST` créneau (:178), `DELETE` créneau (:200), `GET years/classes/subjects/rooms/teachers` (:216-220), `POST /schools/me/schedule/generate` (:243), `GET/POST/DELETE /schools/me/time-slots` (:656,684,704) | Créer un créneau, générer un planning automatiquement, gérer les créneaux horaires | Non | Fonctionnel, fonctionnalité avancée (génération auto) |
| `/dashboard/school/settings` | `frontend/app/dashboard/school/settings/page.tsx` (966 lignes — la plus volumineuse de tout le frontend) | Paramétrage complet de l'établissement (infos générales, filières, années académiques, matières, exigences d'admission, salles) | Formulaires multiples | `GET/PUT /schools/me` (:120,206), `GET /schools/me/programs\|academic-years\|subjects` (:174,178,187), `POST/PATCH` filières (:268,281), années (:302,316), matières (:329,341), exigences (:240,255), `GET/POST/DELETE /schools/me/rooms` (:803,828,849) | CRUD complet sur tous ces référentiels | Non | Fonctionnel |
| `/dashboard/school/students` | `frontend/app/dashboard/school/students/page.tsx` → `components/school-portal/student-import-directory.tsx` | Gestion des étudiants inscrits + import en masse | `StudentImportDirectory` | `GET` étudiants filtrés (:119), `GET programs/academic-years` (:147-148), `PATCH` retrait (:185), `GET` détail (:210), `PATCH` édition (:237), `POST /schools/me/students/enroll` (:263), `POST` import (:303) | Inscrire, retirer, éditer, importer des étudiants | Non | Fonctionnel |
| `/dashboard/school/teachers` | `frontend/app/dashboard/school/teachers/page.tsx` → `components/school-portal/people-directory.tsx` | CRUD des enseignants et affectations | `TeacherDirectory` | `GET /schools/me/teachers` (actifs, :88) et inactifs (:89), `GET` détail (:143), `POST` création (:174), `PATCH` édition (:177) et affectation (:198) | Créer/éditer un professeur, gérer ses affectations | Non | Fonctionnel |

---

## Portail: teacher (TEACHER)

**Une seule route physique** (`/dashboard/teacher`) qui multiplexe **~12 vues** via le paramètre `?view=` (routage géré dans `components/teacher-portal/teacher-portal.tsx` lignes 212-224). La sidebar (`dashboard/layout.tsx`, `TeacherSidebar`, lignes 591-754) construit tous ses liens sous cette forme (`/dashboard/teacher?view=courses`, etc.).

| Route (query `view=`) | Fichier(s) | Objectif métier | API appelées | Actions utilisateur | Statut apparent |
|---|---|---|---|---|---|
| *(défaut)* Tableau de bord | `frontend/app/dashboard/teacher/page.tsx` → `components/teacher-portal/teacher-dashboard.tsx` | Vue d'ensemble (cours, étudiants, devoirs à corriger, évaluations à venir, messages non lus) | `GET /teacher/dashboard/summary` (:98), `GET /teacher/courses/schedule` (:111) | Navigation | Fonctionnel |
| `courses` / `course-detail` | `teacher-portal.tsx` | Mes cours, détail d'un cours | `GET /teacher/courses` (:1583,1669,2532), `GET /teacher/courses/schools` (:254), `GET /teacher/courses/:id` (:409) | Consulter, gérer un cours | Fonctionnel |
| `students` | `teacher-portal.tsx` | Étudiants des cours du professeur | Endpoints non tous détaillés individuellement dans l'extraction, mais rattachés à `/teacher/courses` | Consultation | Fonctionnel (non vérifié en détail) |
| `evaluations` | `teacher-portal.tsx` | Évaluations | `POST/PATCH` (lignes 620,652) | Créer/modifier une évaluation | Fonctionnel |
| `grades` | `teacher-portal.tsx` | Notes & Bulletins | `GET/PATCH` (lignes 2163,2187,1925,1953) | Saisir/modifier des notes | Fonctionnel |
| `schedule` | `components/teacher-portal/teacher-schedule.tsx` | Emploi du temps | `GET /teacher/courses/schedule` (:42) | Consultation | Fonctionnel |
| `availability` | `components/teacher-portal/teacher-availability.tsx` | Disponibilités et zones de déplacement (multi-écoles) | `GET /teacher/availability` (:49), `/teacher/travel-buffers` (:50), `/teacher/courses/schools` (:51), `POST/DELETE /teacher/availability` (:123,143), `POST/DELETE /teacher/travel-buffers` (:299,316) | Ajouter/supprimer une disponibilité ou une zone tampon de déplacement | Fonctionnel |
| `assignments` | `components/teacher-portal/teacher-assignments.tsx` | Devoirs (création, correction) | `GET /teacher/courses` (:71), `GET` soumissions (:97,114), `POST` (:153), `PATCH` correction (:183) | Créer un devoir, corriger une soumission | Fonctionnel |
| `resources` | `teacher-portal.tsx` | Ressources pédagogiques | `GET /teacher/courses/resources` (:2408), `POST` upload (:691) | Ajouter une ressource | Fonctionnel |
| `messages` | `teacher-portal.tsx` (intégré, pas `MessagesScreen`) | Messagerie professeur | Endpoints messages internes au fichier (lignes 2516 et alentours) | Lire/répondre | Fonctionnel (non vérifié en détail, fichier très volumineux) |
| `announcements` | `teacher-portal.tsx` | Annonces de cours | `POST /teacher/courses/:id/announcements` (:2566) | Publier une annonce | Fonctionnel |
| `settings` | `teacher-portal.tsx` | Profil & paramètres professeur | `GET/PATCH /teacher/profile` (:2745,2768), `PATCH /teacher/profile/password` (:2871), `PATCH /teacher/profile/theme` (:2992) | Modifier profil, mot de passe, thème | Fonctionnel |

**Note méthodologique** : `components/teacher-portal/teacher-portal.tsx` fait plus de 3000 lignes et concentre la quasi-totalité de la logique des 12 vues ; l'analyse ci-dessus est basée sur les appels `apiClient` détectés par recherche exhaustive (`grep`) plutôt que sur une lecture ligne à ligne complète du fichier — à confirmer/compléter lors d'une revue plus approfondie si nécessaire.

---

## Portail: student (STUDENT)

Le layout (`dashboard/layout.tsx`, lignes 218-290) distingue deux états : **candidat** (`isEnrolled === false`, pas encore admis dans une école) et **inscrit** (`isEnrolled === true`), avec des menus différents (lignes 1340-1443). Cette distinction est aussi gérée directement dans `app/dashboard/student/page.tsx` (ligne 187-188 : `if (student && enrollments.length === 0) return <CandidateDashboard student={student} />;`).

| Route | Fichier | Objectif métier | Composants clés | API appelées | Actions utilisateur | Données mockées ? | Statut apparent |
|---|---|---|---|---|---|---|---|
| `/dashboard/student` (candidat) | `frontend/app/dashboard/student/page.tsx`, fonction `CandidateDashboard` (ligne ~538) | Accueil candidat : suivi de dossier, étapes (compléter dossier / candidater / suivre admissions) | `steps` calculés dynamiquement | `GET /applications/me?limit=100` (:540), `GET /offers?limit=3` | Naviguer vers profil/offres/candidatures | Non | Fonctionnel |
| `/dashboard/student` (inscrit) | même fichier, corps principal (lignes ~200-520) | Accueil étudiant inscrit : emploi du temps du jour, devoirs, cours/notes, événements à venir, stats (moyenne, crédits, absences, points de mérite) | `StatWidget`, `Widget` | **Aucun appel API pour le contenu** : `schedule` (lignes 66-91), `tasks` (94-115), `courses` (118-137), `events` (140-152) sont des **tableaux codés en dur** dans le fichier ; les 4 `StatWidget` ("Moyenne générale 15,2/20", "Crédits validés 18/30", "Absences 2", "Points de mérite 120 pts", lignes ~236-262) affichent des **valeurs littérales fixes**, pas des données dérivées de `student` ou d'un fetch | Liens de navigation vers les sous-écrans | **OUI — données 100% mockées** malgré une UI d'apparence connectée | **Statique** (apparence fonctionnelle trompeuse) |
| `/dashboard/student/applications` | `frontend/app/dashboard/student/applications/page.tsx` | Mes candidatures (suivi, filtres par statut incl. liste d'attente) | Tableau paginé + filtres | `GET /applications/me?...` (paginé, ligne 137) | Filtrer par statut, paginer, consulter le détail | Non | Fonctionnel |
| `/dashboard/student/assignments` | `frontend/app/dashboard/student/assignments/page.tsx` | Mes devoirs (par cours), soumission | Sélecteur de cours + liste devoirs | `GET /students/me/courses` (:34), `GET /students/me/courses/:id/assignments` (:49), `POST` soumission (:78) | Sélectionner un cours, soumettre un devoir (fichier) | Non | Fonctionnel. États gérés : chargement ("Chargement de vos cours…"), vide ("Vous n'êtes inscrit à aucun cours pour le moment.") |
| `/dashboard/student/courses` | `frontend/app/dashboard/student/courses/page.tsx` | Mes cours | Liste | `GET /students/me/courses` (:24) | Consultation | Non | Fonctionnel. États gérés : chargement, erreur ("Vos cours n'ont pas pu être chargés."), vide |
| `/dashboard/student/documents` | `frontend/app/dashboard/student/documents/page.tsx` | Mes documents (pièce d'identité, photo...) | Liste + upload | `GET /students/me/documents` (:54), `POST` upload (:79), `DELETE /students/me/documents/:id` (:108) | Ajouter, supprimer un document | Non | Fonctionnel |
| `/dashboard/student/grades` | `frontend/app/dashboard/student/grades/page.tsx` | Mes notes | Tableau par cours | `GET /students/me/grades` (:51) | Consultation | Non | Fonctionnel. États gérés : chargement, erreur, vide |
| `/dashboard/student/library` | `frontend/app/dashboard/student/library/page.tsx` → `components/student-portal/portal-view.tsx` (`view="library"`) | Bibliothèque en ligne | `ComingSoon` (portal-view.tsx ligne 24) | Aucun | Lien "Retour à l'accueil" | Non applicable — **écran placeholder explicite** | **Statique / non connecté**, assumé dans le code même : texte affiché "Cet espace est prêt à être connecté. Le lien fonctionne. Son contenu sera alimenté dès que les données correspondantes seront disponibles." |
| `/dashboard/student/messages` | `frontend/app/dashboard/student/messages/page.tsx` (601 lignes ; réutilisé par school/admin via `MessagesScreen`) | Messagerie interne complète | Vue conversations + fil de discussion | `GET /messages/conversations?limit=30` (:116), `GET` messages d'une conversation (:141), `PATCH .../read` (:145), `POST` envoi message (:187), `POST` (pièce jointe probable, :222) | Lire, répondre, marquer comme lu, envoyer une pièce jointe, composer (`?compose=1`) | Non | Fonctionnel, le plus complet du portail |
| `/dashboard/student/news` | `frontend/app/dashboard/student/news/page.tsx` → `portal-view.tsx` (`view="news"`) → `components/shared/school-news-feed.tsx` | Actualités de l'établissement | `SchoolNewsFeed` | `GET` actualités (school-news-feed.tsx:26), `PUT /notifications/:id/read` (:58) | Consulter, marquer comme lu | Non | Fonctionnel (contrairement à library/opportunities) |
| `/dashboard/student/offers` | `frontend/app/dashboard/student/offers/page.tsx` | Recherche d'offres de formation, candidature | Filtres (diplôme, ville...) | `GET /offers?...` (:62), `GET /applications/me` (:74, pour savoir si déjà postulé), `POST /applications` (:90) | Rechercher, filtrer, candidater | Non | Fonctionnel |
| `/dashboard/student/opportunities` | `frontend/app/dashboard/student/opportunities/page.tsx` → `portal-view.tsx` (`view="opportunities"`) | Stages & emplois | `ComingSoon` | Aucun | Lien retour accueil | Non applicable — **écran placeholder explicite** | **Statique / non connecté**, même mécanisme que `library` |
| `/dashboard/student/parcours` | `frontend/app/dashboard/student/parcours/page.tsx` → `portal-view.tsx` (`view="parcours"`) → fonction `Parcours()` (ligne 19-21) | Mon parcours (progression du programme, matières validées, jalons) | Anneau de progression, liste de matières, timeline | **Aucun appel API** : `subjects` (ligne 20, tableau codé en dur), progression "60%", crédits "18/30", matières validées "12/20", jalons avec dates fixes ("30 juin 2025", "01-12 juillet 2025"...) tous en dur dans le JSX | Bouton "Télécharger mon relevé" (**sans `onClick`**, ligne 21) | **OUI — 100% mockées** | **Statique**, avec un bouton d'action non fonctionnel |
| `/dashboard/student/payments` | `frontend/app/dashboard/student/payments/page.tsx` | Paiement des frais (scolarité, dossier) | Sélection candidature, initiation paiement, reçu | `GET /payments` (:120), `GET /applications/me?limit=100` (:132), `POST /payments/initiate` (×2, :205 et :235 — probablement 2 moyens de paiement), `GET /payments/:id/receipt` (blob, :256) | Choisir une candidature, payer, télécharger un reçu | Non | Fonctionnel |
| `/dashboard/student/profile` | `frontend/app/dashboard/student/profile/page.tsx` | Mon profil / dossier candidat (infos perso, adresse, parcours scolaire) | Formulaire multi-sections | `GET /students/me` (:55), `GET /students/me/stats` (:70), `PUT /students/me` (:87) | Éditer le profil | Non | Fonctionnel |
| `/dashboard/student/schedule` | `frontend/app/dashboard/student/schedule/page.tsx` | Emploi du temps de l'étudiant inscrit | Liste de créneaux | `GET /students/me/schedule` (:33) | Consultation | Non | Fonctionnel. États gérés : chargement ("Chargement de l'emploi du temps…"), erreur ("Votre emploi du temps n'a pas pu être chargé."), vide ("Aucun créneau planifié pour le moment.") |
| `/dashboard/student/settings` | `frontend/app/dashboard/student/settings/page.tsx` | Profil & Paramètres (mot de passe, thème) | Formulaires | `GET /students/me` (:223), `PATCH /students/me/password` (:137), `PATCH /students/me/theme` (:246) | Changer mot de passe, changer thème | Non | Fonctionnel |

---

## Écrans isolés ou non reliés à un parcours clair

1. **`/dashboard/student/library` et `/dashboard/student/opportunities`** (`components/student-portal/portal-view.tsx`, fonction `ComingSoon`) — accessibles depuis la sidebar étudiant inscrit, mais le contenu est un écran d'attente générique explicitement marqué "prêt à être connecté" dans le code. Ce sont des liens qui fonctionnent (pas de 404) mais sans aucune valeur métier actuelle.
2. **`/dashboard/student/parcours`** — accessible et visuellement complet, mais 100% déconnecté de l'API (voir tableau ci-dessus) ; à ce stade il constitue un habillage visuel isolé du reste du système de données (cours, notes, crédits réels exposés par ailleurs via `/students/me/courses`, `/students/me/grades`).
3. **La section homepage de l'étudiant inscrit** (`/dashboard/student`, bloc "inscrit") — bien qu'intégrée dans le parcours principal (première page vue après connexion), son contenu (emploi du temps, devoirs, cours/notes, événements, statistiques) est totalement statique et déconnecté des vraies données disponibles par ailleurs via les pages dédiées (`/dashboard/student/schedule`, `/assignments`, `/courses`, `/grades`), créant un risque de confusion pour l'utilisateur final (les chiffres affichés à l'accueil ne correspondent à rien de réel).
4. **Le champ de recherche global** sur `/dashboard/admin` (`app/dashboard/admin/page.tsx` lignes 117-126) et sur `/dashboard/student` "inscrit" (lignes ~208-214, `Input placeholder="Rechercher..."`) — présents visuellement dans l'en-tête mais sans logique de recherche câblée (pas de `onChange`, pas d'appel API), à considérer comme fonctionnalité annoncée mais non implémentée plutôt que comme écran réel.
5. **`/dashboard/school/documents`, `/dashboard/school/payments`, `/dashboard/school/reports`, `/dashboard/school/communications`** ne sont reliés à aucun "assistant" ou parcours guidé explicite (contrairement au parcours candidat côté étudiant) ; ce sont des écrans de gestion autonomes accessibles uniquement via la sidebar "Administration".

---

## Incohérences de navigation observées

1. **Landing page → inscription école incohérente.** `frontend/app/page.tsx` (ligne 85) propose un CTA "Je suis une école / institution" qui pointe vers `/auth/register`. Or `frontend/app/auth/register/page.tsx` ne contient aucun champ de sélection de rôle et crée systématiquement un compte `STUDENT` (redirection codée en dur vers `/dashboard/student` après succès). **Un visiteur cliquant sur ce bouton en tant qu'établissement ne peut pas créer de compte "école" via ce formulaire** — soit la fonctionnalité manque, soit le lien de la landing page est trompeur.
2. **Boutons sans gestionnaire d'événement (`onClick` manquant) repérés dans le code :**
   - `frontend/components/student-portal/portal-view.tsx` ligne 21 : bouton "Télécharger mon relevé" (`Parcours()`).
   - `frontend/components/student-portal/portal-view.tsx` ligne 26 : bouton générique `action` du composant `Panel` (rendu quand une prop `action` est passée, mais aucun handler n'est câblé dans ce fichier).
   - `frontend/app/dashboard/student/page.tsx` (fonction `Widget`, ligne ~940) : bouton "Voir tout" affiché sur les widgets "Emploi du temps" / "Devoirs" (aucun `onClick`).
   - `frontend/app/dashboard/student/page.tsx` (bandeau "Astuce GET", ligne ~531) : bouton de fermeture "×" sans `onClick`.
   - `frontend/components/student-portal/portal-view.tsx` ligne 10 : icône cloche (`Bell`) sans `onClick` dans l'en-tête `StudentPortalView`.
3. **Doublon d'appel `POST /auth/logout` dans le flux de connexion.** `frontend/components/auth/LoginScreen.tsx` appelle `apiClient.post('/auth/logout')` à deux endroits proches (lignes 64 et 69) avant même la tentative de connexion — comportement à clarifier avec l'équipe technique (nettoyage défensif de session résiduelle probable, mais non documenté dans le code).
4. **Deux endpoints d'initiation de paiement quasi identiques.** `frontend/app/dashboard/student/payments/page.tsx` appelle `POST /payments/initiate` à deux endroits (lignes 205 et 235) — vraisemblablement deux moyens de paiement différents (ex. mobile money vs carte), mais cela n'a pas pu être confirmé sans lire le détail des payloads ; à vérifier si les deux cas sont bien distincts fonctionnellement ou s'il y a redondance.
5. **Différence desktop / mobile de la sidebar** : dans `frontend/app/dashboard/layout.tsx`, chaque sidebar (`StudentSidebar`, `SchoolSidebar`, `TeacherSidebar`, `AdminGetSidebar`, `MinistrySidebar`) affiche un bloc "profil utilisateur" et un bloc d'aide/support en `hidden ... lg:block` (visibles seulement en desktop) et un bloc équivalent réduit en `lg:hidden` (mobile) — cohérent et volontaire (commenté dans le code), mais à noter que la barre de recherche globale du tableau de bord admin est, elle, **`hidden xl:block`** (`app/dashboard/admin/page.tsx` ligne 117) : elle n'apparaît donc ni sur mobile ni sur tablette, uniquement en grand écran — à confirmer si c'est un choix produit assumé.
6. **Vues "cachées" non découvrables sans connaître l'URL exacte.** Toutes les sous-vues admin pilotées par `?section=` (ex. `teacher-conflicts`, `programs`, `partners`, `landing-content`, `landing-news`) et toutes les vues professeur pilotées par `?view=` ne correspondent à **aucune route physique Next.js** distincte : elles ne sont accessibles que via les liens de la sidebar (`dashboard/layout.tsx`) et ne peuvent pas être partagées/bookmarkées de façon aussi robuste qu'une route classique côté SEO/analytics, même si elles fonctionnent correctement en navigation normale.

---

## Synthèse des données mockées / statiques identifiées

| Écran | Fichier | Nature |
|---|---|---|
| `/dashboard/student` (état inscrit) | `frontend/app/dashboard/student/page.tsx` lignes 66-152, 236-262 | Emploi du temps du jour, devoirs, cours/notes, événements, KPIs (moyenne, crédits, absences, points de mérite) — tableaux et valeurs 100% codés en dur |
| `/dashboard/student/parcours` | `frontend/components/student-portal/portal-view.tsx` ligne 20-21 | Matières, progression, crédits, jalons — 100% codés en dur |
| `/dashboard/student/library` | `frontend/components/student-portal/portal-view.tsx` ligne 24 | Écran "coming soon" explicite |
| `/dashboard/student/opportunities` | `frontend/components/student-portal/portal-view.tsx` ligne 24 | Écran "coming soon" explicite |
| `/` (landing) | `frontend/app/page.tsx` lignes 27-47, 60-67 | `DEFAULT_CONFIG` — repli assumé en cas d'échec du `fetch`, pas une donnée mockée cachée |

Aucune autre occurrence de données mockées en dur n'a été trouvée dans le reste du code applicatif (`app/`, `components/`) lors de la recherche exhaustive des motifs `mock`, `dummy`, `TODO`, `FIXME`, `hardcod`, `placeholder data`, `fake data` — les seules occurrences restantes concernent des fichiers de test (`*.test.tsx` dans `components/ministry-portal/`, `components/school-portal/`, `components/teacher-portal/`), ce qui est normal et attendu.

---

## Résumé de la tâche

Inventaire de 51 fichiers `page.tsx` (routes réelles), soit : public 1, auth 4, redirection technique `/dashboard` 1, admin 8 fichiers physiques + 11 sous-écrans via `?section=`, ministry 3, school 17, student 16, teacher 1 fichier physique + ~12 vues via `?view=`. Constats notables : aucun `middleware.ts` (protection 100% côté client via `dashboard/layout.tsx`), plusieurs boutons sans `onClick`, l'accueil étudiant "inscrit" et l'écran "Mon parcours" affichent des données 100% codées en dur, et le CTA "Je suis une école" de la landing mène à un formulaire qui ne crée que des comptes étudiants.
