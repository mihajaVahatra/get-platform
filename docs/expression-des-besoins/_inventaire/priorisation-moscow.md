# Priorisation MoSCoW — Plateforme GET

Document produit pour l'Expression des Besoins (EdB), à partir des cinq inventaires techniques exhaustifs du 2026-08-05 (`backend-inventory.md`, `frontend-inventory.md`, `roles-auth-inventory.md`, `data-model-inventory.md`, `docs-tests-inventory.md`). La priorisation s'appuie sur l'état d'implémentation observé, la centralité métier du domaine (admission → paiement → vie académique) et les risques déjà documentés dans `risques.md`.

---

## Must Have

Fonctions indispensables au fonctionnement du produit tel que déjà conçu — soit déjà opérationnelles et au cœur du parcours métier, soit bloquantes pour une mise en production sérieuse.

| Fonction | Justification |
|---|---|
| Authentification (login/register étudiant, session JWT cookies httpOnly, verrouillage anti brute-force) | Socle d'accès à toute la plateforme ; déjà implémenté et fonctionnel côté backend, fréquence d'usage maximale (chaque session) |
| Catalogue d'offres public + candidature multiple étudiant | Cœur du modèle métier « admission » ; fonctionnel de bout en bout (soumission, machine à états stricte, inscription auto) et couvert par tests |
| Gestion des candidatures côté école (présélection, test, entretien, décision) | Fonctionnalité la plus riche du portail école (`applications/[id]`, 788 lignes), entièrement câblée à l'API, cœur du flux de revenu |
| Paiement des frais (initiation, webhook, confirmation → inscription automatique) | Étape pivot entre candidature acceptée et inscription réelle ; logique métier robuste et testée (montant jamais côté client, idempotence) — **mais dépend d'un vrai fournisseur, voir Should Have ci-dessous pour le branchement** |
| Un vrai fournisseur de paiement (Orange Money/Mvola/carte) branché en remplacement du mode mock | Sans cela, aucune mise en production commerciale n'est possible ; état actuel = `MockPaymentProvider` uniquement (GET-RISQUE-001, GET-ECART-006) — Must Have pour la V1 de production, bien qu'absent aujourd'hui |
| Gestion école complète (profil, filières, années académiques, étudiants, professeurs, cours) | Module le plus volumineux du backend (~65 routes), entièrement fonctionnel et testé, indispensable à l'exploitation quotidienne par les établissements |
| Inscription automatique et gestion de la capacité des offres | Règle métier centrale (capacité, promotion liste d'attente) déjà implémentée et testée ; sans elle le pipeline d'admission n'a pas de valeur |
| Messagerie interne (hors Ministère) | Canal de communication transverse fonctionnel entre tous les rôles opérationnels, déjà câblé et utilisé par plusieurs portails |
| Tableau de bord et rapports Ministère (agrégats anonymisés) | Exigence réglementaire/institutionnelle explicite (aucune donnée nominative), très bien testée côté backend et frontend — fonction de confiance vis-à-vis de la tutelle |
| Emploi du temps structuré et moteur de génération automatique (CourseSlot) | Décision produit actée (ADR-001), largement implémentée et testée (idempotence, anti-conflit salle/professeur), fonctionnalité différenciante du produit |
| Provisioning des comptes staff (SCHOOL_ADMIN/TEACHER/MINISTRY) hors seed | Aujourd'hui absent (GET-ECART-013, GET-Q-002) mais bloquant : sans ce flux, impossible d'onboarder une nouvelle école en dehors du jeu de démonstration — Must Have malgré son absence actuelle |
| Notifications email fonctionnelles pour les parcours critiques (reset password, confirmation paiement, décision candidature) | Aujourd'hui simulées (GET-ECART-004, GET-RISQUE-002) ; sans un canal réel, des fonctions Must Have en amont (auth, paiement) sont elles-mêmes non fiables en production |
| Contrôle d'accès par rôle et isolation multi-établissement | Déjà largement implémenté et testé (RolesGuard, contrôle d'ownership systématique) ; condition de confiance de base pour héberger des données de plusieurs écoles concurrentes |

---

## Should Have

Fonctions à forte valeur ajoutée, déjà largement construites ou proches de l'être, mais dont l'absence ne bloque pas un lancement minimal.

