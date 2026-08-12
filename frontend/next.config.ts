import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Expose le SHA du commit déployé (fourni automatiquement par Vercel côté
  // serveur au build, absent en local) pour pouvoir diagnostiquer en un
  // coup d'œil un cache/déploiement figé — voir le footer de LoginScreen.
  // `?? ''` plutôt qu'une valeur par défaut trompeuse type 'dev' : un champ
  // vide indique sans ambiguïté "ceci n'a jamais transité par un build
  // Vercel", ce qui est le signal recherché.
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7),
  },
  // Autorise le serveur de dev à répondre aux requêtes venant d'autres
  // appareils du même réseau local (ex. un téléphone pour tester le responsive).
  // - '10.163.7.165' : IP locale actuelle, change à chaque réseau (DHCP) —
  //   à mettre à jour si elle ne répond plus (vérifier avec `hostname -I`).
  // - 'fedora.local' : nom mDNS/Avahi, stable quel que soit le réseau, tant
  //   que le réseau autorise le mDNS (généralement bloqué sur les Wi-Fi
  //   invités/professionnels avec isolation client).
  allowedDevOrigins: ['10.163.7.165', '192.168.1.73', 'fedora.local'],
  images: {
    qualities: [70, 75],
  },
  // /login et /register étaient des doublons orphelins (aucun lien interne
  // ne pointait vers eux, atteignables seulement en tapant l'URL) des
  // vraies pages /auth/login et /auth/register — supprimés, remplacés par
  // une redirection pour ne pas casser un éventuel favori/lien externe.
  redirects() {
    return [
      { source: '/login', destination: '/auth/login', permanent: true },
      { source: '/register', destination: '/auth/register', permanent: true },
    ];
  },
  // Proxy /api/* vers le backend (architecture d'auth retenue — voir
  // lib/api-client.ts et DEPLOYMENT.md) : le navigateur ne parle jamais
  // directement au backend, y compris quand il est sur un domaine distinct
  // (ex. Vercel + Render). Sans ce proxy, le cookie de session serait
  // "tiers" du point de vue du navigateur : Safari (desktop et iOS) le
  // bloque par défaut (ITP), quel que soit le réglage sameSite côté
  // serveur — la connexion semble réussir mais le dashboard reste
  // inaccessible. En passant par ce proxy, le navigateur ne parle qu'au
  // domaine du frontend, le cookie redevient "premier parti" partout.
  //
  // API_ORIGIN est donc obligatoire dès que ce build tourne réellement en
  // production (échec de build explicite plutôt qu'un déploiement qui
  // semble réussir mais où plus aucun appel API n'aboutit — voir
  // DEPLOYMENT.md §4). En dev, une valeur absente désactive juste la
  // réécriture (utile si on préfère pointer NEXT_PUBLIC_API_URL en dur
  // pour un besoin ponctuel) ; `frontend/.env.example` documente la valeur
  // locale par défaut.
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN;
    if (!apiOrigin) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          "API_ORIGIN doit être défini en production : sans lui, le proxy /api ne route vers aucun backend et toute la plateforme (connexion incluse) est injoignable. Voir DEPLOYMENT.md.",
        );
      }
      return [];
    }
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default withNextIntl(nextConfig);
