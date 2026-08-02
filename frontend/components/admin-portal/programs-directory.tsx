'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

type Program = {
  id: string;
  name: string;
  diploma: string;
  durationYears: number;
  isActive: boolean;
  school: { id: string; name: string };
};
type SchoolOption = { id: string; name: string };

const PAGE_SIZE = 20;

export function ProgramsDirectory() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [schoolId, setSchoolId] = useState('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiClient
      .get('/schools', { params: { limit: 100 } })
      .then((response) => setSchools(response.data.data || []))
      .catch((error) => console.error('Erreur chargement écoles:', error));
  }, []);

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/schools/programs', {
        params: { page, limit: PAGE_SIZE, schoolId: schoolId || undefined },
      });
      setPrograms(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement filières:', error);
      toast.error('Impossible de charger les filières');
    } finally {
      setLoading(false);
    }
  }, [page, schoolId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchPrograms();
    });
    return () => {
      active = false;
    };
  }, [fetchPrograms]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Programmes & Filières
        </h1>
        <p className="mt-1 text-sm text-violet-600">
          Filières proposées, toutes écoles confondues.
        </p>
      </header>
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-6">
          <select
            value={schoolId}
            onChange={(event) => {
              setSchoolId(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
          >
            <option value="">Toutes les écoles</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des filières...
          </p>
        ) : programs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucune filière ne correspond à cette recherche.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {programs.map((program) => (
              <div
                key={program.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <BookOpen className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {program.name}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {program.diploma} · {program.durationYears} an
                    {program.durationYears > 1 ? 's' : ''} · {program.school.name}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${program.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
                >
                  {program.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} filière
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
