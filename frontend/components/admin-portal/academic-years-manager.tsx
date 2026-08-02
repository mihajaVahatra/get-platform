'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarRange, Edit3, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type AcademicYear = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

export function AcademicYearsManager() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<AcademicYear | null>(null);
  const [toDelete, setToDelete] = useState<AcademicYear | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchYears = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/academic-years');
      setYears(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement années scolaires:', error);
      toast.error('Impossible de charger les années scolaires');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchYears();
    });
    return () => {
      active = false;
    };
  }, [fetchYears]);

  const removeYear = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/academic-years/${toDelete.id}`);
      toast.success('Année scolaire supprimée');
      setToDelete(null);
      await fetchYears();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer cette année scolaire');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1000px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Années scolaires
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Créez la période de référence que les écoles utiliseront pour
            préparer leurs classes et leurs emplois du temps.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setModal('create');
          }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200"
        >
          <Plus className="size-4" />
          Ajouter une année scolaire
        </button>
      </header>
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement...
          </p>
        ) : years.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune année scolaire pour le moment.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {years.map((year) => (
              <div
                key={year.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <CalendarRange className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {year.label}
                    {year.isCurrent && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                        En cours
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {new Date(year.startDate).toLocaleDateString('fr-FR')} –{' '}
                    {new Date(year.endDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-violet-600">
                  <button
                    aria-label={`Modifier ${year.label}`}
                    onClick={() => {
                      setSelected(year);
                      setModal('edit');
                    }}
                  >
                    <Edit3 className="size-4" />
                  </button>
                  <button
                    aria-label={`Supprimer ${year.label}`}
                    className="text-red-500"
                    onClick={() => setToDelete(year)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {modal && (
        <AcademicYearForm
          year={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void fetchYears();
          }}
        />
      )}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="font-extrabold text-[#17204e]">
              Supprimer l&apos;année scolaire
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Voulez-vous vraiment supprimer « {toDelete.label} » ?
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
                onClick={() => void removeYear()}
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

function AcademicYearForm({
  year,
  onClose,
  onSaved,
}: {
  year: AcademicYear | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(year?.label || '');
  const [startDate, setStartDate] = useState(
    year ? year.startDate.slice(0, 10) : '',
  );
  const [endDate, setEndDate] = useState(year ? year.endDate.slice(0, 10) : '');
  const [isCurrent, setIsCurrent] = useState(year?.isCurrent ?? false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!label.trim() || !startDate || !endDate) return;
    const payload = { label: label.trim(), startDate, endDate, isCurrent };
    try {
      setSaving(true);
      if (year) {
        await apiClient.patch(`/academic-years/${year.id}`, payload);
        toast.success('Année scolaire mise à jour');
      } else {
        await apiClient.post('/academic-years', payload);
        toast.success('Année scolaire créée');
      }
      onSaved();
    } catch (error: unknown) {
      toast.error(axiosMessage(error) || 'Impossible d’enregistrer cette année scolaire');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="font-extrabold text-[#17204e]">
          {year ? "Modifier l'année scolaire" : 'Nouvelle année scolaire'}
        </h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-xs font-bold text-[#34406b]">
            Libellé
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={40}
              required
              placeholder="Ex. 2026-2027"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-[#34406b]">
              Début
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500"
              />
            </label>
            <label className="block text-xs font-bold text-[#34406b]">
              Fin
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-[#34406b]">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(event) => setIsCurrent(event.target.checked)}
            />
            Définir comme année scolaire en cours
          </label>
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
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
