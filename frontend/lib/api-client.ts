import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * Client HTTP Axios partagé par tout le frontend pour communiquer avec l'API backend.
 *
 * Configuration :
 * - `baseURL: '/api'` — TOUJOURS une URL relative à l'origine du frontend,
 *   jamais une URL absolue vers le backend. Le navigateur ne parle donc
 *   qu'à son propre domaine ; c'est le proxy Next.js (voir la réécriture
 *   `/api/*` dans `next.config.ts`, résolue côté serveur vers `API_ORIGIN`)
 *   qui relaie vers le backend. Sans ça, le cookie de session est "tiers"
 *   du point de vue du navigateur dès que frontend et backend sont sur des
 *   domaines distincts (ex. Vercel + Render) : Safari (desktop et iOS)
 *   bloque ce cookie par défaut (ITP) quel que soit le réglage `sameSite`
 *   côté serveur — la connexion semblait réussir mais le dashboard restait
 *   inaccessible (faille corrigée suite à l'audit sécurité — voir aussi
 *   `next.config.ts` pour le détail du proxy).
 * - `withCredentials: true` pour envoyer/recevoir les cookies de session
 *   (access token / refresh token gérés côté backend en httpOnly).
 * - Timeout de 10s pour éviter les requêtes bloquées indéfiniment.
 *
 * Un intercepteur de réponse (voir plus bas) gère automatiquement le
 * rafraîchissement de session en cas de 401 et la redirection vers la page
 * de connexion si le rafraîchissement échoue.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Endpoints d'authentification pour lesquels un 401 ne doit PAS déclencher
 * le mécanisme de refresh/redirection global de l'intercepteur.
 *
 * Intercepteur pour gérer les erreurs 401 — un 401 sur /auth/login (mauvais
 * identifiants) est une réponse attendue que l'écran de connexion doit
 * afficher lui-même (toast), pas un signal de session expirée : la rediriger
 * vers /auth/login rechargeait la page avant que le composant ait eu la
 * moindre chance d'afficher l'erreur. /auth/refresh est exclu pour la même
 * raison : son propre échec ne doit pas se re-déclencher lui-même.
 */
const AUTH_ENDPOINTS_WITHOUT_REDIRECT = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  // Un défi MFA expiré/invalide renvoie 401 (AuthService.completeMfaLogin) —
  // avant l'ajout de cette exclusion, l'intercepteur global tentait un
  // /auth/refresh (qui échoue forcément : aucun cookie de session n'existe
  // encore avant la vérification MFA) puis redirigeait la page entière vers
  // /auth/login, effaçant l'état React de MfaChallengeScreen au lieu de
  // laisser l'écran MFA lui-même gérer l'expiration (faille corrigée suite
  // à l'audit sécurité). Un mauvais *code* (400, pas 401) n'est pas concerné
  // et continue d'être géré localement par un simple toast.
  '/auth/mfa/login-verify',
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

/**
 * Déclenche (ou réutilise) l'appel de rafraîchissement de session `/auth/refresh`.
 *
 * Mutualise les appels concurrents : si un rafraîchissement est déjà en
 * cours, les appelants suivants reçoivent la même promesse au lieu de
 * déclencher un nouvel appel réseau (voir le commentaire ci-dessus sur
 * `refreshPromise` pour la justification métier).
 *
 * @returns `true` si le rafraîchissement a réussi (session prolongée), `false` sinon.
 */
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

// Message renvoyé par MfaEnforcedGuard (backend) — voir
// backend/src/modules/auth/guards/mfa-enforced.guard.ts. Comparé par
// sous-chaîne plutôt qu'égalité stricte : robuste à une reformulation
// mineure du message côté backend tant que l'idée reste la même.
const MFA_REQUIRED_MARKER =
  'authentification à deux facteurs (MFA) est obligatoire';

// Affiché une seule fois par session de navigation (pas une fois par appel
// API en échec) : un chargement de tableau de bord déclenche plusieurs
// requêtes en parallèle (cloche de notifications, widgets...), qui
// échoueraient toutes avec ce même 403 tant que le MFA n'est pas activé —
// sans ce verrou, l'utilisateur verrait le même toast s'empiler plusieurs
// fois d'un coup.
let mfaWarningShown = false;

/**
 * Intercepteur de réponse global : sur un 401 (hors endpoints exclus), tente
 * un rafraîchissement de session puis rejoue la requête d'origine une seule
 * fois (`_retriedAfterRefresh` évite toute boucle infinie). Si le
 * rafraîchissement échoue, redirige l'utilisateur vers `/auth/login`.
 *
 * Sur un 403 MfaEnforcedGuard (rôle à privilèges élevés, MFA pas encore
 * activé), affiche un avertissement explicite au lieu de laisser chaque
 * composant appelant échouer silencieusement (cloche de notifications,
 * widgets de tableau de bord...) — avant ce correctif, ces comptes
 * voyaient un tableau de bord vide sans aucune indication de la cause
 * réelle (voir l'incident du 13/08).
 */
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
    if (
      error.response?.status === 403 &&
      typeof error.response?.data?.message === 'string' &&
      error.response.data.message.includes(MFA_REQUIRED_MARKER) &&
      !mfaWarningShown
    ) {
      mfaWarningShown = true;
      toast.error(
        "Ton rôle exige la double authentification (MFA) — active-la dans Paramètres pour débloquer le reste de la plateforme (notifications, tableau de bord...).",
        { duration: 8000 },
      );
    }
    return Promise.reject(error);
  },
);
