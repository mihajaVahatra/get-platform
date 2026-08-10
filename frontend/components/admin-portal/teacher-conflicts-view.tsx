'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Search, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';

/** Professeur pouvant être sélectionné pour consulter son rapport de conflits d'emploi du temps. */
type TeacherOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  user: { email: string };
  assignments: { school: { name: string } }[];
};
/** Alerte de conflit : marge de trajet insuffisante entre deux cours dans des écoles différentes le même jour. */
type ConflictWarning = {
  dayOfWeek: number;
  schoolA: string;
  timeA: string;
  schoolB: string;
  timeB: string;
  /** Marge réellement disponible entre les deux cours, en minutes. */
  gapMinutes: number;
  /** Marge minimale requise (temps de trajet estimé), en minutes. */
  requiredMinutes: number;
};
/** Rapport de conflits d'emploi du temps pour un professeur intervenant dans plusieurs écoles. */
type ConflictReport = { teacherId: string; schoolCount: number; warnings: ConflictWarning[] };

/** Libellés des jours de la semaine, indexés sur `dayOfWeek` (1 = Lundi ... 7 = Dimanche, index 0 inutilisé). */
const DAY_LABELS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Écran admin permettant de repérer les professeurs intervenant dans
 * plusieurs écoles dont les emplois du temps laissent une marge de trajet
 * insuffisante entre deux cours. Le rapport ne montre que les horaires et
 * noms d'établissements en conflit, sans exposer le contenu des cours d'une
 * école aux autres établissements (confidentialité inter-écoles).
 */
export function TeacherConflictsView() {
  const [search, setSearch] = useState('');
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selected, setSelected] = useState<TeacherOption | null>(null);
  const [report, setReport] = useState<ConflictReport | null>(null);
  const [loading, setLoading] = useState(false);

  /** Recherche des professeurs par nom/email (`GET /teachers`). */
  const fetchTeachers = useCallback(async (query: string) => {
    try {
      const response = await apiClient.get('/teachers', { params: { search: query || undefined } });
      setTeachers(response.data.data || []);
    } catch (error) {
      console.error('Erreur recherche professeurs:', error);
    }
  }, []);

  // Debounce de 250ms sur la recherche pour éviter une requête à chaque frappe.
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.resolve().then(() => {
        if (active) return fetchTeachers(search);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, fetchTeachers]);

  /** Charge le rapport de conflits d'emploi du temps du professeur sélectionné (`GET /teachers/:id/conflicts`). */
  const openReport = async (teacher: TeacherOption) => {
    setSelected(teacher);
    setReport(null);
    try {
      setLoading(true);
      const response = await apiClient.get(`/teachers/${teacher.id}/conflicts`);
      setReport(response.data.data);
    } catch (error) {
      console.error('Erreur rapport de conflits:', error);
      toast.error('Impossible de charger le rapport');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Conflits professeurs
        </h1>
        <p className="mt-1 text-sm text-indigo-600">
          Repérez les temps de trajet insuffisants entre écoles pour un professeur partagé, sans exposer le détail des cours entre établissements.
        </p>
      </header>
      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={150}
              placeholder="Rechercher un professeur..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-indigo-500"
            />
          </label>
          <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto">
            {teachers.map((teacher) => (
              <button
                key={teacher.id}
                onClick={() => void openReport(teacher)}
                className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-indigo-50 ${selected?.id === teacher.id ? 'bg-indigo-50' : ''}`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600">
                  <UsersRound className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-slate-800">
                    {[teacher.firstName, teacher.lastName].filter(Boolean).join(' ') || teacher.user.email}
                  </span>
                  <span className="block truncate text-slate-500">
                    {teacher.assignments.map((a) => a.school.name).join(', ') || 'Aucune école active'}
                  </span>
                </span>
              </button>
            ))}
            {teachers.length === 0 && (
              <p className="p-3 text-center text-xs text-slate-500">Aucun professeur trouvé.</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          {!selected ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Sélectionnez un professeur pour voir son rapport.
            </p>
          ) : loading ? (
            <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
          ) : report ? (
            <div>
              <h2 className="font-extrabold text-[#17204e]">
                {[selected.firstName, selected.lastName].filter(Boolean).join(' ') || selected.user.email}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Intervient dans {report.schoolCount} établissement{report.schoolCount > 1 ? 's' : ''}.
              </p>
              {report.warnings.length === 0 ? (
                <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-center text-sm text-emerald-700">
                  Aucun conflit de temps de trajet détecté.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {report.warnings.map((warning, index) => (
                    <div key={index} className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-bold text-amber-900">{DAY_LABELS[warning.dayOfWeek]}</p>
                        <p className="mt-1 text-amber-800">
                          {warning.schoolA} ({warning.timeA}) → {warning.schoolB} ({warning.timeB})
                        </p>
                        <p className="mt-1 text-amber-700">
                          Marge actuelle : {warning.gapMinutes} min · requise : {warning.requiredMinutes} min
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
