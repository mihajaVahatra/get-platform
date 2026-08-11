# GET — Grandes Écoles de Tananarive

Plateforme de gestion des candidatures et inscriptions post-bac : les candidats postulent aux formations d'établissements partenaires, suivent leurs candidatures et paient leurs frais de scolarité en ligne ; les établissements gèrent candidatures, cours, professeurs et inscriptions ; le ministère supervise des indicateurs agrégés.

Monorepo à deux paquets :

| Dossier | Stack | Rôle |
| --- | --- | --- |
| [`backend/`](backend) | NestJS + Prisma + PostgreSQL | API REST (`/api/*`), authentification, paiements, stockage de documents |
| [`frontend/`](frontend) | Next.js (App Router) + Tailwind | Interface candidat/école/professeur/ministère/admin |
| [`n8n/`](n8n) | n8n (self-hosted) | Automatisations (relances, rapports) — voir [`docs/n8n/`](docs/n8n) |

## Prérequis

- Node.js **22** (`backend/.nvmrc` et `frontend/.nvmrc`, si présents dans votre branche — sinon `node --version` et vérifier contre `engines.node` de chaque `package.json`)
- Docker + Docker Compose (Postgres, Redis, MinIO en local)
- `npm` (ce dépôt utilise des `package-lock.json`, pas de yarn/pnpm)

## Démarrage local

### 1. Services d'infrastructure (Postgres, Redis, MinIO)

```bash
cp .env.example .env    # renseigner les valeurs marquées "change-this-..."
docker compose up -d
```

MinIO est administrable sur http://localhost:9001 (identifiants `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` du `.env`) — créer les deux buckets (`get-poc-uploads` privé, `get-poc-public`) avant de lancer le backend, voir [`DEPLOYMENT.md`](DEPLOYMENT.md) pour la configuration S3 complète.

### 2. Backend (NestJS)

```bash
cd backend
cp .env.example .env    # ajuster DATABASE_URL/ENCRYPTION_KEY/etc. si besoin
npm install
npx prisma migrate deploy   # applique les migrations sur la base du .env
npx prisma db seed          # optionnel : données de démonstration (comptes affichés en fin d'exécution)
npm run start:dev           # http://localhost:3001, Swagger sur /api/docs
```

Autres commandes utiles (voir `backend/package.json` pour la liste exhaustive) :

```bash
npm run typecheck   # tsc --noEmit
npm run lint         # eslint (non bloquant en CI, backlog en cours de résorption)
npm run test          # tests unitaires (Jest)
npm run test:cov     # tests unitaires + seuil de couverture
npm run test:e2e     # tests e2e (Jest + Supertest, contre une vraie base Postgres)
npm run build          # nest build
```

### 3. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Autres commandes utiles :

```bash
npm run typecheck    # tsc --noEmit
npm run lint          # eslint
npm run test           # tests (Vitest)
npm run build           # next build
```

## Tests

- **Backend** : tests unitaires (`*.spec.ts`, mocks Prisma) et tests e2e (`backend/test/*.e2e-spec.ts`, contre une vraie base Postgres jetable — voir `.github/workflows/ci.yml` pour la configuration utilisée en CI).
- **Frontend** : tests de composants (Vitest + Testing Library).
- La CI (`.github/workflows/ci.yml`) exécute typecheck, tests, build et audit de dépendances sur chaque push/PR vers `main`/`develop` ; lint est actuellement non bloquant (backlog historique en cours de résorption).

## Déploiement

Voir [`DEPLOYMENT.md`](DEPLOYMENT.md) pour la marche à suivre complète d'un environnement QA 100% gratuit (Render + Neon + Vercel + Cloudflare R2).

## Documentation complémentaire

- [`docs/n8n/`](docs/n8n) — automatisations n8n (connecteurs, sauvegarde, décisions actées).
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — déploiement, variables d'environnement de production, rollback.
