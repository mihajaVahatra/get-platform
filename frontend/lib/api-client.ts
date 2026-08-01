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

// Intercepteur pour gérer les erreurs 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);
