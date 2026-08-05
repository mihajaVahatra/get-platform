import axios from 'axios';

// En dev, si NEXT_PUBLIC_API_URL n'est pas défini, on déduit l'URL de l'API
// à partir de l'hôte utilisé pour accéder au frontend (localhost, IP locale
// du réseau pour tester depuis un téléphone, etc.) plutôt que de figer
// "localhost" en dur — sinon l'API est injoignable dès qu'on accède au site
// via une autre adresse que localhost.
function resolveBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001/api`;
  }
  return 'http://localhost:3001/api';
}

export const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour gérer les erreurs 401 — un 401 sur /auth/login (mauvais
// identifiants) est une réponse attendue que l'écran de connexion doit
// afficher lui-même (toast), pas un signal de session expirée : la rediriger
// vers /auth/login rechargeait la page avant que le composant ait eu la
// moindre chance d'afficher l'erreur.
const AUTH_ENDPOINTS_WITHOUT_REDIRECT = ['/auth/login', '/auth/register'];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = AUTH_ENDPOINTS_WITHOUT_REDIRECT.some((path) =>
      error.config?.url?.includes(path),
    );
    if (error.response?.status === 401 && !isAuthEndpoint) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);
