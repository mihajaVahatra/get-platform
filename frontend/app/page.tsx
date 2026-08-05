import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BookOpen, Building2, ClipboardCheck, GraduationCap, Landmark,
  Mail, MapPin, Phone, Search, ShieldCheck, Sparkles, UserRound, WalletCards,
} from 'lucide-react';

const navLinks = [
  ['Accueil', '#accueil'], ['À propos', '#apropos'], ['Établissements', '#etablissements'],
  ['Fonctionnalités', '#fonctionnalites'], ['Actualités', '#actualites'], ['Contact', '#contact'],
];

const STAT_ICONS: Record<string, typeof Building2> = { ShieldCheck, BadgeCheck, Sparkles, Building2, UserRound, ClipboardCheck };
const ACTOR_ICONS: Record<string, typeof GraduationCap> = { GraduationCap, Building2, Landmark, ShieldCheck };
const ACTOR_TONES = ['chart1', 'chart2', 'chart4', 'chart3'] as const;

type Hero = { title: string; subtitle: string };
type StatItem = { icon: string; value: string; label: string };
type StepItem = { title: string; text: string };
type ActorCardItem = { icon: string; title: string; text: string };
type LandingConfig = { hero: Hero; stats: StatItem[]; steps: StepItem[]; actorCards: ActorCardItem[] };
type NewsItem = { id: string; type: string; title: string; body: string; imageUrl: string | null; publishedAt: string };
type PartnerItem = { id: string; name: string; logoUrl: string | null; kind: string };
type Partners = { schools: PartnerItem[]; financialPartners: PartnerItem[] };

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
  const hasPartners = partners.schools.length > 0 || partners.financialPartners.length > 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-7 lg:flex">
            {navLinks.map(([label, href], index) => (
              <a key={href} href={href} className={`relative py-7 text-[13px] font-semibold transition hover:text-primary ${index === 0 ? 'text-primary after:absolute after:bottom-5 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-primary' : 'text-foreground/80'}`}>{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth/login" className="rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary sm:px-5 sm:text-sm">Se connecter</Link>
            <Link href="/auth/register" className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-primary/40 sm:px-5 sm:text-sm">S&apos;inscrire</Link>
          </div>
        </div>
      </header>

      <section id="accueil" className="relative">
        <div className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:pb-24 lg:pt-20">
          <div className="max-w-[560px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" /> Plateforme officielle post-bac
            </span>
            <h1 className="mt-6 whitespace-pre-line text-6xl font-bold leading-[0.98] text-foreground sm:text-7xl">{config.hero.title}</h1>
            <p className="mt-6 max-w-[470px] text-lg leading-8 text-muted-foreground">{config.hero.subtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/auth/register" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-primary/40"><UserRound className="size-5" />Je suis étudiant<ArrowRight className="size-4" /></Link>
              <Link href="/auth/register" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-4 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"><Building2 className="size-5" />Je suis une école / institution</Link>
            </div>
            <div className="mt-11 grid grid-cols-1 gap-4 border-t border-border pt-7 sm:grid-cols-3">
              <MiniBenefit icon={ShieldCheck} title="100% en ligne" text="Accessible partout" />
              <MiniBenefit icon={BadgeCheck} title="Sécurisé et fiable" text="Données protégées" />
              <MiniBenefit icon={Sparkles} title="Simple et rapide" text="Gain de temps assuré" />
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[620px]">
            <div className="relative h-[485px] overflow-hidden rounded-[40px] border-4 border-card bg-muted shadow-[0_30px_70px_-20px_rgba(88,28,235,0.4)] sm:h-[580px]">
              <Image src="/landing-students-campus.png" alt="Deux étudiants sur un campus universitaire" fill priority quality={70} className="object-cover object-center" sizes="(max-width: 639px) 90vw, 620px" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-6 left-5 right-5 rounded-3xl border border-border bg-card/95 p-5 shadow-xl backdrop-blur-md sm:left-8 sm:right-8">
              <div className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap className="size-6" /></span>
                <div><p className="font-bold text-foreground">Rejoins les grandes écoles</p><p className="mt-0.5 text-sm text-muted-foreground">et construis ton avenir dès aujourd&apos;hui.</p></div>
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
                <span className="flex -space-x-2">
                  <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-primary/15 text-[10px] text-primary">E</span>
                  <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-primary/15 text-[10px] text-primary">I</span>
                  <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-primary/15 text-[10px] text-primary">U</span>
                </span>Écoles partenaires
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="apropos" className="mx-auto max-w-[1120px] px-5 py-16 text-center sm:px-8">
        <SectionEyebrow>Pourquoi choisir GET ?</SectionEyebrow>
        <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Une plateforme pensée pour <span className="text-primary">tous les acteurs</span></h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">GET connecte étudiants, établissements et partenaires dans un écosystème numérique simple, transparent et efficace.</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{config.actorCards.map((card, index) => <ActorCard key={card.title} icon={ACTOR_ICONS[card.icon] || GraduationCap} tone={ACTOR_TONES[index] || 'chart1'} title={card.title} text={card.text} />)}</div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
        <div className="text-center"><SectionEyebrow>Comment ça marche ?</SectionEyebrow><h2 className="mt-3 text-4xl font-bold sm:text-5xl">Un parcours simple en <span className="text-primary">4 étapes</span></h2></div>
        <div className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-8 hidden border-t-2 border-dashed border-primary/20 lg:block" />
          {config.steps.map((step, index) => <Step key={step.title} number={String(index + 1)} icon={[ClipboardCheck, Search, BookOpen, WalletCards][index] || ClipboardCheck} title={step.title} text={step.text} />)}
        </div>
        <div className="mt-16 grid gap-6 rounded-[32px] bg-primary px-8 py-9 text-primary-foreground shadow-2xl shadow-primary/25 sm:grid-cols-2 lg:grid-cols-4">{config.stats.map((stat) => <Stat key={stat.label} icon={STAT_ICONS[stat.icon] || Building2} value={stat.value} label={stat.label} />)}</div>
      </section>

      <section id="actualites" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><SectionEyebrow>Actualités</SectionEyebrow><h2 className="mt-3 text-4xl font-bold sm:text-5xl">Reste <span className="text-primary">informé</span></h2></div>
          {news.length > 0 && <a href="#actualites" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3 transition-all">Voir toutes les actualités <ArrowRight className="size-4" /></a>}
        </div>
        {news.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">Aucune actualité publiée pour le moment.</p> : <div className="mt-10 grid gap-5 md:grid-cols-3">{news.map((item) => <NewsCard key={item.id} type={item.type} date={new Date(item.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} title={item.title} text={item.body} image={item.imageUrl} />)}</div>}
      </section>

      <section id="etablissements" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8">
        <SectionEyebrow>Nos partenaires</SectionEyebrow>
        <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Ils nous font <span className="text-primary">confiance</span></h2>
        {!hasPartners ? <p className="mt-6 text-sm text-muted-foreground">Nos partenaires seront bientôt affichés ici.</p> : <div className="mt-10 space-y-8">{partners.schools.length > 0 && <PartnerRow title="Établissements partenaires" items={partners.schools} />}{partners.financialPartners.length > 0 && <PartnerRow title="Partenaires financiers" items={partners.financialPartners} />}</div>}
      </section>

      <section id="rejoindre" className="mx-auto max-w-[1120px] px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-[36px] bg-primary px-8 py-12 text-primary-foreground sm:px-12">
          <GraduationCap className="absolute -bottom-8 right-8 size-44 rotate-[-20deg] text-primary-foreground/10" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div><h2 className="text-4xl font-bold sm:text-5xl">Prêt à construire ton avenir ?</h2><p className="mt-3 max-w-lg text-primary-foreground/80">Rejoins des milliers d&apos;étudiants et accède aux meilleures opportunités d&apos;études à Madagascar.</p></div>
            <Link href="/auth/register" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-card px-7 py-4 text-sm font-bold text-primary shadow-lg transition hover:-translate-y-0.5"><UserRound className="size-5" />Créer mon compte gratuitement</Link>
          </div>
          <p className="relative mt-5 text-sm font-medium text-primary-foreground/70 md:text-right">C&apos;est rapide, gratuit et sécurisé !</p>
        </div>
      </section>

      <footer id="contact" className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Brand />
            <p className="mt-5 max-w-[230px] text-sm leading-6 text-muted-foreground">La plateforme qui ouvre la voie vers ton bac et ton futur.</p>
            <div className="mt-5 flex gap-3"><Social label="Facebook" /><Social label="Instagram" /><Social label="LinkedIn" /><Social label="YouTube" /></div>
          </div>
          <FooterLinks title="Plateforme" links={['Fonctionnalités', 'Établissements', 'Tarifs', 'FAQ']} />
          <FooterLinks title="Ressources" links={['Guides étudiants', 'Conseils orientation', 'Actualités', "Centre d'aide"]} />
          <div>
            <h3 className="font-bold">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2"><Phone className="size-4 shrink-0 text-primary" />+261 34 12 345 67</li>
              <li className="flex gap-2"><Mail className="size-4 shrink-0 text-primary" />contact@get.mg</li>
              <li className="flex gap-2"><MapPin className="size-4 shrink-0 text-primary" />Antananarivo, Madagascar</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-3 border-t border-border px-5 py-5 text-xs text-muted-foreground sm:px-8">
          <span>© 2025 GET - Tous droits réservés.</span>
          <span className="flex gap-5"><a className="hover:text-primary" href="#">Conditions d&apos;utilisation</a><a className="hover:text-primary" href="#">Politique de confidentialité</a></span>
        </div>
      </footer>
    </main>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="relative font-heading text-4xl font-bold tracking-[-0.08em] text-primary">GET<GraduationCap className="absolute -right-3 -top-2 size-5 rotate-[-18deg] text-primary/70" /></span>
      <span className="text-[10px] font-semibold leading-3 text-muted-foreground">Grandes Écoles de<br />Tananarive et de Madagascar</span>
    </Link>
  );
}

function MiniBenefit({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <div>
      <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
      <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{children}</p>;
}

function ActorCard({ icon: Icon, tone, title, text }: { icon: typeof GraduationCap; tone: 'chart1' | 'chart2' | 'chart3' | 'chart4'; title: string; text: string }) {
  const tones = {
    chart1: 'text-[var(--chart-1)]', chart2: 'text-[var(--chart-2)]',
    chart3: 'text-[var(--chart-3)]', chart4: 'text-[var(--chart-4)]',
  };
  return (
    <article className="group rounded-3xl border border-border bg-card p-6 text-left transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <span className={`grid size-12 place-items-center rounded-2xl bg-muted ${tones[tone]}`}><Icon className="size-6" /></span>
      <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}

function Step({ number, icon: Icon, title, text }: { number: string; icon: typeof Search; title: string; text: string }) {
  return (
    <article className="relative z-10 text-center">
      <span className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-border bg-card text-primary shadow-lg shadow-primary/10">
        <Icon className="size-7" />
        <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{number}</span>
      </span>
      <p className="mt-5 text-base font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-[190px] text-xs leading-5 text-muted-foreground">{text}</p>
    </article>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Building2; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary-foreground/15"><Icon className="size-6" /></span>
      <div><p className="font-heading text-3xl font-bold">{value}</p><p className="text-xs text-primary-foreground/75">{label}</p></div>
    </div>
  );
}

function NewsCard({ type, date, title, text, image }: { type: string; date: string; title: string; text: string; image: string | null }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-primary/10"><span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">{type}</span></div>
      )}
      <div className="p-5">
        <div className="flex justify-between gap-2 text-[11px] font-semibold text-muted-foreground"><span className="text-primary">{type}</span><span>{date}</span></div>
        <h3 className="mt-2 text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </article>
  );
}

function FooterLinks({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm text-muted-foreground">{links.map((link) => <li key={link}><a className="transition hover:text-primary" href="#">{link}</a></li>)}</ul>
    </div>
  );
}

function Social({ label }: { label: string }) {
  return <a aria-label={label} href="#" className="grid size-9 place-items-center rounded-full border border-border text-xs font-bold text-muted-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground">{label.slice(0, 1)}</a>;
}

function PartnerRow({ title, items }: { title: string; items: PartnerItem[] }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-4 flex flex-wrap gap-4">{items.map((item) => <PartnerLogo key={item.id} item={item} />)}</div>
    </div>
  );
}

function PartnerLogo({ item }: { item: PartnerItem }) {
  return (
    <div className="flex w-[140px] flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition hover:border-primary/40">
      {item.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.logoUrl} alt={item.name} className="h-12 w-full object-contain" />
      ) : (
        <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{item.name.slice(0, 1).toUpperCase()}</span>
      )}
      <p className="line-clamp-2 text-[11px] font-bold text-foreground">{item.name}</p>
    </div>
  );
}
