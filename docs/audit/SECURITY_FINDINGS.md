# Constats de sécurité — Plateforme GET

Revue basée sur OWASP Top 10 (2021) et OWASP API Security Top 10. Toutes les valeurs sensibles sont masquées. Aucun secret en clair n'a été trouvé dans le code source suivi par git (`.env`, `.env.local` correctement ignorés). Aucune modification n'a été appliquée.

Légende gravité : Critique / Élevée / Moyenne / Faible / Information.

---

## SEC-01 — Montant de paiement contrôlable par le client (intégrité financière / A04:2021-Insecure Design)
- **Gravité :** Critique
- **Fichier :** `backend/src/modules/payment/payment.service.ts:24-43` (`initiatePayment`)
- **Preuve :**
  ```ts
  let amount = dto.amount; // dto.amount vient directement du corps de la requête
  if (dto.applicationId) {
    // recalcul serveur UNIQUEMENT dans ce branchement
    amount = application.offer.tuitionFees;
  }
  ```
  `InitiatePaymentDto.applicationId` est `@IsOptional()`.
- **Exploitation possible :** `POST /api/payments/initiate` avec `{ "amount": 100, "method": "MVOLA" }` (sans `applicationId`), authentifié en tant qu'étudiant quelconque → crée un enregistrement `Payment` valide de 100 MGA (minimum autorisé par `@Min(100)`), sans lien de cohérence avec une offre/candidature réelle. Pollue les agrégats consultés par Ministère/Admin (`PaymentService.getStats`).
- **Correction :** rendre `applicationId` obligatoire pour tout paiement lié à une candidature ; si un paiement « libre » doit exister un jour (frais divers), définir un catalogue serveur de montants autorisés au lieu de faire confiance au client.

## SEC-02 — `/ministry/public/stats` non accessible sans authentification malgré son contrat (A01:2021-Broken Access Control, contrat API incohérent)
- **Gravité :** Élevée
- **Fichier :** `backend/src/modules/ministry/ministry.controller.ts:39-43,312-330`
- **Preuve :** `@Controller('ministry') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('MINISTRY','ADMIN_GET')` est posé au niveau classe ; la méthode `getPublicStats` (documentée `@ApiOperation({summary: 'Public statistics (no authentication required)'})`) ne porte pas de `@Public()`.
- **Exploitation possible :** aucune (le sens du bug est inverse — la route est *trop* fermée, pas trop ouverte), mais c'est un défaut de contrat qui peut induire en erreur un intégrateur externe (site public, application mobile) qui s'attendrait à un accès anonyme documenté.
- **Correction :** ajouter `@Public()` sur `getPublicStats`, ou retirer la mention « no authentication required » si le comportement restreint est volontaire.

## SEC-03 — Réinitialisation de mot de passe non fonctionnelle (impact disponibilité du compte, pas de compromission)
- **Gravité :** Élevée (fonctionnel) — mentionné ici pour sa dimension sécurité : sans canal de délivrance, un opérateur pourrait être tenté de contourner via une procédure manuelle non sécurisée (reset direct en base par un admin, sans traçabilité formelle).
- **Fichier :** `backend/src/modules/auth/auth.service.ts:119-143`
- **Preuve :** voir CRIT-01 dans `CODE_AUDIT_REPORT.md`.
- **Correction :** brancher un vrai canal d'envoi + table de jetons à usage unique avec expiration et révocation après utilisation (actuellement, même une fois le canal branché, le jeton resterait réutilisable pendant 1h — MED-04).

## SEC-04 — Absence de révocation de session serveur (JWT stateless sans liste de révocation)
- **Gravité :** Moyenne
- **Fichier :** `backend/src/modules/auth/auth.controller.ts:115-120` (`logout`)
- **Preuve :** `logout` se contente de `response.clearCookie(...)`. Le JWT signé reste cryptographiquement valide jusqu'à expiration naturelle (15 min access / 7 jours refresh) même après « déconnexion ».
- **Exploitation possible :** un attaquant ayant intercepté un jeton avant la déconnexion légitime de la victime (ex. XSS ponctuel, log réseau non chiffré sur un réseau compromis) peut continuer à l'utiliser jusqu'à expiration, malgré la déconnexion apparente de la victime.
- **Correction :** table `RevokedToken`/`SessionVersion` sur `User` incrémentée à la déconnexion et vérifiée dans `JwtStrategy.validate()`, ou raccourcir encore la durée de vie de l'access token et s'appuyer sur la révocation du refresh token uniquement.

