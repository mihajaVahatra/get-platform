import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
  // Proxy /api/* vers le backend quand il est sur un domaine distinct
  // (ex. Vercel + Render). Sans ça, le cookie de session est un cookie
  // "tiers" du point de vue du navigateur : Safari (desktop et iOS) le
  // bloque par défaut (ITP), quel que soit le réglage sameSite côté
  // serveur — la connexion semble réussir mais le dashboard reste
  // inaccessible. En passant par ce proxy, le navigateur ne parle qu'au
  // domaine du frontend, le cookie redevient "premier parti" partout.
  // N'a aucun effet en dev tant que API_ORIGIN n'est pas défini.
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN;
    if (!apiOrigin) return [];
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default withNextIntl(nextConfig);
