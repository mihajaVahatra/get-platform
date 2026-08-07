# 29. RECOMMANDATIONS POUR LA V2

Les recommandations ci-dessous découlent directement des écarts (section 25), risques (section 27) et questions ouvertes (section 26). Les efforts sont exprimés en complexité relative (XS/S/M/L/XL), sans estimation financière.

| Lot | Objectif | Fonctionnalités concernées | Dépendances | Priorité | Effort indicatif | Critère de sortie |
|---|---|---|---|---|---|---|
| V2-1 | Fiabiliser les canaux de notification | Brancher un fournisseur email/SMS réel, persister les préférences utilisateur | Choix du fournisseur (décision métier, section 26) | Must | M | Un email de réinitialisation de mot de passe est effectivement reçu en environnement de production |
| V2-2 | Brancher un prestataire de paiement réel | Remplacer `MockPaymentProvider` par une intégration Orange Money/Mvola/carte réelle | Contrat avec le(s) prestataire(s), conformité webhook | Must | L | Un paiement réel aboutit à un webhook signé validé en production |
| V2-3 | Reconnecter les écrans à données statiques | Accueil étudiant inscrit, écran « Mon parcours » | Endpoints déjà existants (`/students/me/schedule`, `/grades`, `/courses`) à recomposer côté frontend | Must | S | Les widgets de l'accueil reflètent les données réelles de l'étudiant connecté |
| V2-4 | Ouvrir une voie de création de compte établissement | Formulaire dédié ou processus d'onboarding école, distinct de l'inscription étudiant | Décision métier sur le circuit de validation d'un nouvel établissement (section 26) | Should | M | Le CTA « Je suis une école » de la page vitrine aboutit à un parcours fonctionnel dédié |
| V2-5 | Couvrir les modules critiques par des tests | Authentification (login, MFA, verrouillage), audit, notification | — | Must | M | Les scénarios P0 de `TEST_GAPS.md` encore non couverts (verrouillage, MFA, JWT strategy, login/register frontend) sont testés |
| V2-6 | Finaliser la vérification des documents étudiants | Endpoint de validation par un agent d'établissement, confirmation de la validation par signature binaire pour tous les types de documents | — | Should | S | Un document uploadé peut être marqué vérifié/rejeté par un SCHOOL_ADMIN avec traçabilité |
| V2-7 | Clarifier et corriger les incohérences d'habilitation | `GET /audit/me`, refresh token inutilisé, protection de `PUT /schools/:id` | Décision métier sur le périmètre exact de chaque route (section 26) | Should | S | Chaque route protégée dispose d'un `@Roles` explicite cohérent avec son intitulé |
| V2-8 | Développer les écrans « Bibliothèque » et « Stages & emplois » | Ou retirer les liens si hors périmètre décidé | Décision métier de priorisation (section 28) | Could | L (si développé) / XS (si retiré) | Les liens de la sidebar mènent à un contenu réel ou sont retirés de la navigation |
| V2-9 | Produire les documents de conformité manquants | Politique de confidentialité, politique de conservation/purge des données et des logs d'audit | Revue juridique dédiée (recommandé hors périmètre technique) | Must | S | Un document de politique de confidentialité est publié et lié depuis l'inscription |
| V2-10 | Industrialiser le pipeline qualité | Résorber le backlog ESLint (735 erreurs / 44 avertissements backend signalé au 2026-08-02), documenter le README racine (actuellement boilerplate NestJS non personnalisé) | — | Should | M | CI verte sans backlog d'erreurs non traité, README à jour avec scripts et comptes de démonstration |
| V2-11 | Cadrer l'adoption des établissements | Processus d'onboarding, formation, données de référence géographiques structurées (régions/villes) | Décision métier | Could | M | Un nouvel établissement peut être onboardé selon un processus documenté et reproductible |
| V2-12 | Renforcer le pilotage institutionnel | Indicateurs de conformité pondérés, export enrichi, éventuel SSO Ministère | Décision métier sur la formule de score de conformité | Could | M | Le Ministère dispose d'un score de conformité consolidé et documenté par établissement |