## SEC-05 — Comptes de démonstration à identifiants prévisibles (A07:2021-Identification and Authentication Failures)
- **Gravité :** Moyenne (le garde-fou de production existe, donc pas Élevée)
- **Fichier :** `backend/prisma/seed.ts:8-13,48-61,133-152`
- **Preuve :** le script refuse de s'exécuter si `NODE_ENV=production` sauf si `ALLOW_DEMO_SEED=true` est explicitement positionné — bon réflexe. Mais les mots de passe (`Admin123!`, `Ministere123!`, `Professeur123!`, `Student123!`) sont des motifs prévisibles et **affichés en clair dans les logs de seed** (`console.log('✅ Admin GET créé: admin@get.mg / Admin123!')`), donc potentiellement capturés par un agrégateur de logs si le seed était un jour exécuté contre un environnement partagé.
- **Correction :** générer des mots de passe aléatoires à la volée pour tout environnement autre que le poste de développement local, ne jamais les journaliser en clair (utiliser un canal one-shot type fichier local ignoré par git).

## SEC-06 — Dépendances avec vulnérabilités connues (A06:2021-Vulnerable and Outdated Components)
- **Gravité :** Élevée
- **Fichiers :** `backend/package-lock.json`, `frontend/package-lock.json`
- **Preuve :** `npm audit` → 26 vulnérabilités *high* backend (chaîne `brace-expansion`/`minimatch` utilisée par ESLint/Jest, `fast-uri`), 12 *high* frontend (`postcss`/`sharp` via `next`, même chaîne `brace-expansion`/`minimatch` via `eslint-config-next`).
- **Exploitation possible :** la majorité des paquets touchés sont des `devDependencies` (outillage de lint/test), donc **pas exposés en production**. `postcss`/`sharp` (traitement d'image côté build Next.js) présentent un risque théorique plus élevé (CVE de déni de service / lecture de fichier arbitraire liée au traitement de sourcemaps), mais uniquement exploitable au moment du build, pas à l'exécution côté serveur pour un utilisateur final.
- **Correction :** `npm audit fix` (sans `--force`) pour les correctifs non-breaking ; planifier une mise à jour majeure d'ESLint/Next.js dans une itération dédiée avec tests de non-régression complets (le correctif `--force` proposé bascule ESLint en v10 et Next.js en v9, ce qui casserait la configuration actuelle).

## SEC-07 — Objet utilisateur complet (y compris hash de mot de passe) propagé en `any` dans toute la couche contrôleur (A04:2021-Insecure Design, défense en profondeur)
- **Gravité :** Moyenne
- **Fichier :** `backend/src/modules/auth/strategies/jwt.strategy.ts:27-48`
- **Preuve :**
  ```ts
  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { student: true, schoolAdmin: true, role: true } });
    ...
    return { ...user, role: user.role?.name || 'STUDENT', studentId: user.student?.id, schoolAdminId: user.schoolAdmin?.id };
  }
  ```
  `user` inclut `password` (hash bcrypt) et `mfaSecret` (chiffré). Cet objet devient `request.user`, injecté par `@GetUser() user: any` dans **tous** les contrôleurs.
- **Exploitation possible :** aucune fuite confirmée à ce jour — chaque contrôleur audité reconstruit explicitement sa réponse (`{ id, email, role, ... }`). Le risque est **latent** : un futur développeur qui écrirait `return { success: true, data: user }` par erreur exposerait immédiatement le hash bcrypt et le secret MFA chiffré de l'utilisateur courant à lui-même (impact limité, l'utilisateur voit ses propres secrets) — le risque devient réel si un tel raccourci était pris sur un endpoint qui renvoie un *autre* utilisateur.
- **Correction :** typer `request.user` avec une interface stricte `AuthenticatedUser` n'exposant jamais `password`/`mfaSecret` ; utiliser un `select` Prisma explicite dans `JwtStrategy.validate()` au lieu d'un `findUnique` sans restriction de champs.

