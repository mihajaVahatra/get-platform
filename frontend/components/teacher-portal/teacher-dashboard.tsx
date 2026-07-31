'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, FileText, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type DashboardStats = {
  courses: number;
  submissionsToGrade: number;
  upcomingEvaluations: number;
  unreadMessages: number;
};

const METRICS = [
  {
    key: 'courses',
    icon: BookOpen,
    label: 'Cours',
    detail: 'Cours qui vous sont affectés',
    tone: 'violet',
  },
  {
    key: 'submissionsToGrade',
    icon: FileText,
    label: 'Soumissions à corriger',
    detail: 'Soumissions reçues sans note',
    tone: 'orange',
  },
  {
    key: 'upcomingEvaluations',
    icon: CalendarDays,
    label: 'Évaluations à venir',
    detail: 'Évaluations programmées à partir d’aujourd’hui',
    tone: 'blue',
  },
  {
    key: 'unreadMessages',
    icon: Mail,
    label: 'Messages non lus',
    detail: 'Messages reçus non encore lus',
    tone: 'violet',
  },
] as const;

const TONES = {
  violet: 'bg-violet-100 text-violet-600',
  blue: 'bg-blue-100 text-blue-600',
  orange: 'bg-orange-100 text-orange-600',
};

export function TeacherDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadDashboard();
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  if (loading)
    return (
      <p className="rounded-xl border border-slate-100 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Chargement de votre activité…
      </p>
    );

  if (failed || !stats)
    return (
      <div className="rounded-xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">
        <p>Votre activité n’a pas pu être chargée.</p>
        <button
          className="mt-3 text-xs font-bold text-violet-600"
          onClick={() => void loadDashboard()}
        >
          Réessayer
        </button>
      </div>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {METRICS.map(({ key, icon: Icon, label, detail, tone }) => (
        <section
          className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
          key={key}
        >
          <div className="flex items-center gap-3">
            <span
              className={`grid size-10 place-items-center rounded-xl ${TONES[tone]}`}
            >
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold text-slate-500">
                {label}
              </p>
              <p className="text-xl font-extrabold text-[#111949]">
                {stats[key]}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">{detail}</p>
        </section>
      ))}
    </div>
  );
}