---

# 30. GLOSSAIRE

| Terme | Définition |
|---|---|
| **GET** | Nom du projet et de la plateforme : Grandes Écoles de Tananarive / Madagascar. |
| **Établissement / École** | Institution d'enseignement supérieur partenaire de GET, gérée par un compte `SCHOOL_ADMIN` (modèle `School`). |
| **Formation / Offre** | Proposition de formation publiée par un établissement, ouverte aux candidatures (modèle `Offer`). |
| **Filière (Programme)** | Parcours diplômant d'un établissement (modèle `SchoolProgram`), ex. « Licence Informatique ». |
| **Campagne** | Terme non utilisé tel quel dans le code ; la notion la plus proche est l'« année académique » (`SchoolAcademicYear`, avec fenêtre d'inscription) — à clarifier avec le métier si un concept de campagne distinct est attendu (section 26). |
| **Dossier étudiant** | Ensemble des informations et documents rattachés au profil `Student` (identité, parcours bac, documents, aspirations). |
| **Candidature** | Demande d'admission d'un étudiant à une offre précise (modèle `Application`), avec un cycle de vie à statuts. |
| **Admission** | Décision positive sur une candidature (statut `ACCEPTED`), déclenchant potentiellement le paiement puis l'inscription. |
| **Inscription** | Rattachement effectif et actif d'un étudiant à un établissement, une filière et une année (modèle `StudentEnrollment`), distinct de l'« inscription à un cours » (`CourseEnrollment`). |
| **Rôle** | Profil d'habilitation d'un compte utilisateur (`STUDENT`, `SCHOOL_ADMIN`, `TEACHER`, `MINISTRY`, `ADMIN_GET`). |
| **Permission** | Droit fin optionnel attribué à un `SCHOOL_ADMIN` (ex. `OFFERS_MANAGE`, `STUDENTS_MANAGE`, `PAYMENTS_VIEW`), en complément du rôle. |
| **Statut** | Valeur d'un champ représentant l'état d'un objet métier à un instant donné (ex. statut de candidature, de paiement). |
| **Orientation** | Fonction de suggestion d'offres de formation à un étudiant, basée sur un questionnaire d'intérêts/compétences/aspirations. |
| **Partenaire (financier)** | Organisme (banque, mobile money, assurance, bourse) mis en avant sur la plateforme comme solution de financement. |
| **Utilisateur** | Tout compte de connexion à la plateforme (modèle `User`), quel que soit son rôle. |
| **Administrateur (GET)** | Utilisateur porteur du rôle `ADMIN_GET`, le plus privilégié du système. |
| **KPI** | Indicateur clé de performance (ex. taux d'acceptation, chiffre d'affaires). |
| **MFA** | Authentification à deux facteurs (TOTP), réservée aux rôles à privilèges dans la V1. |
| **Webhook** | Notification entrante envoyée par un prestataire externe (ici, de paiement) pour confirmer une transaction, signée par HMAC. |
| **Soft delete** | Suppression logique (champ `deletedAt`) plutôt que suppression physique de l'enregistrement en base. |
| **Audit / AuditLog** | Journal des actions effectuées sur la plateforme, à des fins de sécurité et de traçabilité. |
| **UAT** | User Acceptance Testing — tests de recette fonctionnelle par les utilisateurs métier. |

---

# 31. ANNEXES

