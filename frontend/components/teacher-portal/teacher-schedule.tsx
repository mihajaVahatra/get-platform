'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDaysIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';

/** Jours de la semaine affichés en colonnes, avec leur code numérique attendu par l'API (1 = Lundi ... 7 = Dimanche). */
const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

/** Créneau horaire de l'emploi du temps d'un professeur, associé à un cours et à l'établissement qui le dispense. */
type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  course: {
    id: string;
    code: string;
    title: string;
    school: { id: string; name: string; slug: string };
  };
};

/**
 * Affiche l'emploi du temps hebdomadaire du professeur connecté sous forme de
 * grille à 7 colonnes (une par jour), chaque colonne listant les créneaux de
 * cours de la journée.
 *
 * Charge les créneaux via `GET /teacher/courses/schedule` au montage et gère
 * les états de chargement, d'échec (avec bouton de nouvelle tentative) et de
 * liste vide.
 */
export function TeacherSchedule() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /** Récupère les créneaux de l'emploi du temps auprès de l'API et met à jour les états de chargement/échec. */
  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/teacher/courses/schedule');
      setSlots(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement emploi du temps professeur:', error);
      setFailed(true);
      toast.error("Impossible de charger l'emploi du temps");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Report le chargement au prochain microtask et vérifie `active` pour éviter
    // un appel réseau après démontage du composant (course entre effets en StrictMode).
    void Promise.resolve().then(() => {
      if (active) return loadSchedule();
    });
    return () => {
      active = false;
    };
  }, [loadSchedule]);

  return (
    <Card>
      <CardContent className="p-5">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chargement du planning…
          </p>
        ) : failed ? (
          <div className="py-12 text-center text-sm text-rose-700 dark:text-rose-300">
            <p>Le planning n’a pas pu être chargé.</p>
            <button
              className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-300"
              onClick={() => void loadSchedule()}
            >
              Réessayer
            </button>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <CalendarDaysIcon className="mx-auto size-8" />
            <p className="mt-3 text-sm">Aucun créneau planifié.</p>
          </div>
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
                          <p className="mt-2 rounded bg-white/70 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                            {slot.course.school.name}
                          </p>
                        </article>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
