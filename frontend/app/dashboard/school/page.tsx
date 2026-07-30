'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  Clock3Icon,
  CreditCardIcon,
  GraduationCapIcon,
  Layers3Icon,
  XCircleIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type SchoolStats = {
  totalOffers: number;
  openOffers: number;
  totalApplications: number;
  pendingApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
};

type PaymentSummary = {
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  completedAmount: number;
};

type SchoolPayment = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  student: { firstName: string; lastName: string; user: { email: string } };
  application: { offer: { title: string } } | null;
};

type PaymentsResponse = {
  summary: PaymentSummary;
  payments: SchoolPayment[];
};

export default function SchoolDashboardPage() {
  const [stats, setStats] = useState<SchoolStats | null>(null);
  const [payments, setPayments] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const [statsResponse, paymentsResponse] = await Promise.all([
          apiClient.get('/schools/me/stats'),
          apiClient.get('/schools/me/payments?limit=5'),
        ]);
        const receivedStats = statsResponse.data.data as SchoolStats | undefined;
        const receivedPayments = paymentsResponse.data.data as PaymentsResponse | undefined;
        if (!receivedStats) throw new Error('Statistiques absentes de la réponse');
        if (!receivedPayments) throw new Error('Paiements absents de la réponse');
        if (!cancelled) {
          setStats(receivedStats);
          setPayments(receivedPayments);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement statistiques école:', error);
          toast.error('Impossible de charger les statistiques de l’école');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="flex justify-center p-8">Chargement des statistiques...</div>;
  }

  if (!stats || !payments) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <p className="text-slate-500">Les statistiques sont indisponibles pour le moment.</p>
      </div>
    );
  }

  const acceptanceRate = stats.totalApplications
    ? Math.round((stats.acceptedApplications / stats.totalApplications) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">Tableau de bord</h1>
        <p className="mt-1 text-sm text-violet-600">Pilotage de vos offres et candidatures en temps réel.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={Layers3Icon} tone="violet" label="Offres publiées" value={stats.totalOffers} detail={`${stats.openOffers} actuellement ouverte(s)`} />
        <Kpi icon={ClipboardListIcon} tone="blue" label="Candidatures reçues" value={stats.totalApplications} detail={`${stats.pendingApplications} à traiter`} />
        <Kpi icon={CheckCircle2Icon} tone="green" label="Candidatures acceptées" value={stats.acceptedApplications} detail={`Taux d’acceptation : ${acceptanceRate} %`} />
        <Kpi icon={Clock3Icon} tone="orange" label="Candidatures en attente" value={stats.pendingApplications} detail="À traiter" />
        <Kpi icon={XCircleIcon} tone="rose" label="Candidatures refusées" value={stats.rejectedApplications} detail="Décision enregistrée" />
        <Kpi icon={CreditCardIcon} tone="violet" label="Paiements reçus" value={payments.summary.completedPayments} detail={`${formatCurrency(payments.summary.completedAmount)} encaissés`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-[#17204e]">Accès rapides</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/dashboard/school/offers" className="rounded-lg border border-violet-100 bg-violet-50 p-4 transition hover:bg-violet-100">
              <Layers3Icon className="size-5 text-violet-600" />
              <p className="mt-3 font-semibold text-[#28315e]">Gérer les offres</p>
              <p className="mt-1 text-sm text-slate-500">Créer, modifier ou fermer une offre.</p>
            </Link>
            <Link href="/dashboard/school/applications" className="rounded-lg border border-violet-100 bg-violet-50 p-4 transition hover:bg-violet-100">
              <ClipboardListIcon className="size-5 text-violet-600" />
              <p className="mt-3 font-semibold text-[#28315e]">Traiter les candidatures</p>
              <p className="mt-1 text-sm text-slate-500">Consulter les dossiers et faire avancer leur statut.</p>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-[#17204e]">Paiements des candidatures</h2>
              <p className="mt-1 text-sm text-slate-500">{payments.summary.pendingPayments} en attente · {payments.summary.failedPayments} échoué(s)</p>
            </div>
            <CreditCardIcon className="size-6 text-violet-600" />
          </div>
          <div className="mt-4 space-y-3">
            {payments.payments.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun paiement lié à vos candidatures.</p>
            ) : payments.payments.map((payment) => (
              <div key={payment.id} className="border-t border-slate-100 pt-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#28315e]">{payment.student.firstName} {payment.student.lastName}</p>
                  <PaymentStatus status={payment.status} />
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{payment.application?.offer.title ?? 'Candidature'} · {payment.student.user.email}</p>
                <p className="mt-1 text-xs font-medium text-slate-600">{formatCurrency(payment.amount, payment.currency)} · {payment.method}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
        <GraduationCapIcon className="size-6 text-slate-400" />
        <h2 className="mt-3 font-extrabold text-[#17204e]">Statistiques à venir</h2>
        <p className="mt-2 text-sm text-slate-500">Les données sur les étudiants inscrits, cours et professeurs seront affichées lorsqu’un endpoint dédié sera disponible.</p>
      </section>
    </div>
  );
}

function formatCurrency(amount: number, currency = 'MGA') {
  return new Intl.NumberFormat('fr-MG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function PaymentStatus({ status }: { status: string }) {
  const labels: Record<string, string> = { COMPLETED: 'Payé', PENDING: 'En attente', PROCESSING: 'En cours', FAILED: 'Échoué' };
  const tones: Record<string, string> = { COMPLETED: 'bg-emerald-50 text-emerald-700', PENDING: 'bg-amber-50 text-amber-700', PROCESSING: 'bg-blue-50 text-blue-700', FAILED: 'bg-rose-50 text-rose-700' };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tones[status] ?? 'bg-slate-100 text-slate-600'}`}>{labels[status] ?? status}</span>;
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  tone: 'violet' | 'green' | 'blue' | 'orange' | 'rose';
  label: string;
  value: number;
  detail: string;
}) {
  const tones = {
    violet: 'bg-violet-100 text-violet-600',
    green: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-500',
    orange: 'bg-orange-100 text-orange-500',
    rose: 'bg-rose-100 text-rose-500',
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <span className={`grid size-12 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold text-[#28315e]">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-[#111949]">{value.toLocaleString('fr-FR')}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  );
}
