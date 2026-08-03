# Déploiement d'un environnement QA (Railway + Vercel)

Ce guide déploie :
- le **backend** (NestJS + Postgres) sur **Railway**,
- le **frontend** (Next.js) sur **Vercel**,
- le **stockage de fichiers** (documents, avatars, logos...) sur **Cloudflare R2** (S3-compatible).

Ces trois comptes sont gratuits pour démarrer. Rien de tout ceci ne doit être fait sur les données de production existantes — c'est un environnement QA à part entière, avec sa propre base de données.

## 1. Cloudflare R2 (stockage de fichiers)

Le code attend **deux buckets** : un privé (documents, supports de cours, pièces jointes) et un public (avatars, logos, bannières). Voir `backend/src/common/services/storage.service.ts` — c'est nécessaire car la plupart des fournisseurs S3-compatibles n'honorent pas de façon fiable une ACL "public-read" posée sur un objet individuel, seule une politique de bucket est fiable partout.

1. Créer un compte sur [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** dans le menu.
2. Créer deux buckets : `get-poc-uploads` (privé, ne rien changer) et `get-poc-public`.
3. Sur `get-poc-public` : onglet **Settings** → **Public access** → activer l'accès public (Cloudflare fournit une URL `https://pub-xxxx.r2.dev` — c'est la valeur de `S3_PUBLIC_URL`).
4. **R2** → **Manage API Tokens** → créer un token avec permissions lecture/écriture sur les deux buckets. Noter `Access Key ID` et `Secret Access Key`.
5. Noter l'**Account ID** Cloudflare (visible dans l'URL du dashboard ou la page R2) : l'endpoint S3 est `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Variables à retenir pour l'étape Railway :
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

*(Alternative : MinIO auto-hébergé sur Railway plutôt que R2 — même variables, `S3_FORCE_PATH_STYLE=true`, mais demande un service Railway supplémentaire avec un volume persistant.)*

## 2. Railway (backend + Postgres)

1. Créer un compte sur [railway.app](https://railway.app), connecter le compte GitHub.
2. **New Project** → **Deploy from GitHub repo** → choisir ce dépôt.
3. Sur le service créé : **Settings** → **Root Directory** = `backend`. Railway détecte automatiquement Node/NestJS (Nixpacks) et lit `backend/railway.json` pour la commande de build/démarrage (`npm run build` / `npm run start:prod`).
4. **New** → **Database** → **Add PostgreSQL** dans le même projet : Railway injecte automatiquement `DATABASE_URL` dans le service backend (les deux doivent être dans le même projet Railway pour ça).
5. Sur le service backend → **Variables**, ajouter :
   ```
   JWT_SECRET=<générer une valeur longue aléatoire>
   JWT_REFRESH_SECRET=<autre valeur longue aléatoire>
   JWT_EXPIRATION=15m
   JWT_REFRESH_EXPIRATION=7d
   ENCRYPTION_KEY=<64 caractères hexadécimaux>
   PAYMENT_WEBHOOK_SECRET=<valeur longue aléatoire>
   NODE_ENV=production
   ENABLE_SWAGGER=true
   ALLOW_DEMO_SEED=true
   ALLOW_MOCK_PAYMENT=true
   APP_URL=<URL publique Railway du service, ex. https://xxx.up.railway.app>
   FRONTEND_URL=<URL Vercel, complétée à l'étape 3>
   S3_ENDPOINT=...
   S3_REGION=auto
   S3_FORCE_PATH_STYLE=false
   S3_BUCKET=get-poc-uploads
   S3_PUBLIC_BUCKET=get-poc-public
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_PUBLIC_URL=...
   ```
   `PORT` et `DATABASE_URL` sont déjà injectés automatiquement par Railway, ne pas les redéfinir.
6. **Settings** → **Deploy** → **Release Command** = `npx prisma migrate deploy` (applique les migrations une fois par déploiement, pas à chaque redémarrage).
7. Générer un domaine public : **Settings** → **Networking** → **Generate Domain**. C'est l'URL à utiliser pour `NEXT_PUBLIC_API_URL` côté Vercel (avec `/api` en suffixe) et pour `APP_URL` ci-dessus.
8. Déclencher le déploiement (normalement automatique au push). Suivre les logs jusqu'à `🚀 Server running on...`.

### Peupler la base

Une fois le service en ligne, lancer le seed une fois (Railway CLI, `npm install -g @railway/cli` puis `railway login` et `railway link` sur ce projet) :
```
railway run --service <nom-du-service-backend> npm run seed:national
```
Ou, plus simple : récupérer la `DATABASE_URL` Railway (onglet Postgres → Variables) et lancer le seed en local en la substituant temporairement dans `backend/.env`, puis `npx ts-node prisma/seed/national.ts` (avec `SEED_MODE=national`).

## 3. Vercel (frontend)

1. Créer un compte sur [vercel.com](https://vercel.com), connecter GitHub.
2. **Add New** → **Project** → choisir ce dépôt.
3. **Root Directory** = `frontend` (important, c'est un monorepo).
4. **Environment Variables** → ajouter :
   ```
   NEXT_PUBLIC_API_URL=https://<domaine-railway>/api
   ```
5. Déployer. Vercel donne une URL du type `https://<projet>.vercel.app`.
6. Revenir sur Railway → mettre à jour `FRONTEND_URL` avec cette URL Vercel exacte, redéployer le backend (sinon le navigateur bloquera les appels API en CORS).

## 4. Vérification de bout en bout

1. Ouvrir l'URL Vercel, créer un compte candidat, compléter le profil.
2. Uploader un document (pièce d'identité fictive) → doit réussir (passe par le bucket privé R2).
3. Se connecter en School Admin (`schooladmin@get.mg` / mot de passe du seed, ou un compte `admin.ecole.XX@demo.get.test` / `DemoNational2026!` si `seed:national` a été lancé), consulter la candidature et son document.
4. Uploader un avatar → l'image doit s'afficher immédiatement (bucket public, pas de redirection nécessaire).
5. `https://<domaine-railway>/api/docs` doit afficher Swagger (activé via `ENABLE_SWAGGER=true`).

## Limitations connues de cet environnement QA

- **Redis** n'est provisionné nulle part ici : le code ne l'utilise pas (rate-limiting en mémoire), ce n'est pas un oubli.
- **Paiements** : `ALLOW_MOCK_PAYMENT=true` active un fournisseur de paiement simulé — aucune vraie transaction n'est possible, c'est voulu pour un QA.
- Le filesystem Railway étant éphémère, ne pas définir `UPLOAD_DIR` ni retirer les variables `S3_*` : sans elles, les uploads échoueraient silencieusement au premier redéploiement.
