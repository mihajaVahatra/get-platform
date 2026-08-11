import { getLocale } from 'next-intl/server';
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
  try {
    const [configRes, newsRes, partnersRes] = await Promise.all([
      fetch(`${base}/landing/config?locale=${locale}`, { cache: 'no-store' }),
      fetch(`${base}/landing/news?limit=3`, { cache: 'no-store' }),
      fetch(`${base}/landing/partners`, { cache: 'no-store' }),
    ]);
    const [configJson, newsJson, partnersJson] = await Promise.all([
      configRes.json(), newsRes.json(), partnersRes.json(),
    ]);
    return {
      config: (configJson.data as LandingConfig) || defaultConfig,
      news: (newsJson.data as NewsItem[]) || [],
      partners: (partnersJson.data as Partners) || { schools: [], financialPartners: [] },
    };
  } catch {
    return { config: defaultConfig, news: [] as NewsItem[], partners: { schools: [], financialPartners: [] } as Partners };
  }
}

export default async function Home() {
  const locale = await getLocale();
  const { config, news, partners } = await getLandingData(locale);
  return <LandingAnimated config={config} news={news} partners={partners} />;
}
