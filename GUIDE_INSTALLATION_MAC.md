# Installer et lancer GET sur un nouveau Mac

Ce guide permet de repartir proprement sur un Mac neuf et de faire tourner
l'application complète en local. Il est conçu pour une première installation.

> Temps à prévoir : 45 à 90 minutes selon la connexion Internet. Docker et les
> dépendances npm téléchargent plusieurs gigaoctets.

## Résultat attendu

À la fin, tu auras :

| Élément | Adresse | Rôle |
| --- | --- | --- |
| Frontend | http://localhost:3000 | Le site web GET |
| Backend | http://localhost:3001 | L'API REST |
| Swagger | http://localhost:3001/api/docs | La documentation/test de l'API |
| MinIO | http://localhost:9001 | La console des fichiers envoyés |

Docker lance aussi PostgreSQL, Redis et MinIO. Il ne faut donc **pas**
installer PostgreSQL, Redis, MinIO, Next.js, NestJS, Prisma ou npm
globalement : le projet s'en charge.

## Avant de quitter l'ancien ordinateur

1. Vérifie que ton code est sauvegardé dans GitHub. Dans le dossier actuel du
   projet, lance :

   ~~~bash
   git status
   ~~~

   Ne supprime rien sur l'ancien Mac si ce résultat montre du travail que tu
   veux conserver et que tu ne sais pas encore comment le sauvegarder.

2. Ne copie pas les dossiers node_modules, .next, dist ou les volumes Docker.
   Ils sont lourds, spécifiques à la machine, et seront recréés.

3. Les fichiers .env contiennent des secrets. Ne les envoie jamais par Git,
   e-mail, WhatsApp ou capture d'écran. Si des vraies données locales doivent
   être conservées, garde aussi leurs secrets de manière chiffrée, surtout
   ENCRYPTION_KEY. Avec une autre clé, les données chiffrées existantes ne
   pourront pas être relues.

4. Si tu n'as que des données de démonstration, repars de zéro : le seed du
   projet recréera les comptes et les données de démo.

## Petit vocabulaire

- **Terminal** : l'application macOS où l'on tape les commandes. Ouvre-la avec
  Cmd + Espace, tape Terminal, puis Entrée.
- **Dossier du projet** : le dossier get-poc contenant backend, frontend et
  docker-compose.yml.
- **Docker** : l'application qui exécute localement la base de données et les
  autres services techniques.
- **.env** : fichier de configuration contenant des secrets. Il reste sur le
  Mac et ne doit jamais être ajouté à GitHub.

## 1. Installer les outils sur macOS

### 1.1 Mettre macOS à jour

Dans **Réglages système → Général → Mise à jour de logiciels**, installe les
mises à jour proposées. Redémarre si macOS le demande.

### 1.2 Installer les outils développeur Apple

Dans Terminal, lance :

~~~bash
xcode-select --install
~~~

Une fenêtre macOS s'ouvre. Clique sur **Installer**, accepte la licence et
attends la fin. Cette étape installe Git et les outils nécessaires à la
compilation de dépendances Node comme bcrypt.

Vérifie ensuite :

~~~bash
git --version
~~~

Tu dois voir un numéro de version. Si macOS demande une licence, suis
l'instruction affichée dans Terminal.

### 1.3 Installer Homebrew (recommandé, mais facultatif)

Homebrew est un gestionnaire d'outils utile sur Mac. GET n'en dépend pas
directement.

