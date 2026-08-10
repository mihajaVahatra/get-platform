import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, BookOpen, CheckCircle2, ChevronRight, WalletCards } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { SchoolNewsFeed } from '@/components/shared/school-news-feed';

/** Onglets/vues disponibles dans le portail étudiant, chacune correspondant à une route sous `dashboard/student`. */
type View = 'parcours' | 'news' | 'opportunities' | 'library';
/** État d'avancement d'une matière dans le parcours pédagogique de l'étudiant. */
type SubjectStatus = 'validated' | 'inProgress' | 'notStarted';

/**
 * Composant racine partagé du portail étudiant, invoqué par les pages `page.tsx`
 * de `dashboard/student/{parcours,news,opportunities,library}` (et réutilisable côté professeur).
 * Server component asynchrone (pas de `'use client'`) : charge les traductions côté serveur
 * via `getTranslations` puis délègue le rendu du contenu à `renderView`.
 * @param view - Vue à afficher (détermine le titre et le contenu rendu).
 */
export async function StudentPortalView({ view }: { view: View }) {
  const t = await getTranslations('StudentPortal');
  const title = t(`titles.${view}`);
  return <div className="mx-auto max-w-[1180px] text-[#111a4b]"><header className="mb-5 flex items-center justify-between"><div><h1 className="text-xl font-extrabold">{title}</h1><p className="mt-1 text-xs text-muted-foreground">{t('subtitle')}</p></div><button className="relative rounded-lg p-2 text-muted-foreground hover:bg-indigo-50 dark:bg-indigo-500/15"><Bell className="size-5" /><span className="absolute right-1 top-1 size-2 rounded-full bg-rose-500" /></button></header>{await renderView(view, t)}</div>;
}

/**
 * Sélectionne le contenu à afficher selon la vue demandée : parcours pédagogique détaillé,
 * fil d'actualités de l'école, ou écran "à venir" pour les opportunités/la bibliothèque
 * (fonctionnalités non encore implémentées).
 */
async function renderView(view: View, t: Awaited<ReturnType<typeof getTranslations<'StudentPortal'>>>) {
  if (view === 'parcours') return <Parcours t={t} />;
  if (view === 'news') return <SchoolNewsFeed />;
  return <ComingSoon title={view === 'opportunities' ? t('titles.opportunities') : t('titles.library')} icon={view === 'opportunities' ? WalletCards : BookOpen} t={t} />;
}

/**
 * Vue "Parcours" : tableau de bord de progression pédagogique de l'étudiant
 * (taux de complétion global, crédits validés, matières avec statut, jalons de fin de semestre).
 * Note : les données affichées (matières, crédits, jalons) sont actuellement statiques/factices,
 * en attente de branchement sur une API réelle.
 */
function Parcours({ t }: { t: Awaited<ReturnType<typeof getTranslations<'StudentPortal'>>> }) {
  const statusLabels: Record<SubjectStatus, string> = {
    validated: t('statusValidated'),
    inProgress: t('statusInProgress'),
    notStarted: t('statusNotStarted'),
  };
  const subjects: [string, string, SubjectStatus][] = [
    ['Algorithmique', '6/6', 'validated'],
    ['Bases de Données', '4/6', 'inProgress'],
    ['Réseaux & Télécoms', '2/6', 'inProgress'],
    ['Mathématiques', '6/6', 'validated'],
    ['Anglais', '0/6', 'notStarted'],
    ['Management', '0/6', 'notStarted'],
  ];
  return <div className="grid gap-4 lg:grid-cols-3"><Panel className="lg:col-span-2" title={t('progressPanelTitle')}><div className="mt-5 flex items-center gap-7 rounded-xl bg-indigo-50/70 p-5"><div className="flex size-28 shrink-0 items-center justify-center rounded-full border-[10px] border-indigo-200 border-t-indigo-600"><div className="text-center"><p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-300">60%</p><p className="text-[10px] text-muted-foreground">{t('completed')}</p></div></div><div className="grid flex-1 grid-cols-2 gap-4 text-xs"><Info label={t('creditsValidated')} value="18/30" /><Info label={t('subjectsValidated')} value="12/20" /><Info label={t('currentSemester')} value="S2 – 2024/2025" /></div></div></Panel><Panel title={t('infoPanelTitle')}><div className="mt-3 space-y-3 text-xs"><Info label={t('track')} value="Informatique" /><Info label={t('level')} value="2ᵉ année" /><Info label={t('admission')} value="2023" /><Info label={t('status')} value={t('statusRegular')} /></div></Panel><Panel className="lg:col-span-2" title={t('subjectsPanelTitle')}><div className="mt-3 divide-y divide-border">{subjects.map(([subject, credits, status]) => <div key={subject} className="flex items-center gap-3 py-2.5 text-xs"><CheckCircle2 className={`size-4 ${status === 'validated' ? 'text-emerald-500 dark:text-emerald-300' : 'text-slate-300'}`} /><span className="flex-1 font-semibold">{subject}</span><span className="text-muted-foreground">{credits}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status === 'validated' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : status === 'inProgress' ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300' : 'bg-rose-50 dark:bg-rose-500/15 text-rose-500 dark:text-rose-300'}`}>{statusLabels[status]}</span></div>)}</div></Panel><Panel title={t('milestonesPanelTitle')}><div className="mt-3 space-y-5 border-l-2 border-indigo-200 pl-4 text-xs"><Timeline label="Fin du semestre S2" date="30 juin 2025" /><Timeline label="Examens finaux" date="01 – 12 juillet 2025" /><Timeline label="Publication résultats" date="20 juillet 2025" /><Timeline label="Début S3" date="01 septembre 2025" /></div><button className="mt-5 w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white">{t('downloadTranscript')}</button></Panel></div>;
}

/** Écran de substitution affiché pour les vues non encore développées (opportunités, bibliothèque), avec lien de retour à l'accueil étudiant. */
function ComingSoon({ title, icon: Icon, t }: { title: string; icon: typeof Bell; t: Awaited<ReturnType<typeof getTranslations<'StudentPortal'>>> }) { return <Panel title={title}><div className="flex flex-col items-center justify-center py-20 text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"><Icon className="size-7" /></span><p className="mt-4 text-sm font-bold">{t('comingSoonTitle')}</p><p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{t('comingSoonText')}</p><Link href="/dashboard/student" className="mt-5 text-xs font-bold text-indigo-600 dark:text-indigo-300">{t('backHome')} <ChevronRight className="inline size-3" /></Link></div></Panel>; }

/** Conteneur visuel générique en carte (bordure, fond, ombre) utilisé pour regrouper une section du portail sous un titre, avec bouton d'action optionnel. */
function Panel({ title, action, children, className = '' }: { title: string; action?: string; children: ReactNode; className?: string }) { return <section className={`rounded-2xl border border-border bg-card p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)] ${className}`}><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">{title}</h2>{action && <button className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">{action}</button>}</div>{children}</section>; }
/** Paire libellé/valeur affichée dans les panneaux d'information (ex. crédits validés, niveau). */
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-extrabold text-foreground">{value}</p></div>; }
/** Entrée d'une frise chronologique (libellé + date) utilisée pour lister les jalons du semestre. */
function Timeline({ label, date }: { label: string; date: string }) { return <div><p className="font-bold">{label}</p><p className="mt-1 text-[10px] text-muted-foreground">{date}</p></div>; }
