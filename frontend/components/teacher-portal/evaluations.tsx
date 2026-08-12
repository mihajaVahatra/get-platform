'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { StudentIdentity } from '@/components/teacher-portal/student-identity';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CourseSummary,
  Evaluation,
  EvaluationGrade,
  EvaluationGradeEntry,
} from './types';
import { Card, AsyncState, ListPagination, LIST_PAGE_SIZE } from './shared';

/**
 * Hook partagé par les vues "Évaluations" et "Notes" : charge la liste des
 * cours du professeur (`GET /teacher/courses`) et gère la sélection du cours
 * actif, en conservant la sélection courante si elle reste valide après un
 * rechargement (sinon retombe sur le premier cours de la liste).
 *
 * @returns `courses`, `selectedCourseId`/`setSelectedCourseId`, `loading`,
 * `failed` et `fetchCourses` (pour relancer le chargement, ex. bouton "Réessayer").
 */
export function useTeacherCourses() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/teacher/courses');
      const assignedCourses = (response.data.data || []) as CourseSummary[];
      setCourses(assignedCourses);
      setSelectedCourseId((current) =>
        assignedCourses.some((course) => course.id === current)
          ? current
          : assignedCourses[0]?.id || '',
      );
    } catch (error) {
      console.error('Erreur chargement cours professeur:', error);
      setFailed(true);
      toast.error('Impossible de charger vos cours');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchCourses();
    });
    return () => {
      active = false;
    };
  }, [fetchCourses]);

  return {
    courses,
    selectedCourseId,
    setSelectedCourseId,
    loading,
    failed,
    fetchCourses,
  };
}