1. Ouvre [brew.sh](https://brew.sh/).
2. Copie la commande officielle indiquée par le site et exécute-la dans
   Terminal.
3. À la fin, si l'installateur affiche deux commandes pour ajouter Homebrew au
   PATH, copie-les telles quelles. Elles diffèrent selon que ton Mac possède
   une puce Apple ou Intel.
4. Vérifie :

   ~~~bash
   brew --version
   ~~~

### 1.4 Installer Visual Studio Code

1. Télécharge **Visual Studio Code** depuis
   [le site officiel](https://code.visualstudio.com/download).
2. Ouvre le fichier .dmg téléchargé.
3. Fais glisser Visual Studio Code dans le dossier Applications.
4. Ouvre VS Code une fois.
5. Dans VS Code, appuie sur Cmd + Shift + P, tape
   **Shell Command: Install 'code' command in PATH**, puis lance cette action.
6. Ferme et rouvre Terminal, puis vérifie :

   ~~~bash
   code --version
   ~~~

Cette dernière étape est pratique mais facultative : tu peux toujours ouvrir
le projet depuis Finder.

### 1.5 Installer Docker Desktop

1. Menu Apple  → **À propos de ce Mac**.
2. Si tu vois une puce Apple M1, M2, M3, M4… choisis le téléchargement
   **Apple silicon**. Si tu vois Intel, choisis **Intel**.
3. Suis [la procédure officielle Docker pour macOS](https://docs.docker.com/desktop/setup/install/mac-install/).
4. Ouvre Docker depuis Applications, accepte les conditions et sélectionne les
   réglages recommandés.
5. Attends que l'icône Docker dans la barre de menus indique qu'il est prêt.

Docker Desktop doit avoir au moins 4 Go de mémoire. Si le Mac est lent, ouvre
Docker Desktop → Settings → Resources et attribue-lui 4 Go ou plus.

Vérifie dans Terminal :

~~~bash
docker --version
docker compose version
~~~

Si le démon Docker ne tourne pas, ouvre Docker Desktop et attends une minute
avant de réessayer.

### 1.6 Installer Node.js 22 avec nvm

GET exige Node.js **22**. Utilise nvm : il permet à chaque projet d'utiliser
sa bonne version de Node sans conflit.

Dans Terminal, lance l'installateur officiel nvm :

~~~bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
~~~

Ferme complètement Terminal et ouvre-en un nouveau. Vérifie :

~~~bash
nvm --version
~~~

Puis installe et sélectionne Node 22 :

~~~bash
nvm install 22
nvm alias default 22
nvm use 22
node --version
npm --version
~~~

La version Node doit commencer par v22. N'installe pas Node/npm séparément
avec un .pkg ou Homebrew : npm est fourni par Node, et nvm doit gérer la
version du projet.

## 2. Récupérer le projet depuis GitHub

### 2.1 Configurer ton identité Git

Cette étape ne se fait qu'une fois. Remplace les deux exemples par ton vrai nom
et ton e-mail GitHub :

~~~bash
git config --global user.name "Prénom Nom"
git config --global user.email "ton-adresse@email.com"
~~~

Ce ne sont pas des mots de passe : ces valeurs signent tes futurs commits.

### 2.2 Cloner le dépôt

Sur la page GitHub du projet, clique sur le bouton vert **Code**, sélectionne
HTTPS ou SSH, puis copie l'adresse. Le guide officiel GitHub est disponible
[ici](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).

Dans Terminal :

~~~bash
mkdir -p ~/Developer
cd ~/Developer
git clone COLLE_ICI_L_ADRESSE_DU_DEPOT get-poc
cd get-poc
git status
~~~

Remplace seulement COLLE_ICI_L_ADRESSE_DU_DEPOT par l'adresse copiée, par
exemple https://github.com/organisation/get-poc.git. Garde le nom final
get-poc : n8n, si tu l'utilises plus tard, attend ce nom de réseau Docker.

Si le dépôt est privé, ton compte GitHub doit avoir l'accès. Une clé SSH est
une solution durable ; le parcours officiel est
[ici](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

Pour ouvrir le projet dans VS Code :

~~~bash
code .
~~~

## 3. Créer les fichiers de configuration

Le projet utilise trois fichiers différents :

| Fichier | Utilisé par | Rôle |
| --- | --- | --- |
| .env | Docker Compose | PostgreSQL, Redis et MinIO |
| backend/.env | Backend NestJS | Base de données, chiffrement, stockage, API |
| frontend/.env.local | Frontend Next.js | Adresse locale du backend |

Depuis la racine du projet :

~~~bash
cd ~/Developer/get-poc
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
chmod 600 .env backend/.env frontend/.env.local
~~~

Ne copie **jamais** le .env racine directement dans backend/.env : le backend
a des variables supplémentaires, dont DATABASE_URL et JWT_REFRESH_SECRET.

Le chmod 600 limite la lecture de ces fichiers à ton compte macOS. Git les
ignore, mais vérifie toujours git status avant un commit.

### 3.1 Générer les secrets

Pour chaque secret ordinaire, génère une valeur différente :

~~~bash
openssl rand -hex 24
~~~

Pour ENCRYPTION_KEY, utilise impérativement :

~~~bash
openssl rand -hex 32
~~~

Cette dernière commande produit exactement 64 caractères hexadécimaux, le
format exigé par le backend. Les secrets hexadécimaux évitent aussi des
caractères spéciaux qui casseraient l'URL PostgreSQL.

### 3.2 Remplir le .env racine

Ouvre .env dans VS Code. Garde les noms de variables et remplace toutes les
valeurs change-this-... ou replace-with-....

Utilise ces valeurs locales :

| Variable | Valeur recommandée |
| --- | --- |
| POSTGRES_USER | get_user |
| POSTGRES_PASSWORD | une nouvelle valeur hexadécimale |
| POSTGRES_DB | get_poc |
| REDIS_PASSWORD | une autre nouvelle valeur |
| MINIO_ROOT_USER | getminioadmin |
| MINIO_ROOT_PASSWORD | une autre nouvelle valeur |
| JWT_SECRET | une autre nouvelle valeur |
| ENCRYPTION_KEY | la valeur produite par openssl rand -hex 32 |
| PAYMENT_WEBHOOK_SECRET | une autre nouvelle valeur |
| INTEGRATION_API_KEY | une autre nouvelle valeur |
| N8N_WEBHOOK_SECRET | une autre nouvelle valeur |
| N8N_WEBHOOK_BASE_URL | laisse vide tant que n8n n'est pas installé |
| FRONTEND_URL | http://localhost:3000 |
| APP_URL | http://localhost:3001 |

Dans ce même fichier, garde cette configuration S3 locale et fais-la
correspondre aux identifiants MinIO :

~~~env
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_BUCKET=get-poc-uploads
S3_PUBLIC_BUCKET=get-poc-public
S3_ACCESS_KEY_ID=getminioadmin
S3_SECRET_ACCESS_KEY=LA_MEME_VALEUR_QUE_MINIO_ROOT_PASSWORD
S3_PUBLIC_URL=http://localhost:9000/get-poc-public
~~~

Si tu choisis un autre MINIO_ROOT_USER, reporte exactement cette valeur dans
S3_ACCESS_KEY_ID.

### 3.3 Remplir backend/.env

Ouvre backend/.env et synchronise les valeurs avec le .env racine :

~~~env
# Remplacer LE_MOT_DE_PASSE_POSTGRES par POSTGRES_PASSWORD de .env
DATABASE_URL="postgresql://get_user:LE_MOT_DE_PASSE_POSTGRES@localhost:5432/get_poc?schema=public"

# Même valeur que JWT_SECRET du .env racine
JWT_SECRET=LA_MEME_VALEUR_QUE_DANS_ENV_RACINE
# Nouvelle valeur, différente de JWT_SECRET
JWT_REFRESH_SECRET=UNE_NOUVELLE_VALEUR_GENEREE
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
PORT=3001
FRONTEND_URL=http://localhost:3000

# Même valeur que ENCRYPTION_KEY de .env
ENCRYPTION_KEY=LA_MEME_VALEUR_QUE_DANS_ENV_RACINE
PAYMENT_WEBHOOK_SECRET=LA_MEME_VALEUR_QUE_DANS_ENV_RACINE
APP_URL=http://localhost:3001

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_BUCKET=get-poc-uploads
S3_PUBLIC_BUCKET=get-poc-public
# Même valeur que MINIO_ROOT_USER
S3_ACCESS_KEY_ID=getminioadmin
# Même valeur que MINIO_ROOT_PASSWORD
S3_SECRET_ACCESS_KEY=LA_MEME_VALEUR_QUE_MINIO_ROOT_PASSWORD
S3_PUBLIC_URL=http://localhost:9000/get-poc-public

# Valeurs facultatives tant que n8n n'est pas installé
INTEGRATION_API_KEY=LA_MEME_VALEUR_QUE_DANS_ENV_RACINE
N8N_WEBHOOK_BASE_URL=
N8N_WEBHOOK_SECRET=LA_MEME_VALEUR_QUE_DANS_ENV_RACINE
~~~

Laisse SENDGRID_API_KEY vide et ne définis pas STRIPE_SECRET_KEY pour le
premier lancement. Les e-mails et paiements fonctionneront alors en mode de
développement. Ne mets pas NODE_ENV=production sur ton Mac : Stripe et
SendGrid deviendraient obligatoires et Swagger ne serait plus disponible.

### 3.4 Vérifier frontend/.env.local

Ce fichier doit contenir :

~~~env
API_ORIGIN=http://localhost:3001
~~~

Ne définis pas NEXT_PUBLIC_API_URL pour l'architecture normale du projet : le
frontend utilise son proxy /api vers API_ORIGIN. Après une modification de ce
fichier, redémarre npm run dev côté frontend.

## 4. Démarrer l'infrastructure Docker

Assure-toi que Docker Desktop est ouvert, puis :

~~~bash
cd ~/Developer/get-poc
docker compose -p get-poc up -d
docker compose -p get-poc ps
~~~

Au premier lancement, Docker télécharge les images : cela peut prendre
quelques minutes. La commande ps doit afficher get-db, get-redis et get-minio.

Vérifie PostgreSQL :

~~~bash
docker exec get-db pg_isready -U get_user -d get_poc
~~~

La réponse attendue contient accepting connections.

### Créer les buckets MinIO (obligatoire, une seule fois)

1. Ouvre http://localhost:9001.
2. Connecte-toi avec MINIO_ROOT_USER et MINIO_ROOT_PASSWORD du .env racine.
3. Dans **Buckets**, clique sur **Add Bucket** et crée get-poc-uploads.
   Laisse-le privé : il reçoit les documents sensibles.
4. Crée get-poc-public.
5. Ouvre ce deuxième bucket et, dans ses réglages d'accès anonyme, choisis
   **Download / lecture seule**. Ne lui donne jamais le droit d'upload public.

Les deux buckets sont nécessaires : le premier stocke des documents privés,
le second des avatars, logos et images publiques. La documentation de la
console MinIO est [ici](https://docs.min.io/aistor/administration/console/managing-objects/).

## 5. Installer et lancer le backend

Ouvre un **nouvel onglet Terminal** avec Cmd + T, puis laisse-le ouvert pendant
le développement :

~~~bash
cd ~/Developer/get-poc/backend
nvm use
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
~~~

Explication rapide :

- npm ci installe exactement les versions verrouillées par le projet. C'est
  préférable à npm install sur une machine neuve.
- npx prisma migrate deploy crée/met à jour les tables de la base locale.
- npx prisma db seed ajoute les données de démonstration. Il peut être relancé.
- npm run start:dev garde l'API ouverte et la redémarre quand le code change.

La bonne commande est npm run start:dev. **N'utilise pas**
npx nodemon index.js : il n'existe ni fichier index.js ni dépendance nodemon
dans ce projet.

Quand tout va bien, le terminal indique que le serveur écoute sur le port 3001.
Vérifie dans le navigateur :

- http://localhost:3001/api/docs
- http://localhost:3001 — la réponse doit être OK

## 6. Installer et lancer le frontend

Ouvre un **troisième onglet Terminal**. Ne ferme ni le terminal backend ni
Docker.

~~~bash
cd ~/Developer/get-poc/frontend
nvm use
npm ci
npm run dev
~~~

Ouvre ensuite http://localhost:3000. Tu dois voir GET.

Le frontend et le backend doivent tourner en même temps. Le frontend envoie
ses appels /api vers le backend grâce à API_ORIGIN.

## 7. Vérifier avec les comptes de démonstration

Après le seed, tu peux te connecter avec :

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Étudiant | test@gmail.com | Student123! |
| Administrateur GET | admin@get.mg | Admin123! |
| Admin école | schooladmin@get.mg | Mihaja@25! |

Les comptes privilégiés (administrateur, école, ministère) demandent
l'activation du MFA à la première connexion. Utilise une application
d'authentification (Google Authenticator, Microsoft Authenticator, Authy ou
Aegis) pour scanner le QR code.

Tu n'as pas besoin d'un compte SendGrid localement. Les e-mails sont simulés
dans ce fichier :

~~~text
backend/.local-mail/outbox.log
~~~

Pour le consulter en direct depuis la racine du projet :

~~~bash
tail -f backend/.local-mail/outbox.log
~~~

Arrête cette commande avec Ctrl + C. Stripe n'est pas non plus requis au
premier démarrage : un fournisseur de paiement simulé est utilisé en
développement.

## 8. Routine quotidienne

À chaque reprise de travail :

1. Ouvre Docker Desktop et attends qu'il soit prêt.
2. Dans un terminal, démarre l'infrastructure :

   ~~~bash
   cd ~/Developer/get-poc
   docker compose -p get-poc up -d
   ~~~

3. Dans un deuxième terminal, démarre l'API :

   ~~~bash
   cd ~/Developer/get-poc/backend
   nvm use
   npm run start:dev
   ~~~

4. Dans un troisième terminal, démarre le site :

   ~~~bash
   cd ~/Developer/get-poc/frontend
   nvm use
   npm run dev
   ~~~

5. Ouvre http://localhost:3000.

Pour arrêter le projet :

1. Dans les deux terminaux Node, fais Ctrl + C.
2. À la racine du projet :

   ~~~bash
   docker compose -p get-poc down
   ~~~

docker compose down arrête les services mais conserve la base et MinIO.
**N'utilise jamais docker compose down -v sans être sûr** : cette variante
supprime irréversiblement les données locales et les buckets.

## 9. Mettre à jour le projet et vérifier son travail

Avant de commencer une journée ou de changer de branche :

~~~bash
cd ~/Developer/get-poc
git status
git pull --ff-only
~~~

Après une mise à jour Git, réinstalle les dépendances seulement si un
package-lock.json a changé :

~~~bash
cd ~/Developer/get-poc/backend && npm ci
cd ~/Developer/get-poc/frontend && npm ci
~~~

Vérifications utiles :

~~~bash
cd ~/Developer/get-poc/backend
npm run typecheck
npm test

cd ../frontend
npm run typecheck
npm test
~~~

Le lint complet contient actuellement de la dette historique. Un échec isolé
de npm run lint ne signifie donc pas forcément que ton installation est
cassée.

## 10. Résoudre les problèmes fréquents

### nvm est introuvable ou Node n'est pas en version 22

Ferme/réouvre Terminal, puis :

~~~bash
nvm use 22
node --version
~~~

Le résultat doit commencer par v22. Si nvm reste introuvable, l'installateur
n'a probablement pas modifié ~/.zshrc : relance la procédure de la section 1.6.

### Docker ne démarre pas

Ouvre Docker Desktop, attends qu'il soit prêt, puis :

~~~bash
docker version
~~~

Si le Mac est lent, augmente la mémoire de Docker Desktop dans Settings →
Resources puis redémarre Docker Desktop.

### Erreur P1000 ou authentification PostgreSQL

Vérifie que POSTGRES_USER, POSTGRES_PASSWORD et POSTGRES_DB du .env racine
correspondent exactement à DATABASE_URL dans backend/.env.

Changer POSTGRES_PASSWORD **après** le premier démarrage Docker ne modifie pas
le mot de passe déjà stocké dans le volume PostgreSQL. Restaure la valeur
initiale si tu la connais. Si, et seulement si, tu acceptes de perdre toutes
les données locales, repars à zéro :

~~~bash
cd ~/Developer/get-poc
docker compose -p get-poc down -v
docker compose -p get-poc up -d
~~~

Ensuite, recrée les buckets MinIO, relance les migrations et le seed.

### Un port est déjà utilisé

Les ports concernés sont 3000, 3001, 5432, 6379, 9000 et 9001. Pour savoir
quel programme utilise un port, adapte cette commande :

~~~bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
~~~

Arrête l'ancienne application depuis son terminal. Ne change les ports que si
tu sais aussi modifier tous les fichiers .env associés.

### Images ou documents en erreur

Vérifie dans MinIO :

- get-poc-uploads existe et reste privé ;
- get-poc-public existe et a la politique Download ;
- S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY de backend/.env correspondent aux
  identifiants MinIO du .env racine.

### Le frontend ne peut pas joindre l'API

Vérifie d'abord :

~~~bash
curl http://localhost:3001
~~~

Puis vérifie que frontend/.env.local contient
API_ORIGIN=http://localhost:3001. Redémarre npm run dev après toute
modification de ce fichier.

### npm ci échoue en compilant bcrypt

Installe/termine les outils Apple :

~~~bash
xcode-select --install
~~~

Ferme/réouvre Terminal puis relance npm ci. Sur Apple Silicon, utilise Node 22
natif ; Rosetta n'est normalement pas nécessaire.

## 11. Optionnel : installer n8n pour les automatisations

n8n gère les automatisations (relances, rapport hebdomadaire, e-mail de
bienvenue). GET fonctionne sans lui. Installe-le seulement après avoir validé
les sections précédentes.

### 11.1 Créer la configuration n8n

~~~bash
cd ~/Developer/get-poc
cp .env.n8n.example .env.n8n
chmod 600 .env.n8n
~~~

Dans .env.n8n, remplace N8N_DB_PASSWORD par une nouvelle valeur produite par :

~~~bash
openssl rand -hex 32
~~~

Reporte aussi les mêmes valeurs que dans .env pour GET_INTEGRATION_API_KEY et
GET_N8N_WEBHOOK_SECRET.

### 11.2 Créer la base n8n une seule fois

Le compose n8n ne crée pas encore automatiquement son rôle/base. Lance :

~~~bash
docker exec -it get-db psql -U get_user -d postgres
~~~

Tu arrives dans l'invite PostgreSQL. Colle ces trois lignes en remplaçant
MOT_DE_PASSE_N8N par exactement N8N_DB_PASSWORD de .env.n8n :

~~~sql
CREATE ROLE n8n_service LOGIN PASSWORD 'MOT_DE_PASSE_N8N';
CREATE DATABASE n8n OWNER n8n_service;
\q
~~~

Cette étape ne se fait qu'une fois. Si le rôle ou la base existe déjà, ne
relance pas les commandes : passe à l'étape suivante.

### 11.3 Démarrer n8n

~~~bash
cd ~/Developer/get-poc
docker compose -p get-poc -f docker-compose.n8n.yml \
  --env-file .env --env-file .env.n8n up -d
~~~

Ouvre http://localhost:5678 et crée le compte propriétaire demandé par n8n.

Pour importer les workflows, utilise **Import from File** et sélectionne les
fichiers dans n8n/workflows. Les secrets ne sont pas dans ces fichiers : crée
les credentials Header Auth expliqués dans
[docs/n8n/03-connecteurs-get.md](docs/n8n/03-connecteurs-get.md), avec les
valeurs de .env.n8n.

Enfin, dans backend/.env, définis :

~~~env
N8N_WEBHOOK_BASE_URL=http://localhost:5678
~~~

Puis redémarre le backend. Pour les sauvegardes et détails, lis
[docs/n8n](docs/n8n/).

## 12. Si de vraies données locales doivent migrer

Ne copie pas des volumes Docker bruts entre deux Mac : ils dépendent de Docker
et peuvent différer entre Intel et Apple Silicon.

Avant d'effacer l'ancien Mac, conserve au minimum :

- le code poussé sur GitHub ;
- les .env de manière chiffrée, ou au moins tous leurs secrets ;
- un export PostgreSQL si les données ne sont pas de démonstration ;
- les objets des deux buckets MinIO si des documents/images ont été envoyés ;
- les sauvegardes n8n si n8n était utilisé.

Le point le plus important est de conserver exactement la même ENCRYPTION_KEY
si la base contient des données chiffrées. Un export PostgreSQL seul ne suffit
pas à récupérer les fichiers de MinIO : prépare la migration de données réelles
avant d'effacer l'ancien ordinateur.

---

## Aide rapide : trois commandes de démarrage

~~~bash
# Terminal 1 — services techniques
cd ~/Developer/get-poc && docker compose -p get-poc up -d

# Terminal 2 — API
cd ~/Developer/get-poc/backend && nvm use && npm run start:dev

# Terminal 3 — site
cd ~/Developer/get-poc/frontend && nvm use && npm run dev
~~~

Ensuite, ouvre http://localhost:3000.

