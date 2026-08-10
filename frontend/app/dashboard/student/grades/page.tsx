'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

/** Épreuve évaluée d'un cours (examen, contrôle, etc.). `value` vaut `null` tant que la note n'est pas saisie. */
type Evaluation = {
  id: string;
  title: string;
  type: string;
  coefficient: number;
  scheduledAt: string | null;
  value: number | null;
};

/** Devoir noté d'un cours. `grade` vaut `null` tant que la note n'est pas saisie. */
type GradedAssignment = {
  id: string;
  title: string;
  grade: number | null;
};

/** Ensemble des notes (évaluations + devoirs) d'un cours, tel que retourné par l'API `/students/me/grades`. */
type CourseGrades = {
  courseId: string;
  code: string;
  title: string;
  evaluations: Evaluation[];
  assignments: GradedAssignment[];
};

/**
 * Calcule la moyenne pondérée par coefficient d'une liste d'évaluations, en ignorant
 * les évaluations pas encore notées (`value === null`).
 * @returns La moyenne sur 20, ou `null` si aucune évaluation notée ou si la somme des coefficients est nulle.
 */
function weightedAverage(evaluations: Evaluation[]): number | null {
  const graded = evaluations.filter((evaluation) => evaluation.value !== null);
  if (graded.length === 0) return null;
  const totalCoefficient = graded.reduce(
    (sum, evaluation) => sum + evaluation.coefficient,
    0,
  );
  if (totalCoefficient === 0) return null;
  const weightedSum = graded.reduce(
    (sum, evaluation) => sum + (evaluation.value ?? 0) * evaluation.coefficient,
    0,
  );
  return weightedSum / totalCoefficient;
}

/**
 * Route `/dashboard/student/grades` : client component ('use client') affichant, par cours,
 * la moyenne pondérée ainsi que le détail des notes d'évaluations et de devoirs.
 * Récupère les notes via `apiClient.get('/students/me/grades')` au montage et gère les
 * états de chargement, d'échec et de liste vide.
 */
export default function StudentGradesPage() {
  const t = useTranslations('StudentGrades');
  const [courses, setCourses] = useState<CourseGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get('/students/me/grades')
      .then((response) => setCourses(response.data.data as CourseGrades[]))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl text-foreground">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </header>

      {loading ? (
        <Loading label={t('loading')} />
      ) : failed ? (
        <Empty label={t('loadError')} />
      ) : courses.length === 0 ? (
        <Empty label={t('empty')} />
      ) : (
        <div className="space-y-4">
          {courses.map((course) => {
            const average = weightedAverage(course.evaluations);
            const hasContent =
              course.evaluations.length > 0 || course.assignments.length > 0;
            return (
              <section
                key={course.courseId}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold">{course.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {course.code}
                    </p>
                  </div>
                  {average !== null && (
                    <span className="rounded-lg bg-indigo-50 dark:bg-indigo-500/15 px-3 py-2 text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
                      {average.toFixed(1)}/20
                    </span>
                  )}
                </div>

                {!hasContent ? (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {t('noGrades')}
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {course.evaluations.map((evaluation) => (
                      <div
                        key={evaluation.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {evaluation.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {evaluation.type} · {t('coefficient', { value: evaluation.coefficient })}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-indigo-700 dark:text-indigo-300">
                          {evaluation.value !== null
                            ? `${evaluation.value}/20`
                            : t('pending')}
                        </span>
                      </div>
                    ))}
                    {course.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {assignment.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {t('assignment')}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-indigo-700 dark:text-indigo-300">
                          {assignment.grade !== null
                            ? `${assignment.grade}/20`
                            : t('pending')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Indicateur de chargement affiché pendant la récupération des notes. */
function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** État vide/erreur affiché en cas d'échec de l'appel API ou d'absence de notes. */
function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">
      {label}
    </p>
  );
}
