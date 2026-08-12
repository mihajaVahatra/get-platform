# Déploiement d'un environnement QA (100% gratuit)

Ce guide déploie :
- le **backend** (NestJS) sur **Render** (plan gratuit),
- la **base de données Postgres** sur **Neon** (plan gratuit, sans expiration),
- le **frontend** (Next.js) sur **Vercel** (plan gratuit),
- le **stockage de fichiers** (documents, avatars, logos...) sur **Cloudflare R2** (plan gratuit, S3-compatible).

Ces quatre comptes sont gratuits **en continu**, pas juste à l'essai. Rien de tout ceci ne doit être fait sur les données de production existantes — c'est un environnement QA à part entière, avec sa propre base de données.

**Compromis du plan gratuit à connaître** : le service Render s'endort après ~15 minutes sans requête ; le premier appel qui le réveille prend 30 à 60 secondes le temps qu'il redémarre. Pour un QA ponctuel (pas un service 24/7 avec des utilisateurs réels en continu), c'est un compromis raisonnable. Si ça devient gênant, la seule vraie solution est un plan payant (Render Starter ~7$/mois, ou Railway) — pas d'astuce gratuite miracle pour éviter la mise en veille.

## 1. Cloudflare R2 (stockage de fichiers)

Le code attend **deux buckets** : un privé (documents, supports de cours, pièces jointes) et un public (avatars, logos, bannières). Voir `backend/src/common/services/storage.service.ts` — c'est nécessaire car la plupart des fournisseurs S3-compatibles n'honorent pas de façon fiable une ACL "public-read" posée sur un objet individuel, seule une politique de bucket est fiable partout.

1. Créer un compte sur [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** dans le menu.
2. Créer deux buckets : `get-poc-uploads` (privé, ne rien changer) et `get-poc-public`.
3. Sur `get-poc-public` : onglet **Settings** → **Public access** → activer l'accès public (Cloudflare fournit une URL `https://pub-xxxx.r2.dev` — c'est la valeur de `S3_PUBLIC_URL`).
4. **R2** → **Manage API Tokens** → créer un token avec permissions lecture/écriture sur les deux buckets. Noter `Access Key ID` et `Secret Access Key`.
5. Noter l'**Account ID** Cloudflare (visible dans l'URL du dashboard ou la page R2) : l'endpoint S3 est `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Variables à retenir pour l'étape Render :
```
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_FORCE_PATH_STYLE=false
S3_BUCKET=get-poc-uploads
S3_PUBLIC_BUCKET=get-poc-public
S3_ACCESS_KEY_ID=<le token créé>
S3_SECRET_ACCESS_KEY=<le secret du token>
S3_PUBLIC_URL=https://pub-xxxx.r2.dev
```

*(Alternative payante : MinIO auto-hébergé plutôt que R2 — même variables, `S3_FORCE_PATH_STYLE=true`, mais demande un service supplémentaire avec un volume persistant, donc pas gratuit sur la plupart des hébergeurs.)*

## 2. Neon (Postgres gratuit, sans expiration)

