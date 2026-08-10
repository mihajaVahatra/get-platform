'use client';

import { useEffect, useState } from 'react';
import { BookOpen, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

/** Cours inscrit tel que retourné par l'API `/students/me/courses`. `room`/`schedule` sont optionnels selon la matière. */
type Course = {
  id: string;
  code: string;
  title: string;
  level: string;
  credits: number;
  room?: string | null;
  schedule?: string | null;
  school: { id: string; name: string };
};

/**
 * Route `/dashboard/student/courses` : client component ('use client') listant les cours
 * auxquels l'étudiant est inscrit, sous forme de cartes (code, niveau, crédits, salle, horaire).
 * Récupère les cours via `apiClient.get('/students/me/courses')` au montage et gère les
 * états de chargement, d'échec et de liste vide.
 */
export default function StudentCoursesPage() {
  const t = useTranslations('StudentCourses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get('/students/me/courses')
      .then((response) => setCourses(response.data.data as Course[]))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl text-foreground">
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
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <article
              key={course.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-[#17204e]">
                    {course.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.code} · {course.level}
                  </p>
                </div>
                <BookOpen className="size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
              </div>
              <span className="mt-4 inline-flex rounded bg-indigo-50 dark:bg-indigo-500/15 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                {course.school.name}
              </span>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold text-muted-foreground">
                <span className="rounded bg-muted px-2 py-1">
                  {t('credits', { count: course.credits })}
                </span>
                {course.room && (
                  <span className="rounded bg-muted px-2 py-1">
                    {t('room', { room: course.room })}
                  </span>
                )}
                {course.schedule && (
                  <span className="rounded bg-muted px-2 py-1">
                    {course.schedule}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** Indicateur de chargement affiché pendant la récupération des cours. */
function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** État vide/erreur affiché en cas d'échec de l'appel API ou d'absence de cours. */
function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-xl bg-muted p-6 text-sm text-muted-foreground">
      {label}
    </p>
  );
}
