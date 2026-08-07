'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Search, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  enrolledYear: string | null;
  user: { email: string };
  enrolledSchool: { id: string; name: string } | null;
};
type SchoolOption = { id: string; name: string };

const PAGE_SIZE = 20;

export function StudentsDirectory() {
  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiClient
      .get('/schools', { params: { limit: 100 } })
      .then((response) => setSchools(response.data.data || []))
      .catch((error) => console.error('Erreur chargement écoles:', error));
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/schools/students', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          schoolId: schoolId || undefined,
        },
      });
      setStudents(response.data.data || []);
      setMeta(response.data.meta || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Erreur chargement étudiants:', error);
      toast.error('Impossible de charger les étudiants');
    } finally {
      setLoading(false);
    }
  }, [page, search, schoolId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchStudents();
    });
    return () => {
      active = false;
    };
  }, [fetchStudents]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Étudiants
        </h1>
        <p className="mt-1 text-sm text-indigo-600">
          Étudiants inscrits, toutes écoles confondues.
        </p>
      </header>
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-wrap gap-3">
          <label className="relative block max-w-md flex-1">
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
          <Select
            items={[
              { value: 'ALL', label: 'Toutes les écoles' },
              ...schools.map((school) => ({ value: school.id, label: school.name })),
            ]}
            value={schoolId || 'ALL'}
            onValueChange={(value) => {
              setSchoolId(!value || value === 'ALL' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les écoles</SelectItem>
              {schools.map((school) => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement des étudiants...
          </p>
        ) : students.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Aucun étudiant ne correspond à cette recherche.
          </p>
        ) : (
          <div className="space-y-2 text-[11px]">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                  <UsersRound className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#28315e]">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {student.user.email}
                    {student.enrolledYear ? ` · ${student.enrolledYear}` : ''}
                  </p>
                </div>
                {student.enrolledSchool && (
                  <span className="shrink-0 rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
                    {student.enrolledSchool.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {!loading && meta.total > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {meta.page} sur {meta.totalPages} · {meta.total} étudiant
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
