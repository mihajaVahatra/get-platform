'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileCheck2,
  FileText,
  MapPinned,
  MessageSquare,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';

const activities: Array<[string, string, string, LucideIcon, string]> = [
  [
    'Nouvel établissement enregistré : IST Mahajanga',
    'Institut Supérieur de Technologie de Mahajanga',
    'Il y a 10 min',
    Building2,
    'violet',
  ],
  [
    '12 450 nouvelles inscriptions aujourd’hui',
    'Sur la plateforme GET',
    'Il y a 30 min',
    UserPlus,
    'blue',
  ],
  [
    'Paiement de 125 000 000 Ar reçu',
    'par BNI Madagascar',
    'Il y a 1 h',
    WalletCards,
    'green',
  ],
  [
    'Rapport mensuel généré',
    'Rapport national – Mai 2025',
    'Il y a 2 h',
    FileText,
    'blue',
  ],
  [
    'Mise à jour des données établissements',
    '156 établissements synchronisés',
    'Il y a 3 h',
    FileCheck2,
    'green',
  ],
];

const regions = [
  ['Analamanga', '42 561', '51,8%', 100],
  ['Vakinankaratra', '12 865', '15,7%', 53],
  ['Atsinanana', '8 745', '10,6%', 42],
  ['Atsimo-Andrefana', '6 321', '7,7%', 32],
  ['Diana', '4 521', '5,5%', 24],
  ['Autres régions', '7 132', '8,7%', 36],
] as const;