| Fonction | Justification |
|---|---|
| Persistance réelle des préférences de notification | Actuellement simulée (`console.log`, GET-ECART-005) ; valeur UX importante mais contournable à court terme par des canaux par défaut raisonnables |
| Flux de rafraîchissement de session (`/auth/refresh`) | Refresh token déjà émis mais jamais consommé (GET-ECART-002, GET-RISQUE-009) ; améliore fortement l'UX (déconnexions moins fréquentes) sans être bloquant pour la fonction |
| Vérification de l'email à l'inscription (`isVerified`) | Champ déjà présent en base, non contrôlé au login ; renforce la sécurité et la qualité des données sans être requis pour le fonctionnement de base |
| Vérification documentaire des pièces étudiantes (workflow `isVerified`/`verifiedBy`) | Champs déjà modélisés, mais aucun écran/endpoint de vérification identifié ; utile pour la fiabilité du dossier candidat, non bloquant à très court terme |
| Extension de la validation par signature binaire à tous les documents étudiants | Correction déjà amorcée sur le matériel de cours (`storage.service.spec.ts`) ; à généraliser pour réduire un risque de sécurité identifié (GET-RISQUE-017) |
| Isolation stricte école sur les notifications `status-update`/`reminder` | Risque de fuite croisée inter-établissements signalé par le pré-audit (GET-RISQUE-010) ; à corriger rapidement mais sans bloquer les autres fonctions |
| Correction du niveau d'inscription forcé (`programLevel: 1`) pour les transferts | Erreur fonctionnelle réelle mais contournable manuellement par l'école à court terme (GET-ECART-023, GET-Q-018) |
| Tests unitaires du module `auth` (verrouillage, MFA, JWT strategy) | Priorité P0 documentée depuis longtemps et toujours absente (GET-RISQUE-006) ; ne bloque pas le fonctionnement observé mais expose à des régressions silencieuses sur un module critique |
| Branchement de l'accueil étudiant inscrit sur les données réelles | Fort impact de confiance utilisateur (GET-ECART-008, GET-RISQUE-004) mais les données réelles existent déjà par ailleurs (pages dédiées) — contournable en attendant |
| Recherche globale (admin, accueil étudiant) | Fonctionnalité visible mais non câblée (GET-ECART-011) ; utile au quotidien pour les gros volumes de données mais non structurante |
| Invalidation du jeton de reset password après usage | Amélioration de sécurité ciblée (GET-RISQUE-014), effort limité, à traiter avant une exposition large du public |

---

## Could Have

Fonctions utiles mais secondaires, dont le report n'affecte pas le cœur de la proposition de valeur.

| Fonction | Justification |
|---|---|
| Page « Mon Parcours » connectée aux données réelles (progression, crédits, jalons, relevé téléchargeable) | Valeur de confort pour l'étudiant, mais l'information (notes, cours) est déjà accessible via d'autres écrans dédiés et fonctionnels ; état actuel 100% mocké (GET-ECART-009) |
| Bibliothèque en ligne | Écran « Coming Soon » assumé dans le code, aucune donnée/modèle associé identifié ; fonctionnalité annexe au parcours d'admission/scolarité |
| Stages & emplois (opportunités) | Même statut que la Bibliothèque ; valeur d'enrichissement mais hors cœur du parcours admission-paiement-scolarité |
| Gabarits de notification réutilisables (`NotificationTemplate`) | Modèle de données présent mais totalement inutilisé ; amélioration de maintenabilité de la communication, non urgente |
| Points de mérite / gamification | Concept visible en dur sur l'accueil étudiant sans aucune logique métier ni modèle associé (GET-Q-014) ; à spécifier ou abandonner, faible priorité en l'état |
| Boutons/actions UI mineurs non câblés (icône cloche, boutons « Voir tout », bandeau fermable) | Frictions UX mineures (GET-ECART-012), effort de correction faible mais impact business négligeable |
| Enums Prisma natifs pour les champs de statut | Amélioration de robustesse technique (GET-ECART-017, GET-RISQUE-021) ; pertinent à moyen terme, sans urgence fonctionnelle immédiate |
| Migration des vues admin/professeur pilotées par query params vers des routes physiques Next.js | Bénéfice SEO/analytics/partage de lien (GET-ECART-025) ; aucune perte de fonctionnalité en l'état actuel |

