'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Evaluation = {
  id: string;
  title: string;
  type: string;
  coefficient: number;
  scheduledAt: string | null;
  value: number | null;
};

type GradedAssignment = {
  id: string;
  title: string;
  grade: number | null;
};

type CourseGrades = {
  courseId: string;
  code: string;
  title: string;
  evaluations: Evaluation[];
  assignments: GradedAssignment[];
};

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

export default function StudentGradesPage() {
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
    <div className="mx-auto max-w-4xl text-slate-900">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">Mes notes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Consultez vos évaluations et devoirs notés par cours.
        </p>
      </header>

      {loading ? (
        <Loading label="Chargement de vos notes…" />
      ) : failed ? (
        <Empty label="Vos notes n’ont pas pu être chargées." />
      ) : courses.length === 0 ? (
        <Empty label="Vous n’êtes inscrit à aucun cours pour le moment." />
      ) : (
        <div className="space-y-4">
          {courses.map((course) => {
            const average = weightedAverage(course.evaluations);
            const hasContent =
              course.evaluations.length > 0 || course.assignments.length > 0;
            return (
              <section
                key={course.courseId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold">{course.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {course.code}
                    </p>
                  </div>
                  {average !== null && (
                    <span className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-extrabold text-indigo-700">
                      {average.toFixed(1)}/20
                    </span>
                  )}
                </div>

                {!hasContent ? (
                  <p className="mt-4 text-xs text-slate-400">
                    Aucune note disponible pour ce cours.
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
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {evaluation.type} · Coef. {evaluation.coefficient}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-indigo-700">
                          {evaluation.value !== null
                            ? `${evaluation.value}/20`
                            : 'En attente'}
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
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Devoir
                          </p>
                        </div>
                        <span className="shrink-0 font-bold text-indigo-700">
                          {assignment.grade !== null
                            ? `${assignment.grade}/20`
                            : 'En attente'}
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

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">
      {label}
    </p>
  );
}
