import type { NextConfig } from "next";

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
};

export default nextConfig;
