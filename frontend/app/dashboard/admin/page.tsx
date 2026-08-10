'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Building, CalendarDays, FileText, Search, ShieldCheck, UsersRound, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { MessageIconLink } from '@/components/messages/message-icon-link';
import { MessagesScreen } from '@/components/messages/messages-screen';
import { ActivityLog } from '@/components/admin-portal/activity-log';
import { AnnouncementsBroadcast } from '@/components/admin-portal/announcements-broadcast';
import { CompetitionsManager } from '@/components/admin-portal/competitions-manager';
import { FinancialPartnersManager } from '@/components/admin-portal/financial-partners-manager';
import { LandingContentManager } from '@/components/admin-portal/landing-content-manager';
import { LandingNewsManager } from '@/components/admin-portal/landing-news-manager';
import { TeacherConflictsView } from '@/components/admin-portal/teacher-conflicts-view';
import { StudentsDirectory } from '@/components/admin-portal/students-directory';
import { ProgramsDirectory } from '@/components/admin-portal/programs-directory';
import { NotificationsOverview } from '@/components/admin-portal/notifications-overview';

/**
 * Point d'entrée de la page d'accueil du dashboard admin.
 * Englobe le contenu dans un `Suspense` car `AdminDashboardContent` utilise
 * `useSearchParams`, qui nécessite une frontière de suspension en App Router.
 */
export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardContent />
    </Suspense>
  );
}

/**
 * Sélectionne la section du portail admin à afficher en fonction du
 * paramètre d'URL `section`. Ce routage par query param permet de garder
 * une seule page tout en donnant une URL partageable/bookmarkable à chaque
 * sous-vue (messages, activité, annonces, etc.). Sans paramètre reconnu,
 * affiche le résumé chiffré du tableau de bord (`DashboardSummary`).
 */
function AdminDashboardContent() {
  const searchParams = useSearchParams();
  if (searchParams.get('section') === 'messages') {
    return <MessagesScreen />;
  }
  if (searchParams.get('section') === 'activity') {
    return <ActivityLog />;
  }
  if (searchParams.get('section') === 'announcements') {
    return <AnnouncementsBroadcast />;
  }
  if (searchParams.get('section') === 'competitions') {
    return <CompetitionsManager />;
  }
  if (searchParams.get('section') === 'partners') {
    return <FinancialPartnersManager />;
  }
  if (searchParams.get('section') === 'landing-content') {
    return <LandingContentManager />;
  }
  if (searchParams.get('section') === 'landing-news') {
    return <LandingNewsManager />;
  }
  if (searchParams.get('section') === 'teacher-conflicts') {
    return <TeacherConflictsView />;
  }
  if (searchParams.get('section') === 'students') {
    return <StudentsDirectory />;
  }
  if (searchParams.get('section') === 'programs') {
    return <ProgramsDirectory />;
  }
  if (searchParams.get('section') === 'notifications') {
    return <NotificationsOverview />;
  }
  return <DashboardSummary />;
}

/** Indicateurs clés agrégés affichés sur le résumé du tableau de bord admin. */
type Summary = {
  activeSchools: number;
  enrolledStudents: number;
  totalApplications: number;
  pendingApplications: number;
  acceptanceRate: number;
  totalRevenue: number;
};

/**
 * Vue par défaut du dashboard admin : charge et affiche les KPI globaux de
 * la plateforme (étudiants inscrits, établissements actifs, candidatures,
 * revenus, taux d'acceptation) via `GET /admin/dashboard-summary`.
 */
function DashboardSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  /** Récupère le résumé chiffré du tableau de bord admin depuis l'API. */
  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/dashboard-summary');
      setSummary(response.data.data);
    } catch (error) {
      console.error('Erreur chargement tableau de bord:', error);
      toast.error('Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Déféré via une microtâche pour laisser le rendu initial se produire
    // avant de déclencher l'appel réseau ; `active` évite de mettre à jour
    // l'état si le composant est démonté entre-temps.
    void Promise.resolve().then(() => {
      if (active) return fetchSummary();
    });
    return () => {
      active = false;
    };
  }, [fetchSummary]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Bonjour, Administrateur 👋
          </h1>
          <p className="mt-1 text-sm text-indigo-600">
            Voici un aperçu global de la plateforme GET.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="relative hidden w-[400px] xl:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-xs outline-none focus:border-indigo-500"
              maxLength={150}
              placeholder="Rechercher un étudiant, une école, un cours..."
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
              ⌘ K
            </kbd>
          </label>
          <NotificationBell />
          <MessageIconLink href="/dashboard/admin?section=messages" />
          <button className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#34406b]">
            <CalendarDays className="size-4 text-indigo-600" />
            {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </button>
        </div>
      </header>
      {loading || !summary ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
      ) : (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Kpi icon={UsersRound} tone="indigo" label="Étudiants inscrits" value={summary.enrolledStudents.toLocaleString('fr-FR')} />
          <Kpi icon={Building} tone="green" label="Établissements actifs" value={summary.activeSchools.toLocaleString('fr-FR')} />
          <Kpi icon={FileText} tone="blue" label="Candidatures totales" value={summary.totalApplications.toLocaleString('fr-FR')} />
          <Kpi icon={WalletCards} tone="orange" label="Revenus totaux" value={`${summary.totalRevenue.toLocaleString('fr-FR')} Ar`} />
          <Kpi icon={ShieldCheck} tone="indigo" label="Taux d’acceptation" value={`${summary.acceptanceRate}%`} />
        </section>
      )}
    </div>
  );
}

/** Carte affichant un indicateur clé (icône + libellé + valeur) avec une teinte de couleur donnée. */
function Kpi({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: 'indigo' | 'green' | 'blue' | 'orange'; label: string; value: string }) {
  const tones = { indigo: 'bg-indigo-100 text-indigo-600', green: 'bg-emerald-100 text-emerald-600', blue: 'bg-blue-100 text-blue-500', orange: 'bg-orange-100 text-orange-500' };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <span className={`grid size-12 place-items-center rounded-full ${tones[tone]}`}>
          <Icon className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold text-[#28315e]">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-[#111949]">{value}</p>
        </div>
      </div>
    </div>
  );
}
