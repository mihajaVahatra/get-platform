# 16. NOTIFICATIONS ET COMMUNICATIONS

## 16.1 Canaux disponibles
Le modèle `Notification` prévoit 4 canaux (enum `NotificationType`) : `EMAIL`, `SMS`, `PUSH`, `IN_APP`. **Seul le canal IN_APP est réellement fiable et persistant** (stocké en base, consulté via `GET /notifications/me`). Les canaux EMAIL/SMS/PUSH sont **intégralement simulés** dans le code (`console.log` + délai artificiel), sans intégration à un fournisseur réel identifiée (pas de SendGrid, AWS SES, Twilio ou équivalent). Les préférences de notification par utilisateur (`GET/PUT /notifications/preferences`) existent en façade mais **ne sont pas persistées** (valeurs par défaut codées en dur côté service).

## 16.2 Catalogue événement → notification

| Événement | Destinataire | Canal(x) | Contenu attendu | Moment d'envoi | Statut d'implémentation |
|---|---|---|---|---|---|
| Mot de passe oublié | Utilisateur demandeur | EMAIL | Lien de réinitialisation (jeton valable 1h) | Immédiat | Simulé (canal EMAIL non branché à un fournisseur réel) |
| Changement de statut de candidature | Étudiant candidat | IN_APP (+ EMAIL prévu) | Nouveau statut, motif éventuel | À chaque transition de statut | IN_APP fiable ; EMAIL simulé |
| Promotion depuis liste d'attente | Étudiant promu | IN_APP (+ EMAIL prévu) | Candidature passée en ACCEPTED | Libération de place | IN_APP fiable ; EMAIL simulé |
| Création/modification/suppression de créneau de cours | Professeur concerné | IN_APP | Détail du créneau modifié | Immédiat | Fiable (observé et sourcé) |
| Annonce école/cours/plateforme | Destinataires ciblés (étudiants/classes/professeurs/tous) | IN_APP | Titre, corps, image éventuelle | Immédiat, en transaction unique | Fiable, testé (`announcement.service.spec.ts`) |
| Email de bienvenue | Nouvel utilisateur (déclenché manuellement par ADMIN_GET) | EMAIL | Message de bienvenue | À la demande | Simulé |
| Confirmation de paiement | Étudiant payeur (déclenché manuellement par ADMIN_GET) | EMAIL | Confirmation, montant | À la demande | Simulé |
| Rappel de deadline | Étudiants ciblés (déclenché par SCHOOL_ADMIN/ADMIN_GET) | EMAIL/SMS | Rappel d'échéance | À la demande | Simulé |

## 16.3 Règles de gestion associées
Voir catalogue détaillé en section 12 (domaine « Notifications »). Points clés : un envoi vérifie l'existence de l'utilisateur et l'activation du canal dans ses préférences (théoriques, non persistées) avant envoi ; l'envoi SMS échoue explicitement si l'étudiant n'a pas de téléphone renseigné ; les annonces contournent le service générique d'envoi et créent directement des notifications IN_APP (pas de vérification de préférence de canal pour ce flux).

---

# 17. RECHERCHE, FILTRES, TRI ET PAGINATION

