import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import {
  ArrowRight, BadgeCheck, BookOpen, Building2, ClipboardCheck, GraduationCap, Landmark,
  Mail, MapPin, Phone, Search, ShieldCheck, Sparkles, UserRound, WalletCards,
} from 'lucide-react';

const navLinks = [
  ['Accueil', '#accueil'], ['À propos', '#apropos'], ['Établissements', '#etablissements'],
  ['Fonctionnalités', '#fonctionnalites'], ['Actualités', '#actualites'], ['Contact', '#contact'],
];

const STAT_ICONS: Record<string, typeof Building2> = { ShieldCheck, BadgeCheck, Sparkles, Building2, UserRound, ClipboardCheck };
const ACTOR_ICONS: Record<string, typeof GraduationCap> = { GraduationCap, Building2, Landmark, ShieldCheck };
const ACTOR_TONES = ['indigo', 'green', 'orange', 'blue'] as const;
const NEWS_GRADIENTS = ['from-slate-700 via-slate-500 to-emerald-300', 'from-indigo-800 via-teal-500 to-amber-200', 'from-amber-700 via-orange-300 to-teal-300'];

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
    <main className="min-h-screen overflow-x-hidden bg-[#fdfcff] text-[#101849]">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-7 lg:flex">{navLinks.map(([label, href], index) => <a key={href} href={href} className={`relative py-7 text-[13px] font-bold transition hover:text-indigo-600 ${index === 0 ? 'text-indigo-600 after:absolute after:bottom-5 after:left-0 after:h-0.5 after:w-full after:bg-indigo-600' : 'text-[#182153]'}`}>{label}</a>)}</nav>
          <div className="flex items-center gap-2 sm:gap-3"><Link href="/auth/login" className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-[#192153] transition hover:border-indigo-500 hover:text-indigo-600 sm:px-5 sm:text-sm">Se connecter</Link><Link href="/auth/register" className="rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:shadow-indigo-300 sm:px-5 sm:text-sm">S&apos;inscrire</Link></div>
        </div>
      </header>

      <section id="accueil" className="relative"><div className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-14 pt-14 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:pb-20 lg:pt-16">
        <div className="max-w-[530px]"><h1 className="whitespace-pre-line text-5xl font-black leading-[1.1] tracking-tight text-[#111949] sm:text-6xl">{config.hero.title}</h1><p className="mt-6 max-w-[460px] text-lg leading-8 text-[#56618a]">{config.hero.subtitle}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/auth/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-400 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5"><UserRound className="size-5" />Je suis étudiant<ArrowRight className="size-4" /></Link><Link href="/auth/register" className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-white px-5 py-3.5 text-sm font-bold text-indigo-600 transition hover:bg-indigo-50"><Building2 className="size-5" />Je suis une école / institution</Link></div><div className="mt-10 grid grid-cols-1 gap-3 border-t border-indigo-100 pt-6 sm:grid-cols-2 xl:grid-cols-3"><MiniBenefit icon={ShieldCheck} title="100% en ligne" text="Accessible partout" /><MiniBenefit icon={BadgeCheck} title="Sécurisé et fiable" text="Données protégées" /><MiniBenefit icon={Sparkles} title="Simple et rapide" text="Gain de temps assuré" /></div></div>
        <div className="relative mx-auto w-full max-w-[620px]"><div className="absolute -inset-8 rounded-[56px] bg-gradient-to-br from-indigo-100 via-transparent to-teal-100 blur-2xl" /><div className="relative h-[485px] overflow-hidden rounded-[46px] border border-white bg-[#e9eaff] shadow-[0_25px_55px_rgba(69,49,170,0.18)] sm:h-[570px]"><Image src="/landing-students-campus.png" alt="Deux étudiants sur un campus universitaire" fill priority quality={70} className="object-cover object-center" sizes="(max-width: 639px) 90vw, 620px" /><div className="absolute inset-0 bg-gradient-to-t from-[#21185d]/25 via-transparent to-white/10" /></div><div className="absolute -bottom-2 left-5 right-5 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-xl backdrop-blur-md sm:-bottom-7 sm:left-8 sm:right-8 sm:p-5"><div className="flex items-center gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><GraduationCap className="size-6" /></span><div><p className="font-extrabold text-[#161d4c]">Rejoins les grandes écoles</p><p className="mt-0.5 text-sm text-[#67718f]">et construis ton avenir dès aujourd&apos;hui.</p></div></div><div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs font-semibold text-[#717b99]"><span className="flex -space-x-2"><span className="grid size-7 place-items-center rounded-full border-2 border-white bg-indigo-100 text-[10px] text-indigo-600">E</span><span className="grid size-7 place-items-center rounded-full border-2 border-white bg-emerald-100 text-[10px] text-emerald-600">I</span><span className="grid size-7 place-items-center rounded-full border-2 border-white bg-orange-100 text-[10px] text-orange-600">U</span></span>Écoles partenaires</div></div></div>
      </div></section>

      <section id="apropos" className="mx-auto max-w-[1120px] px-5 py-16 text-center sm:px-8"><SectionEyebrow>Pourquoi choisir GET ?</SectionEyebrow><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Une plateforme pensée pour <span className="text-indigo-600">tous les acteurs</span></h2><p className="mx-auto mt-3 max-w-2xl text-[#68738f]">GET connecte étudiants, établissements et partenaires dans un écosystème numérique simple, transparent et efficace.</p><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{config.actorCards.map((card, index) => <ActorCard key={card.title} icon={ACTOR_ICONS[card.icon] || GraduationCap} tone={ACTOR_TONES[index] || 'indigo'} title={card.title} text={card.text} />)}</div></section>

      <section id="fonctionnalites" className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8"><div className="text-center"><SectionEyebrow>Comment ça marche ?</SectionEyebrow><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Un parcours simple en <span className="text-indigo-600">4 étapes</span></h2></div><div className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4"><div className="absolute left-[12%] right-[12%] top-8 hidden border-t-2 border-dotted border-indigo-200 lg:block" />{config.steps.map((step, index) => <Step key={step.title} number={String(index + 1)} icon={[ClipboardCheck, Search, BookOpen, WalletCards][index] || ClipboardCheck} title={step.title} text={step.text} />)}</div><div className="mt-14 grid gap-5 rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-teal-500 px-6 py-6 text-white shadow-xl shadow-indigo-200 sm:grid-cols-2 lg:grid-cols-4">{config.stats.map((stat) => <Stat key={stat.label} icon={STAT_ICONS[stat.icon] || Building2} value={stat.value} label={stat.label} />)}</div></section>

      <section id="actualites" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><SectionEyebrow>Actualités</SectionEyebrow><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Reste <span className="text-indigo-600">informé</span></h2></div>{news.length > 0 && <a href="#actualites" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600">Voir toutes les actualités <ArrowRight className="size-4" /></a>}</div>{news.length === 0 ? <p className="mt-8 text-sm text-[#68738f]">Aucune actualité publiée pour le moment.</p> : <div className="mt-8 grid gap-5 md:grid-cols-3">{news.map((item, index) => <NewsCard key={item.id} type={item.type} date={new Date(item.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} title={item.title} text={item.body} image={item.imageUrl} gradient={NEWS_GRADIENTS[index % NEWS_GRADIENTS.length]} />)}</div>}</section>

      <section id="etablissements" className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8"><SectionEyebrow>Nos partenaires</SectionEyebrow><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Ils nous font <span className="text-indigo-600">confiance</span></h2>{!hasPartners ? <p className="mt-6 text-sm text-[#68738f]">Nos partenaires seront bientôt affichés ici.</p> : <div className="mt-8 space-y-8">{partners.schools.length > 0 && <PartnerRow title="Établissements partenaires" items={partners.schools} />}{partners.financialPartners.length > 0 && <PartnerRow title="Partenaires financiers" items={partners.financialPartners} />}</div>}</section>

      <section id="rejoindre" className="mx-auto max-w-[1120px] px-5 pb-16 sm:px-8"><div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-teal-50 px-7 py-8 sm:px-10"><GraduationCap className="absolute -bottom-7 right-8 size-36 rotate-[-20deg] text-indigo-100" /><div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"><div><h2 className="text-3xl font-black tracking-tight">Prêt à construire ton avenir ?</h2><p className="mt-2 max-w-lg text-[#66718e]">Rejoins des milliers d’étudiants et accède aux meilleures opportunités d’études à Madagascar.</p></div><Link href="/auth/register" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-400 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200"><UserRound className="size-5" />Créer mon compte gratuitement</Link></div><p className="relative mt-4 text-center text-sm font-medium text-[#78819a] md:text-right">C’est rapide, gratuit et sécurisé !</p></div></section>

      <footer id="contact" className="border-t border-slate-100 bg-white"><div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_repeat(3,1fr)]"><div><Brand /><p className="mt-5 max-w-[230px] text-sm leading-6 text-[#68738f]">La plateforme qui ouvre la voie vers ton bac et ton futur.</p><div className="mt-5 flex gap-3 text-[#475174]"><Social label="Facebook" /><Social label="Instagram" /><Social label="LinkedIn" /><Social label="YouTube" /></div></div><FooterLinks title="Plateforme" links={['Fonctionnalités', 'Établissements', 'Tarifs', 'FAQ']} /><FooterLinks title="Ressources" links={['Guides étudiants', 'Conseils orientation', 'Actualités', 'Centre d’aide']} /><div><h3 className="font-extrabold">Contact</h3><ul className="mt-4 space-y-3 text-sm text-[#68738f]"><li className="flex gap-2"><Phone className="size-4 shrink-0 text-indigo-600" />+261 34 12 345 67</li><li className="flex gap-2"><Mail className="size-4 shrink-0 text-indigo-600" />contact@get.mg</li><li className="flex gap-2"><MapPin className="size-4 shrink-0 text-indigo-600" />Antananarivo, Madagascar</li></ul></div></div><div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-3 border-t border-slate-100 px-5 py-5 text-xs text-[#7b849e] sm:px-8"><span>© 2025 GET - Tous droits réservés.</span><span className="flex gap-5"><a href="#">Conditions d’utilisation</a><a href="#">Politique de confidentialité</a></span></div></footer>
    </main>
  );
}

function Brand() { return <Link href="/"><Logo size={44} /></Link>; }
function MiniBenefit({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) { return <div><Icon className="size-5 text-indigo-600" /><p className="mt-2 text-xs font-extrabold text-[#202858]">{title}</p><p className="mt-0.5 text-[10px] text-[#737d9a]">{text}</p></div>; }
function SectionEyebrow({ children }: { children: React.ReactNode }) { return <p className="text-xs font-black uppercase tracking-[0.12em] text-indigo-600">{children}</p>; }
function ActorCard({ icon: Icon, tone, title, text }: { icon: typeof GraduationCap; tone: 'indigo' | 'green' | 'orange' | 'blue'; title: string; text: string }) { const tones = { indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100', green: 'bg-emerald-50 text-emerald-600 border-emerald-100', orange: 'bg-orange-50 text-orange-500 border-orange-100', blue: 'bg-blue-50 text-blue-600 border-blue-100' }; return <article className={`rounded-xl border p-5 text-left ${tones[tone]}`}><span className="grid size-11 place-items-center rounded-full bg-white/70 shadow-sm"><Icon className="size-6" /></span><h3 className="mt-4 font-extrabold text-[#17204e]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#5d6889]">{text}</p></article>; }
function Step({ number, icon: Icon, title, text }: { number: string; icon: typeof Search; title: string; text: string }) { return <article className="relative z-10 text-center"><span className="mx-auto grid size-16 place-items-center rounded-full border border-indigo-100 bg-white text-indigo-600 shadow-lg shadow-indigo-100"><Icon className="size-7" /></span><p className="mt-5 text-sm font-extrabold"><span className="text-indigo-600">{number}.</span> {title}</p><p className="mx-auto mt-2 max-w-[190px] text-xs leading-5 text-[#68738f]">{text}</p></article>; }
function Stat({ icon: Icon, value, label }: { icon: typeof Building2; value: string; label: string }) { return <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-white/15"><Icon className="size-6" /></span><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-indigo-100">{label}</p></div></div>; }
function NewsCard({ type, date, title, text, image, gradient }: { type: string; date: string; title: string; text: string; image: string | null; gradient: string }) { return <article className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">{image ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={image} alt="" className="h-36 w-full object-cover" />
) : <div className={`h-36 bg-gradient-to-br ${gradient} p-3`}><span className="rounded bg-indigo-600 px-2 py-1 text-[9px] font-black text-white">{type}</span></div>}<div className="p-4"><div className="flex justify-between gap-2 text-[10px] text-[#78819a]"><span>{type}</span><span>{date}</span></div><h3 className="mt-2 font-extrabold text-[#17204e]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#68738f]">{text}</p></div></article>; }
function FooterLinks({ title, links }: { title: string; links: string[] }) { return <div><h3 className="font-extrabold">{title}</h3><ul className="mt-4 space-y-3 text-sm text-[#68738f]">{links.map((link) => <li key={link}><a className="hover:text-indigo-600" href="#">{link}</a></li>)}</ul></div>; }
function Social({ label }: { label: string }) { return <a aria-label={label} href="#" className="grid size-8 place-items-center rounded-full border border-slate-200 text-xs font-black transition hover:border-indigo-300 hover:text-indigo-600">{label.slice(0, 1)}</a>; }
function PartnerRow({ title, items }: { title: string; items: PartnerItem[] }) {
  return <div><h3 className="text-xs font-black uppercase tracking-wide text-[#68738f]">{title}</h3><div className="mt-4 flex flex-wrap gap-4">{items.map((item) => <PartnerLogo key={item.id} item={item} />)}</div></div>;
}
function PartnerLogo({ item }: { item: PartnerItem }) {
  return <div className="flex w-[140px] flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
    {item.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.logoUrl} alt={item.name} className="h-12 w-full object-contain" />
    ) : (
      <span className="grid size-12 place-items-center rounded-full bg-indigo-100 text-sm font-black text-indigo-600">{item.name.slice(0, 1).toUpperCase()}</span>
    )}
    <p className="line-clamp-2 text-[11px] font-bold text-[#28315e]">{item.name}</p>
  </div>;
}
