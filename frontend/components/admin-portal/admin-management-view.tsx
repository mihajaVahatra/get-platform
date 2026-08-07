'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { MfaSettingsCard } from '@/components/auth/MfaSettingsCard';
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building,
  CalendarDays,
  ChevronRight,
  Edit3,
  FileText,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';

export type AdminView =
  'schools' | 'users' | 'enrollments' | 'transactions' | 'reports' | 'settings';
type SchoolItem = {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
  type: string;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  isActive: boolean;
  _count: { enrolledStudents: number };
};
type UserAccount = {
  id: string;
  email: string;
  isActive: boolean;
  isVerified: boolean;
  lastLogin: string | null;
  createdAt: string;
  role: string | null;
  displayName: string | null;
  school: string | null;
};

export function AdminManagementView({ view }: { view: AdminView }) {
  if (view === 'schools') return <SchoolsDirectory />;
  if (view === 'users') return <UsersDirectory />;
  if (view === 'transactions') return <TransactionsDirectory />;
  if (view === 'enrollments') return <EnrollmentsDirectory />;
  if (view === 'reports') return <Reports />;
  return <SettingsView />;
}

function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

const PAGE_SIZE = 20;

function SchoolsDirectory() {
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<SchoolItem | null>(null);
  const [schoolToDeactivate, setSchoolToDeactivate] =
    useState<SchoolItem | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/schools', {
        params: { page, limit: PAGE_SIZE, search: search || undefined },
      });
      setSchools(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement établissements:', error);
      toast.error('Impossible de charger les établissements');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchSchools();
    });
    return () => {
      active = false;
    };
  }, [fetchSchools]);

  const deactivateSchool = async () => {
    if (!schoolToDeactivate) return;
    try {
      setDeactivating(true);
      await apiClient.delete(`/schools/${schoolToDeactivate.id}`);
      toast.success('Établissement désactivé');
      setSchoolToDeactivate(null);
      await fetchSchools();
    } catch (error: unknown) {
      toast.error(
        axiosMessage(error) || 'Impossible de désactiver cet établissement',
      );
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Établissements"
        subtitle="Gérez la liste de tous les établissements partenaires."
        action="Ajouter un établissement"
        onAction={() => {
          setSelected(null);
          setModal('create');
        }}
      />
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <label className="relative mb-6 block max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-indigo-500"
            maxLength={150}
            placeholder="Rechercher un établissement..."
          />
        </label>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des établissements...
          </p>
        ) : schools.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucun établissement ne correspond à cette recherche.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {schools.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Building className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {row.name}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {row.city || 'Ville non renseignée'} ·{' '}
                    {row.contactPhone ||
                      row.contactEmail ||
                      'Contact non renseigné'}{' '}
                    · {row._count.enrolledStudents} étudiant
                    {row._count.enrolledStudents > 1 ? 's' : ''} inscrit
                    {row._count.enrolledStudents > 1 ? 's' : ''}
                  </p>
                  <div className="mt-1.5">
                    <Status value={row.isActive ? 'Actif' : 'Inactif'} />
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-indigo-600">
                  <button
                    aria-label={`Modifier ${row.name}`}
                    onClick={() => {
                      setSelected(row);
                      setModal('edit');
                    }}
                  >
                    <Edit3 className="size-4" />
                  </button>
                  <button
                    aria-label={`Désactiver ${row.name}`}
                    className="text-red-500"
                    onClick={() => setSchoolToDeactivate(row)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total}{' '}
              établissement{meta.total > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4 rotate-180" />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </section>
      {modal && (
        <SchoolForm
          school={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void fetchSchools();
          }}
        />
      )}
      {schoolToDeactivate && (
        <ConfirmDialog
          title="Désactiver l’établissement"
          message={`Voulez-vous vraiment désactiver « ${schoolToDeactivate.name} » ? Il n’apparaîtra plus dans la liste des établissements actifs.`}
          confirmLabel={deactivating ? 'Désactivation...' : 'Désactiver'}
          disabled={deactivating}
          onCancel={() => setSchoolToDeactivate(null)}
          onConfirm={() => void deactivateSchool()}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="font-extrabold text-[#17204e]">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={disabled}
            className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const APPLICATION_STATUS_OPTIONS: [string, string][] = [
  ['PENDING', 'En attente'],
  ['TEST_SCHEDULED', 'Test programmé'],
  ['TEST_COMPLETED', 'Test complété'],
  ['INTERVIEW_SCHEDULED', 'Entretien programmé'],
  ['PRESELECTED', 'Présélectionné'],
  ['WAITLISTED', 'Liste d’attente'],
  ['ACCEPTED', 'Accepté'],
  ['REJECTED', 'Rejeté'],
];

type ApplicationRow = {
  id: string;
  status: string;
  submittedAt: string;
  studentName: string;
  offerTitle: string;
  school: string;
};

function EnrollmentsDirectory() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/applications', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          status: status || undefined,
        },
      });
      setApplications(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement inscriptions:', error);
      toast.error('Impossible de charger les inscriptions');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchApplications();
    });
    return () => {
      active = false;
    };
  }, [fetchApplications]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Inscriptions & Admissions"
        subtitle="Suivez et gérez les demandes d’inscription des étudiants."
      />
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-indigo-500"
              maxLength={150}
              placeholder="Rechercher un étudiant..."
            />
          </label>
          <UiSelect
            items={[
              { value: 'ALL', label: 'Tous les statuts' },
              ...APPLICATION_STATUS_OPTIONS.map(([value, label]) => ({ value, label })),
            ]}
            value={status || 'ALL'}
            onValueChange={(value) => {
              setStatus(!value || value === 'ALL' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {APPLICATION_STATUS_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </UiSelect>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des inscriptions...
          </p>
        ) : applications.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune inscription ne correspond à cette recherche.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {applications.map((application) => (
              <div
                key={application.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {application.studentName}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {application.offerTitle} · {application.school} ·{' '}
                    {new Date(application.submittedAt).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="mt-1.5">
                    <Status
                      value={
                        APPLICATION_STATUS_OPTIONS.find(([value]) => value === application.status)?.[1] ||
                        application.status
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} inscription
              {meta.total > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4 rotate-180" />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

type Transaction = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
  studentName: string;
  school: string | null;
};

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Réussie',
  PENDING: 'En attente',
  FAILED: 'Échouée',
  REFUNDED: 'Remboursée',
};

function TransactionsDirectory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/payments/admin', {
        params: { page, limit: PAGE_SIZE, status: status || undefined },
      });
      setTransactions(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
      toast.error('Impossible de charger les transactions');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchTransactions();
    });
    return () => {
      active = false;
    };
  }, [fetchTransactions]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Transactions"
        subtitle="Consultez toutes les transactions effectuées sur la plateforme."
      />
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-3">
          <UiSelect
            items={[
              { value: 'ALL', label: 'Tous les statuts' },
              { value: 'COMPLETED', label: 'Réussie' },
              { value: 'PENDING', label: 'En attente' },
              { value: 'FAILED', label: 'Échouée' },
              { value: 'REFUNDED', label: 'Remboursée' },
            ]}
            value={status || 'ALL'}
            onValueChange={(value) => {
              setStatus(!value || value === 'ALL' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              <SelectItem value="COMPLETED">Réussie</SelectItem>
              <SelectItem value="PENDING">En attente</SelectItem>
              <SelectItem value="FAILED">Échouée</SelectItem>
              <SelectItem value="REFUNDED">Remboursée</SelectItem>
            </SelectContent>
          </UiSelect>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des transactions...
          </p>
        ) : transactions.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune transaction ne correspond à ce filtre.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {transactions.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">{row.reference}</p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {row.studentName}
                    {row.school ? ` · ${row.school}` : ''} ·{' '}
                    {row.amount.toLocaleString('fr-FR')} {row.currency} · {row.method}
                  </p>
                  <div className="mt-1.5">
                    <Status value={TRANSACTION_STATUS_LABELS[row.status] || row.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} transaction
              {meta.total > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4 rotate-180" />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

function UsersDirectory() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleName, setRoleName] = useState('');
  const [loading, setLoading] = useState(true);
  const [toToggle, setToToggle] = useState<UserAccount | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          roleName: roleName || undefined,
        },
      });
      setUsers(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      toast.error('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleName]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchUsers();
    });
    return () => {
      active = false;
    };
  }, [fetchUsers]);

  const toggleActive = async () => {
    if (!toToggle) return;
    try {
      setToggling(true);
      await apiClient.patch(`/users/${toToggle.id}/status`, {
        isActive: !toToggle.isActive,
      });
      toast.success(toToggle.isActive ? 'Compte désactivé' : 'Compte activé');
      setToToggle(null);
      await fetchUsers();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible de modifier ce compte');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Utilisateurs"
        subtitle="Consultez et gérez les comptes des utilisateurs de la plateforme."
      />
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-indigo-500"
              maxLength={150}
              placeholder="Rechercher un email..."
            />
          </label>
          <UiSelect
            items={[
              { value: 'ALL', label: 'Tous les rôles' },
              { value: 'ADMIN_GET', label: 'Admin GET' },
              { value: 'SCHOOL_ADMIN', label: 'Admin école' },
              { value: 'TEACHER', label: 'Professeur' },
              { value: 'STUDENT', label: 'Étudiant' },
              { value: 'MINISTRY', label: 'Ministère' },
            ]}
            value={roleName || 'ALL'}
            onValueChange={(value) => {
              setRoleName(!value || value === 'ALL' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les rôles</SelectItem>
              <SelectItem value="ADMIN_GET">Admin GET</SelectItem>
              <SelectItem value="SCHOOL_ADMIN">Admin école</SelectItem>
              <SelectItem value="TEACHER">Professeur</SelectItem>
              <SelectItem value="STUDENT">Étudiant</SelectItem>
              <SelectItem value="MINISTRY">Ministère</SelectItem>
            </SelectContent>
          </UiSelect>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des utilisateurs...
          </p>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucun utilisateur ne correspond à cette recherche.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <UserRound className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {user.displayName || user.email}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {user.role || 'Sans rôle'} · {user.email}
                    {user.school ? ` · ${user.school}` : ''}
                  </p>
                  <div className="mt-1.5">
                    <Status value={user.isActive ? 'Actif' : 'Inactif'} />
                  </div>
                </div>
                <button
                  onClick={() => setToToggle(user)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-bold ${user.isActive ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {user.isActive ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} utilisateur
              {meta.total > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4 rotate-180" />
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </span>
          </div>
        )}
      </section>
      {toToggle && (
        <ConfirmDialog
          title={toToggle.isActive ? 'Désactiver le compte' : 'Activer le compte'}
          message={`Voulez-vous vraiment ${toToggle.isActive ? 'désactiver' : 'activer'} le compte « ${toToggle.displayName || toToggle.email} » ?`}
          confirmLabel={toggling ? 'Enregistrement...' : toToggle.isActive ? 'Désactiver' : 'Activer'}
          disabled={toggling}
          onCancel={() => setToToggle(null)}
          onConfirm={() => void toggleActive()}
        />
      )}
    </div>
  );
}
function PageHead({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-indigo-600">{subtitle}</p>
      </div>
      <div className="flex gap-3">
        <button className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#34406b]">
          <CalendarDays className="size-4 text-indigo-600" />
          01 mai – 31 mai 2025
        </button>
        {action && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200"
          >
            <Plus className="size-4" />
            {action}
          </button>
        )}
      </div>
    </header>
  );
}
function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-indigo-100 bg-[#fbfcff] shadow-[-18px_0_50px_rgba(29,24,88,0.14)] md:w-[calc(100%-15rem)]">
      <section className="mx-auto min-h-full max-w-[980px] p-6 sm:p-8">
        <header className="flex justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-indigo-600">
              {title.includes('utilisateur')
                ? 'Utilisateurs › Ajouter un utilisateur'
                : 'Établissements › Ajouter un établissement'}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#111949]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-9 place-items-center rounded-lg text-indigo-700 transition hover:bg-indigo-50"
          >
            <X className="size-5" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function SchoolForm({
  school,
  onClose,
  onSaved,
}: {
  school: SchoolItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(school?.name || '');
  const [type, setType] = useState(
    school?.type === 'PUBLIC' ? 'Public' : 'Privé',
  );
  const [city, setCity] = useState(school?.city || '');
  const [cities, setCities] = useState<string[]>([]);
  const [region, setRegion] = useState(school?.region || '');
  const [contactEmail, setContactEmail] = useState(school?.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(school?.contactPhone || '');
  const [website, setWebsite] = useState(school?.website || '');
  const [description, setDescription] = useState(school?.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get('/platform-cities')
      .then((response) =>
        setCities(
          (response.data.data as { name: string; isActive: boolean }[])
            .filter((item) => item.isActive)
            .map((item) => item.name),
        ),
      )
      .catch(() => setCities([]));
  }, []);

  const submit = async () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      type: type === 'Public' ? 'PUBLIC' : 'PRIVATE',
      city: city.trim() || undefined,
      region: region.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      website: website.trim() || undefined,
      description: description.trim() || undefined,
    };
    try {
      setSaving(true);
      if (school) await apiClient.put(`/schools/${school.id}`, payload);
      else await apiClient.post('/schools', payload);
      toast.success(school ? 'Établissement mis à jour' : 'Établissement créé');
      onSaved();
    } catch (error: unknown) {
      toast.error(
        axiosMessage(error) ||
          (school
            ? 'Impossible de mettre à jour cet établissement'
            : 'Impossible de créer cet établissement'),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={school ? 'Modifier l’établissement' : 'Ajouter un établissement'}
      subtitle={
        school
          ? 'Mettez à jour les informations de cet établissement'
          : 'Enregistrez un nouvel établissement sur la plateforme'
      }
      onClose={onClose}
    >
      <div className="mt-6 space-y-5">
        <FormBox icon={Building} title="Informations générales">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nom de l’établissement *"
              value={name}
              onChange={setName}
              placeholder="Entrez le nom complet de l’établissement"
            />
            <Select
              label="Type d’établissement *"
              value={type}
              onChange={setType}
              options={['Public', 'Privé']}
            />
            <Select
              label="Ville"
              value={city}
              onChange={setCity}
              options={cities}
            />
            <Input
              label="Région"
              value={region}
              onChange={setRegion}
              placeholder="Ex : Analamanga"
            />
            <Input
              label="Téléphone"
              value={contactPhone}
              onChange={setContactPhone}
              placeholder="+261 20 22 222 22"
              maxLength={30}
            />
            <Input
              label="Email officiel"
              value={contactEmail}
              onChange={setContactEmail}
              placeholder="contact@etablissement.mg"
              type="email"
              maxLength={254}
            />
            <Input
              label="Site web"
              value={website}
              onChange={setWebsite}
              placeholder="https://www.exemple.mg"
              type="url"
              maxLength={300}
            />
            <Input
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Présentez brièvement l’établissement..."
              wide
              multiline
              maxLength={2000}
            />
          </div>
        </FormBox>
      </div>
      <Footer
        onClose={onClose}
        onSave={() => void submit()}
        label={
          saving
            ? 'Enregistrement...'
            : school
              ? 'Mettre à jour'
              : 'Enregistrer l’établissement'
        }
        icon={Building}
      />
    </Modal>
  );
}
function FormBox({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4">
      <h3 className="flex items-center gap-2 font-extrabold text-[#17204e]">
        <Icon className="size-5 text-indigo-600" />
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Input({
  label,
  value,
  onChange,
  placeholder,
  wide = false,
  multiline = false,
  maxLength = 150,
  type = 'text',
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  wide?: boolean;
  multiline?: boolean;
  maxLength?: number;
  type?: string;
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : ''}>
      <span className="mb-1.5 block text-xs font-bold text-[#34406b]">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-indigo-500"
        />
      ) : (
        <input
          value={value}
          type={type}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500"
        />
      )}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options = ['Administrateur', 'Gestionnaire', 'Validateur'],
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  options?: string[];
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-[#34406b]">
        {label}
      </span>
      <UiSelect value={value} onValueChange={(next) => onChange?.(next ?? '')}>
        <SelectTrigger className="h-10 w-full text-xs text-slate-500">
          <SelectValue placeholder="Sélectionnez une option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </UiSelect>
    </div>
  );
}
function Footer({
  onClose,
  onSave,
  label,
  icon: Icon,
}: {
  onClose: () => void;
  onSave: () => void;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <footer className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button
        onClick={onClose}
        className="rounded-lg border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600"
      >
        Annuler
      </button>
      <button
        onClick={onSave}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 px-5 py-2.5 text-xs font-bold text-white"
      >
        <Icon className="size-4" />
        {label}
      </button>
    </footer>
  );
}
const APPLICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  TEST_SCHEDULED: 'Test programmé',
  TEST_COMPLETED: 'Test complété',
  INTERVIEW_SCHEDULED: 'Entretien programmé',
  PRESELECTED: 'Présélectionné',
  WAITLISTED: 'Liste d’attente',
  ACCEPTED: 'Accepté',
  REJECTED: 'Rejeté',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement bancaire',
  MVOLA: 'MVola',
  ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money',
};

type PaymentStats = {
  totalTransactions: number;
  totalAmount: number;
  byStatus: { status: string; count: number }[];
  byMethod: { method: string; count: number }[];
};
type ApplicationStats = {
  total: number;
  byStatus: { status: string; count: number }[];
};

function Reports() {
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [applicationStats, setApplicationStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const [paymentsRes, applicationsRes] = await Promise.all([
          apiClient.get('/payments/stats'),
          apiClient.get('/applications/stats'),
        ]);
        if (!active) return;
        setPaymentStats(paymentsRes.data.data);
        setApplicationStats(applicationsRes.data.data);
      } catch (error) {
        console.error('Erreur chargement rapports:', error);
        toast.error('Impossible de charger les rapports');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !paymentStats || !applicationStats) {
    return (
      <div className="mx-auto max-w-[1500px]">
        <PageHead
          title="Rapports & Statistiques"
          subtitle="Analysez les performances de la plateforme."
        />
        <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
      </div>
    );
  }

  const accepted = applicationStats.byStatus.find((s) => s.status === 'ACCEPTED')?.count || 0;
  const successRate = applicationStats.total
    ? ((accepted / applicationStats.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Rapports & Statistiques"
        subtitle="Analysez les performances de la plateforme."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Candidatures par statut">
          <Bars
            items={applicationStats.byStatus.map(
              (row) => [APPLICATION_STATUS_LABELS[row.status] || row.status, row.count] as [string, number],
            )}
          />
        </Card>
        <Card title="Paiements par méthode">
          {paymentStats.byMethod.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun paiement effectué pour le moment.</p>
          ) : (
            <Bars
              items={paymentStats.byMethod.map(
                (row) => [PAYMENT_METHOD_LABELS[row.method] || row.method, row.count] as [string, number],
              )}
            />
          )}
        </Card>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Stat
          icon={WalletCards}
          label="Revenus totaux (paiements réussis)"
          value={`${paymentStats.totalAmount.toLocaleString('fr-FR')} Ar`}
        />
        <Stat
          icon={FileText}
          label="Transactions totales"
          value={String(paymentStats.totalTransactions)}
        />
        <Stat
          icon={ShieldCheck}
          label="Taux d’acceptation des candidatures"
          value={`${successRate}%`}
        />
      </div>
    </div>
  );
}
type PlatformSettings = {
  platformName: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
};

function SettingsView() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await apiClient.get('/settings');
        if (active) setSettings(response.data.data);
      } catch (error) {
        console.error('Erreur chargement paramètres:', error);
        toast.error('Impossible de charger les paramètres');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const response = await apiClient.put('/settings', settings);
      setSettings(response.data.data);
      toast.success('Paramètres enregistrés');
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || "Impossible d'enregistrer les paramètres");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="mx-auto max-w-[1500px]">
        <PageHead title="Paramètres" subtitle="Gérez les paramètres généraux de la plateforme." />
        <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Paramètres"
        subtitle="Gérez les paramètres généraux de la plateforme."
      />
      <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-[#17204e]">Informations générales</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input
            label="Nom de la plateforme"
            value={settings.platformName}
            onChange={(value) => setSettings({ ...settings, platformName: value })}
            placeholder="GET – Grandes Écoles de Tananarive"
            wide
          />
          <Input
            label="Email de contact"
            value={settings.contactEmail}
            onChange={(value) => setSettings({ ...settings, contactEmail: value })}
            placeholder="contact@get.mg"
            type="email"
            maxLength={254}
          />
          <Input
            label="Téléphone"
            value={settings.contactPhone}
            onChange={(value) => setSettings({ ...settings, contactPhone: value })}
            placeholder="+261 34 12 345 67"
            maxLength={30}
          />
          <Input
            label="Adresse"
            value={settings.address}
            onChange={(value) => setSettings({ ...settings, address: value })}
            placeholder="Lot II 4B, Antananarivo, Madagascar"
            wide
          />
        </div>
        <Footer
          onClose={() => undefined}
          onSave={() => void save()}
          label={saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          icon={Settings}
        />
      </section>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <PlatformCitiesSection />
        <FeeBracketsSection />
      </div>
      <div className="mt-4">
        <MfaSettingsCard />
      </div>
    </div>
  );
}

type PlatformCityItem = { id: string; name: string; isActive: boolean };

function PlatformCitiesSection() {
  const [cities, setCities] = useState<PlatformCityItem[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await apiClient.get('/platform-cities');
      setCities(response.data.data);
    } catch (error) {
      console.error('Erreur chargement villes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const addCity = async () => {
    if (!name.trim()) return toast.error('Le nom de la ville est obligatoire');
    try {
      await apiClient.post('/platform-cities', { name: name.trim() });
      setName('');
      await refresh();
      toast.success('Ville ajoutée');
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || "Impossible d'ajouter cette ville");
    }
  };

  const toggleCity = async (city: PlatformCityItem) => {
    try {
      await apiClient.patch(`/platform-cities/${city.id}`, {
        isActive: !city.isActive,
      });
      await refresh();
    } catch {
      toast.error('Impossible de modifier cette ville');
    }
  };

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-[#17204e]">Villes</h2>
      <p className="mt-1 text-xs text-slate-500">
        Utilisées pour la ville des établissements et le filtre de recherche
        d’offres.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          placeholder="Ex. Antsirabe"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={() => void addCity()}
          className="shrink-0 rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 px-4 text-xs font-bold text-white"
        >
          Ajouter
        </button>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        {loading ? (
          <p className="text-slate-500">Chargement...</p>
        ) : cities.length === 0 ? (
          <p className="text-slate-500">Aucune ville configurée.</p>
        ) : (
          cities.map((city) => (
            <div
              key={city.id}
              className="flex items-center justify-between rounded-lg border border-slate-50 p-2.5"
            >
              <span className={city.isActive ? '' : 'text-slate-400 line-through'}>
                {city.name}
              </span>
              <button
                type="button"
                onClick={() => void toggleCity(city)}
                className="font-bold text-indigo-600"
              >
                {city.isActive ? 'Désactiver' : 'Réactiver'}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type FeeBracketItem = {
  id: string;
  label: string;
  minFees: number;
  maxFees: number | null;
  isActive: boolean;
};

function FeeBracketsSection() {
  const [brackets, setBrackets] = useState<FeeBracketItem[]>([]);
  const [label, setLabel] = useState('');
  const [minFees, setMinFees] = useState('');
  const [maxFees, setMaxFees] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await apiClient.get('/fee-brackets');
      setBrackets(response.data.data);
    } catch (error) {
      console.error('Erreur chargement tranches de frais:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const addBracket = async () => {
    if (!label.trim() || !minFees) {
      return toast.error('Le libellé et le montant minimum sont obligatoires');
    }
    try {
      await apiClient.post('/fee-brackets', {
        label: label.trim(),
        minFees: Number(minFees),
        maxFees: maxFees ? Number(maxFees) : undefined,
      });
      setLabel('');
      setMinFees('');
      setMaxFees('');
      await refresh();
      toast.success('Tranche de frais ajoutée');
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || "Impossible d'ajouter cette tranche");
    }
  };

  const toggleBracket = async (bracket: FeeBracketItem) => {
    try {
      await apiClient.patch(`/fee-brackets/${bracket.id}`, {
        isActive: !bracket.isActive,
      });
      await refresh();
    } catch {
      toast.error('Impossible de modifier cette tranche');
    }
  };

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-[#17204e]">Tranches de frais</h2>
      <p className="mt-1 text-xs text-slate-500">
        Utilisées pour le filtre de frais de la recherche d’offres.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={60}
          placeholder="Libellé"
          className="col-span-3 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500 sm:col-span-1"
        />
        <input
          type="number"
          min={0}
          max={999999999}
          value={minFees}
          onChange={(event) => setMinFees(event.target.value.slice(0, 9))}
          placeholder="Min (Ar)"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500"
        />
        <input
          type="number"
          min={0}
          max={999999999}
          value={maxFees}
          onChange={(event) => setMaxFees(event.target.value.slice(0, 9))}
          placeholder="Max (Ar, facultatif)"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => void addBracket()}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 px-4 py-2 text-xs font-bold text-white"
        >
          Ajouter
        </button>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        {loading ? (
          <p className="text-slate-500">Chargement...</p>
        ) : brackets.length === 0 ? (
          <p className="text-slate-500">Aucune tranche configurée.</p>
        ) : (
          brackets.map((bracket) => (
            <div
              key={bracket.id}
              className="flex items-center justify-between rounded-lg border border-slate-50 p-2.5"
            >
              <span className={bracket.isActive ? '' : 'text-slate-400 line-through'}>
                {bracket.label}
              </span>
              <button
                type="button"
                onClick={() => void toggleBracket(bracket)}
                className="font-bold text-indigo-600"
              >
                {bracket.isActive ? 'Désactiver' : 'Réactiver'}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
function Bars({ items }: { items: Array<[string, number]> }) {
  const largest = Math.max(...items.map(([, value]) => value));
  return (
    <div className="space-y-5">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-28 text-xs text-slate-600">{label}</span>
          <div className="h-2 flex-1 rounded bg-slate-100">
            <div
              className="h-2 rounded bg-indigo-600"
              style={{ width: `${(value / largest) * 100}%` }}
            />
          </div>
          <b className="text-xs text-[#34406b]">
            {value.toLocaleString('fr-FR')}
          </b>
        </div>
      ))}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <Icon className="size-6 text-indigo-600" />
      <p className="mt-4 text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#17204e]">{value}</p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`rounded px-2 py-1 text-[10px] font-bold ${value === 'Actif' || value === 'Validée' || value === 'Réussie' ? 'bg-emerald-50 text-emerald-600' : value === 'Échouée' ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-500'}`}
    >
      {value}
    </span>
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
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-[#17204e]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
