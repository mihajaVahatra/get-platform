import LandingAnimated, {
  type LandingConfig,
  type NewsItem,
  type Partners,
} from '@/components/LandingAnimated';

const DEFAULT_CONFIG: LandingConfig = {
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
};

async function getLandingData() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  try {
    const [configRes, newsRes, partnersRes] = await Promise.all([
      fetch(`${base}/landing/config`, { cache: 'no-store' }),
      fetch(`${base}/landing/news?limit=3`, { cache: 'no-store' }),
      fetch(`${base}/landing/partners`, { cache: 'no-store' }),
    ]);
    const [configJson, newsJson, partnersJson] = await Promise.all([
      configRes.json(), newsRes.json(), partnersRes.json(),
    ]);
    return {
      config: (configJson.data as LandingConfig) || DEFAULT_CONFIG,
      news: (newsJson.data as NewsItem[]) || [],
      partners: (partnersJson.data as Partners) || { schools: [], financialPartners: [] },
    };
  } catch {
    return { config: DEFAULT_CONFIG, news: [] as NewsItem[], partners: { schools: [], financialPartners: [] } as Partners };
  }
}

export default async function Home() {
  const { config, news, partners } = await getLandingData();
  return <LandingAnimated config={config} news={news} partners={partners} />;
}
