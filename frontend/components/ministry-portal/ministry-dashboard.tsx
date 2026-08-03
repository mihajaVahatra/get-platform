'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart2,
  FileText,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { MessageIconLink } from '@/components/messages/message-icon-link';
import { MessagesScreen } from '@/components/messages/messages-screen';
import { MfaSettingsCard } from '@/components/auth/MfaSettingsCard';

type DateRange = {
  from: string;
  to: string;
};

type CountByStatus = {
  status: string;
  count: number;
};

type CountByRegion = {
  region: string;
  count: number;
};

type SchoolProgrammeCount = {
  school: string;
  region: string | null;
  city: string | null;
  filiere: string | null;
  programme: string | null;
  count: number;
  acceptedCount: number;
  pendingCount: number;
};

type EnrollmentBySchoolProgramme = {
  school: string;
  region: string | null;
  city: string | null;
  filiere: string | null;
  programme: string | null;
  enrolledCount: number;
};

type Trend = {
  period: string;
  count: number;
  acceptedCount: number;
  pendingCount: number;
};

type DashboardData = {
  period: { from: string | null; to: string | null };
  totalApplications: number;
  totalStudents: number;
  totalSchools: number;
  totalOffers: number;
  acceptanceRate: number;
  totalEnrolledStudents?: number;
  applicationsByStatus?: CountByStatus[];
  regionalDistribution?: CountByRegion[];
  // `applicationsBySchoolProgramme` est le nom de l’API Ministry. L’alias
  // d’inscriptions garde le composant compatible avec les jeux de données
  // déjà nommés « enrollments » sans changer la granularité affichée.
  applicationsBySchoolProgramme?: SchoolProgrammeCount[];
  enrollmentsBySchoolProgramme?: EnrollmentBySchoolProgramme[];
  trends?: Trend[];
  alerts?: { pendingApplicationsOver48h: number };
};

type ApiResponse = {
  data: DashboardData;
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  UNDER_REVIEW: 'En cours',
  TEST_SCHEDULED: 'Test planifié',
  INTERVIEW_SCHEDULED: 'Entretien planifié',
  PRESELECTED: 'Présélectionnées',
  WAITLISTED: 'Liste d’attente',
  ACCEPTED: 'Acceptées',
  REJECTED: 'Rejetées',
  ENROLLED: 'Inscrites',
};

const DISTRIBUTION_COLORS = [
  '#5b42e9',
  '#36c3a5',
  '#ff9b27',
  '#3998e9',
  '#7682ed',
  '#dce1ec',
];

