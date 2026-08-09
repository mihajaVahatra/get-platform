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
// moindre chance d'afficher l'erreur. /auth/refresh est exclu pour la même
// raison : son propre échec ne doit pas se re-déclencher lui-même.
const AUTH_ENDPOINTS_WITHOUT_REDIRECT = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
];

// L'access token expire au bout de 15 min (voir backend AuthController) —
// sans ce mécanisme, la moindre pause de plus de 15 min pendant un test
// (ou entre deux clics) se traduisait par un 401 sur le prochain appel et un
// aller-retour immédiat vers /auth/login, alors que le refresh token (7j)
// aurait pu prolonger la session silencieusement. On ne veut lancer qu'un
// seul appel /auth/refresh à la fois même si plusieurs requêtes échouent en
// même temps (ex. plusieurs appels API lancés en parallèle au chargement
// d'une page) : les requêtes suivantes attendent la même promesse.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post('/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isAuthEndpoint = AUTH_ENDPOINTS_WITHOUT_REDIRECT.some((path) =>
      error.config?.url?.includes(path),
    );
    if (error.response?.status === 401 && !isAuthEndpoint) {
      const originalRequest = error.config;
      if (originalRequest && !originalRequest._retriedAfterRefresh) {
        originalRequest._retriedAfterRefresh = true;
        const refreshed = await refreshSession();
        if (refreshed) {
          return apiClient(originalRequest);
        }
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);