export function MinistryDashboard() {
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
        <div className="flex items-center gap-4">
          <button className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#34406b]">
            <CalendarDays className="size-4 text-violet-600" />
            01 mai – 31 mai 2025⌄
          </button>
          <span className="relative">
            <Bell className="size-5 text-[#17204e]" />
            <i className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] not-italic text-white">
              6
            </i>
          </span>
          <button className="hidden h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-4 text-xs font-bold text-white shadow-md shadow-violet-200 sm:flex">
            <Download className="size-4" />
            Exporter le rapport
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={UsersRound}
          tone="violet"
          label="Total étudiants"
          value="156 284"
          note="+8,5% vs avril 2025"
        />
        <Kpi
          icon={Building2}
          tone="blue"
          label="Établissements actifs"
          value="156"
          note="+2 nouveaux"
        />
        <Kpi
          icon={FileText}
          tone="green"
          label="Inscriptions totales"
          value="82 145"
          note="+12,2% vs avril 2025"
        />
        <Kpi
          icon={WalletCards}
          tone="orange"
          label="Revenus collectés"
          value="1 245 000 000 Ar"
          note="+15,4% vs avril 2025"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_0.92fr]">
        <LineChart />
        <Donut
          title="Répartition des inscriptions par filière"
          total="82 145"
          labels={[
            ['Sciences & Techniques', '28% (22 999)', 'bg-violet-600'],
            ['Sciences de l’ingénieur', '24% (19 727)', 'bg-emerald-500'],
            ['Économie & Gestion', '18% (14 783)', 'bg-orange-400'],
            ['Sciences Humaines', '16% (13 139)', 'bg-blue-500'],
            ['Santé', '8% (6 577)', 'bg-indigo-400'],
            ['Autres', '6% (4 920)', 'bg-slate-300'],
          ]}
          gradient="conic-gradient(#5b42e9 0 28%, #36c3a5 28% 52%, #ff9b27 52% 70%, #3998e9 70% 86%, #7682ed 86% 94%, #dce1ec 94% 100%)"
        />
        <Donut
          title="Inscriptions par statut"
          total="82 145"
          labels={[
            ['Validées', '50% (45 201)', 'bg-emerald-500'],
            ['En attente', '22% (18 102)', 'bg-orange-400'],
            ['En cours', '14% (11 483)', 'bg-blue-500'],
            ['Rejetées', '7% (6 519)', 'bg-rose-400'],
          ]}
          gradient="conic-gradient(#36c3a5 0 55%, #ff9b27 55% 77%, #3998e9 77% 91%, #f47070 91% 100%)"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr_0.92fr]">
        <Card
          title="Cartographie des inscriptions par région"
          action="Voir tout"
        >
          <div className="flex gap-4">
            <div className="grid h-44 w-28 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-50 via-indigo-100 to-violet-200 text-violet-600">
              <MapPinned className="size-12" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {regions.map(([region, value, share, width]) => (
                <div key={region}>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-bold text-[#34406b]">{region}</span>
                    <span className="text-slate-500">
                      {value} ({share})
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-slate-100">
                    <div
                      className="h-1.5 rounded bg-violet-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Activités récentes" action="Voir tout">
          <div className="space-y-1">
            {activities.map(([title, description, time, Icon, tone]) => (
              <div
                key={title}
                className="flex gap-3 border-b border-slate-100 py-2.5 last:border-0"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone === 'green' ? 'bg-emerald-50 text-emerald-600' : tone === 'blue' ? 'bg-blue-50 text-blue-500' : 'bg-violet-50 text-violet-600'}`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[#28315e]">
                    {title}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {description}
                  </p>
                </div>
                <span className="whitespace-nowrap text-[10px] text-slate-400">
                  {time}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Alertes & notifications" action="Voir tout">
          <div className="space-y-1">
            <Notice
              icon={AlertTriangle}
              tone="rose"
              title="12 inscriptions en attente de validation"
              text="Depuis plus de 48h"
            />
            <Notice
              icon={AlertTriangle}
              tone="blue"
              title="3 établissements n’ont pas encore transmis leurs résultats de concours"
              text="À relancer"
            />
            <Notice
              icon={CircleDollarSign}
              tone="rose"
              title="5 paiements échoués"
              text="À réessayer"
            />
            <Notice
              icon={MessageSquare}
              tone="blue"
              title="Campagne de bourses en cours"
              text="Date limite : 30 juin 2025"
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MiniTable
          title="Inscriptions & Admissions"
          columns={['Étudiant', 'Établissement', 'Filière', 'Statut']}
          rows={[
            ['Rasolonjato Tina', 'ENI', 'Informatique', 'Validée'],
            ['Rakotoarivelo Mamy', 'ISPM', 'Génie Civil', 'Validée'],
            ['Andriamialana Fanja', 'ESPA', 'Management', 'En attente'],
            ['Rabeharisoa Lia', 'IST', 'Électrotechnique', 'En cours'],
          ]}
        />
        <MiniTable
          title="Concours"
          columns={['Concours', 'Établissement', 'Candidats', 'Statut']}
          rows={[
            ['Concours ENI 2025', 'ENI', '2 450', 'Planifié'],
            ['Concours ISPM 2025', 'ISPM', '1 980', 'Planifié'],
            ['Concours ESPA 2025', 'ESPA', '2 860', 'En cours'],
            ['Concours IST 2025', 'IST', '1 620', 'Planifié'],
          ]}
        />
        <Card title="Paiements" action="Exporter">
          <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-3 text-center">
            <Metric label="Total collecté" value="1 245 000 000 Ar" />
            <Metric label="Transactions" value="18 750" />
            <Metric label="Échoués" value="245" tone="rose" />
          </div>
          <div className="mt-3 space-y-2">
            {[
              'TRX-2025-0001  ·  Mobile Money  ·  Réussi',
              'TRX-2025-0002  ·  Banque  ·  Réussi',
              'TRX-2025-0003  ·  Carte bancaire  ·  Échoué',
              'TRX-2025-0004  ·  Mobile Money  ·  Réussi',
            ].map((item) => (
              <p
                key={item}
                className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600"
              >
                {item}
              </p>
            ))}
          </div>
        </Card>
      </section>
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
      <p className="mt-3 text-[10px] font-semibold text-emerald-600">
        ↗ {note}
      </p>
    </article>
  );
}
function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-[#17204e]">{title}</h2>
        {action && (
          <button className="text-[10px] font-bold text-violet-600">
            {action}
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function LineChart() {
  const points = [27, 39, 51, 64, 65, 76, 86, 72, 84];
  return (
    <Card title="Évolution des inscriptions" action="6 derniers mois⌄">
      <div className="relative h-40 border-b border-l border-slate-100">
        <svg
          viewBox="0 0 400 160"
          className="absolute inset-0 size-full overflow-visible"
          preserveAspectRatio="none"
        >
          <polyline
            points={points
              .map((point, index) => `${index * 50},${150 - point * 1.35}`)
              .join(' ')}
            fill="none"
            stroke="#593bef"
            strokeWidth="3"
          />
          <polyline
            points={`0,150 ${points.map((point, index) => `${index * 50},${150 - point * 1.35}`).join(' ')} 400,150`}
            fill="url(#area)"
            opacity=".16"
          />
          <defs>
            <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#6144ef" />
              <stop offset="1" stopColor="#6144ef" stopOpacity="0" />
            </linearGradient>
          </defs>
          {points.map((point, index) => (
            <circle
              key={index}
              cx={index * 50}
              cy={150 - point * 1.35}
              r="3.5"
              fill="#593bef"
            />
          ))}
        </svg>
        <span className="absolute right-4 top-14 rounded-lg bg-white p-2 text-[10px] font-bold shadow-lg">
          Mai 2025
          <br />
          82 145 inscriptions
        </span>
      </div>
      <div className="mt-3 flex justify-between text-[9px] text-slate-500">
        <span>Déc. 2024</span>
        <span>Jan. 2025</span>
        <span>Fév. 2025</span>
        <span>Mars 2025</span>
        <span>Avr. 2025</span>
        <span>Mai 2025</span>
      </div>
    </Card>
  );
}
function Donut({
  title,
  total,
  labels,
  gradient,
}: {
  title: string;
  total: string;
  labels: string[][];
  gradient: string;
}) {
  return (
    <Card title={title} action="Voir tout">
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
          {labels.map(([name, value, color]) => (
            <li key={name} className="flex items-center gap-2">
              <i className={`size-2 shrink-0 rounded-full ${color}`} />
              <span className="flex-1">{name}</span>
              <b className="whitespace-nowrap font-medium">{value}</b>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
function Notice({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: LucideIcon;
  tone: 'rose' | 'blue';
  title: string;
  text: string;
}) {
  return (
    <button className="flex w-full items-center gap-3 border-b border-slate-100 py-2.5 text-left last:border-0">
      <span
        className={`grid size-8 place-items-center rounded-lg ${tone === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[11px] text-[#34406b]">{title}</b>
        <small className="text-[10px] text-slate-500">{text}</small>
      </span>
      <ChevronRight className="size-4 text-slate-400" />
    </button>
  );
}
function MiniTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <Card title={title} action="Exporter">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[390px] text-left text-[9px]">
          <thead className="border-b border-slate-100 text-slate-400">
            <tr>
              {columns.map((column) => (
                <th className="pb-2 font-semibold" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-slate-50" key={row[0]}>
                {row.map((cell, index) => (
                  <td
                    key={cell}
                    className={`py-2 ${index === 0 ? 'font-bold text-[#28315e]' : 'text-slate-600'}`}
                  >
                    {index === row.length - 1 ? (
                      <span
                        className={`rounded px-1.5 py-1 font-bold ${cell === 'Validée' || cell === 'Planifié' ? 'bg-emerald-50 text-emerald-600' : cell === 'En attente' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}
                      >
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function Metric({
  label,
  value,
  tone = 'violet',
}: {
  label: string;
  value: string;
  tone?: 'violet' | 'rose';
}) {
  return (
    <div>
      <p className="text-[9px] text-slate-500">{label}</p>
      <p
        className={`mt-1 text-sm font-extrabold ${tone === 'rose' ? 'text-rose-500' : 'text-violet-600'}`}
      >
        {value}
      </p>
    </div>
  );
}