1. Créer un compte sur [neon.tech](https://neon.tech) (connexion GitHub possible).
2. **Create a project** → nom au choix (ex. `get-poc-qa`), région proche de toi.
3. Neon crée une base par défaut et affiche une **Connection string** du type :
   ```
   postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require
   ```
   Copier cette URL telle quelle — c'est la valeur de `DATABASE_URL`. Le plan gratuit Neon n'expire pas : la base se met juste en pause après une période d'inactivité et se réveille automatiquement au premier appel (quelques centaines de ms, bien plus rapide que le réveil du service Render).

## 3. SendGrid (emails transactionnels)

Le backend s'appuie sur SendGrid pour l'email de vérification d'inscription et le lien de réinitialisation de mot de passe. **Sans clé configurée, ces deux parcours échouent explicitement** dès que `NODE_ENV=production` (le cas de ce déploiement Render, voir étape suivante) — ce n'est pas une dégradation silencieuse, une erreur claire est renvoyée à l'appelant plutôt que de faire semblant d'avoir envoyé l'email.

1. Créer un compte gratuit sur [sendgrid.com](https://sendgrid.com) (100 emails/jour à vie sur le plan Free, largement suffisant pour un QA).
2. **Settings** → **API Keys** → créer une clé avec permission "Mail Send" uniquement. Noter la valeur (affichée une seule fois) : c'est `SENDGRID_API_KEY`.
3. **Settings** → **Sender Authentication** → vérifier au moins une adresse d'expéditeur (Single Sender Verification suffit pour un QA, pas besoin de vérifier un domaine entier). C'est la valeur de `SENDGRID_FROM_EMAIL`.

Variables à retenir pour l'étape Render :
```
SENDGRID_API_KEY=<la clé créée à l'étape 2>
SENDGRID_FROM_EMAIL=<l'adresse vérifiée à l'étape 3>
SENDGRID_FROM_NAME=GET
```

*(Échappatoire pour un QA sans besoin d'emails fonctionnels : définir `ALLOW_SIMULATED_EMAIL=true` à la place — les emails sont alors simulés (jamais réellement envoyés) et les liens/codes de vérification ne sont récupérables que dans les logs du service Render, pas dans les réponses API. Dans ce mode, inscription et mot de passe oublié ne peuvent pas être testés de bout en bout.)*

## 4. Render (backend, plan gratuit)

1. Créer un compte sur [render.com](https://render.com), connecter le compte GitHub.
2. **New** → **Blueprint** → choisir ce dépôt. Render détecte `backend/render.yaml` et propose de créer le service `get-poc-backend` automatiquement (plan Free, build/démarrage déjà configurés).
   - Si tu préfères une création manuelle plutôt que le Blueprint : **New** → **Web Service**, choisir le repo, **Root Directory** = `backend`, **Build Command** = `npm ci --include=dev && npm run build` (voir le commentaire dans `render.yaml` pour le pourquoi de `--include=dev` malgré `NODE_ENV=production`, et de `npm ci` plutôt que `npm install` — installation reproductible depuis le lockfile, identique à ce que la CI a testé), **Start Command** = `npx prisma migrate deploy && npm run start:prod`, **Plan** = Free.
3. Render va demander de renseigner les variables marquées `sync: false` dans `render.yaml` (ou toutes les variables si création manuelle) — dans l'onglet **Environment** du service :
   ```
   DATABASE_URL=<la connection string Neon de l'étape 2>
   JWT_SECRET=<générer une valeur longue aléatoire>
   JWT_REFRESH_SECRET=<autre valeur longue aléatoire>
   ENCRYPTION_KEY=<64 caractères hexadécimaux>
   PAYMENT_WEBHOOK_SECRET=<valeur longue aléatoire>
   STRIPE_SECRET_KEY=<clé secrète Stripe en mode test, sk_test_...>
   STRIPE_WEBHOOK_SECRET=<secret de signature de l'endpoint webhook Stripe, whsec_...>
   APP_URL=<URL publique Render du service, ex. https://get-poc-backend.onrender.com>
   FRONTEND_URL=<URL Vercel, complétée à l'étape 5>
   ENABLE_SWAGGER=true
   ALLOW_DEMO_SEED=true
   TRUST_PROXY=true
   SENDGRID_API_KEY=<la clé SendGrid de l'étape 3>
   SENDGRID_FROM_EMAIL=<l'adresse vérifiée à l'étape 3>
   SENDGRID_FROM_NAME=GET
   S3_ENDPOINT=...
   S3_REGION=auto
   S3_FORCE_PATH_STYLE=false
   S3_BUCKET=get-poc-uploads
   S3_PUBLIC_BUCKET=get-poc-public
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_PUBLIC_URL=...
   ```
   `PORT` est injecté automatiquement par Render, ne pas le redéfinir. `ENABLE_SWAGGER`/`ALLOW_DEMO_SEED`/`ALLOW_MOCK_PAYMENT` sont volontairement en `sync: false` dans `render.yaml` (pas préremplis à `true`) : ce sont les garde-fous qui bloquent comptes de démo et paiements simulés en production — les saisir manuellement ici à `true` pour ce QA évite qu'ils se retrouvent actifs par défaut si ce fichier est un jour réutilisé comme template pour un vrai déploiement.

   **Paiements — obtenir les clés Stripe (mode test, gratuit, sans vérification d'entreprise) :**
   1. Créer un compte sur [dashboard.stripe.com/register](https://dashboard.stripe.com/register).
   2. Rester en mode **Test** (bascule en haut du dashboard) — **Developers → API keys** : copier la clé **Secret key** (`sk_test_...`), c'est `STRIPE_SECRET_KEY`.
   3. **Developers → Webhooks → Add endpoint** : URL = `<APP_URL ci-dessus>/api/payments/webhook/stripe`, événements à écouter : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Une fois créé, copier le **Signing secret** (`whsec_...`), c'est `STRIPE_WEBHOOK_SECRET`.
   4. Cartes de test pour valider les parcours (voir [stripe.com/docs/testing](https://stripe.com/docs/testing)) : `4242 4242 4242 4242` (paiement réussi), `4000 0000 0000 0002` (refusé), n'importe quelle date future/CVC à 3 chiffres.

   *En local (avant tout déploiement), pas besoin de créer un endpoint webhook dans le dashboard : `stripe listen --forward-to localhost:3001/api/payments/webhook/stripe` (CLI Stripe, `stripe login` au préalable) affiche un `whsec_...` temporaire à mettre dans `backend/.env`.*

   `ALLOW_MOCK_PAYMENT` n'a plus besoin d'être défini : dès que `STRIPE_SECRET_KEY` est renseignée, `PaymentModule` utilise `StripePaymentProvider` au lieu du mock (voir `backend/src/modules/payment/payment.module.ts`) — la procédure de déploiement ne demande plus d'activer un mock de paiement.
4. Déployer. L'URL du service (`https://<nom-du-service>.onrender.com`) apparaît en haut du dashboard — c'est celle à utiliser pour `APP_URL` ci-dessus et pour `API_ORIGIN` côté Vercel (**sans** `/api` en suffixe, voir étape 4 — le proxy Next.js l'ajoute lui-même). Suivre les logs jusqu'à `🚀 Server running on...`.

### Peupler la base

Une fois le service en ligne, lancer le seed une fois **en local**, pointé vers Neon : dans `backend/.env`, remplacer temporairement `DATABASE_URL` par la connection string Neon, puis :
```
SEED_MODE=national npx ts-node prisma/seed/national.ts
```
Remettre ensuite `DATABASE_URL` local dans `.env` pour ne pas continuer à travailler par erreur sur la base Neon depuis ta machine.

## 5. Vercel (frontend)

1. Créer un compte sur [vercel.com](https://vercel.com), connecter GitHub.
2. **Add New** → **Project** → choisir ce dépôt.
3. **Root Directory** = `frontend` (important, c'est un monorepo).
4. **Environment Variables** → ajouter :
   ```
   API_ORIGIN=https://<domaine-render>
   ```
   **Sans** `/api` en suffixe — la réécriture Next.js (`frontend/next.config.ts`) l'ajoute déjà. Cette variable est lue **côté serveur** par le proxy `/api/*` de Next.js (`rewrites()`), jamais exposée au navigateur (contrairement à une variable `NEXT_PUBLIC_*`) : le frontend n'appelle jamais le backend directement (`frontend/lib/api-client.ts` — `baseURL: '/api'`, une URL relative à son propre domaine, en toute circonstance).

   **Pourquoi un proxy et pas un appel direct au backend ?** Avec deux domaines distincts (Vercel + Render), un appel direct du navigateur vers Render rendrait le cookie de session "tiers" de son point de vue. Chrome/Firefox l'acceptent avec `SameSite=None; Secure`, mais **Safari (desktop et iOS) le bloque par défaut (ITP) quel que soit ce réglage** : la connexion semble réussir, mais le dashboard reste inaccessible ensuite. Le proxy fait que le navigateur ne parle *jamais* qu'à son propre domaine (Vercel) — le cookie redevient "premier parti" partout, y compris Safari. C'est l'architecture retenue par ce projet ; ne pas la contourner en définissant `NEXT_PUBLIC_API_URL` (variable volontairement ignorée par `api-client.ts`).

   *(Si tu choisis malgré tout l'architecture alternative — appel direct sans proxy — il faut définir `CROSS_SITE_COOKIES=true` côté Render **et** accepter que Safari/iOS ne fonctionnera pas ; voir le commentaire dans `.env.example` à la racine. Ce n'est pas la voie recommandée ni celle documentée ci-dessous.)*
5. Déployer. Vercel donne une URL du type `https://<projet>.vercel.app`.
6. Revenir sur Render → mettre à jour `FRONTEND_URL` avec cette URL Vercel exacte, redéployer le backend (sinon le navigateur bloquera les appels API en CORS **et** la protection CSRF par vérification d'origine, voir `backend/src/main.ts`).

## 6. Vérification de bout en bout

1. Ouvrir l'URL Vercel — le tout premier appel peut prendre 30-60s si le backend Render s'était endormi, c'est normal.
2. Créer un compte candidat, compléter le profil — l'email de vérification doit arriver réellement (SendGrid configuré à l'étape 3) ; un 400 immédiat à l'inscription signale une clé SendGrid manquante ou invalide.
3. Uploader un document (pièce d'identité fictive) → doit réussir (passe par le bucket privé R2).
4. Se connecter en School Admin (`schooladmin@get.mg` / mot de passe du seed, ou un compte `admin.ecole.XX@demo.get.test` / `DemoNational2026!` si `seed:national` a été lancé). Le MFA est obligatoire pour ce rôle (ADMIN_GET/SCHOOL_ADMIN/MINISTRY) : au premier login, tout endpoint hors `/auth/me` et `/auth/mfa/*` renvoie 403 tant qu'il n'est pas activé — scanner le QR code renvoyé par `POST /auth/mfa/enable` dans une app d'authentification (Google Authenticator, Aegis...), puis confirmer avec `POST /auth/mfa/verify`. Ensuite seulement, consulter la candidature et son document.
5. Uploader un avatar → l'image doit s'afficher immédiatement (bucket public, pas de redirection nécessaire).
6. `https://<domaine-render>/api/docs` doit afficher Swagger (activé via `ENABLE_SWAGGER=true`).
7. **Paiement (Stripe, mode test)** : en tant que candidat avec une candidature `ACCEPTED`, initier un paiement → redirection vers une page Stripe Checkout réelle (`checkout.stripe.com`). Tester au moins :
   - **Réussi** : carte `4242 4242 4242 4242` → redirection vers `.../payments?status=success`, le paiement passe `COMPLETED` puis la candidature `ENROLLED` (peut prendre quelques secondes, le temps que le webhook Stripe arrive — voir **Developers → Webhooks → (ton endpoint) → Events récents** sur le dashboard Stripe pour vérifier la livraison).
   - **Refusé** : carte `4000 0000 0000 0002` → le paiement reste `FAILED`, aucune inscription.
   - **Annulé** : quitter la page Stripe Checkout sans payer → redirection vers `.../payments?status=cancelled`, le paiement reste `PENDING`.
   - **Webhook tardif sur candidature annulée** : après un paiement réussi mais avant que le webhook n'arrive, annuler la candidature côté admin → le webhook, une fois traité, ne doit jamais repasser la candidature à `ENROLLED` (voir `PaymentService.reconcilePayment` — comportement déjà couvert par les tests unitaires, à revalider ici en conditions réelles si le temps le permet).
8. **Session (à valider sur au moins Chrome/Firefox et Safari — desktop et iOS si possible, c'est justement le navigateur que l'architecture proxy vise à corriger) :**
   - Se connecter → la session doit rester active après un rafraîchissement de page (F5) et après avoir fermé/rouvert l'onglet.
   - Ouvrir les DevTools → Application/Storage → Cookies sur le domaine Vercel : `access_token` et `refresh_token` doivent y apparaître (`httpOnly`, `Secure`), **jamais** sur le domaine Render — s'ils apparaissent sur le domaine Render, `API_ORIGIN` n'est pas configuré ou le frontend n'a pas été redéployé après l'avoir défini.
   - Rester connecté plus de 15 minutes (durée de vie de l'access token) sans naviguer, puis effectuer une action → doit fonctionner sans redemander de connexion (rafraîchissement silencieux via `/auth/refresh`, voir `frontend/lib/api-client.ts`).
   - Se déconnecter → les deux cookies doivent disparaître et l'accès aux pages protégées doit rediriger vers `/auth/login`.
   - Sur un compte avec MFA activé (`ADMIN_GET`/`SCHOOL_ADMIN`/`MINISTRY`) : vérifier le cycle complet enrôlement → déconnexion → reconnexion avec code MFA.

## Limitations connues de cet environnement QA

- **Render (plan free)** met le service en veille après ~15 min d'inactivité — premier appel suivant plus lent (30-60s), c'est le compromis du 100% gratuit. Pas de solution gratuite pour l'éviter ; un plan payant (Render Starter, Railway...) supprime ce comportement.
- **Redis** n'est provisionné nulle part ici : le code ne l'utilise pas (rate-limiting en mémoire), ce n'est pas un oubli.
- **Paiements** : Stripe en **mode test** (voir étape 3) — aucune vraie transaction bancaire, cartes de test uniquement. Passer en mode réel (clés `sk_live_`/`whsec_` live) est un choix produit distinct, hors de portée de ce guide QA.
- **Emails** : sans `SENDGRID_API_KEY` valide, inscription et mot de passe oublié échouent explicitement (`NODE_ENV=production` sur ce service interdit le repli silencieux vers un envoi simulé) — voir étape 3.
- Le filesystem Render étant éphémère, ne pas définir `UPLOAD_DIR` ni retirer les variables `S3_*` : sans elles, les uploads échoueraient silencieusement au premier redéploiement/réveil.
- `backend/railway.json` est conservé dans le dépôt comme chemin alternatif si un jour la mise en veille Render devient gênante et que tu acceptes de payer — non utilisé par le parcours 100% gratuit ci-dessus.

## Revenir en arrière après un déploiement problématique

**Code seul (pas de migration Prisma dans le déploiement qui pose problème)** — cas le plus courant :
- **Render** : onglet **Events** (ou **Deploys**) du service → repérer le dernier déploiement sain → **Redeploy**. Redéploie exactement ce commit sans nécessiter de revert Git.
- **Vercel** : onglet **Deployments** du projet → dernier déploiement sain → **⋯** → **Promote to Production** (« Instant Rollback ») — bascule immédiate, pas de rebuild.
- **Railway** : onglet **Deployments** du service → déploiement précédent → **Redeploy**.

Dans les trois cas, c'est un aller simple tant qu'aucune migration de schéma n'a été appliquée entre-temps — sinon voir le point suivant.

**Si le déploiement problématique incluait une migration Prisma** — ne jamais se contenter de redéployer l'ancien code :
- Les migrations de ce projet sont à sens unique (`prisma migrate deploy`, pas de migration "down" maintenue) — revenir au code d'avant sans revenir sur le schéma laisse tourner une version du code qui ne correspond plus à la structure de la base (colonnes manquantes/en trop selon le sens du changement), ce qui casse silencieusement des requêtes plutôt que d'échouer proprement au démarrage.
- La bonne réaction est presque toujours une **migration corrective qui avance** (ajouter une nouvelle migration qui annule l'effet de la précédente), pas un retour en arrière du schéma — cohérent avec la façon dont les migrations de ce dépôt ont déjà été gérées (voir par ex. `docs/n8n/04-decisions-actees.md` pour un exemple de correctif appliqué en avant).
- Si la migration a corrompu des données (pas seulement le schéma) et qu'aucun correctif en avant n'est possible : Neon propose une restauration ponctuelle (**point-in-time restore**) ou la création d'une branche de base à un instant antérieur — fonctionnalité et fenêtre de rétention dépendent du plan Neon en vigueur au moment des faits, à vérifier dans leur dashboard avant de s'y fier en urgence plutôt que de le supposer.