export function MinistryDashboard() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const loadDashboard = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<ApiResponse>('/ministry/dashboard', {
        params: {
          from: range.from || undefined,
          to: range.to || undefined,
        },
      });
      setData(response.data.data);
    } catch (requestError) {
      console.error(
        'Erreur chargement du tableau de bord ministère:',
        requestError,
      );
      setError(
        'Les indicateurs agrégés ne sont pas disponibles pour le moment.',
      );
      toast.error('Impossible de charger les indicateurs du ministère');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadDashboard({ from: '', to: '' }));
  }, [loadDashboard]);

  const applyRange = () => {
    if (from && to && from > to) {
      toast.error('La date de début doit précéder la date de fin.');
      return;
    }
    void loadDashboard({ from, to });
  };

  const resetRange = () => {
    setFrom('');
    setTo('');
    void loadDashboard({ from: '', to: '' });
  };

  if (searchParams.get('section') === 'messages') {
    return <MessagesScreen />;
  }

  if (searchParams.get('section') === 'settings') {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Paramètres
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Sécurité de votre compte
          </p>
        </div>
        <MfaSettingsCard />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Pilotage national
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-violet-700">
            Indicateurs agrégés et anonymisés des candidatures, établissements
            et programmes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ministry-from">
            Date de début
          </label>
          <input
            id="ministry-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs text-[#34406b]"
          />
          <span aria-hidden="true" className="text-xs text-slate-400">
            →
          </span>
          <label className="sr-only" htmlFor="ministry-to">
            Date de fin
          </label>
          <input
            id="ministry-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs text-[#34406b]"
          />
          <button
            type="button"
            onClick={applyRange}
            disabled={loading}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#34406b] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            Appliquer
          </button>
          {(from || to) && (
            <button
              type="button"
              onClick={resetRange}
              disabled={loading}
              className="h-10 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            >
              Réinitialiser
            </button>
          )}
          <NotificationBell />
          <MessageIconLink href="/dashboard/ministry?section=messages" />
          <Link
            href="/dashboard/ministry/reports"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-4 text-xs font-bold text-white shadow-md shadow-violet-200 transition hover:brightness-105"
          >
            <FileText className="size-4" />
            Rapports
          </Link>
        </div>
      </header>

      {data?.period && <PeriodNote period={data.period} />}

      {!loading &&
        !error &&
        Boolean(data?.alerts?.pendingApplicationsOver48h) && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            {numberFormatter.format(data!.alerts!.pendingApplicationsOver48h)}{' '}
            candidature(s) en attente depuis plus de 48h, tous établissements
            confondus.
          </div>
        )}

      {loading && <DashboardSkeleton />}

      {!loading && error && (
        <section className="rounded-xl border border-rose-100 bg-rose-50 p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadDashboard({ from, to })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
          >
            <RefreshCw className="size-4" />
            Réessayer
          </button>
        </section>
      )}

      {!loading && !error && data && <DashboardContent data={data} />}
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={ClipboardList}
          tone="violet"
          label="Candidatures"
          value={numberFormatter.format(data.totalApplications)}
          note="Périmètre sélectionné"
        />
        <Kpi
          icon={Building2}
          tone="blue"
          label="Établissements actifs"
          value={numberFormatter.format(data.totalSchools)}
          note="Établissements publiants"
        />
        <Kpi
          icon={FileBarChart2}
          tone="green"
          label="Offres publiées"
          value={numberFormatter.format(data.totalOffers)}
          note="Offres visibles sur la plateforme"
        />
        <Kpi
          icon={CheckCircle2}
          tone="orange"
          label="Taux d’admission"
          value={`${numberFormatter.format(data.acceptanceRate)} %`}
          note="Candidatures acceptées"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr]">
        <TrendChart trends={data.trends ?? []} />
        <Distribution
          title="Candidatures par statut"
          total={data.totalApplications}
          items={(data.applicationsByStatus ?? []).map((item) => ({
            label: STATUS_LABELS[item.status] || item.status,
            count: item.count,
          }))}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.3fr]">
        <RegionalDistribution regions={data.regionalDistribution ?? []} />
        <div className="space-y-4">
          <SchoolProgrammeTable
            rows={data.applicationsBySchoolProgramme ?? []}
          />
          {(data.enrollmentsBySchoolProgramme ?? []).length > 0 && (
            <EnrollmentSchoolProgrammeTable
              rows={data.enrollmentsBySchoolProgramme ?? []}
            />
          )}
        </div>
      </section>
    </>
  );
}

