'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDaysIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';

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
  course: {
    id: string;
    code: string;
    title: string;
    school: { id: string; name: string; slug: string };
  };
};

export function TeacherSchedule() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
          <p className="py-12 text-center text-sm text-slate-500">
            Chargement du planning…
          </p>
        ) : failed ? (
          <div className="py-12 text-center text-sm text-rose-700">
            <p>Le planning n’a pas pu être chargé.</p>
            <button
              className="mt-3 text-xs font-bold text-indigo-600"
              onClick={() => void loadSchedule()}
            >
              Réessayer
            </button>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CalendarDaysIcon className="mx-auto size-8" />
            <p className="mt-3 text-sm">Aucun créneau planifié.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[900px] grid-cols-7 divide-x rounded-lg border border-slate-200">
              {DAYS.map((day) => (
                <section key={day.value} className="min-h-80 bg-white">
                  <h2 className="border-b bg-slate-50 px-3 py-3 text-center text-xs font-bold text-[#28315e]">
                    {day.label}
                  </h2>
                  <div className="space-y-2 p-2">
                    {slots
                      .filter((slot) => slot.dayOfWeek === day.value)
                      .map((slot) => (
                        <article
                          key={slot.id}
                          className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-950"
                        >
                          <p className="font-extrabold">
                            {slot.startTime} – {slot.endTime}
                          </p>
                          <p className="mt-2 font-semibold">
                            {slot.course.code} · {slot.course.title}
                          </p>
                          <p className="mt-1 text-indigo-700">{slot.room}</p>
                          <p className="mt-2 rounded bg-white/70 px-2 py-1 text-[10px] font-bold text-indigo-700">
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
