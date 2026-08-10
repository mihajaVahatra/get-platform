'use client';

import { useEffect, useState } from 'react';
import { CalendarDaysIcon, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

/** Jours de la semaine représentés dans la grille d'emploi du temps (1 = lundi ... 7 = dimanche). */
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;

/** Créneau de cours tel que retourné par l'API `/students/me/schedule`. */
type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  course: { id: string; code: string; title: string };
};

/**
 * Route `/dashboard/student/schedule` : client component ('use client') affichant l'emploi du
 * temps hebdomadaire de l'étudiant sous forme de grille à 7 colonnes (une par jour).
 * Récupère les créneaux via `apiClient.get('/students/me/schedule')` au montage et gère les
 * états de chargement, d'échec et de liste vide.
 */
export default function StudentSchedulePage() {
  const t = useTranslations('StudentSchedule');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get('/students/me/schedule')
      .then((response) => setSlots(response.data.data as Slot[]))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl text-foreground">
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
      ) : slots.length === 0 ? (
        <Empty label={t('empty')} />
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-7 divide-x rounded-lg border border-border">
            {DAY_VALUES.map((dayValue) => (
              <section key={dayValue} className="min-h-80 bg-card">
                <h2 className="border-b bg-muted px-3 py-3 text-center text-xs font-bold text-[#28315e]">
                  {t(`days.${dayValue}`)}
                </h2>
                <div className="space-y-2 p-2">
                  {slots
                    .filter((slot) => slot.dayOfWeek === dayValue)
                    .map((slot) => (
                      <article
                        key={slot.id}
                        className="rounded-lg border border-indigo-100 bg-indigo-50 dark:bg-indigo-500/15 p-3 text-xs text-indigo-950"
                      >
                        <p className="font-extrabold">
                          {slot.startTime} – {slot.endTime}
                        </p>
                        <p className="mt-2 font-semibold">
                          {slot.course.code} · {slot.course.title}
                        </p>
                        <p className="mt-1 text-indigo-700 dark:text-indigo-300">{slot.room}</p>
                      </article>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Indicateur de chargement affiché pendant la récupération de l'emploi du temps. */
function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** État vide/erreur affiché en cas d'échec de l'appel API ou d'absence de créneaux. */
function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted py-12 text-center text-sm text-muted-foreground">
      <CalendarDaysIcon className="size-8" />
      {label}
    </div>
  );
}
