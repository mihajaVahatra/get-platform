'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useEffect, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  useReducedMotion,
  useMotionValue,
  animate,
  type Variants,
} from 'motion/react';
import {
  ArrowRight, GraduationCap, Building2, Landmark, ShieldCheck, Sparkles,
  UserRound, Search, BookOpen, WalletCards, CheckCircle2, Zap, BadgeCheck,
  ClipboardCheck,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/* =============================================================
   TYPES (source de vérité, réutilisés par app/page.tsx)
   ============================================================= */
export type Hero = { title: string; subtitle: string };
export type StatItem = { icon: string; value: string; label: string };
export type StepItem = { title: string; text: string };
export type ActorCardItem = { icon: string; title: string; text: string };
export type LandingConfig = { hero: Hero; stats: StatItem[]; steps: StepItem[]; actorCards: ActorCardItem[] };
export type NewsItem = { id: string; type: string; title: string; body: string; imageUrl: string | null; publishedAt: string };
export type PartnerItem = { id: string; name: string; logoUrl: string | null; kind: string };
export type Partners = { schools: PartnerItem[]; financialPartners: PartnerItem[] };

const navHrefs = ['#accueil', '#apropos', '#etablissements', '#fonctionnalites', '#actualites', '#contact'] as const;
const navKeys = ['home', 'about', 'schools', 'features', 'news', 'contact'] as const;

const STAT_ICONS: Record<string, typeof Building2> = { ShieldCheck, BadgeCheck, Sparkles, Building2, UserRound, ClipboardCheck };
const ACTOR_ICONS: Record<string, typeof GraduationCap> = { GraduationCap, Building2, Landmark, ShieldCheck };
const STEP_ICONS = [ClipboardCheck, Search, BookOpen, WalletCards];
const NEWS_GRADIENTS = [
  'from-slate-700 via-slate-500 to-emerald-300',
  'from-violet-800 via-[#f0568a] to-amber-200',
  'from-amber-700 via-orange-300 to-emerald-300',
];
const ACTOR_TONES = [
  { bg: 'bg-violet-50', tx: 'text-violet-600', border: 'border-violet-100', glow: '#7c3aed' },
  { bg: 'bg-emerald-50', tx: 'text-emerald-600', border: 'border-emerald-100', glow: '#10b981' },
  { bg: 'bg-orange-50', tx: 'text-orange-500', border: 'border-orange-100', glow: '#f97316' },
  { bg: 'bg-blue-50', tx: 'text-blue-600', border: 'border-blue-100', glow: '#3b82f6' },
] as const;

/* =============================================================
   VARIANTS RÉUTILISABLES
   ============================================================= */
const containerStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 90, damping: 18, mass: 0.6 },
  },
};

const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 80, damping: 18 } },
};
const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 80, damping: 18 } },
};

function Reveal({
  children,
  variants = fadeUp,
  className,
  amount = 0.25,
  once = true,
}: {
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
  amount?: number;
  once?: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, amount });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={reduce ? undefined : variants}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : inView ? 'show' : 'hidden'}
    >
      {children}
    </motion.div>
  );
}

/* =============================================================
   COMPTEUR ANIMÉ ("30 000+", "100%", etc.)
   ============================================================= */
function AnimatedStat({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const locale = useLocale();

  const match = value.replace(/\s/g, '').match(/^([^\d]*)(\d+)(.*)$/);
  const prefix = match?.[1] ?? '';
  const target = match ? parseInt(match[2], 10) : 0;
  const suffix = match?.[3] ?? '';

  const [display, setDisplay] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, target, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, target, reduce]);

  const formatted = display.toLocaleString(locale);
  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* =============================================================
   CARTE À INCLINAISON 3D AU SURVOL
   ============================================================= */
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 150, damping: 20 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}
    >
      {children}
    </motion.div>
  );
}

/* =============================================================
   COMPOSANT PRINCIPAL
   ============================================================= */
