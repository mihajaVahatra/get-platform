# Phase 1 — Cadrage et conception de l'automatisation n8n

- **Statut :** en cours
- **Date :** 2026-08-05
- **Contexte :** GET est aujourd'hui un POC piloté par une petite équipe, hébergé
  sur des offres gratuites (Render, Neon, Vercel — voir [DEPLOYMENT.md](../../DEPLOYMENT.md)).
  Cette phase adapte le plan n8n initial (10 semaines, 8 workflows, 3 environnements,
  équipe de 9 rôles) à cette réalité plutôt que de le reprendre tel quel — voir la
  section [Écarts assumés par rapport au plan initial](#écarts-assumés-par-rapport-au-plan-initial).

Preuve du fonctionnement technique : un n8n local a déjà reçu et traité un webhook
de bout en bout (`docker-compose.n8n.yml`, `n8n/workflows/get-test-webhook.json`).
Cette phase porte sur *quoi* automatiser et *pourquoi*, pas sur l'infrastructure.

## 1.1 Identification des processus

État réel du backend au 2026-08-05 (vérifié dans `backend/src/modules/notification/`
et `backend/src/modules/application/`), pas une supposition :

| Processus | État actuel dans GET | Candidat n8n |
| --- | --- | --- |
| Email de bienvenue | `NotificationService.sendWelcomeEmail` existe, exposé via `POST /notifications/welcome`, **mais rien ne l'appelle automatiquement** à la création d'un compte | Oui — déclencher l'appel existant depuis un événement `student.created`, sans réécrire la logique d'envoi |
| Confirmation de candidature | Pas de méthode dédiée trouvée | Oui — nouveau, mais simple accusé de réception |
| Notification à l'établissement (nouvelle candidature) | Non trouvé | Oui |
| Relance des dossiers incomplets | `NotificationService.sendDeadlineReminder` existe, exposé via `POST /notifications/reminder`, appelable **uniquement à la demande** — **aucun mécanisme de planification (`@Cron`/`ScheduleModule`) n'existe nulle part dans `backend/src`** | Oui — c'est le vrai trou : n8n apporte le déclenchement quotidien, le backend garde le contenu et l'envoi |
| Changement de statut / décision d'admission | `NotificationService.sendApplicationStatusUpdate` est **déjà appelé automatiquement** par `application.service.ts:38` à chaque changement de statut | **Non** — déjà couvert par le backend, ne pas dupliquer |
| Génération de rapports (hebdomadaire) | Non trouvé | Oui — aucun mécanisme de reporting périodique existant |
| Invitation des administrateurs d'établissement | Non vérifié dans cette passe | À confirmer en Phase 4 |
| Alertes techniques / erreurs d'intégration | N/A (n'existe pas encore) | Oui, mais seulement une fois qu'il y a des intégrations n8n à surveiller |