export function CourseSelect({
  courses,
  value,
  onChange,
}: {
  courses: CourseSummary[];
  value: string;
  onChange: (courseId: string) => void;
}) {
  return (
    <div className="block max-w-xl">
      <span className="mb-1 block text-xs font-bold text-[#34406b]">Cours</span>
      <Select
        items={courses.map((course) => ({
          value: course.id,
          label: `${course.title} · ${course.school.name}`,
        }))}
        value={value}
        onValueChange={(next) => onChange(next ?? '')}
      >
        <SelectTrigger className="h-10 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {courses.map((course) => (
            <SelectItem key={course.id} value={course.id}>
              {course.title} · {course.school.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function EvaluationPanel({ courseId }: { courseId: string }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Contrôle');
  const [scheduledAt, setScheduledAt] = useState('');
  const [coefficient, setCoefficient] = useState('1');
  const [saving, setSaving] = useState(false);

  const fetchEvaluations = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get(
        `/teacher/courses/${courseId}/evaluations`,
      );
      setEvaluations(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement évaluations:', error);
      setFailed(true);
      toast.error('Impossible de charger les évaluations');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchEvaluations();
    });
    return () => {
      active = false;
    };
  }, [fetchEvaluations]);

  const createEvaluation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      try {
        setSaving(true);
        const response = await apiClient.post(
          `/teacher/courses/${courseId}/evaluations`,
          {
            title,
            type,
            scheduledAt: scheduledAt || undefined,
            coefficient: Number(coefficient),
          },
        );
        const evaluation = response.data.data as Evaluation;
        setEvaluations((current) =>
          [...current, evaluation].sort((first, second) =>
            (first.scheduledAt || '').localeCompare(second.scheduledAt || ''),
          ),
        );
        setDialogOpen(false);
        setTitle('');
        setType('Contrôle');
        setScheduledAt('');
        setCoefficient('1');
        toast.success('Évaluation créée');
      } catch (error) {
        console.error('Erreur création évaluation:', error);
        toast.error('Impossible de créer l’évaluation');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <>
      <Card title="Évaluations">
        <div className="mb-4 flex justify-end">
          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" /> Nouvelle évaluation
          </button>
        </div>
        {loading || failed || evaluations.length === 0 ? (
          <AsyncState
            status={loading ? 'loading' : failed ? 'error' : 'empty'}
            variant="inline"
            loadingMessage="Chargement des évaluations…"
            retryLabel="Réessayer de charger les évaluations"
            emptyMessage="Aucune évaluation pour ce cours."
            onRetry={() => void fetchEvaluations()}
          />
        ) : (
          <div className="space-y-2">
            {evaluations.map((evaluation) => (
              <div
                key={evaluation.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                  <ClipboardList className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#26305e]">
                    {evaluation.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {evaluation.type} ·{' '}
                    {evaluation.scheduledAt
                      ? new Date(evaluation.scheduledAt).toLocaleDateString(
                          'fr-FR',
                        )
                      : 'Non planifiée'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  Coef. {evaluation.coefficient}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={createEvaluation}>
            <DialogHeader>
              <DialogTitle>Nouvelle évaluation</DialogTitle>
              <DialogDescription>
                Elle sera ajoutée au cours sélectionné.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <label className="text-xs font-bold text-[#34406b]">
                Titre
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Type
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  maxLength={50}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Date (facultative)
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Coefficient
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={coefficient}
                  onChange={(event) => setCoefficient(event.target.value.slice(0, 6))}
                  required
                />
              </label>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Création…' : 'Créer'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GradeBook({ courseId }: { courseId: string }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [loadingEvaluations, setLoadingEvaluations] = useState(true);
  const [evaluationsFailed, setEvaluationsFailed] = useState(false);
  const [entries, setEntries] = useState<EvaluationGradeEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [gradesFailed, setGradesFailed] = useState(false);

  const fetchEvaluations = useCallback(async () => {
    try {
      setLoadingEvaluations(true);
      setEvaluationsFailed(false);
      const response = await apiClient.get(
        `/teacher/courses/${courseId}/evaluations`,
      );
      const courseEvaluations = (response.data.data || []) as Evaluation[];
      setEvaluations(courseEvaluations);
      setSelectedEvaluationId(courseEvaluations[0]?.id || '');
    } catch (error) {
      console.error('Erreur chargement évaluations:', error);
      setEvaluationsFailed(true);
      toast.error('Impossible de charger les évaluations');
    } finally {
      setLoadingEvaluations(false);
    }
  }, [courseId]);

  const fetchGrades = useCallback(async () => {
    if (!selectedEvaluationId) {
      setEntries([]);
      setTotalEntries(0);
      return;
    }
    try {
      setLoadingGrades(true);
      setGradesFailed(false);
      const response = await apiClient.get(
        `/teacher/evaluations/${selectedEvaluationId}/grades`,
        { params: { page, limit: LIST_PAGE_SIZE } },
      );
      setEntries(response.data.data.items || []);
      setTotalEntries(response.data.data.meta?.total || 0);
    } catch (error) {
      console.error('Erreur chargement notes:', error);
      setGradesFailed(true);
      toast.error('Impossible de charger les notes');
    } finally {
      setLoadingGrades(false);
    }
  }, [selectedEvaluationId, page]);

  const [pageResetKey, setPageResetKey] = useState(selectedEvaluationId);
  if (selectedEvaluationId !== pageResetKey) {
    setPageResetKey(selectedEvaluationId);
    setPage(1);
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchEvaluations();
    });
    return () => {
      active = false;
    };
  }, [fetchEvaluations]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchGrades();
    });
    return () => {
      active = false;
    };
  }, [fetchGrades]);

  const saveGrade = async (studentId: string, value: number) => {
    const response = await apiClient.post(
      `/teacher/evaluations/${selectedEvaluationId}/grades`,
      { studentId, value },
    );
    const grade = response.data.data as EvaluationGrade;
    setEntries((current) =>
      current.map((entry) =>
        entry.studentId === studentId ? { ...entry, grade } : entry,
      ),
    );
  };

  if (loadingEvaluations || evaluationsFailed || evaluations.length === 0)
    return (
      <AsyncState
        status={
          loadingEvaluations ? 'loading' : evaluationsFailed ? 'error' : 'empty'
        }
        variant="inline"
        emptyVariant="card"
        loadingMessage="Chargement des évaluations…"
        retryLabel="Réessayer de charger les évaluations"
        emptyMessage="Créez d’abord une évaluation pour saisir des notes."
        onRetry={() => void fetchEvaluations()}
      />
    );

  return (
    <div className="space-y-5">
      <div className="block max-w-xl">
        <span className="mb-1 block text-xs font-bold text-[#34406b]">
          Évaluation
        </span>
        <Select
          items={evaluations.map((evaluation) => ({
            value: evaluation.id,
            label: `${evaluation.title} · ${evaluation.type}`,
          }))}
          value={selectedEvaluationId}
          onValueChange={(value) => setSelectedEvaluationId(value ?? '')}
        >
          <SelectTrigger className="h-10 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {evaluations.map((evaluation) => (
              <SelectItem key={evaluation.id} value={evaluation.id}>
                {evaluation.title} · {evaluation.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card title="Saisie des notes">
        <p className="mb-4 text-xs text-muted-foreground">
          Chaque note est enregistrée lorsque vous quittez son champ.
        </p>
        {loadingGrades || gradesFailed || totalEntries === 0 ? (
          <AsyncState
            status={loadingGrades ? 'loading' : gradesFailed ? 'error' : 'empty'}
            variant="inline"
            loadingMessage="Chargement des étudiants…"
            retryLabel="Réessayer de charger les notes"
            emptyMessage="Aucun étudiant n’est inscrit à ce cours."
            onRetry={() => void fetchGrades()}
          />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.studentId}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <StudentIdentity
                    firstName={entry.student.firstName}
                    lastName={entry.student.lastName}
                    email={entry.student.user.email}
                  />
                </div>
                <GradeInput
                  key={`${entry.studentId}-${entry.grade?.value ?? 'empty'}`}
                  value={entry.grade?.value ?? null}
                  onSave={(value) => saveGrade(entry.studentId, value)}
                />
              </div>
            ))}
          </div>
        )}
        <ListPagination
          page={page}
          totalItems={totalEntries}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}

export function GradeInput({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (value: number) => Promise<void>;
}) {
  const initialValue = value === null ? '' : String(value);
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const saveOnBlur = () => {
    const parsedValue = Number(draft);
    if (!draft.trim()) return;
    if (!Number.isFinite(parsedValue)) {
      toast.error('La note doit être un nombre');
      setDraft(initialValue);
      return;
    }
    if (parsedValue === value) return;
    void (async () => {
      try {
        setSaving(true);
        await onSave(parsedValue);
      } catch (error) {
        console.error('Erreur enregistrement note:', error);
        toast.error('Impossible d’enregistrer cette note');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="w-28">
      <input
        type="number"
        step="0.01"
        min={0}
        max={20}
        className="h-9 w-full rounded-lg border border-border px-2 text-xs outline-none focus:border-indigo-500"
        value={draft}
        onChange={(event) => setDraft(event.target.value.slice(0, 5))}
        onBlur={saveOnBlur}
        aria-label="Note"
      />
      {saving && (
        <span className="text-[9px] text-muted-foreground">Enregistrement…</span>
      )}
    </div>
  );
}