## 31.1 Inventaire des documents analysés (code et documentation)
Voir le détail exhaustif dans les fichiers de travail suivants (conservés à titre de preuve et d'annexe technique) :
- `_inventaire/backend-inventory.md` — 21 modules backend, ~220 endpoints
- `_inventaire/frontend-inventory.md` — 51 pages frontend, 7 portails
- `_inventaire/data-model-inventory.md` — 55 modèles Prisma, 30 enums fonctionnels, 27 migrations
- `_inventaire/roles-auth-inventory.md` — 5 rôles, 19 contrôleurs analysés
- `_inventaire/docs-tests-inventory.md` — 17 documents projet lus intégralement, 18 fichiers de tests backend + 4 frontend
- `_inventaire/parcours-utilisateurs.md` — 7 parcours utilisateurs détaillés
- `_inventaire/exigences-fonctionnelles.md` — 138 exigences fonctionnelles (GET-BES-FON-001 à 138)
- `_inventaire/regles-gestion.md` — 109 règles de gestion (GET-RG-001 à 109)
- `_inventaire/cycles-de-vie.md` — 12 objets métier détaillés, 4 diagrammes d'état Mermaid
- `_inventaire/analyse-ecarts.md` — 27 écarts (GET-ECART-001 à 027)
- `_inventaire/risques.md` — 21 risques (GET-RISQUE-001 à 021)
- `_inventaire/questions-ouvertes.md` — 27 questions ouvertes (GET-Q-001 à 027)
- `_inventaire/priorisation-moscow.md` — priorisation MoSCoW complète

## 31.2 Documents projet source consultés
`README.md`, `DEPLOYMENT.md`, `docs/ADR-001-emploi-du-temps-cours.md`, `docs/ADR-002-visibilite-financiere-ecole.md`, `docs/audit/API_INVENTORY.md`, `docs/audit/AUDIT_PROGRESS.md`, `docs/audit/CODE_AUDIT_REPORT.md`, `docs/audit/REMEDIATION_PLAN.md`, `docs/audit/SECURITY_FINDINGS.md`, `docs/audit/TECHNICAL_DEBT.md`, `docs/audit/TEST_GAPS.md`, `docs/security-audit-backlog.md`, `frontend/AGENTS.md`, `frontend/CLAUDE.md`, `frontend/docs/RESPONSIVE_TEST_CHECKLIST.md`, `frontend/README.md`, `Lancer le POC 1 Démarrer.txt`.

## 31.3 Commit Git de référence
Branche `develop`, commit `30b7953f30a68c1275fededea6e4471e687dc493` (2026-08-05 08:18:59 +0300), dépôt propre (`git status` sans modification non commitée) au moment de l'analyse.

## 31.4 Éléments non analysables ou hors périmètre de cette analyse
- Contenu réel de l'environnement de production (variables d'environnement, données réelles) — non consulté, conformément aux règles de sécurité de la mission.
- Exécution effective des tests automatisés (l'analyse s'est fondée sur la lecture du code des tests, pas sur leur exécution en direct) — à confirmer par une exécution `npm test`/`npm run test:e2e` en atelier de validation.
- Audit de sécurité dynamique (tests d'intrusion, essais d'accès croisés en conditions réelles) — hors périmètre de cette Expression des Besoins, recommandé séparément.
- Documents stratégiques éventuels détenus par le métier hors du dépôt Git (étude de marché, plan d'affaires, accords institutionnels) — non fournis, non analysés.
- Un audit de suivi daté du 2026-08-02 est mentionné en commentaire dans la configuration CI (`735 erreurs / 44 avertissements ESLint backend`) sans que le document correspondant ait été fourni dans le périmètre de lecture demandé — à demander en complément.

## 31.5 Limites de l'analyse
Cette Expression des Besoins a été produite par analyse statique automatisée du code source, complétée par la lecture intégrale des documents projet disponibles dans le dépôt. Elle reflète l'état du code au commit `30b7953` et ne remplace pas une validation fonctionnelle en environnement réel (UAT). Les statuts « OBSERVÉE » s'appuient sur la présence de code et, quand disponible, d'un test automatisé — ils ne garantissent pas un comportement correct en toutes circonstances de production. Toute mention « à confirmer » dans ce document doit être levée avant que celui-ci ne serve de référentiel officiel.