Point de vigilance sécurité déjà connu et non fermé : selon
[docs/security-audit-backlog.md](../security-audit-backlog.md), les endpoints de
notification (statut, rappel) ne vérifient pas aujourd'hui que l'appelant appartient
bien à l'établissement concerné. Tant que ce constat n'est pas corrigé, n8n ne doit
appeler ces endpoints **qu'avec une identité de service explicite et une portée
limitée** (jamais en réutilisant un token d'administrateur école existant) — voir
§ Gouvernance.

## 1.2 Classification des workflows retenus pour le MVP

| Workflow | Niveau | Justification |
| --- | --- | --- |
| Relance quotidienne des dossiers incomplets | Moyen | Récupérable — un retard d'envoi n'impacte pas l'intégrité d'une candidature |
| Rapport hebdomadaire (indicateurs) | Faible | Non bloquant, lecture seule |
| Email de bienvenue déclenché à la création de compte | Faible | Non bloquant, best-effort ; l'endpoint existant gère déjà l'échec côté backend |

Explicitement **hors MVP n8n**, laissé au backend : décision d'admission,
paiement, authentification, autorisation — conformément au principe du plan
original (§9.6) et confirmé par le fait que `sendApplicationStatusUpdate` est
déjà correctement intégré côté backend.

## 1.3 Architecture fonctionnelle

```text
Backend GET (NestJS)
   │
   │  événement métier (ex: candidature incomplète détectée par un cron n8n,
   │  ou compte étudiant créé)
   ▼
n8n (orchestration : planification, mise en forme, agrégation)
   │
   ▼
Endpoints NestJS EXISTANTS (POST /notifications/welcome, POST /notifications/reminder)
   │
   ▼
Envoi réel de l'email (le backend reste seul propriétaire du contenu et du canal)
```

Différence assumée par rapport au plan initial : n8n n'envoie pas d'email
directement. Il orchestre et appelle les endpoints de notification qui existent
déjà dans le backend, pour ne pas dupliquer la logique métier ni contourner
l'audit qui passe par ces endpoints.

## 1.4 Convention de nommage

Conservée du plan initial, préfixe `GET-` :

```text
GET-STUDENT-WELCOME-EMAIL
GET-APPLICATION-INCOMPLETE-REMINDER
GET-WEEKLY-REPORT
```

## Gouvernance

- n8n n'implémente aucune règle métier — il appelle des endpoints existants ou en
  lit l'état, il ne décide jamais d'une admission, d'un statut ou d'un paiement.
- Authentification inter-services : clé API dédiée à n8n, distincte de tout token
  utilisateur, avec un scope minimal (accès aux seuls endpoints de notification et
  de lecture nécessaires) — à créer en Phase 4, pas de réutilisation de comptes
  admin existants.
- Idempotence : chaque appel n8n → backend porte un `eventId` unique ; le rappel
  d'un même dossier incomplet le même jour ne doit pas produire un second envoi.
- Le correctif d'isolation école du security-audit-backlog est un **prérequis**
  avant d'exposer le workflow de relance au-delà d'un test local, puisque ce
  workflow passe justement par les endpoints concernés.
- Instance n8n locale uniquement pour cette phase (`127.0.0.1`, voir
  `docker-compose.n8n.yml`) — aucune exposition réseau tant que la Phase 4
  (authentification inter-services) n'est pas faite.

## Écarts assumés par rapport au plan initial

| Plan initial | Ici | Pourquoi |
| --- | --- | --- |
| 8 workflows MVP | 3 workflows | Seuls 3 processus n'ont aucune couverture actuelle dans le backend (voir §1.1) ; les autres existent déjà ou dupliqueraient une logique en place |
| 3 environnements (dev/uat/prod) | 1 environnement local | Pas d'équipe UAT dédiée ni d'infra dédiée à ce stade ; on valide l'utilité avant d'investir dans l'infra |
| Équipe de 9 rôles | 1-2 personnes | Taille réelle du projet actuel |
| n8n envoie les notifications | n8n orchestre, le backend envoie | Évite la duplication de logique et contourne le risque de bypass de l'audit constaté dans security-audit-backlog.md |

## Définition du MVP

1. `GET-APPLICATION-INCOMPLETE-REMINDER` — cron quotidien, appelle
   `POST /notifications/reminder` pour chaque dossier incomplet identifié.
2. `GET-WEEKLY-REPORT` — cron hebdomadaire, agrège des indicateurs et les envoie
   à une liste restreinte de destinataires.
3. `GET-STUDENT-WELCOME-EMAIL` — déclenché par un événement `student.created`,
   appelle `POST /notifications/welcome`.

## Backlog d'implémentation (ordre proposé)

1. Corriger l'isolation école sur les endpoints de notification (prérequis sécurité,
   déjà tracké dans `docs/security-audit-backlog.md`).
2. Construire l'endpoint de lecture "dossiers incomplets" côté backend (n'existe pas
   aujourd'hui — nécessaire pour que n8n sache qui relancer).
3. Créer la clé API de service pour n8n (scope minimal, rotation, journalisation).
4. Implémenter `GET-APPLICATION-INCOMPLETE-REMINDER`.
5. Implémenter `GET-STUDENT-WELCOME-EMAIL` (câbler l'événement `student.created`
   côté backend — aujourd'hui aucun événement n'est émis à la création d'un compte).
6. Implémenter `GET-WEEKLY-REPORT`.
7. Décider, sur la base de l'usage réel de ces 3 workflows, si les 5 workflows
   restants du plan initial (notification établissement, tâches admin, gestion
   d'erreurs centralisée, etc.) apportent une valeur suffisante pour être construits.

## Critère de sortie

Ce document est validé quand le backlog ci-dessus est accepté et que la
correction de sécurité (item 1) est planifiée — pas nécessairement terminée,
mais avec un propriétaire et une échéance.
