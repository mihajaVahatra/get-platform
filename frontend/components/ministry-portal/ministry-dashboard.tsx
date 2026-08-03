'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Clock3,
  Download,
  FileText,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { MessageIconLink } from '@/components/messages/message-icon-link';
import { MessagesScreen } from '@/components/messages/messages-screen';

type DashboardData = {
  totalApplications: number;
  totalStudents: number;
  totalSchools: number;
  totalOffers: number;
  acceptanceRate: number;
  genderDistribution: { male: number; female: number; other: number };
  regionalDistribution: { region: string; count: number }[];
  applicationsByFiliere: { filiere: string; count: number }[];
  trends: { period: string; count: number }[];
  alerts: {
    nonCompliantSchools: number;
    pendingApplicationsOver48h: number;
  };
  recentApplications: {
    studentName: string;
    school: string;
    filiere: string;
    status: string;
    submittedAt: string;
  }[];
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  UNDER_REVIEW: 'En cours',
  TEST_SCHEDULED: 'Test planifié',
  INTERVIEW_SCHEDULED: 'Entretien planifié',
  PRESELECTED: 'Présélectionnée',
  WAITLISTED: 'Liste d’attente',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Rejetée',
  ENROLLED: 'Inscrite',
};

export function MinistryDashboard() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchDashboard = async (params?: { from?: string; to?: string }) => {
    setLoading(true);
    setError(false);
    try {
      const response = await apiClient.get('/ministry/dashboard', {
        params: {
          from: params?.from || undefined,
          to: params?.to || undefined,
        },
      });
      setData(response.data.data);
    } catch (err) {
      console.error('Erreur chargement du tableau de bord ministère:', err);
      setError(true);
      toast.error('Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (searchParams.get('section') === 'messages') {
    return <MessagesScreen />;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Tableau de bord
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Vue d’ensemble du système post-bac national
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Date de début"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs text-[#34406b]"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            aria-label="Date de fin"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs text-[#34406b]"
          />
          <button
            onClick={() => fetchDashboard({ from, to })}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#34406b]"
          >
            Appliquer
          </button>
          {(from || to) && (
            <button
              onClick={() => {
                setFrom('');
                setTo('');
                fetchDashboard();
              }}
              className="h-10 rounded-lg px-2 text-xs font-semibold text-slate-400"
            >
              Réinitialiser
            </button>
          )}
          <NotificationBell />
          <MessageIconLink href="/dashboard/ministry?section=messages" />
          <Link
            href="/dashboard/ministry/reports"
            className="hidden h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-4 text-xs font-bold text-white shadow-md shadow-violet-200 sm:flex"
          >
            <Download className="size-4" />
            Générer un rapport
          </Link>
        </div>
      </header>

      {loading && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-6 text-center">
          <p className="text-sm font-semibold text-rose-600">
            Le tableau de bord n’a pas pu être chargé.
          </p>
          <button
            onClick={() => fetchDashboard({ from, to })}
            className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              icon={UsersRound}
              tone="violet"
              label="Total étudiants"
              value={numberFormatter.format(data.totalStudents)}
              note={`${data.totalSchools} établissement(s) actif(s)`}
            />
            <Kpi
              icon={Building2}
              tone="blue"
              label="Offres publiées"
              value={numberFormatter.format(data.totalOffers)}
              note={`sur ${data.totalSchools} établissements`}
            />
            <Kpi
              icon={FileText}
              tone="green"
              label="Candidatures"
              value={numberFormatter.format(data.totalApplications)}
              note={`${data.acceptanceRate}% acceptées`}
            />
            <Kpi
              icon={ShieldAlert}
              tone="orange"
              label="Établissements non conformes"
              value={numberFormatter.format(data.alerts.nonCompliantSchools)}
              note="Dernier contrôle en échec"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_0.92fr]">
            <TrendChart trends={data.trends} />
            <Donut
              title="Répartition des candidatures par filière"
              total={numberFormatter.format(data.totalApplications)}
              items={data.applicationsByFiliere.slice(0, 6).map((f, i) => ({
                label: f.filiere,
                count: f.count,
                color: FILIERE_COLORS[i % FILIERE_COLORS.length],
              }))}
            />
            <Donut
              title="Répartition par genre"
              total={numberFormatter.format(data.totalStudents)}
              items={[
                {
                  label: 'Hommes',
                  count: data.genderDistribution.male,
                  color: 'bg-blue-500',
                },
                {
                  label: 'Femmes',
                  count: data.genderDistribution.female,
                  color: 'bg-violet-600',
                },
                {
                  label: 'Autre / non renseigné',
                  count: data.genderDistribution.other,
                  color: 'bg-slate-300',
                },
              ]}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_0.92fr]">
            <Card title="Candidatures par région">
              {data.regionalDistribution.length === 0 ? (
                <EmptyNote text="Aucune donnée régionale disponible." />
              ) : (
                <div className="space-y-3">
                  {data.regionalDistribution.slice(0, 6).map((r) => {
                    const max = data.regionalDistribution[0]?.count || 1;
                    const width = Math.round((r.count / max) * 100);
                    return (
                      <div key={r.region}>
                        <div className="flex justify-between text-[10px]">
                          <span className="font-bold text-[#34406b]">
                            {r.region}
                          </span>
                          <span className="text-slate-500">{r.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded bg-slate-100">
                          <div
                            className="h-1.5 rounded bg-violet-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card title="Dernières candidatures">
              {data.recentApplications.length === 0 ? (
                <EmptyNote text="Aucune candidature récente." />
              ) : (
                <div className="space-y-1">
                  {data.recentApplications.map((a, i) => (
                    <div
                      key={i}
                      className="flex gap-3 border-b border-slate-100 py-2.5 last:border-0"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                        <FileText className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-[#28315e]">
                          {a.studentName} — {a.filiere}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          {a.school}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-[10px] font-semibold text-slate-500">
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Alertes de suivi">
              <div className="space-y-1">
                <Notice
                  icon={ShieldAlert}
                  tone={data.alerts.nonCompliantSchools > 0 ? 'rose' : 'green'}
                  title={`${data.alerts.nonCompliantSchools} établissement(s) non conforme(s)`}
                  href="/dashboard/ministry/compliance"
                />
                <Notice
                  icon={Clock3}
                  tone={
                    data.alerts.pendingApplicationsOver48h > 0
                      ? 'blue'
                      : 'green'
                  }
                  title={`${data.alerts.pendingApplicationsOver48h} candidature(s) en attente depuis +48h`}
                />
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

const FILIERE_COLORS = [
  'bg-violet-600',
  'bg-emerald-500',
  'bg-orange-400',
  'bg-blue-500',
  'bg-indigo-400',
  'bg-slate-300',
];

function EmptyNote({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-slate-400">{text}</p>;
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  tone: 'violet' | 'blue' | 'green' | 'orange';
  label: string;
  value: string;
  note: string;
}) {
  const toneClasses = {
    violet: 'bg-violet-100 text-violet-600',
    blue: 'bg-blue-100 text-blue-500',
    green: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-500',
  };
  return (
    <article className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-12 place-items-center rounded-xl ${toneClasses[tone]}`}
        >
          <Icon className="size-6" />
        </span>
        <div>
          <p className="text-[11px] font-bold text-[#28315e]">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-[#111949]">{value}</p>
        </div>
      </div>
      <p className="mt-3 truncate text-[10px] font-semibold text-slate-500">
        {note}
      </p>
    </article>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-[#17204e]">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TrendChart({ trends }: { trends: { period: string; count: number }[] }) {
  const ordered = [...trends].reverse();
  const max = Math.max(...ordered.map((t) => t.count), 1);
  const points = ordered.map((t) => (t.count / max) * 130);

  return (
    <Card title="Évolution des candidatures (12 derniers mois)">
      {ordered.length === 0 ? (
        <EmptyNote text="Pas encore de candidature soumise." />
      ) : (
        <>
          <div className="relative h-40 border-b border-l border-slate-100">
            <svg
              viewBox={`0 0 ${Math.max(ordered.length - 1, 1) * 50} 160`}
              className="absolute inset-0 size-full overflow-visible"
              preserveAspectRatio="none"
            >
              <polyline
                points={points
                  .map((point, index) => `${index * 50},${150 - point}`)
                  .join(' ')}
                fill="none"
                stroke="#593bef"
                strokeWidth="3"
              />
              {points.map((point, index) => (
                <circle
                  key={index}
                  cx={index * 50}
                  cy={150 - point}
                  r="3.5"
                  fill="#593bef"
                />
              ))}
            </svg>
          </div>
          <div className="mt-3 flex justify-between text-[9px] text-slate-500">
            {ordered.map((t) => (
              <span key={t.period}>
                {new Date(t.period).toLocaleDateString('fr-FR', {
                  month: 'short',
                  year: '2-digit',
                })}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Donut({
  title,
  total,
  items,
}: {
  title: string;
  total: string;
  items: { label: string; count: number; color: string }[];
}) {
  const sum = items.reduce((acc, i) => acc + i.count, 0) || 1;
  let cursor = 0;
  const stops = items.map((item) => {
    const start = (cursor / sum) * 100;
    cursor += item.count;
    const end = (cursor / sum) * 100;
    return { ...item, start, end };
  });
  const colorHex: Record<string, string> = {
    'bg-violet-600': '#5b42e9',
    'bg-emerald-500': '#36c3a5',
    'bg-orange-400': '#ff9b27',
    'bg-blue-500': '#3998e9',
    'bg-indigo-400': '#7682ed',
    'bg-slate-300': '#dce1ec',
  };
  const gradient = stops.length
    ? `conic-gradient(${stops
        .map(
          (s) =>
            `${colorHex[s.color] || '#dce1ec'} ${s.start}% ${s.end}%`,
        )
        .join(', ')})`
    : '#f1f5f9';

  return (
    <Card title={title}>
      {sum === 0 || items.every((i) => i.count === 0) ? (
        <EmptyNote text="Aucune donnée sur la période." />
      ) : (
        <div className="flex items-center gap-5 py-3">
          <div
            className="grid size-32 shrink-0 place-items-center rounded-full"
            style={{ background: gradient }}
          >
            <div className="grid size-20 place-items-center rounded-full bg-white text-center">
              <strong className="text-xl text-[#111949]">{total}</strong>
              <span className="text-[10px] text-slate-500">Total</span>
            </div>
          </div>
          <ul className="min-w-0 space-y-2 text-[9px] text-slate-600">
            {items.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <i className={`size-2 shrink-0 rounded-full ${item.color}`} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <b className="whitespace-nowrap font-medium">
                  {item.count} ({Math.round((item.count / sum) * 100)}%)
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Notice({
  icon: Icon,
  tone,
  title,
  href,
}: {
  icon: LucideIcon;
  tone: 'rose' | 'blue' | 'green';
  title: string;
  href?: string;
}) {
  const toneClasses =
    tone === 'rose'
      ? 'bg-rose-50 text-rose-500'
      : tone === 'green'
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-blue-50 text-blue-500';
  const content = (
    <>
      <span className={`grid size-8 place-items-center rounded-lg ${toneClasses}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <b className="block text-[11px] text-[#34406b]">{title}</b>
      </span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex w-full items-center gap-3 border-b border-slate-100 py-2.5 last:border-0"
      >
        {content}
      </Link>
    );
  }
  return (
    <div className="flex w-full items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
      {content}
    </div>
  );
}
