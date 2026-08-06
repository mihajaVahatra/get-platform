'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, MailOpen, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type PlatformStats = {
  total: number;
  unread: number;
  read: number;
  sentLast7Days: number;
  topRecentTitles: { title: string; count: number }[];
};

export function NotificationsOverview() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/notifications/platform-stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Erreur chargement statistiques notifications:', error);
      toast.error('Impossible de charger les statistiques');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchStats();
    });
    return () => {
      active = false;
    };
  }, [fetchStats]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-indigo-600">
          Suivi des notifications envoyées sur la plateforme. Pour envoyer une
          annonce, utilisez la page « Annonces ».
        </p>
      </header>
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Chargement...
        </p>
      ) : !stats ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Impossible de charger les statistiques.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={BellRing} tone="indigo" label="Total envoyées" value={stats.total} />
            <Kpi icon={MailOpen} tone="orange" label="Non lues" value={stats.unread} />
            <Kpi icon={CheckCircle2} tone="green" label="Lues" value={stats.read} />
            <Kpi icon={TrendingUp} tone="blue" label="7 derniers jours" value={stats.sentLast7Days} />
          </div>
          <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="font-extrabold text-[#17204e]">
              Notifications les plus fréquentes (7 derniers jours)
            </h2>
            {stats.topRecentTitles.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Aucune notification envoyée cette semaine.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {stats.topRecentTitles.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-xs"
                  >
                    <span className="font-bold text-slate-800">{item.title}</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-1 font-bold text-indigo-600">
                      {item.count}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof BellRing;
  tone: 'indigo' | 'orange' | 'green' | 'blue';
  label: string;
  value: number;
}) {
  const tones = {
    indigo: 'bg-indigo-100 text-indigo-600',
    orange: 'bg-orange-100 text-orange-500',
    green: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-500',
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`grid size-11 place-items-center rounded-full ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-bold text-[#28315e]">{label}</p>
          <p className="mt-1 text-xl font-extrabold text-[#111949]">{value}</p>
        </div>
      </div>
    </div>
  );
}