---

## Won't Have (pour la présente version)

Fonctions hors périmètre assumé pour cette version, à ne pas développer maintenant.

| Fonction | Justification |
|---|---|
| Facturation des écoles à la plateforme (`SchoolSubscription`, plans payants) | Modèle de données présent mais aucune logique, aucun contrôleur, aucune donnée de seed ; nécessite un cadrage métier et commercial complet avant tout développement (GET-Q-022) |
| Ouverture de compte bancaire partenaire complète (`bank-account`) au-delà d'une simple mise en relation | Portée fonctionnelle non clarifiée et peu de logique existante (GET-ECART-007, GET-Q-007) ; à cadrer avant toute extension |
| Parcours d'inscription self-service pour les écoles depuis la landing | Le CTA existe visuellement mais nécessite un cadrage produit complet (qualification, validation, sécurité) avant développement ; en V1, un formulaire de contact commercial suffit (GET-Q-001) |
| Inscription candidat dédiée aux concours (`Competition`) | Aucun mécanisme d'inscription candidat identifié ; à cadrer si le produit doit gérer les concours au-delà de la simple vitrine administrative (GET-Q-024) |
| Gestion multi-administrateurs par école avec permissions différenciées | Le modèle actuel limite un `SchoolAdmin` à une seule école ; extension à cadrer si la demande des grandes écoles partenaires se confirme (GET-Q-025) |
| Politique d'anonymisation/purge automatisée des données après désinscription | Nécessite une décision juridique/DPO préalable (GET-Q-026) avant tout développement technique |

---

## Fonctions nécessitant une validation métier avant la V2

Liste des points qui recoupent directement `questions-ouvertes.md` et qui doivent être tranchés en atelier avant d'engager du développement pour la version suivante.

1. **Périmètre et mécanisme d'inscription des écoles** (self-service vs contact commercial) — recoupe GET-Q-001.
2. **Procédure de provisioning des comptes staff** (SCHOOL_ADMIN/TEACHER/MINISTRY) — recoupe GET-Q-002.
3. **Choix du/des fournisseur(s) de paiement réel(s) et modalités contractuelles** — recoupe GET-Q-006, GET-Q-008.
4. **Choix du/des fournisseur(s) d'envoi email/SMS et budget associé** — recoupe GET-Q-003.
5. **Politique de personnalisation des notifications** (préférences utilisateur vs canaux obligatoires par événement) — recoupe GET-Q-004, GET-Q-005.
6. **Politique de rétention des journaux d'audit** — recoupe GET-Q-009.
7. **Ouverture de la consultation des logs d'audit personnels à tous les rôles** — recoupe GET-Q-010.
8. **Stratégie de session** (implémentation du refresh silencieux vs session courte assumée) — recoupe GET-Q-011.
9. **Obligation de vérification d'email avant accès complet** — recoupe GET-Q-012.
10. **Spécification du contenu réel de l'accueil étudiant et de la page Mon Parcours** — recoupe GET-Q-013, GET-Q-014, GET-Q-015.
11. **Périmètre des fonctionnalités Bibliothèque et Stages/emplois** — recoupe GET-Q-016.
12. **Besoin réel de recherche globale transverse** — recoupe GET-Q-017.
13. **Règle métier de niveau d'inscription pour les transferts/admissions parallèles** — recoupe GET-Q-018.
14. **Cadrage des règles de double cursus / inscriptions multi-écoles** — recoupe GET-Q-019.
15. **Modélisation d'une notion de campagne/session de candidature distincte de l'offre** — recoupe GET-Q-020.
16. **Responsabilité et processus de vérification des documents étudiants** — recoupe GET-Q-021.
17. **Cadrage du module de facturation des écoles (SchoolSubscription)** — recoupe GET-Q-022.
18. **Cadrage des gabarits de notification réutilisables** — recoupe GET-Q-023.
19. **Mécanisme d'inscription candidat aux concours** — recoupe GET-Q-024.
20. **Organisation multi-administrateurs par école** — recoupe GET-Q-025.
21. **Politique de conservation/anonymisation des données après désinscription** — recoupe GET-Q-026.
22. **Formalisation de la checklist de bascule démonstration → production** — recoupe GET-Q-027.
