import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import LandingAnimated, {
  type LandingConfig,
  type NewsItem,
  type Partners,
} from '@/components/LandingAnimated';

const DEFAULT_CONFIGS: Record<string, LandingConfig> = {
  fr: {
    hero: { title: 'Ton avenir\ncommence ici.', subtitle: "GET est la plateforme officielle qui simplifie ton parcours post-bac : candidatures, concours, paiements et inscriptions, tout en un seul endroit." },
    stats: [
      { icon: 'Building2', value: '50+', label: 'Établissements partenaires' },
      { icon: 'UserRound', value: '30 000+', label: 'Étudiants inscrits' },
      { icon: 'ClipboardCheck', value: '100 000+', label: 'Candidatures traitées' },
      { icon: 'ShieldCheck', value: '100%', label: 'Paiements sécurisés' },
    ],
    steps: [
      { title: 'Crée ton compte', text: 'Inscris-toi gratuitement en quelques minutes.' },
      { title: 'Choisis et postule', text: 'Découvre les formations et envoie tes candidatures.' },
      { title: 'Suis ton parcours', text: "Suis l'évolution de ton dossier, tes concours et résultats." },
      { title: 'Inscris-toi en ligne', text: 'Paie tes frais en toute sécurité et finalise ton inscription.' },
    ],
    actorCards: [
      { icon: 'GraduationCap', title: 'Pour les étudiants', text: 'Candidature simplifiée, suivi en temps réel, paiements sécurisés et accès aux informations essentielles.' },
      { icon: 'Building2', title: 'Pour les écoles', text: 'Gestion centralisée des candidatures, suivi des inscriptions, outils de communication et tableaux de bord performants.' },
      { icon: 'Landmark', title: 'Pour les partenaires', text: "Intégration bancaire et mobile, paiements sécurisés et promotion de l'inclusion financière des jeunes." },
      { icon: 'ShieldCheck', title: 'Pour le ministère', text: "Pilotage stratégique, statistiques fiables et amélioration continue du système d'enseignement supérieur." },
    ],
  },
  en: {
    hero: { title: 'Your future\nstarts here.', subtitle: 'GET is the official platform that simplifies your post-secondary journey: applications, entrance exams, payments and enrollment, all in one place.' },
    stats: [
      { icon: 'Building2', value: '50+', label: 'Partner institutions' },
      { icon: 'UserRound', value: '30,000+', label: 'Enrolled students' },
      { icon: 'ClipboardCheck', value: '100,000+', label: 'Applications processed' },
      { icon: 'ShieldCheck', value: '100%', label: 'Secure payments' },
    ],
    steps: [
      { title: 'Create your account', text: 'Sign up for free in a few minutes.' },
      { title: 'Choose and apply', text: 'Discover programs and submit your applications.' },
      { title: 'Track your journey', text: 'Follow your file, entrance exams and results.' },
      { title: 'Enroll online', text: 'Pay your fees securely and finalize your enrollment.' },
    ],
    actorCards: [
      { icon: 'GraduationCap', title: 'For students', text: 'Simplified applications, real-time tracking, secure payments and access to essential information.' },
      { icon: 'Building2', title: 'For schools', text: 'Centralized application management, enrollment tracking, communication tools and powerful dashboards.' },
      { icon: 'Landmark', title: 'For partners', text: 'Banking and mobile integration, secure payments and promotion of financial inclusion for youth.' },
      { icon: 'ShieldCheck', title: 'For the ministry', text: 'Strategic oversight, reliable statistics and continuous improvement of the higher education system.' },
    ],
  },
};

/* =============================================================
   VALIDATION — la landing page est alimentée par un CMS piloté par
   l'admin GET (voir dashboard/admin?section=landing-content). Une
   réponse dont la forme ne correspond plus à ce que le composant attend
   (champ renommé/retiré côté backend, retour d'erreur inattendu...) ne
   doit jamais planter le rendu ni afficher des données à moitié
   présentes — repli sur le contenu par défaut pour CE seul bloc.
   ============================================================= */
const heroSchema = z.object({ title: z.string(), subtitle: z.string() });
const statItemSchema = z.object({
  icon: z.string(),
  value: z.string(),
  label: z.string(),
});
const stepItemSchema = z.object({ title: z.string(), text: z.string() });
const actorCardItemSchema = z.object({
  icon: z.string(),
  title: z.string(),
  text: z.string(),
});
const landingConfigSchema = z.object({
  hero: heroSchema,
  stats: z.array(statItemSchema),
  steps: z.array(stepItemSchema),
  actorCards: z.array(actorCardItemSchema),
});
const newsItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string(),
});
const partnerItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  kind: z.string(),
});
const partnersSchema = z.object({
  schools: z.array(partnerItemSchema),
  financialPartners: z.array(partnerItemSchema),
});

// Contenu marketing public, modifié occasionnellement via le CMS admin — pas
// besoin de le refaire à neuf à chaque visite. `revalidate` (secondes) : le
// contenu servi peut avoir jusqu'à cette ancienneté avant qu'un prochain
// visiteur ne déclenche une régénération en arrière-plan (ISR), au lieu du
// `cache: 'no-store'` précédent qui refaisait ces 3 appels backend à chaque
// chargement de page, même pour du contenu identique.
const REVALIDATE_SECONDS = 120;

/**
 * Récupère un bloc de contenu de la landing page, valide sa forme, et
 * retourne le repli fourni si la requête échoue (réseau, statut HTTP non-2xx,
 * JSON invalide, ou forme inattendue) — un échec sur un bloc n'affecte
 * jamais les deux autres (contrairement à un `Promise.all` qui échoue en bloc).
 */
async function fetchLandingBlock<T>(
  url: string,
  schema: z.ZodType<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      console.error(`Landing: ${label} a répondu ${response.status}`);
      return fallback;
    }
    const body: unknown = await response.json();
    const data =
      body && typeof body === 'object' && 'data' in body
        ? (body as { data: unknown }).data
        : body;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      console.error(
        `Landing: forme inattendue pour ${label}`,
        parsed.error.issues,
      );
      return fallback;
    }
    return parsed.data;
  } catch (error) {
    console.error(`Landing: échec de chargement de ${label}`, error);
    return fallback;
  }
}

async function getLandingData(locale: string) {
  // Cette fonction s'exécute côté serveur (fonction Vercel), pas dans le
  // navigateur : elle peut donc joindre le backend directement via
  // `API_ORIGIN` (même variable que le proxy /api de next.config.ts), sans
  // passer par le proxy ni transporter de cookie — cette route ne lit que
  // des données publiques.
  const base = process.env.API_ORIGIN
    ? `${process.env.API_ORIGIN}/api`
    : 'http://localhost:3001/api';
  const defaultConfig = DEFAULT_CONFIGS[locale] ?? DEFAULT_CONFIGS.fr;

  const [config, news, partners] = await Promise.all([
    fetchLandingBlock(
      `${base}/landing/config?locale=${locale}`,
      landingConfigSchema,
      defaultConfig,
      'config',
    ),
    fetchLandingBlock(
      `${base}/landing/news?limit=3`,
      z.array(newsItemSchema),
      [] as NewsItem[],
      'news',
    ),
    fetchLandingBlock(
      `${base}/landing/partners`,
      partnersSchema,
      { schools: [], financialPartners: [] } as Partners,
      'partners',
    ),
  ]);

  return { config, news, partners };
}

export default async function Home() {
  const locale = await getLocale();
  const { config, news, partners } = await getLandingData(locale);
  return <LandingAnimated config={config} news={news} partners={partners} />;
}
