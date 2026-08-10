'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Award,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Concours d'entrée organisé par un établissement, tel que renvoyé par l'API. */
type CompetitionItem = {
  id: string;
  name: string;
  description?: string | null;
  schoolId: string;
  school: { id: string; name: string };
  programId?: string | null;
  program?: { id: string; name: string } | null;
  examDate?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  status: string;
  isActive: boolean;
};

/** Option simplifiée pour le filtre/formulaire de sélection d'école. */
type SchoolOption = { id: string; name: string };

/** Libellés français des statuts de concours. */
const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planifié',
  OPEN: 'Inscriptions ouvertes',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

/** Classes Tailwind (fond/texte) associées à chaque statut de concours pour le badge. */
const STATUS_STYLES: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-600',
  OPEN: 'bg-emerald-50 text-emerald-600',
  IN_PROGRESS: 'bg-orange-50 text-orange-500',
  COMPLETED: 'bg-indigo-50 text-indigo-600',
  CANCELLED: 'bg-rose-50 text-rose-600',
};

/** Formate une date ISO en date longue localisée en français, ou `null` si absente. */
const dateOf = (date?: string | null) =>
  date
    ? new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(date))
    : null;

/** Extrait le message d'erreur métier renvoyé par l'API (format axios), s'il existe. */
function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

/** Nombre de concours chargés par page. */
const PAGE_SIZE = 20;

/**
 * Écran d'administration des concours d'entrée organisés par les
 * établissements : liste paginée avec recherche, création, édition et
 * suppression.
 */
export function CompetitionsManager() {
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<CompetitionItem | null>(null);
  const [toDelete, setToDelete] = useState<CompetitionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Charge une page de concours (`GET /competitions`), filtrée par recherche texte si renseignée. */
  const fetchCompetitions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/competitions', {
        params: { page, limit: PAGE_SIZE, search: search || undefined },
      });
      setCompetitions(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement concours:', error);
      toast.error('Impossible de charger les concours');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchCompetitions();
    });
    return () => {
      active = false;
    };
  }, [fetchCompetitions]);

  // Charge la liste des écoles une seule fois au montage pour alimenter le formulaire.
  useEffect(() => {
    let active = true;
    apiClient
      .get('/schools', { params: { page: 1, limit: 100 } })
      .then((response) => {
        if (active) setSchools(response.data.data || []);
      })
      .catch((error) => console.error('Erreur chargement écoles:', error));
    return () => {
      active = false;
    };
  }, []);

  /** Supprime le concours sélectionné (`toDelete`) puis rafraîchit la liste. */
  const removeCompetition = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/competitions/${toDelete.id}`);
      toast.success('Concours supprimé');
      setToDelete(null);
      await fetchCompetitions();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer ce concours');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Concours
          </h1>
          <p className="mt-1 text-sm text-indigo-600">
            Gérez les concours d’entrée organisés par les établissements.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setModal('create');
          }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-teal-400 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200"
        >
          <Plus className="size-4" />
          Ajouter un concours
        </button>
      </header>
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
            placeholder="Rechercher un concours..."
          />
        </label>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des concours...
          </p>
        ) : competitions.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucun concours ne correspond à cette recherche.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {competitions.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Award className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {row.name}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {row.school.name}
                    {row.examDate ? ` · Examen le ${dateOf(row.examDate)}` : ''}
                    {row.capacity ? ` · ${row.capacity} places` : ''}
                  </p>
                  <div className="mt-1.5">
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[row.status] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {STATUS_LABELS[row.status] || row.status}
                    </span>
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
                    aria-label={`Supprimer ${row.name}`}
                    className="text-red-500"
                    onClick={() => setToDelete(row)}
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
              Page {meta.page} sur {meta.totalPages} · {meta.total} concours
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
        <CompetitionForm
          competition={modal === 'edit' ? selected : null}
          schools={schools}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void fetchCompetitions();
          }}
        />
      )}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="font-extrabold text-[#17204e]">
              Supprimer le concours
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Voulez-vous vraiment supprimer « {toDelete.name} » ? Cette action
              est irréversible.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={() => void removeCompetition()}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Modale de création/édition d'un concours.
 * @param competition Concours à éditer, ou `null` pour créer un nouveau concours.
 * @param schools Liste des écoles disponibles pour le sélecteur d'établissement.
 * @param onClose Ferme la modale sans sauvegarder.
 * @param onSaved Appelé après une création/mise à jour réussie (déclenche le rechargement de la liste côté parent).
 */
function CompetitionForm({
  competition,
  schools,
  onClose,
  onSaved,
}: {
  competition: CompetitionItem | null;
  schools: SchoolOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(competition?.name || '');
  const [description, setDescription] = useState(
    competition?.description || '',
  );
  const [schoolId, setSchoolId] = useState(
    competition?.schoolId || schools[0]?.id || '',
  );
  const [examDate, setExamDate] = useState(
    competition?.examDate ? competition.examDate.slice(0, 10) : '',
  );
  const [registrationDeadline, setRegistrationDeadline] = useState(
    competition?.registrationDeadline
      ? competition.registrationDeadline.slice(0, 10)
      : '',
  );
  const [capacity, setCapacity] = useState(
    competition?.capacity != null ? String(competition.capacity) : '',
  );
  const [status, setStatus] = useState(competition?.status || 'PLANNED');
  const [saving, setSaving] = useState(false);

  /** Valide et envoie le formulaire : création (`POST`) ou mise à jour (`PATCH`) selon la présence de `competition`. */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !schoolId) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      schoolId,
      examDate: examDate || undefined,
      registrationDeadline: registrationDeadline || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      status,
    };
    try {
      setSaving(true);
      if (competition) {
        await apiClient.patch(`/competitions/${competition.id}`, payload);
        toast.success('Concours mis à jour');
      } else {
        await apiClient.post('/competitions', payload);
        toast.success('Concours créé');
      }
      onSaved();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer ce concours');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="font-extrabold text-[#17204e]">
          {competition ? 'Modifier le concours' : 'Nouveau concours'}
        </h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-xs font-bold text-[#34406b]">
            Nom du concours
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              required
              placeholder="Ex. Concours ENI 2026"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
            />
          </label>
          <div className="block text-xs font-bold text-[#34406b]">
            Établissement
            <Select
              items={schools.map((school) => ({ value: school.id, label: school.name }))}
              value={schoolId}
              onValueChange={(value) => setSchoolId(value ?? '')}
              required
            >
              <SelectTrigger className="mt-1.5 h-10 w-full font-normal">
                <SelectValue placeholder="Sélectionner un établissement" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="block text-xs font-bold text-[#34406b]">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Détails du concours..."
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm font-normal outline-none focus:border-indigo-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-[#34406b]">
              Date d’examen
              <input
                type="date"
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-xs font-bold text-[#34406b]">
              Fin des inscriptions
              <input
                type="date"
                value={registrationDeadline}
                onChange={(event) => setRegistrationDeadline(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-[#34406b]">
              Capacité
              <input
                type="number"
                min={0}
                max={100000}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value.slice(0, 6))}
                placeholder="Ex. 200"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-indigo-500"
              />
            </label>
            <div className="block text-xs font-bold text-[#34406b]">
              Statut
              <Select
                items={Object.entries(STATUS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={status}
                onValueChange={(value) => setStatus(value ?? 'PLANNED')}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full font-normal">
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
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
