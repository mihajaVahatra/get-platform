'use client';

import { useCallback, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AuditLog = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  user?: { email: string; role?: { name: string } | null } | null;
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  REGISTER: 'Inscription',
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  VIEW: 'Consultation',
  PAYMENT: 'Paiement',
  EXPORT: 'Export',
  IMPORT: 'Import',
};

const RESOURCE_LABELS: Record<string, string> = {
  user: 'Utilisateur',
  student: 'Étudiant',
  school: 'École',
  offer: 'Offre',
  application: 'Candidature',
  payment: 'Paiement',
  report: 'Rapport',
  notification: 'Notification',
  system: 'Système',
};

const dateOf = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

const PAGE_SIZE = 30;

export function ActivityLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/audit', {
        params: {
          page,
          limit: PAGE_SIZE,
          resource: resource || undefined,
          action: action || undefined,
        },
      });
      setLogs(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement journal d’activité:', error);
      toast.error('Impossible de charger le journal d’activité');
    } finally {
      setLoading(false);
    }
  }, [page, resource, action]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchLogs();
    });
    return () => {
      active = false;
    };
  }, [fetchLogs]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Journal d’activité
        </h1>
        <p className="mt-1 text-sm text-indigo-600">
          Historique des actions effectuées sur la plateforme.
        </p>
      </header>
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-3">
          <Select
            items={[
              { value: 'ALL', label: 'Toutes les ressources' },
              ...Object.entries(RESOURCE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
            value={resource || 'ALL'}
            onValueChange={(value) => {
              setResource(!value || value === 'ALL' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les ressources</SelectItem>
              {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={[
              { value: 'ALL', label: 'Toutes les actions' },
              ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
            ]}
            value={action || 'ALL'}
            onValueChange={(value) => {
              setAction(!value || value === 'ALL' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les actions</SelectItem>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement du journal...
          </p>
        ) : logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune activité ne correspond à ces filtres.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <ScrollText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {ACTION_LABELS[log.action] || log.action} ·{' '}
                    {RESOURCE_LABELS[log.resource] || log.resource}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {log.user?.email || 'Système'} · {dateOf(log.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${
                    log.status === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {log.status === 'SUCCESS' ? 'Réussie' : 'Échouée'}
                </span>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} entrée
              {meta.total > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
              >
                Suivant
              </button>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