export default function LandingAnimated({
  config,
  news,
  partners,
}: {
  config: LandingConfig;
  news: NewsItem[];
  partners: Partners;
}) {
  const reduce = useReducedMotion();
  const t = useTranslations('Landing');
  const locale = useLocale();
  const hasPartners = partners.schools.length > 0 || partners.financialPartners.length > 0;

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroImageY = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const heroCopyY = useTransform(scrollYProgress, [0, 1], ['0%', '-12%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fdfcff] text-[#101849]">
      {/* ===================== HEADER ===================== */}
      <motion.header
        initial={reduce ? undefined : { y: -80, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link href="/"><Logo size={44} /></Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {navHrefs.map((href, i) => (
              <a key={href} href={href}
                className="rounded-full px-3.5 py-2 text-[13.5px] font-bold text-[#4a4470] transition hover:bg-violet-50 hover:text-violet-600">
                {t(`nav.${navKeys[i]}`)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <motion.div
              className="hidden sm:block"
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={{ scale: 0.96 }}
            >
              <Link href="/auth/login"
                className="inline-flex rounded-lg border border-violet-200 px-4 py-2.5 text-[13px] font-bold text-violet-700 transition hover:bg-violet-50">
                {t('header.login')}
              </Link>
            </motion.div>
            <MagneticButton href="/auth/register">{t('header.register')}</MagneticButton>
          </div>
        </div>
      </motion.header>

      {/* ===================== HERO ===================== */}
      <section ref={heroRef} id="accueil" className="relative overflow-hidden">
        {!reduce && (
          <>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,138,91,.16), transparent 62%)' }}
              animate={{ scale: [1, 1.15, 1], x: [0, 30, 0], y: [0, 20, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -left-36 top-10 h-[460px] w-[460px] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(124,58,237,.14), transparent 62%)' }}
              animate={{ scale: [1, 1.2, 1], x: [0, -20, 0], y: [0, 30, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
          </>
        )}

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1fr_1.02fr]">
          <motion.div style={reduce ? undefined : { y: heroCopyY }}>
            <motion.div variants={containerStagger} initial="hidden" animate="show">
              <motion.span variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[#4a4470] shadow-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-600">
                  <motion.i className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                    animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                  {t('hero.badgeOnline')}
                </span>
                {t('hero.badgeText')}
              </motion.span>

              <motion.h1 variants={fadeUp}
                className="mt-6 text-[clamp(40px,6.4vw,68px)] font-black leading-[1.02] tracking-[-0.035em]">
                {config.hero.title.split('\n').map((line, i) => (
                  <span key={i}>
                    {i === 0 ? (
                      line
                    ) : (
                      <span className="bg-gradient-to-r from-violet-600 via-violet-500 to-[#ff8a5b] bg-clip-text text-transparent">
                        {line}
                      </span>
                    )}
                    {i < config.hero.title.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-6 max-w-[52ch] text-[18px] leading-8 text-[#56618a]">
                {config.hero.subtitle}
              </motion.p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <MagneticButton href="/auth/register" large>
                  <UserRound className="size-[18px]" />
                  {t('hero.ctaStudent')}
                  <ArrowRight className="size-4" />
                </MagneticButton>
                <motion.div whileHover={reduce ? undefined : { y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link href="/auth/register"
                    className="inline-flex items-center gap-2 rounded-[10px] border border-violet-200 bg-white px-6 py-3.5 text-[15px] font-bold text-violet-700 transition hover:bg-violet-50">
                    <Building2 className="size-[18px]" />
                    {t('hero.ctaSchool')}
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-7 border-t border-violet-100 pt-6">
                {[
                  [ShieldCheck, t('hero.trustOnlineTitle'), t('hero.trustOnlineText')],
                  [BadgeCheck, t('hero.trustSecureTitle'), t('hero.trustSecureText')],
                  [Zap, t('hero.trustFastTitle'), t('hero.trustFastText')],
                ].map(([Icon, title, text]) => {
                  const I = Icon as typeof ShieldCheck;
                  return (
                    <div key={title as string} className="flex items-start gap-3">
                      <span className="grid size-[38px] place-items-center rounded-[11px] bg-violet-50 text-violet-600">
                        <I className="size-[19px]" />
                      </span>
                      <div>
                        <p className="text-[13px] font-extrabold">{title as string}</p>
                        <p className="text-[11.5px] font-semibold text-[#78819a]">{text as string}</p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative"
            style={reduce ? undefined : { opacity: heroOpacity }}
            initial={reduce ? undefined : { opacity: 0, scale: 0.94 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.15 }}
          >
            <motion.div
              className="relative h-[520px] overflow-hidden rounded-[36px] border-[6px] border-white bg-[#efe7ff] shadow-[0_30px_60px_rgba(76,29,149,.18)]"
              style={reduce ? undefined : { y: heroImageY }}
            >
              <Image
                src="/landing-students-campus.png"
                alt={t('hero.imageAlt')}
                fill
                priority
                quality={70}
                className="object-cover object-center"
                sizes="(max-width: 1023px) 90vw, 620px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2a1065]/25 via-transparent to-white/10" />
            </motion.div>

            <motion.div
              className="absolute -left-6 top-7 flex items-center gap-3 rounded-[20px] border border-slate-100 bg-white p-3.5 shadow-[0_30px_60px_rgba(76,29,149,.18)]"
              initial={reduce ? undefined : { opacity: 0, x: -30 }}
              animate={reduce ? undefined : { opacity: 1, x: 0, y: [0, -10, 0] }}
              transition={{
                opacity: { delay: 0.6 }, x: { delay: 0.6 },
                y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 },
              }}
            >
              <span className="grid size-[42px] place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-extrabold">{t('hero.floatingAccepted')}</p>
                <p className="text-[11px] text-[#78819a]">{t('hero.floatingAcceptedSub')}</p>
              </div>
            </motion.div>

            <motion.div
              className="absolute right-[-22px] top-[150px] flex items-center gap-2.5 rounded-[20px] bg-gradient-to-r from-violet-600 to-[#ff8a5b] p-3.5 text-white shadow-[0_30px_60px_rgba(76,29,149,.18)]"
              initial={reduce ? undefined : { opacity: 0, scale: 0.6 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1, y: [0, 12, 0] }}
              transition={{
                opacity: { delay: 0.9 }, scale: { delay: 0.9, type: 'spring', stiffness: 200 },
                y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.4 },
              }}
            >
              <span className="font-heading text-[22px] font-extrabold leading-none">50+</span>
              <span className="max-w-[11ch] text-[11px] leading-tight opacity-90">{t('hero.floatingSchoolsLabel')}</span>
            </motion.div>

            <motion.div
              className="absolute inset-x-6 -bottom-6 flex items-center gap-3.5 rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_30px_60px_rgba(76,29,149,.18)]"
              initial={reduce ? undefined : { opacity: 0, y: 30 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 1.1, type: 'spring', stiffness: 80, damping: 16 }}
            >
              <span className="grid size-[46px] shrink-0 place-items-center rounded-full bg-violet-50 text-violet-600">
                <GraduationCap className="size-[22px]" />
              </span>
              <div>
                <p className="text-[14px] font-extrabold">{t('hero.floatingJoinTitle')}</p>
                <p className="text-[12px] text-[#78819a]">{t('hero.floatingJoinText')}</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===================== ACTORS ===================== */}
      <section id="apropos" className="mx-auto max-w-[1200px] px-6 py-24">
        <Reveal className="mx-auto max-w-[640px] text-center">
          <SectionEyebrow>{t('actors.eyebrow')}</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(28px,4.2vw,40px)] font-black">
            {t('actors.titleStart')} <span className="text-violet-600">{t('actors.titleHighlight')}</span>
          </h2>
          <p className="mt-3.5 text-[16px] text-[#56618a]">
            {t('actors.text')}
          </p>
        </Reveal>

        <motion.div
          variants={containerStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-13 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {config.actorCards.map((card, i) => {
            const tone = ACTOR_TONES[i] ?? ACTOR_TONES[0];
            const Icon = ACTOR_ICONS[card.icon] ?? GraduationCap;
            return (
              <motion.article
                key={card.title}
                variants={fadeUp}
                whileHover={reduce ? undefined : { y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="group relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm"
              >
                <div
                  className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full opacity-40 blur-[46px] transition-opacity duration-300 group-hover:opacity-70"
                  style={{ background: tone.glow }}
                />
                <span className={`relative grid size-[54px] place-items-center rounded-2xl ${tone.bg} ${tone.tx}`}>
                  <Icon className="size-[26px]" />
                </span>
                <h3 className="mt-4 text-[17px] font-extrabold">{card.title}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[#56618a]">{card.text}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </section>

      {/* ===================== STEPS + STATS ===================== */}
      <div className="border-y border-slate-100 bg-slate-50/60">
        <section id="fonctionnalites" className="mx-auto max-w-[1200px] px-6 py-24">
          <Reveal className="mx-auto max-w-[640px] text-center">
            <SectionEyebrow>{t('steps.eyebrow')}</SectionEyebrow>
            <h2 className="mt-4 text-[clamp(28px,4.2vw,40px)] font-black">
              {t('steps.titleStart')} <span className="text-violet-600">{t('steps.titleHighlight')}</span>
            </h2>
          </Reveal>

          <motion.div
            variants={containerStagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="relative mt-13 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {config.steps.map((step, i) => {
              const Icon = STEP_ICONS[i] ?? BadgeCheck;
              return (
                <motion.div key={step.title} variants={fadeUp} className="relative">
                  {i < config.steps.length - 1 && (
                    <div className="absolute left-11 top-[15px] hidden h-0.5 w-[calc(100%-1rem)] bg-[repeating-linear-gradient(90deg,#e0e7ff_0_6px,transparent_6px_12px)] lg:block" />
                  )}
                  <span className="grid size-[30px] place-items-center rounded-full bg-gradient-to-r from-violet-600 to-[#ff8a5b] font-heading text-[13px] font-extrabold text-white shadow-[0_8px_18px_-6px_rgba(124,58,237,.6)]">
                    {i + 1}
                  </span>
                  <motion.span
                    whileHover={reduce ? undefined : { rotate: -8, scale: 1.06 }}
                    className="my-4 grid size-14 place-items-center rounded-[18px] border border-slate-100 bg-white text-violet-600 shadow-sm"
                  >
                    <Icon className="size-[26px]" />
                  </motion.span>
                  <h4 className="text-[16px] font-extrabold">{step.title}</h4>
                  <p className="mt-1.5 text-[13px] leading-snug text-[#56618a]">{step.text}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <Reveal amount={0.4}>
            <div className="relative mt-16 grid gap-6 overflow-hidden rounded-[36px] bg-gradient-to-r from-violet-700 via-violet-600 to-[#ff8a5b] px-10 py-11 shadow-[0_30px_60px_rgba(76,29,149,.18)] sm:grid-cols-2 lg:grid-cols-4">
              <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-white/10" />
              {config.stats.map((stat) => (
                <div key={stat.label} className="relative flex items-center gap-3.5">
                  <span className="grid size-[50px] shrink-0 place-items-center rounded-[14px] bg-white/[0.18] text-white">
                    <StatIcon name={stat.icon} />
                  </span>
                  <div>
                    <p className="font-heading text-[30px] font-extrabold leading-none text-white">
                      <AnimatedStat value={stat.value} />
                    </p>
                    <p className="text-[12px] font-semibold text-white/85">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      </div>

      {/* ===================== FEATURE SPLIT : ÉTUDIANT ===================== */}
      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal variants={fadeInLeft}>
            <SectionEyebrow>{t('studentFeature.eyebrow')}</SectionEyebrow>
            <h2 className="mt-4 text-[clamp(26px,3.6vw,36px)] font-black leading-tight">
              {t('studentFeature.titleLine1')}
              <br />
              {t('studentFeature.titleLine2')}
            </h2>
            <p className="mt-3.5 max-w-[46ch] text-[15.5px] text-[#56618a]">
              {t('studentFeature.text')}
            </p>
            <div className="mt-6 flex flex-col gap-4">
              {[
                [t('studentFeature.feature1Title'), t('studentFeature.feature1Text')],
                [t('studentFeature.feature2Title'), t('studentFeature.feature2Text')],
                [t('studentFeature.feature3Title'), t('studentFeature.feature3Text')],
              ].map(([b, p]) => (
                <FeatureItem key={b} title={b} text={p} />
              ))}
            </div>
            <MagneticButton href="/auth/register" className="mt-7">
              {t('studentFeature.cta')} <ArrowRight className="size-4" />
            </MagneticButton>
          </Reveal>

          <Reveal variants={fadeInRight}>
            <TiltCard className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_30px_60px_rgba(76,29,149,.18)]">
              <StudentMock />
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* ===================== TESTIMONIAL ===================== */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] border border-slate-100 bg-white px-8 py-12 text-center shadow-sm">
            <span className="absolute left-8 top-2 font-heading text-[120px] leading-none text-violet-50">&ldquo;</span>
            <blockquote className="relative mx-auto max-w-[20ch] font-heading text-[clamp(20px,3vw,28px)] font-bold leading-snug tracking-tight">
              {t('testimonial.quoteBefore')}<span className="text-violet-600">{t('testimonial.quoteHighlight')}</span>{t('testimonial.quoteAfter')}
            </blockquote>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="grid size-[46px] place-items-center rounded-full bg-gradient-to-r from-violet-600 to-[#ff8a5b] font-bold text-white">TR</span>
              <div className="text-left">
                <p className="text-[14px] font-extrabold">{t('testimonial.name')}</p>
                <p className="text-[12px] text-[#78819a]">{t('testimonial.role')}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===================== NEWS ===================== */}
      {news.length > 0 && (
        <section id="actualites" className="mx-auto max-w-[1200px] px-6 pb-24">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionEyebrow>{t('news.eyebrow')}</SectionEyebrow>
              <h2 className="mt-4 text-[clamp(28px,4.2vw,40px)] font-black">
                {t('news.titleStart')} <span className="text-violet-600">{t('news.titleHighlight')}</span>
              </h2>
            </div>
          </Reveal>
          <motion.div
            variants={containerStagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-11 grid gap-6 md:grid-cols-3"
          >
            {news.map((item, index) => (
              <motion.article
                key={item.id}
                variants={fadeUp}
                whileHover={reduce ? undefined : { y: -5 }}
                className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className={`h-40 bg-gradient-to-br p-3.5 ${NEWS_GRADIENTS[index % NEWS_GRADIENTS.length]}`}>
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-700">
                      {item.type}
                    </span>
                  </div>
                )}
                <div className="p-[18px]">
                  <div className="flex justify-between text-[11px] font-semibold text-[#78819a]">
                    <span>{item.type}</span>
                    <span>{new Date(item.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <h3 className="mt-2 text-[16px] font-extrabold leading-tight">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#56618a]">{item.body}</p>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </section>
      )}

      {/* ===================== PARTENAIRES ===================== */}
      <section id="etablissements" className="mx-auto max-w-[1200px] px-6 pb-24">
        <Reveal className="mx-auto max-w-[640px] text-center">
          <SectionEyebrow>{t('partners.eyebrow')}</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(28px,4.2vw,40px)] font-black">
            {t('partners.titleStart')} <span className="text-violet-600">{t('partners.titleHighlight')}</span>
          </h2>
        </Reveal>
        {!hasPartners ? (
          <p className="mt-8 text-center text-sm text-[#68738f]">{t('partners.empty')}</p>
        ) : (
          <div className="mt-11 space-y-10">
            {partners.schools.length > 0 && <PartnerRow title={t('partners.schools')} items={partners.schools} />}
            {partners.financialPartners.length > 0 && <PartnerRow title={t('partners.financial')} items={partners.financialPartners} />}
          </div>
        )}
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <Reveal amount={0.4}>
          <motion.div
            whileHover={reduce ? undefined : { scale: 1.005 }}
            className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-violet-700 via-violet-600 to-[#ff8a5b] px-12 py-16 text-center shadow-[0_30px_60px_rgba(76,29,149,.18)]"
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-20 size-72 rounded-full bg-white/10"
              animate={reduce ? undefined : { scale: [1, 1.2, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="relative mx-auto grid size-16 place-items-center rounded-[20px] bg-white/20 text-white">
              <GraduationCap className="size-[30px]" />
            </span>
            <h2 className="relative mx-auto mt-5 max-w-[20ch] text-[clamp(28px,4.4vw,42px)] font-black text-white">
              {t('finalCta.title')}
            </h2>
            <p className="relative mx-auto mt-4 max-w-[52ch] text-[16px] text-white/90">
              {t('finalCta.text')}
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <motion.div whileHover={reduce ? undefined : { y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link href="/auth/register"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-white px-6 py-3.5 text-[15px] font-bold text-violet-700">
                  <UserRound className="size-[18px]" />
                  {t('finalCta.button')}
                </Link>
              </motion.div>
            </div>
            <p className="relative mt-5 text-[13px] font-semibold text-white/85">{t('finalCta.note')}</p>
          </motion.div>
        </Reveal>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer id="contact" className="border-t border-slate-100 bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <Link href="/"><Logo size={44} /></Link>
            <p className="mt-4 max-w-[26ch] text-[13.5px] leading-relaxed text-[#56618a]">
              {t('footer.tagline')}
            </p>
          </div>
          <FooterCol
            title={t('footer.platformTitle')}
            links={[t('footer.platformLink1'), t('footer.platformLink2'), t('footer.platformLink3'), t('footer.platformLink4')]}
          />
          <FooterCol
            title={t('footer.resourcesTitle')}
            links={[t('footer.resourcesLink1'), t('footer.resourcesLink2'), t('footer.resourcesLink3'), t('footer.resourcesLink4')]}
          />
          <div>
            <h4 className="text-[13px] font-extrabold">{t('footer.contactTitle')}</h4>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-[#56618a]">
              <li className="flex items-start gap-2.5"><span className="mt-0.5 size-4 shrink-0 text-violet-600">☎</span>+261 34 12 345 67</li>
              <li className="flex items-start gap-2.5"><span className="mt-0.5 size-4 shrink-0 text-violet-600">✉</span>contact@get.mg</li>
              <li className="flex items-start gap-2.5"><span className="mt-0.5 size-4 shrink-0 text-violet-600">📍</span>{t('footer.address')}</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 border-t border-slate-100 px-6 py-5 text-[12.5px] text-[#78819a]">
          <span>{t('footer.copyright')}</span>
          <span className="flex gap-5">
            <a href="#" className="hover:text-violet-600">{t('footer.terms')}</a>
            <a href="#" className="hover:text-violet-600">{t('footer.privacy')}</a>
          </span>
        </div>
      </footer>
    </main>
  );
}

/* =============================================================
   SOUS-COMPOSANTS
   ============================================================= */

function MagneticButton({
  href, children, large, className,
}: { href: string; children: React.ReactNode; large?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });

  function move(e: React.MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.35);
  }
  function leave() { x.set(0); y.set(0); }

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={move}
      onMouseLeave={leave}
      whileTap={{ scale: 0.96 }}
      style={reduce ? undefined : { x: sx, y: sy }}
      className={`inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-violet-600 to-[#ff8a5b] font-bold text-white shadow-[0_10px_24px_-8px_rgba(124,58,237,.55)] ${
        large ? 'px-6 py-3.5 text-[15px]' : 'px-4 py-2.5 text-[13px]'
      } ${className ?? ''}`}
    >
      {children}
    </motion.a>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3.5 py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-violet-600">
      {children}
    </span>
  );
}

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="size-[15px]" />
      </span>
      <div>
        <p className="text-[15px] font-extrabold">{title}</p>
        <p className="mt-0.5 text-[13.5px] text-[#56618a]">{text}</p>
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="text-[13px] font-extrabold">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l}><a href="#" className="text-[13.5px] text-[#56618a] transition hover:text-violet-600">{l}</a></li>
        ))}
      </ul>
    </div>
  );
}

function StatIcon({ name }: { name: string }) {
  const Icon = STAT_ICONS[name] ?? Building2;
  return <Icon className="size-6" />;
}

function PartnerRow({ title, items }: { title: string; items: PartnerItem[] }) {
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-wide text-[#68738f]">{title}</h3>
      <motion.div
        variants={containerStagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="mt-4 flex flex-wrap gap-4"
      >
        {items.map((item) => (
          <motion.div key={item.id} variants={fadeUp}>
            <PartnerLogo item={item} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function PartnerLogo({ item }: { item: PartnerItem }) {
  return (
    <div className="flex w-[140px] flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
      {item.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.logoUrl} alt={item.name} className="h-12 w-full object-contain" />
      ) : (
        <span className="grid size-12 place-items-center rounded-full bg-violet-50 text-sm font-black text-violet-600">{item.name.slice(0, 1).toUpperCase()}</span>
      )}
      <p className="line-clamp-2 text-[11px] font-bold text-[#28315e]">{item.name}</p>
    </div>
  );
}

/* Mockup dashboard étudiant (statique, sert de visuel dans la carte tilt) */
function StudentMock() {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <i className="size-2.5 rounded-full bg-slate-200" />
        <i className="size-2.5 rounded-full bg-slate-200" />
        <i className="size-2.5 rounded-full bg-slate-200" />
        <span className="ml-2.5 font-mono text-[11px] text-[#78819a]">app.get.mg/dashboard</span>
      </div>
      <div className="p-5">
        <div className="mb-4 rounded-[20px] bg-gradient-to-r from-violet-700 via-violet-600 to-[#ff8a5b] p-[18px] text-white">
          <p className="text-[16px] font-extrabold">Bonjour Mihaja 👋</p>
          <p className="mt-0.5 text-[11.5px] opacity-90">Voici où en est ton parcours aujourd&apos;hui.</p>
        </div>
        <div className="mb-3.5 grid grid-cols-3 gap-2.5">
          {[
            ['3', 'Candidatures', 'bg-violet-50', 'text-violet-600'],
            ['1', 'Admission', 'bg-emerald-50', 'text-emerald-600'],
            ['450k', 'Ar à régler', 'bg-orange-50', 'text-orange-500'],
          ].map(([v, l, bg, tx]) => (
            <div key={l} className="rounded-xl border border-slate-100 p-3">
              <span className={`mb-2 grid size-[30px] place-items-center rounded-[9px] ${bg} ${tx}`}>
                <CheckCircle2 className="size-4" />
              </span>
              <p className="font-heading text-[18px] font-extrabold leading-none">{v}</p>
              <p className="text-[10px] font-semibold text-[#78819a]">{l}</p>
            </div>
          ))}
        </div>
        {[
          ['IN', 'INSCAE — Management', 'Décision reçue', 'Accepté', 'bg-emerald-50', 'text-emerald-600'],
          ['ES', 'ESPA — Génie Logiciel', "En cours d'examen", 'En attente', 'bg-amber-50', 'text-amber-600'],
          ['EM', 'EMIT — Réseaux', 'Concours le 14 avril', 'Concours', 'bg-violet-50', 'text-violet-600'],
        ].map(([ini, name, sub, badge, bg, tx]) => (
          <div key={name} className="flex items-center gap-2.5 border-b border-slate-100 py-2.5 last:border-0">
            <span className={`grid size-8 shrink-0 place-items-center rounded-[9px] text-[11px] font-extrabold ${bg} ${tx}`}>{ini}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold">{name}</p>
              <p className="text-[10.5px] text-[#78819a]">{sub}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${bg} ${tx}`}>{badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
