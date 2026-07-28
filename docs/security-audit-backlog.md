# Suivi de l'audit sécurité

Ce document conserve les constats du pré-audit réalisé le 28 juillet 2026.
Ils doivent être corrigés et vérifiés lors de l'audit sécurité final, avant la mise en production.

## Constats à corriger

### Priorité élevée — isolation des notifications école

Les endpoints de notification de changement de statut et de rappel sont accessibles aux administrateurs d'école, mais ne vérifient pas que l'utilisateur, la candidature ou l'offre concernée appartient à leur établissement.

À faire : transmettre l'identité de l'émetteur au service et vérifier l'appartenance à l'école avant tout envoi.

Fichiers concernés :

- `backend/src/modules/notification/notification.controller.ts`
- `backend/src/modules/notification/notification.service.ts`

### Priorité moyenne — téléversement de documents étudiants

Le téléversement contrôle uniquement le MIME annoncé par le client. Il doit vérifier la signature réelle des fichiers (PDF, DOC/DOCX, JPG, PNG) et déposer effectivement le fichier dans un stockage privé ; l'implémentation actuelle enregistre une URL construite sans téléverser le document.

À faire : mettre en place une validation de contenu, un nom de fichier aléatoire, un stockage privé et des URL temporaires/signées pour la consultation.

Fichiers concernés :

- `backend/src/modules/student/student.controller.ts`
- `backend/src/modules/student/student.service.ts`

### Priorité moyenne — données sensibles et journaux

Le code peut enregistrer téléphone ou CIN en clair si le chiffrement échoue. Des contenus de notification, e-mails et numéros de téléphone sont aussi écrits dans les logs.

À faire : faire échouer la requête si le chiffrement échoue, sans repli en clair ; remplacer les logs contenant des données personnelles par des journaux structurés et minimisés.

Fichiers concernés :

- `backend/src/modules/student/student.service.ts`
- `backend/src/modules/notification/notification.service.ts`

## Vérifications à refaire lors de l'audit final

- Tests dynamiques avec des comptes étudiant, administrateur d'école, ministère et administrateur GET.
- Essais d'accès croisés entre deux établissements (candidatures, notifications, documents et paiements).
- Tests d'upload de fichiers falsifiés et de fichiers volumineux.
- Vérification des journaux, secrets d'environnement, sauvegardes et configuration HTTPS/CORS de production.
- Nouvelle exécution de `npm audit` et mise à jour de Next.js lorsque les correctifs transitifs de `postcss` et `sharp` seront disponibles.

## État du pré-audit

- Contrôles d'accès critiques déjà durcis : offres, candidatures et paiements.
- Sessions déplacées vers des cookies `HttpOnly`.
- Webhooks de paiement signés et rate limiting activé.
- Audit de dépendances backend : aucune vulnérabilité connue au moment du contrôle.
