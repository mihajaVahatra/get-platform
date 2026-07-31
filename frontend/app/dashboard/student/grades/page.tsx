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
                    <span className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-extrabold text-violet-700">
                      {average.toFixed(1)}/20
                    </span>
                  )}
                </div>

                {!hasContent ? (
                  <p className="mt-4 text-xs text-slate-400">
                    Aucune note disponible pour ce cours.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead className="border-b border-slate-100 text-[10px] text-slate-400">
                        <tr>
                          <th className="pb-2 font-semibold">Évaluation</th>
                          <th className="pb-2 font-semibold">Type</th>
                          <th className="pb-2 font-semibold">Coefficient</th>
                          <th className="pb-2 font-semibold">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {course.evaluations.map((evaluation) => (
                          <tr
                            key={evaluation.id}
                            className="border-b border-slate-50"
                          >
                            <td className="py-2 pr-3 font-semibold">
                              {evaluation.title}
                            </td>
                            <td className="py-2 pr-3 text-slate-500">
                              {evaluation.type}
                            </td>
                            <td className="py-2 pr-3 text-slate-500">
                              {evaluation.coefficient}
                            </td>
                            <td className="py-2 pr-3 font-bold text-violet-700">
                              {evaluation.value !== null
                                ? `${evaluation.value}/20`
                                : 'En attente'}
                            </td>
                          </tr>
                        ))}
                        {course.assignments.map((assignment) => (
                          <tr
                            key={assignment.id}
                            className="border-b border-slate-50"
                          >
                            <td className="py-2 pr-3 font-semibold">
                              {assignment.title}
                            </td>
                            <td className="py-2 pr-3 text-slate-500">Devoir</td>
                            <td className="py-2 pr-3 text-slate-500">—</td>
                            <td className="py-2 pr-3 font-bold text-violet-700">
                              {assignment.grade !== null
                                ? `${assignment.grade}/20`
                                : 'En attente'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
