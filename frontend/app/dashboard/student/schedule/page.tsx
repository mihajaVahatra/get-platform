'use client';

import { useEffect, useState } from 'react';
import { CalendarDaysIcon, LoaderCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  course: { id: string; code: string; title: string };
};

export default function StudentSchedulePage() {
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
        <h1 className="text-2xl font-extrabold">Emploi du temps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos créneaux hebdomadaires pour tous vos cours.
        </p>
      </header>

      {loading ? (
        <Loading label="Chargement de l’emploi du temps…" />
      ) : failed ? (
        <Empty label="Votre emploi du temps n’a pas pu être chargé." />
      ) : slots.length === 0 ? (
        <Empty label="Aucun créneau planifié pour le moment." />
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-7 divide-x rounded-lg border border-border">
            {DAYS.map((day) => (
              <section key={day.value} className="min-h-80 bg-card">
                <h2 className="border-b bg-muted px-3 py-3 text-center text-xs font-bold text-[#28315e]">
                  {day.label}
                </h2>
                <div className="space-y-2 p-2">
                  {slots
                    .filter((slot) => slot.dayOfWeek === day.value)
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

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted py-12 text-center text-sm text-muted-foreground">
      <CalendarDaysIcon className="size-8" />
      {label}
    </div>
  );
}
