'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileText,
  Mail,
  UsersRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

/** Indicateurs agrégés de l'activité du professeur, renvoyés par `/teacher/dashboard/summary`. */
type DashboardStats = {
  courses: number;
  students: number;
  submissionsToGrade: number;
  upcomingEvaluations: number;
  unreadMessages: number;
};

/** Créneau de l'emploi du temps, tel qu'utilisé pour la liste des cours du jour. */
type ScheduleSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  course: { id: string; title: string; group?: string | null };
};

/** Configuration des 4 cartes de métriques affichées en haut du tableau de bord (icône, libellé, sous-texte calculé, couleur). */
const METRICS = [
  {
    key: 'courses',
    icon: BookOpen,
    label: 'Cours enseignés',
    detail: (stats: DashboardStats) => `${stats.courses} ce mois`,
    tone: 'indigo',
  },
  {
    key: 'students',
    icon: UsersRound,
    label: 'Étudiants',
    detail: () => 'Sur vos cours actifs',
    tone: 'blue',
  },
  {
    key: 'upcomingEvaluations',
    icon: CalendarDays,
    label: 'Évaluations',
    detail: () => 'À venir',
    tone: 'green',
  },
  {
    key: 'submissionsToGrade',
    icon: FileText,
    label: 'Devoirs à corriger',
    detail: (stats: DashboardStats) =>
      stats.submissionsToGrade > 0
        ? `${stats.submissionsToGrade} en retard`
        : 'Tout est à jour',
    tone: 'orange',
  },
] as const;

/** Classes Tailwind associées à chaque couleur de métrique déclarée dans `METRICS`. */
const TONES = {
  indigo: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  blue: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300',
  orange: 'bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-300',
  green: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
};

// Index 0 volontairement vide : `dayOfWeek` de l'API est 1-indexé (1 = Lundi), aligné sur l'index du tableau.
const DAY_LABELS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Détermine si un créneau de cours est "En cours", "À venir" ou "Terminé"
 * en comparant l'heure actuelle à l'intervalle [startTime, endTime[.
 */
function currentStatus(startTime: string, endTime: string) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) return 'En cours';
  if (nowMinutes < startMinutes) return 'À venir';
  return 'Terminé';
}

/**
 * Vue d'accueil du portail professeur : affiche les métriques clés de
 * l'activité (cours, étudiants, évaluations à venir, devoirs à corriger),
 * un raccourci vers les messages non lus, et la liste des cours du jour
 * avec leur statut (en cours / à venir / terminé).
 *
 * Charge en parallèle le résumé (`GET /teacher/dashboard/summary`) et
 * l'emploi du temps (`GET /teacher/courses/schedule`, filtré sur le jour
 * courant) au montage du composant.
 */
export function TeacherDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [todaySlots, setTodaySlots] = useState<ScheduleSlot[]>([]);

  /** Récupère les indicateurs agrégés du tableau de bord. */
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/teacher/dashboard/summary');
      setStats(response.data.data as DashboardStats);
    } catch (error) {
      console.error('Erreur chargement tableau de bord professeur:', error);
      setFailed(true);
      toast.error('Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Récupère l'emploi du temps complet et ne conserve que les créneaux du jour courant, triés par heure de début. */
  const loadTodaySchedule = useCallback(async () => {
    try {
      const response = await apiClient.get('/teacher/courses/schedule');
      const slots = (response.data.data ?? []) as ScheduleSlot[];
      // `Date.getDay()` renvoie 0 pour dimanche ; on le convertit vers la convention ISO (1 = lundi ... 7 = dimanche) utilisée par l'API.
      const isoWeekday = new Date().getDay() === 0 ? 7 : new Date().getDay();
      setTodaySlots(
        slots
          .filter((slot) => slot.dayOfWeek === isoWeekday)
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
    } catch (error) {
      console.error('Erreur chargement emploi du temps du jour:', error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void loadDashboard();
        void loadTodaySchedule();
      }
    });
    return () => {
      active = false;
    };
  }, [loadDashboard, loadTodaySchedule]);

  if (loading)
    return (
      <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Chargement de votre activité…
      </p>
    );

  if (failed || !stats)
    return (
      <div className="rounded-xl border border-rose-100 bg-rose-50 dark:bg-rose-500/15 p-5 text-sm text-rose-700 dark:text-rose-300">
        <p>Votre activité n’a pas pu être chargée.</p>
        <button
          className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-300"
          onClick={() => void loadDashboard()}
        >
          Réessayer
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {METRICS.map(({ key, icon: Icon, label, detail, tone }) => (
          <section
            className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"
            key={key}
          >
            <span
              className={`grid size-10 place-items-center rounded-xl ${TONES[tone]}`}
            >
              <Icon className="size-5" />
            </span>
            <p className="mt-2.5 text-[11px] font-semibold text-muted-foreground">
              {label}
            </p>
            <p className="text-xl font-extrabold text-[#111949]">
              {stats[key]}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{detail(stats)}</p>
          </section>
        ))}
      </div>

      <Link
        href="/dashboard/teacher?view=messages"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-indigo-200"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111949]">Messages non lus</p>
          <p className="text-xs text-muted-foreground">
            {stats.unreadMessages > 0
              ? `${stats.unreadMessages} message${stats.unreadMessages > 1 ? 's' : ''} en attente`
              : 'Aucun message en attente'}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#111949]">
            Prochains cours aujourd’hui
          </h2>
          <Link
            href="/dashboard/teacher?view=schedule"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-300"
          >
            Voir tout
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {todaySlots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun cours programmé aujourd’hui.
            </p>
          ) : (
            todaySlots.map((slot) => {
              const status = currentStatus(slot.startTime, slot.endTime);
              return (
                <div
                  key={slot.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                    <BookOpen className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#111949]">
                      {slot.course.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {slot.course.group ? `${slot.course.group} · ` : ''}
                      {DAY_LABELS[slot.dayOfWeek]} {slot.startTime}–
                      {slot.endTime}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                      status === 'En cours'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                        : status === 'À venir'
                          ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {status}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