function PeriodNote({
  period,
}: {
  period: { from: string | null; to: string | null };
}) {
  const formatDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
  };
  const from = formatDate(period.from);
  const to = formatDate(period.to);

  return (
    <p className="flex items-center gap-2 text-xs text-slate-500">
      <CalendarDays className="size-3.5 text-violet-600" />
      {from || to
        ? `Période analysée : ${from || 'début'} — ${to || 'aujourd’hui'}`
        : 'Toutes les candidatures disponibles sont prises en compte.'}
    </p>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-label="Chargement des indicateurs"
      className="space-y-4"
      role="status"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-slate-100 bg-slate-50"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-xl border border-slate-100 bg-slate-50"
          />
        ))}
      </div>
    </div>
  );
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

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-[#17204e]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TrendChart({ trends }: { trends: Trend[] }) {
  const ordered = [...trends].sort((left, right) =>
    left.period.localeCompare(right.period),
  );
  const max = Math.max(...ordered.map((item) => item.count), 1);
  const width = Math.max((ordered.length - 1) * 72, 72);
  const points = ordered.map((item, index) => ({
    x: index * 72,
    y: 150 - (item.count / max) * 128,
  }));

  return (
    <Card title="Évolution des candidatures">
      {ordered.length === 0 ? (
        <EmptyNote text="Aucune candidature sur la période sélectionnée." />
      ) : (
        <>
          <div className="relative h-44 border-b border-l border-slate-100">
            <svg
              aria-label="Évolution agrégée des candidatures"
              className="absolute inset-0 size-full overflow-visible"
              preserveAspectRatio="none"
              role="img"
              viewBox={`0 0 ${width} 160`}
            >
              <polyline
                fill="none"
                points={points
                  .map((point) => `${point.x},${point.y}`)
                  .join(' ')}
                stroke="#593bef"
                strokeWidth="3"
              />
              {points.map((point, index) => (
                <circle
                  key={ordered[index].period}
                  cx={point.x}
                  cy={point.y}
                  fill="#593bef"
                  r="3.5"
                />
              ))}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[9px] text-slate-500">
            {ordered.map((item) => (
              <span key={item.period}>
                {formatMonth(item.period)} ·{' '}
                {numberFormatter.format(item.count)}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Distribution({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: { label: string; count: number }[];
}) {
  const ordered = [...items].sort((left, right) => right.count - left.count);
  const count = ordered.reduce((sum, item) => sum + item.count, 0);
  const safeTotal = count || 1;
  const gradient = ordered.length
    ? `conic-gradient(${ordered
        .map((item, index) => {
          const before = ordered
            .slice(0, index)
            .reduce((sum, previous) => sum + previous.count, 0);
          const start = (before / safeTotal) * 100;
          const end = ((before + item.count) / safeTotal) * 100;
          return `${DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} ${start}% ${end}%`;
        })
        .join(', ')})`
    : '#f1f5f9';

  return (
    <Card title={title}>
      {count === 0 ? (
        <EmptyNote text="Aucune donnée de statut sur la période." />
      ) : (
        <div className="flex items-center gap-5 py-3">
          <div
            aria-label={`Répartition de ${numberFormatter.format(total)} candidatures`}
            className="grid size-32 shrink-0 place-items-center rounded-full"
            role="img"
            style={{ background: gradient }}
          >
            <div className="grid size-20 place-items-center rounded-full bg-white text-center">
              <strong className="text-xl text-[#111949]">
                {numberFormatter.format(total)}
              </strong>
              <span className="text-[10px] text-slate-500">Total</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2 text-[10px] text-slate-600">
            {ordered.map((item, index) => (
              <li key={item.label} className="flex items-center gap-2">
                <i
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <b className="whitespace-nowrap font-medium">
                  {numberFormatter.format(item.count)} (
                  {Math.round((item.count / safeTotal) * 100)} %)
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function RegionalDistribution({ regions }: { regions: CountByRegion[] }) {
  const ordered = [...regions].sort((left, right) => right.count - left.count);
  const max = Math.max(...ordered.map((item) => item.count), 1);

  return (
    <Card title="Candidatures par région">
      {ordered.length === 0 ? (
        <EmptyNote text="Aucune donnée régionale sur la période." />
      ) : (
        <div className="space-y-3">
          {ordered.map((item) => (
            <div key={item.region}>
              <div className="flex justify-between gap-3 text-[10px]">
                <span className="truncate font-bold text-[#34406b]">
                  {item.region}
                </span>
                <span className="shrink-0 text-slate-500">
                  {numberFormatter.format(item.count)}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div
                  className="h-1.5 rounded bg-violet-500"
                  style={{ width: `${Math.round((item.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SchoolProgrammeTable({ rows }: { rows: SchoolProgrammeCount[] }) {
  const ordered = [...rows].sort((left, right) => right.count - left.count);

  return (
    <Card title="Candidatures par établissement et programme">
      {ordered.length === 0 ? (
        <EmptyNote text="Aucun agrégat établissement-programme sur la période." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-2 py-2 font-semibold">
                  Établissement / programme
                </th>
                <th className="px-2 py-2 text-right font-semibold">
                  Candidatures
                </th>
                <th className="px-2 py-2 text-right font-semibold">
                  Acceptées
                </th>
                <th className="px-2 py-2 text-right font-semibold">
                  En attente
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <tr
                  key={`${row.school}-${row.filiere || ''}-${row.programme || ''}`}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-2 py-3">
                    <p className="font-bold text-[#28315e]">{row.school}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {[row.filiere, row.programme]
                        .filter(Boolean)
                        .join(' · ') || 'Programme non renseigné'}
                      {row.region ? ` · ${row.region}` : ''}
                    </p>
                  </td>
                  <td className="px-2 py-3 text-right font-semibold text-[#28315e]">
                    {numberFormatter.format(row.count)}
                  </td>
                  <td className="px-2 py-3 text-right text-emerald-700">
                    {numberFormatter.format(row.acceptedCount)}
                  </td>
                  <td className="px-2 py-3 text-right text-amber-700">
                    {numberFormatter.format(row.pendingCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EnrollmentSchoolProgrammeTable({
  rows,
}: {
  rows: EnrollmentBySchoolProgramme[];
}) {
  const ordered = [...rows].sort(
    (left, right) => right.enrolledCount - left.enrolledCount,
  );

  return (
    <Card title="Inscriptions par établissement et programme">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-2 py-2 font-semibold">
                Établissement / programme
              </th>
              <th className="px-2 py-2 text-right font-semibold">Inscrits</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr
                key={`${row.school}-${row.filiere || ''}-${row.programme || ''}`}
                className="border-b border-slate-50 last:border-0"
              >
                <td className="px-2 py-3">
                  <p className="font-bold text-[#28315e]">{row.school}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {[row.filiere, row.programme].filter(Boolean).join(' · ') ||
                      'Programme non renseigné'}
                    {row.region ? ` · ${row.region}` : ''}
                  </p>
                </td>
                <td className="px-2 py-3 text-right font-semibold text-[#28315e]">
                  {numberFormatter.format(row.enrolledCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-slate-400">{text}</p>;
}

function formatMonth(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? period
    : date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}