## 17.1 Recherche et filtres fonctionnels (connectés à l'API)
| Liste | Filtres disponibles | Pagination | Preuve |
|---|---|---|---|
| Catalogue public d'offres | Diplôme, ville, texte libre (à confirmer l'étendue exacte) | Oui, paginée côté serveur (bug de pagination en mémoire corrigé selon test `offer.service.spec.ts`) | `offer.controller.ts`, `offer.service.spec.ts` |
| Candidatures reçues par une école | Offre, statut (dont liste d'attente) | Oui | `application.controller.ts` |
| Candidatures — vue admin plateforme / ministérielle | Statut, établissement, période, région, filière | Oui | `application.controller.ts`, `ministry.controller.ts` |
| Annuaire admin des étudiants/programmes (toutes écoles) | Recherche texte, école | Oui | `school.controller.ts` (`GET /schools/students`, `/schools/programs`) |
| Journal d'audit | Ressource, utilisateur, période | Oui | `audit.controller.ts` |
| Utilisateurs (admin) | Recherche texte, rôle, statut actif | Oui, limite forcée entre 1 et 100 | `user.controller.ts`, `user.service.ts` |
| Recherche de professeurs / conflits (admin) | Nom, école | Non paginé identifié | `teacher-availability.controller.ts` |

## 17.2 Recherche non connectée (constat, détaillé en section 25 — Écarts)
Deux champs de recherche globale sont présents visuellement (tableau de bord Admin GET, accueil étudiant inscrit) mais **sans logique de recherche câblée** (ni `onChange`, ni appel API) — à traiter comme fonctionnalité annoncée mais non implémentée plutôt que comme un écran réel.

## 17.3 Export des résultats
Les listes de candidatures, étudiants inscrits et rapports (école et ministère) proposent un export (CSV pour l'école, PDF/Excel/CSV/JSON pour le ministère) — voir section 19.

## 17.4 Contrôle d'accès aux résultats
Chaque liste applique le même scoping que les endpoints qui l'alimentent (école limitée à ses propres ressources, ministère jamais de données nominatives) — voir section 8.

---

# 18. TABLEAUX DE BORD, INDICATEURS ET REPORTING

## 18.1 Tableaux de bord identifiés

| Tableau de bord | Acteur | Indicateurs | Source des données | Statut |
|---|---|---|---|---|
| Tableau de bord plateforme | ADMIN_GET | KPIs globaux (écoles, étudiants inscrits distincts vs inscriptions, taux d'acceptation, chiffre d'affaires) | `admin-dashboard.service.ts`, calcul en base à la demande | Fonctionnel, connecté |
| Tableau de bord établissement | SCHOOL_ADMIN | Effectifs, candidatures, paiements récents, cours, professeurs | `school.service.ts` (`me/stats`, `me/payments`...) | Fonctionnel, connecté |
| Tableau de bord national | MINISTRY | Indicateurs agrégés filtrables par période | `ministry.service.ts` | Fonctionnel, connecté, testé (agrégats sans données nominatives) |
| Tableau de bord professeur | TEACHER | Cours, étudiants, devoirs à corriger, évaluations à venir, messages non lus | `teaching.service.ts` (`dashboard/summary`) | Fonctionnel, connecté |
| Accueil étudiant candidat | STUDENT (candidat) | Étapes de progression du dossier | Calcul dynamique côté frontend à partir de `/applications/me` | Fonctionnel, connecté |
| Accueil étudiant inscrit | STUDENT (inscrit) | Emploi du temps du jour, devoirs, cours/notes, événements, moyenne/crédits/absences/mérite | **Données codées en dur**, aucun appel API pour le contenu | **Statique — non fiable, à corriger en priorité (voir section 25/27)** |

## 18.2 Catalogue des indicateurs (KPI)

| ID KPI | Nom | Définition | Source | Utilisateur | Statut |
|---|---|---|---|---|---|
| KPI-01 | Étudiants inscrits (inscriptions actives) | Nombre de lignes `StudentEnrollment` actives | `admin-dashboard.service.ts` | ADMIN_GET | Calculé |
| KPI-02 | Étudiants inscrits distincts | Nombre d'étudiants distincts, indépendamment du nombre d'écoles | `admin-dashboard.service.ts` | ADMIN_GET | Calculé |
| KPI-03 | Taux d'acceptation | Candidatures ACCEPTED / total, arrondi 1 décimale | `admin-dashboard.service.ts` | ADMIN_GET | Calculé |
| KPI-04 | Chiffre d'affaires plateforme | Somme des paiements COMPLETED | `admin-dashboard.service.ts` | ADMIN_GET | Calculé (biaisé tant que le paiement réel n'est pas branché) |
| KPI-05 | Pipeline de candidatures par école | Répartition par statut | `school.service.ts` (reports/pipeline) | SCHOOL_ADMIN | Calculé |
| KPI-06 | Répartition géographique des candidatures | Par région | `ministry.service.ts` | MINISTRY | Calculé |
| KPI-07 | Taux de conformité par établissement | Dernier `ComplianceCheck` par école | `ministry.service.ts` | MINISTRY | Calculé (synthèse pondérée à confirmer) |
| KPI-08 | Moyenne générale / crédits validés / absences / points de mérite (accueil étudiant) | Affichage à l'accueil de l'étudiant inscrit | **Aucune** (valeurs en dur) | STUDENT | **Non calculé — technique uniquement calculable en croisant `Grade`/`CourseEnrollment`, à développer** |

## 18.3 Distinction KPI réels vs affichés statiquement
Les indicateurs KPI-01 à KPI-07 sont réellement calculés à la demande. KPI-08 (widgets de l'accueil étudiant) est **techniquement calculable** à partir des données déjà modélisées (`Grade`, `CourseEnrollment`, `CourseSlot`) mais **n'est pas branché** — écart prioritaire (voir section 25).

---

# 19. IMPORTS ET EXPORTS

| Fonction | Sens | Format | Rôle autorisé | Contrôles | Preuve |
|---|---|---|---|---|---|
| Import d'étudiants en masse | Import | Non précisé dans les inventaires (à confirmer : CSV probable) | SCHOOL_ADMIN | À confirmer | `student-import-directory.tsx`, `school.controller.ts` (`students/enroll/bulk`) |
| Export des candidatures (école) | Export | CSV | SCHOOL_ADMIN | Scopé à son école | `school.controller.ts` (`reports/export`) |
| Export des étudiants inscrits (école) | Export | CSV | SCHOOL_ADMIN | Scopé à son école | `frontend` reports page |
| Export de rapport ministériel | Export | PDF / Excel / CSV / JSON | MINISTRY, ADMIN_GET | Agrégats uniquement, jamais nominatif | `ministry.controller.ts`, `report-exporter.spec.ts` (PDF réel vérifié par en-tête binaire) |
| Reçu de paiement | Export | Format non confirmé comme réellement PDF (constat d'audit antérieur signalait un texte brut déguisé ; correction confirmée pour les rapports Ministère mais non revérifiée pour les reçus de paiement) | STUDENT (le sien), ADMIN_GET | Scopé au paiement du demandeur | `payment.controller.ts` (`:id/receipt`) — **point à confirmer** |

**Contrôles transverses observés** : traçabilité via `AuditLog` (action `EXPORT` identifiée dans l'enum `AuditAction`) ; pas de protection explicite contre les exports en volume excessif identifiée (pas de throttling spécifique aux endpoints d'export) — point à confirmer avec le métier (section 26).

---

# 20. INTÉGRATIONS ET SERVICES EXTERNES

| Intégration | Finalité | Direction | Statut réel | Points à confirmer |
|---|---|---|---|---|
| Stockage de fichiers S3-compatible (MinIO/R2/AWS) | Documents étudiants, avatars, logos, pièces jointes de messages | Sortant (upload) / Entrant (URL présignées) | **Actif** — URLs présignées 60s, deux buckets (privé/public) | Migration de l'ancien stockage local (`./uploads`) vers S3, mentionnée dans les documents comme récente |
| Prestataire de paiement mobile money / carte | Encaissement des frais | Sortant (initiation) + Entrant (webhook signé HMAC) | **Non branché** — `MockPaymentProvider` uniquement | Choix du/des prestataires réels (Orange Money, Mvola, carte bancaire, virement — tous modélisés en DTO) |
| Fournisseur d'email transactionnel | Envoi des notifications EMAIL | Sortant | **Non branché** — simulation `console.log` | Choix du fournisseur (SendGrid, AWS SES, autre) |
| Fournisseur SMS | Envoi des notifications SMS | Sortant | **Non branché** — simulation | Choix du fournisseur, coût par SMS à Madagascar |
| Fournisseur Push | Notifications mobiles/navigateur | Sortant | **Non branché** — simulation | Périmètre (app mobile native absente du dépôt, PWA à confirmer) |
| Solution d'identité externe (SSO) | Authentification | — | **Absente** — authentification interne JWT uniquement | Besoin d'un SSO institutionnel (ex. compte Ministère) à confirmer |
| API partenaires financiers | Mise en avant de solutions de financement | — | **Absente** — simple vitrine sans intégration transactionnelle | Portée exacte de `POST /payments/bank-account` à clarifier (section 26) |

Aucune autre intégration externe (cartes, analytics, monitoring, services gouvernementaux) n'a été identifiée dans le code.

---

# 21. BESOINS NON FONCTIONNELS

## 21.1 Sécurité
- **Authentification** : JWT stateless via cookies `httpOnly` (access token 15 min, refresh token 7 jours — ce dernier généré mais jamais consommé, voir écart section 25), `sameSite=lax` par défaut (`none`+`secure` en cross-site opt-in).
- **Autorisation** : garde globale JWT (tout est protégé par défaut, `@Public()` explicite requis) + garde de rôle par route (`RolesGuard`/`@Roles`), vérifiée module par module en section 8/10.
- **Gestion des sessions** : révocation serveur via `sessionVersion` incrémenté à la déconnexion — un jeton valide mais périmé est rejeté.
- **Mots de passe** : hachage bcrypt (coût 10), règles de complexité fortes (8-32 caractères, majuscule/minuscule/chiffre/caractère spécial), verrouillage de compte après 5 échecs (15 minutes).
- **MFA** : TOTP (secret chiffré AES-256-GCM), réservé aux rôles `ADMIN_GET`/`SCHOOL_ADMIN`/`MINISTRY` — **absent pour STUDENT et TEACHER**, point à confirmer (section 26).
- **Limitation des tentatives** : `ThrottlerGuard` global (100 req/min) + limites spécifiques sur les routes sensibles d'authentification (3 à 5 req/min).
- **Validation des entrées** : `ValidationPipe` global strict (`whitelist`, `forbidNonWhitelisted`, `transform`).
- **Gestion des secrets** : variables d'environnement dédiées (JWT, chiffrement, webhook, stockage), fichiers `.env` non suivis par git.
- **Chiffrement** : AES-256-GCM pour téléphone/CIN étudiant et secret MFA.
- **Audit** : journalisation automatique de toute requête (métadonnées uniquement, jamais le corps de la requête/réponse) — voir section 22 pour la rétention.
- **Contrôle des fichiers** : validation par signature binaire réelle (pas seulement le mimetype déclaré) confirmée pour les images et pour au moins un flux de documents de cours ; statut à reconfirmer pour l'ensemble des documents étudiants (constat d'audit antérieur signalant une validation par mimetype seul, potentiellement partiellement corrigée depuis).
- **Protection des données personnelles** : voir section 22 dédiée.

## 21.2 Performance
- Pagination systématique des listes volumineuses (candidatures, étudiants, paiements, audit), avec limite forcée (ex. 1-100 pour les utilisateurs).
- URLs de fichiers présignées à durée de vie courte (60 secondes) plutôt que des liens permanents.
- Aucun mécanisme de cache applicatif (Redis mentionné dans la note de démarrage informelle mais non confirmé comme provisionné en production — point à confirmer).
- Aucun test de charge ou de performance identifié dans le dépôt.

## 21.3 Disponibilité et résilience
- Gestion d'erreurs uniforme (`AllExceptionsFilter`), réponses structurées.
- Échec de journalisation d'audit non bloquant pour la requête utilisateur.
- Notifications non bloquantes (un échec d'envoi n'interrompt pas le flux métier principal, ex. changement de statut de candidature).
- Aucun mécanisme de sauvegarde/restauration applicatif documenté dans le dépôt analysé (probablement porté par l'hébergeur — point à confirmer).
- Aucun *health check* dédié identifié au-delà du comportement par défaut de NestJS.

## 21.4 Compatibilité
- Application web responsive (breakpoints 375/390/768/1024px+ selon la checklist frontend), pas d'application mobile native identifiée dans le dépôt.
- Navigateurs cibles non explicitement documentés — point à confirmer.

## 21.5 Accessibilité
- Une checklist manuelle existe (cibles tactiles ≥44×44px, absence de zoom automatique iOS Safari, accessibilité des modales) mais **aucun outillage d'accessibilité automatisé** (audit WCAG, tests avec lecteur d'écran) n'a été identifié — statut : process déclaré, non vérifié automatiquement.

## 21.6 Internationalisation
- Aucun framework d'internationalisation (i18n) identifié dans le frontend ; le contenu est en français uniquement dans le code observé (`ACTUALITÉ`, libellés d'interface).
- Devise : MGA (Ariary) par défaut sur les offres et paiements.
- Fuseau horaire, formats de date : non explicitement paramétrables — point à confirmer.

## 21.7 Maintenabilité fonctionnelle
- Paramétrage plateforme centralisé (`SystemConfig`, module `system-settings`) pour le nom, contact, adresse.
- CMS pour la page vitrine (hero, stats, étapes, cartes acteurs, actualités) permettant une modification sans développement.
- Pas de mécanisme de feature flags identifié pour activer/désactiver des fonctions sans déploiement.

## 21.8 Traçabilité
- `AuditLog` : action, ressource, avant/après (le cas échéant), IP, user-agent, statut — pour toute requête HTTP, plus enrichissement métier explicite sur le module `application`.
- Consultation de l'audit réservée à `ADMIN_GET`.
- **Politique de rétention/purge des logs d'audit non identifiée dans le code** — point à confirmer avec le métier (obligation légale de durée de conservation à Madagascar ?).

## 21.9 Catalogue des exigences non fonctionnelles

| Identifiant | Catégorie | Exigence | Statut | Preuve / Commentaire |
|---|---|---|---|---|
| GET-BES-NF-001 | Sécurité | Toute route API doit être authentifiée par défaut, sauf marquage explicite `@Public()` | Implémenté | `JwtAuthGuard` global, `app.module.ts` |
| GET-BES-NF-002 | Sécurité | Les mots de passe doivent respecter une règle de complexité (8-32 car., majuscule, minuscule, chiffre, spécial) | Implémenté | `RegisterDto`, `ChangePasswordDto` |
| GET-BES-NF-003 | Sécurité | Un compte doit être verrouillé temporairement après 5 échecs de connexion consécutifs | Implémenté | `auth.service.ts:350-371` |
| GET-BES-NF-004 | Sécurité | Les rôles à privilèges (ADMIN_GET, SCHOOL_ADMIN, MINISTRY) doivent pouvoir activer une authentification à deux facteurs | Implémenté | `auth.controller.ts` (mfa/*) |
| GET-BES-NF-005 | Sécurité | STUDENT et TEACHER doivent pouvoir activer une authentification à deux facteurs | Absent | À confirmer avec le métier (GET-Q) |
| GET-BES-NF-006 | Sécurité | Une session doit pouvoir être révoquée côté serveur (pas uniquement par expiration du jeton) | Implémenté | Mécanisme `sessionVersion` |
| GET-BES-NF-007 | Sécurité | Les données sensibles (téléphone, CIN) doivent être chiffrées au repos | Implémenté | `EncryptionService`, AES-256-GCM |
| GET-BES-NF-008 | Sécurité | Les fichiers uploadés doivent être validés par signature binaire réelle, pas par le seul type déclaré | Partiellement implémenté | Confirmé pour images et au moins un flux de cours ; à reconfirmer pour tous les documents étudiants |
| GET-BES-NF-009 | Sécurité | Les requêtes sensibles (login, register, reset password) doivent être limitées en fréquence (anti brute-force) | Implémenté | `ThrottlerGuard`, throttles dédiés |
| GET-BES-NF-010 | Sécurité | Les en-têtes de sécurité HTTP standards doivent être positionnés (anti-clickjacking, MIME sniffing, HSTS) | Implémenté | `main.ts:24-37` |
| GET-BES-NF-011 | Sécurité | Le CORS doit être restreint à l'origine frontend officielle | Implémenté | `main.ts:41-47` |
| GET-BES-NF-012 | Sécurité | Le webhook de paiement doit être signé et vérifié (HMAC) | Implémenté | `payment.service.ts:443-455` |
| GET-BES-NF-013 | Performance | Toute liste volumineuse doit être paginée côté serveur | Implémenté | Ex. `user.service.ts`, `application.controller.ts` |
| GET-BES-NF-014 | Performance | Les liens de téléchargement de fichiers privés doivent être à durée de vie courte | Implémenté | URLs présignées S3, 60 secondes |
| GET-BES-NF-015 | Performance | Un cache applicatif doit réduire la charge sur les requêtes fréquentes | À confirmer | Redis mentionné informellement, non confirmé en production |
| GET-BES-NF-016 | Disponibilité/résilience | Un échec de journalisation d'audit ne doit jamais bloquer la requête utilisateur | Implémenté | `audit.interceptor.ts:53,68` |
| GET-BES-NF-017 | Disponibilité/résilience | Un échec d'envoi de notification ne doit jamais bloquer le flux métier principal | Implémenté | `application.service.ts:572-585` |
| GET-BES-NF-018 | Disponibilité/résilience | Une procédure de sauvegarde/restauration doit être documentée | Absent du dépôt analysé | À confirmer (porté par l'hébergeur ?) |
| GET-BES-NF-019 | Disponibilité/résilience | Des health checks doivent permettre de vérifier la disponibilité du service | Non identifié au-delà du comportement par défaut NestJS | À confirmer |
| GET-BES-NF-020 | Compatibilité | L'application doit être utilisable sur mobile, tablette et desktop | Implémenté | Breakpoints 375/390/768/1024px |
| GET-BES-NF-021 | Compatibilité | Les navigateurs cibles doivent être explicitement définis | Non documenté | À confirmer |
| GET-BES-NF-022 | Accessibilité | Les cibles tactiles doivent respecter une taille minimale (44×44px) | Process déclaré (checklist manuelle) | Non vérifié automatiquement |
| GET-BES-NF-023 | Accessibilité | Un audit d'accessibilité (WCAG) doit être réalisé | Absent | À planifier |
| GET-BES-NF-024 | Internationalisation | L'interface doit être disponible en français | Implémenté | Seule langue observée dans le code |
| GET-BES-NF-025 | Internationalisation | Un mécanisme d'internationalisation doit permettre d'ajouter d'autres langues | Absent | Aucun framework i18n identifié |
| GET-BES-NF-026 | Internationalisation | La devise par défaut doit être l'Ariary (MGA) | Implémenté | `Offer.currency`, `Payment.currency` |
| GET-BES-NF-027 | Maintenabilité | Les paramètres généraux de la plateforme doivent être modifiables sans déploiement | Implémenté | Module `system-settings` |
| GET-BES-NF-028 | Maintenabilité | Le contenu de la page vitrine doit être modifiable sans développement | Implémenté | CMS landing (module `landing`) |
| GET-BES-NF-029 | Maintenabilité | Des indicateurs de fonctionnalité (feature flags) doivent permettre d'activer/désactiver des fonctions | Absent | Aucun mécanisme identifié |
| GET-BES-NF-030 | Traçabilité | Toute action sensible doit être journalisée (auteur, action, ressource, résultat) | Implémenté | `AuditLog`, `AuditInterceptor` |
| GET-BES-NF-031 | Traçabilité | Le contenu des requêtes/réponses ne doit jamais apparaître dans le journal d'audit | Implémenté | Choix de conception explicite (`audit.interceptor.ts:39-42`) |
| GET-BES-NF-032 | Traçabilité | Une politique de conservation/purge des journaux d'audit doit être définie | Absent | À confirmer avec le métier |
| GET-BES-NF-033 | Sécurité | La validation des entrées API doit rejeter tout champ non attendu | Implémenté | `ValidationPipe` global strict |
| GET-BES-NF-034 | Performance | La génération automatique d'emploi du temps doit être idempotente (pas de doublons en cas de relance) | Implémenté | `schedule-generation.service.spec.ts` |
| GET-BES-NF-035 | Disponibilité/résilience | Aucune opération financière ne doit rester dans un état intermédiaire incohérent en cas de panne | Implémenté | Transactions Prisma explicites sur paiement/candidature |

---

# 22. EXIGENCES DE PROTECTION DES DONNÉES

## 22.1 Catégories de données manipulées
| Catégorie | Exemples de champs | Modèles concernés | Sensibilité |
|---|---|---|---|
| Identité | Nom, prénom, genre, date de naissance, CIN (chiffré) | User, Student | Élevée |
| Coordonnées | Email, téléphone (chiffré), adresse | User, Student | Élevée |
| Informations académiques | Parcours bac, aspirations, notes, évaluations | Student, Grade, Application | Modérée à élevée |
| Documents | CV, pièce d'identité, diplôme, photo | Document | Élevée |
| Candidatures/décisions | Statut, score, motif de décision | Application, ApplicationTimeline | Élevée |
| Paiements | Montant, méthode, référence, reçu | Payment, Transaction, Refund | Élevée |
| Communications | Messages privés, annonces | Message, Announcement | Modérée |
| Données de connexion | Historique de connexion, tentatives échouées, IP | User, AuditLog | Modérée à élevée |
| Données d'audit | Action, ressource, avant/après, IP, user-agent | AuditLog | Élevée |

## 22.2 Besoins relatifs au cycle de vie de la donnée personnelle
| Besoin | Statut observé |
|---|---|
| Consentement à l'inscription | Formulaire d'inscription mentionne l'acceptation des CGU (frontend) — contenu des CGU non trouvé dans le dépôt, à confirmer |
| Information des utilisateurs (politique de confidentialité) | **Aucun document de politique de confidentialité trouvé dans le dépôt** — à produire (section 26) |
| Minimisation | Le Ministère n'a explicitement accès à aucune donnée nominative (vérifié par tests) — bon exemple de minimisation appliquée |
| Contrôle d'accès | Scoping systématique par propriété (étudiant, école) — voir section 8 |
| Conservation | Aucune politique de durée de conservation ni de purge identifiée pour les données étudiant/candidature — à confirmer |
| Rectification | L'étudiant peut modifier son propre profil (`PUT /students/me`) ; pas de mécanisme de rectification identifié pour les données déjà figées dans une candidature traitée |
| Suppression | Soft-delete (`deletedAt`) sur plusieurs modèles (User, Student, School, Application, Document, Offer, Competition, FinancialPartner, LandingNewsPost) — pas de purge définitive identifiée |
| Export (portabilité) | Aucun mécanisme d'export des données personnelles à la demande de l'utilisateur identifié — à confirmer si requis réglementairement |
| Journalisation | `AuditLog` couvre les accès et modifications, sans exposer le contenu des données dans le journal (bonne pratique observée) |
| Partage avec les établissements | Un `SCHOOL_ADMIN` voit les données des étudiants inscrits/candidats de son école uniquement |
| Partage avec les institutions (Ministère) | Exclusivement des agrégats anonymisés |
| Partage avec les partenaires | Aucun partage de données personnelles avec les partenaires financiers identifié (simple vitrine) |

## 22.3 Avertissement méthodologique
**Aucune conformité réglementaire (loi malgache sur la protection des données personnelles ou équivalent) n'est déclarée ou vérifiée dans le code ou les documents analysés.** Cette section décrit ce qui est techniquement observé, pas une attestation de conformité — une revue juridique dédiée est nécessaire avant toute mise en production à grande échelle (voir recommandations, section 29).

---

# 23. CRITÈRES D'ACCEPTATION

Les critères d'acceptation détaillés, au format Given/When/Then, sont intégrés **individuellement à chaque exigence** du catalogue (section 11, colonne « Critères d'acceptation ») afin d'éviter toute duplication et de garantir la traçabilité directe exigence ↔ critère ↔ preuve de code. Cette section rassemble uniquement des critères **transverses**, qui engagent plusieurs exigences à la fois.

| # | Critère transverse |
|---|---|
| 1 | **Étant donné** un étudiant authentifié dont le profil est incomplet, **lorsqu'il** tente de soumettre une candidature, **alors** le système doit permettre la soumission technique (aucun contrôle de complétude de profil bloquant n'a été identifié au niveau candidature) — **à confirmer si un contrôle de complétude devrait bloquer la candidature** (section 26). |
| 2 | **Étant donné** une candidature au statut `ACCEPTED` et un paiement confirmé, **lorsque** le webhook de paiement est reçu, **alors** le système doit, dans une seule transaction, faire passer la candidature à `ENROLLED`, créer/mettre à jour l'inscription (`StudentEnrollment`) et synchroniser les inscriptions aux cours, sans jamais laisser un paiement `COMPLETED` sans effet sur le dossier. |
| 3 | **Étant donné** deux administrateurs d'écoles différentes, **lorsque** l'un tente d'agir sur une ressource (candidature, offre, étudiant) de l'autre école, **alors** l'accès doit être refusé (403), y compris pour les routes qui ne portent pas de `@Roles` explicite mais un contrôle de propriété en service. |
| 4 | **Étant donné** un compte avec 5 échecs de connexion consécutifs, **lorsqu'** une 6ᵉ tentative est effectuée dans les 15 minutes suivantes, **alors** la connexion doit être refusée même avec les identifiants corrects. |
| 5 | **Étant donné** le rôle `MINISTRY`, **lorsqu'il** consulte tout endpoint de statistiques ou de rapport, **alors** aucune donnée nominative (nom, email, téléphone d'un étudiant) ne doit apparaître dans la réponse. |
| 6 | **Étant donné** une génération automatique d'emploi du temps, **lorsqu'** un besoin horaire ne peut être placé (professeur non affecté, aucun créneau/salle compatible), **alors** le système doit le signaler explicitement comme « non résolu » plutôt que d'échouer silencieusement ou de produire un planning incomplet sans avertissement. |

---

# 24. MATRICE DE TRAÇABILITÉ

## 24.1 Matrice besoin → implémentation (synthèse par domaine)
La traçabilité fine (une ligne par exigence, avec fichier de preuve exact) est portée par la colonne « Source de preuve » du catalogue d'exigences (section 11, 138 exigences) et par la colonne « Preuve » du catalogue de règles de gestion (section 12, 109 règles). Le tableau ci-dessous en offre une vue de synthèse par domaine fonctionnel.

| Domaine besoin | Module(s) backend | Écrans frontend principaux | Modèles de données clés | Tests associés |
|---|---|---|---|---|
| Authentification & compte | `auth` | `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | User, Role | `roles.guard.spec.ts` (partiel — voir écart) |
| Profil étudiant | `student` | `/dashboard/student/profile`, `/settings` | Student, Document | `student.service.spec.ts` |
| Catalogue écoles/offres | `school`, `offer` | `/`, `/dashboard/student/offers`, `/dashboard/school/offers*` | School, Offer, SchoolProgram | `offer.service.spec.ts`, `school.service.spec.ts` |
| Candidature & admission | `application` | `/dashboard/student/offers`, `/dashboard/school/applications*` | Application, ApplicationTimeline | `application.service.spec.ts`, `application.controller.spec.ts` |
| Paiement | `payment` | `/dashboard/student/payments`, `/dashboard/school/payments`, `/dashboard/admin/transactions` | Payment, Transaction, Refund | `payment.service.spec.ts` |
| Inscription | `school` (StudentEnrollment) | `/dashboard/school/students`, `/dashboard/admin/enrollments` | StudentEnrollment | `application.service.spec.ts`, `school.service.spec.ts` |
| Pédagogie / cours | `teaching`, `student` | `/dashboard/teacher*`, `/dashboard/student/courses,grades,assignments` | Course, Grade, Assignment, Evaluation | `teaching.service.spec.ts`, `teaching.controller.spec.ts` |
| Planification / emploi du temps | `school` (scheduling), `teacher-availability` | `/dashboard/school/schedule`, `/dashboard/teacher?view=schedule,availability` | CourseSlot, TeacherAvailability, TeacherTravelBuffer | `schedule-generation.service.spec.ts` |
| Messagerie | `message` | `/dashboard/*/messages` | Message, Conversation | `message.controller.spec.ts` |
| Notifications | `notification` | Cloche de notification (tous portails) | Notification | **Aucun test identifié** |
| Annonces | `announcement`, `school` | Annonces école/cours, diffusion admin | Announcement, AnnouncementRecipient | `announcement.service.spec.ts` |
| Ministère / conformité | `ministry` | `/dashboard/ministry*` | ComplianceCheck, MinistryReport | `ministry.service.spec.ts`, `ministry-access-policy.spec.ts`, `report-exporter.spec.ts` |
| Administration plateforme | `user`, `audit`, `system-settings`, `landing`, `competition`, `financial-partner`, `academic-year`, `admin-dashboard` | `/dashboard/admin*` | User, Role, AuditLog, SystemConfig | Couverture très partielle (voir section 25/27) |

## 24.2 Matrice inverse — éléments techniques sans besoin métier clairement rattaché
| Élément technique | Fonction/besoin associé | Statut documentaire |
|---|---|---|
| `SchoolSubscription` (modèle Prisma) | Abonnement payant école | Aucune logique de service — besoin non formalisé |
| `NotificationTemplate` (modèle Prisma) | Modèles de notification réutilisables | Aucun usage identifié — besoin non formalisé |
| Cookie `refresh_token` (7 jours) | Prolongation de session | Généré mais jamais consommé (pas de route `/auth/refresh`) — incohérence de conception |
| `GET /audit/me` | Consultation de ses propres logs par un non-admin | Route nommée en ce sens mais héritant d'une restriction `ADMIN_GET` — incohérence |
| `POST /payments/bank-account` | Ouverture d'un compte bancaire partenaire | Portée fonctionnelle peu détaillée dans le code exploré — à clarifier |
| Champ `Offer.academicYear` (texte libre) | Rattachement à une année académique école | Non relié par clé étrangère à `SchoolAcademicYear` — incohérence de modélisation potentielle |
