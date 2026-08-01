'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Payment = {
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

type Summary = {
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  completedAmount: number;
};
const PAGE_SIZE = 10;
const STATUS_LABELS: Record<string, string> = {
  ALL: 'Tous les statuts',
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  COMPLETED: 'Payé',
  FAILED: 'Échoué',
};
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
};

export default function SchoolPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadPayments = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (status !== 'ALL') params.set('status', status);
        const response = await apiClient.get(
          `/schools/me/payments?${params.toString()}`,
        );
        if (cancelled) return;
        setPayments(response.data.data?.payments || []);
        setSummary(response.data.data?.summary || null);
        setTotal(response.data.meta?.total || 0);
        setTotalPages(response.data.meta?.totalPages || 1);
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur chargement paiements:', error);
          toast.error('Impossible de charger les paiements');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadPayments();
    return () => {
      cancelled = true;
    };
  }, [page, status]);

  const selectStatus = (value: string) => {
    setLoading(true);
    setPage(1);
    setStatus(value);
  };
  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  const formatDate = (date: string | null) =>
    date
      ? new Date(date).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Paiements des candidatures
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Suivez les règlements liés aux candidats de votre établissement.
          </p>
        </div>
        <Select
          items={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          value={status}
          onValueChange={(value) => selectStatus(value ?? 'ALL')}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>
      {summary && (
        <section className="grid gap-3 sm:grid-cols-4">
          <Metric label="Total" value={summary.totalPayments} />
          <Metric label="Payés" value={summary.completedPayments} />
          <Metric label="En attente" value={summary.pendingPayments} />
          <Metric
            label="Montant encaissé"
            value={formatAmount(summary.completedAmount, 'MGA')}
          />
        </section>
      )}
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Chargement des paiements...
            </p>
          ) : payments.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Aucun paiement ne correspond à ce filtre.
            </p>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {payment.student.firstName} {payment.student.lastName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {payment.student.user.email}
                      </p>
                    </div>
                    <Badge
                      className={
                        STATUS_STYLES[payment.status] ??
                        'bg-slate-100 text-slate-700'
                      }
                    >
                      {STATUS_LABELS[payment.status] ?? payment.status}
                    </Badge>
                  </div>
                  <p className="mt-2 truncate text-xs text-slate-500">
                    {payment.application?.offer.title ?? 'Candidature'}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {formatAmount(payment.amount, payment.currency)} ·{' '}
                      {payment.method}
                    </span>
                    <span className="text-slate-400">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && totalPages > 1 && (
            <Pagination className="mt-5">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={
                      page === 1 ? 'pointer-events-none opacity-50' : ''
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) {
                        setLoading(true);
                        setPage(page - 1);
                      }
                    }}
                  />
                </PaginationItem>
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === page}
                      onClick={(event) => {
                        event.preventDefault();
                        setLoading(true);
                        setPage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={
                      page === totalPages
                        ? 'pointer-events-none opacity-50'
                        : ''
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < totalPages) {
                        setLoading(true);
                        setPage(page + 1);
                      }
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">
        {total} paiement(s) dans le périmètre de votre établissement. Les
        références et données techniques du fournisseur ne sont pas affichées.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-extrabold text-[#111949]">
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
        </p>
      </CardContent>
    </Card>
  );
}