## SEC-08 — Fichiers de reçu/rapport renvoyés avec un `Content-Type` ne correspondant pas au contenu réel
- **Gravité :** Faible (intégrité fonctionnelle, pas un vecteur d'exécution de code — le contenu est du texte brut, pas de contenu actif)
- **Fichiers :** `backend/src/modules/payment/payment.service.ts:208-225`, `backend/src/modules/ministry/ministry.service.ts:492-518`
- **Preuve :** voir HIGH-02 dans `CODE_AUDIT_REPORT.md`.
- **Correction :** générer un vrai PDF (ex. `pdfkit`, déjà anticipé en commentaire dans le code) ou, à défaut, renvoyer `text/plain` tant que la génération réelle n'est pas implémentée, pour ne pas induire l'utilisateur en erreur sur la nature du fichier téléchargé.

## SEC-09 — `apiClient` frontend en HTTP dur vers `localhost`
- **Gravité :** Faible en tant que finding sécurité pur (c'est avant tout un bug de configuration, voir CRIT-08), mais mentionné car une bascule ultérieure mal faite vers une URL de production en clair (`http://` au lieu de `https://`) transmettrait le cookie de session en clair.
- **Fichier :** `frontend/lib/api-client.ts:4`
- **Correction :** utiliser `NEXT_PUBLIC_API_URL`, s'assurer que la valeur de production est en `https://`.

## SEC-10 — Validation du type de fichier basée sur la signature binaire réelle pour les images (bon point à consolider)
- **Gravité :** Information (pas une vulnérabilité, mais un contrôle à étendre)
- **Fichier :** `backend/src/common/services/storage.service.ts:103-126` (`assertSafeImage`)
- **Constat positif :** contrairement à un contrôle naïf basé sur l'extension ou le `mimetype` déclaré par le client, `StorageService.assertSafeImage` vérifie la **signature binaire réelle** (magic bytes PNG/JPEG/WebP) avant d'accepter un upload d'avatar/logo — bonne pratique qui empêche un fichier renommé (ex. script déguisé en `.png`) d'être accepté sous ce chemin.
- **Lacune :** ce contrôle n'existe **que** pour les images (`StorageService`). L'upload de documents étudiants (CV, diplôme, PDF/DOC) dans `StudentController.uploadDocument` ne vérifie que le `mimetype` déclaré par le client (`fileFilter` sur `file.mimetype`), facilement falsifiable — **mais cela reste sans conséquence aujourd'hui puisque le fichier n'est de toute façon jamais écrit sur disque** (CRIT-03). Ce point devra être traité **en même temps** que la correction de CRIT-03, pas après, pour ne pas rouvrir un vecteur d'upload de fichier arbitraire au moment de la correction.
- **Correction :** appliquer une vérification de signature binaire équivalente pour les PDF/DOC/DOCX lors du branchement du stockage réel des documents.

## SEC-11 — Pas de CSRF token explicite (mitigé mais pas éliminé)
- **Gravité :** Information
- **Fichier :** `backend/src/main.ts:35-42`, `backend/src/modules/auth/auth.controller.ts:39-59`
- **Constat :** l'authentification repose sur un cookie `httpOnly` + `SameSite=Lax`, combiné à `CORS` restreint à `FRONTEND_URL` avec `credentials: true`. Cette combinaison bloque la plupart des attaques CSRF classiques (SameSite=Lax n'envoie pas le cookie sur une requête POST cross-site). Il n'existe cependant aucun jeton CSRF explicite en défense en profondeur, et aucune requête d'état (POST/PUT/DELETE) n'est actuellement exposée en `GET`, ce qui évite le principal contournement connu de SameSite=Lax.
- **Recommandation :** conserver cette architecture pour le MVP ; envisager un jeton CSRF explicite (double-submit cookie) uniquement si le support de navigateurs très anciens devient un prérequis.

---

## Recherche de secrets exposés

- `git grep -n -i -E "password|secret|api[_-]?key|private[_-]?key"` sur le code source suivi : aucune valeur de secret en clair, uniquement des noms de champs/DTO/variables (`password: string`, `JWT_SECRET` en tant que nom de variable d'environnement lu via `config.get(...)`).
- `backend/.env`, `backend/.env.local`, `frontend/.env.local` existent en local mais sont exclus par `.gitignore` (racine, backend, frontend) et confirmés **non suivis** par `git ls-files`.
- Aucun dump de base, aucune sauvegarde, aucun certificat, aucune archive n'a été trouvé dans le dépôt suivi.
- Le seul contenu sensible versionné est constitué des mots de passe de démonstration en clair dans `backend/prisma/seed.ts` (voir SEC-05) — acceptable pour un script de seed de développement explicitement gardé hors production, mais à traiter avec prudence (ne jamais réutiliser ces mots de passe au-delà de l'environnement de démonstration).

## Résumé des vulnérabilités

| ID | Vulnérabilité | Gravité | Fichier |
|---|---|---|---|
| SEC-01 | Montant de paiement contrôlable côté client | Critique | `payment.service.ts` |
| SEC-02 | Contrat API incohérent sur `/ministry/public/stats` | Élevée | `ministry.controller.ts` |
| SEC-03 | Reset de mot de passe non fonctionnel | Élevée | `auth.service.ts` |
| SEC-04 | Pas de révocation de session serveur | Moyenne | `auth.controller.ts` |
| SEC-05 | Comptes de démo à mots de passe prévisibles, journalisés en clair | Moyenne | `prisma/seed.ts` |
| SEC-06 | Dépendances vulnérables (`npm audit`) | Élevée | `package-lock.json` (x2) |
| SEC-07 | Objet utilisateur complet en `any` propagé partout | Moyenne | `jwt.strategy.ts` |
| SEC-08 | Content-Type mensonger sur fichiers générés | Faible | `payment.service.ts`, `ministry.service.ts` |
| SEC-09 | `apiClient` en dur vers `localhost` | Faible (sécurité) / Critique (fonctionnel, voir CRIT-08) | `api-client.ts` |
| SEC-10 | Validation MIME déclaratif pour les documents (latent) | Information | `student.controller.ts` |
| SEC-11 | Pas de jeton CSRF explicite (mitigé par SameSite) | Information | `main.ts` |
