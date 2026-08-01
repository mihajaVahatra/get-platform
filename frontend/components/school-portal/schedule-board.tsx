'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDaysIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = [
  { value: '1', label: 'Lundi' },
  { value: '2', label: 'Mardi' },
  { value: '3', label: 'Mercredi' },
  { value: '4', label: 'Jeudi' },
  { value: '5', label: 'Vendredi' },
  { value: '6', label: 'Samedi' },
  { value: '7', label: 'Dimanche' },
];
type Course = { id: string; code: string; title: string };
type Slot = {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  course: {
    id: string;
    code: string;
    title: string;
    teacher: { user: { email: string } };
  };
};
type SlotForm = {
  courseId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
};
const EMPTY_FORM: SlotForm = {
  courseId: '',
  dayOfWeek: '1',
  startTime: '08:00',
  endTime: '10:00',
  room: '',
};

export function ScheduleBoard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SlotForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const loadSchedule = useCallback(async () => {
    try {
      const [slotsResponse, coursesResponse] = await Promise.all([
        apiClient.get('/schools/me/schedule'),
        apiClient.get('/schools/me/courses'),
      ]);
      setSlots(slotsResponse.data.data || []);
      setCourses(coursesResponse.data.data || []);
    } catch (error) {
      console.error('Erreur chargement emploi du temps:', error);
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
  const setField = (field: keyof SlotForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const createSlot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        await apiClient.post(`/schools/me/courses/${form.courseId}/slots`, {
          dayOfWeek: Number(form.dayOfWeek),
          startTime: form.startTime,
          endTime: form.endTime,
          room: form.room,
        });
        toast.success('Créneau ajouté');
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        await loadSchedule();
      } catch (error) {
        console.error('Erreur création créneau:', error);
        toast.error(
          'Créneau impossible : vérifiez les horaires et les conflits de salle',
        );
      } finally {
        setSaving(false);
      }
    })();
  };
  const deleteSlot = async (slot: Slot) => {
    try {
      await apiClient.delete(
        `/schools/me/courses/${slot.courseId}/slots/${slot.id}`,
      );
      toast.success('Créneau supprimé');
      await loadSchedule();
    } catch (error) {
      console.error('Erreur suppression créneau:', error);
      toast.error('Impossible de supprimer le créneau');
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Emploi du temps
          </h1>
          <p className="mt-1 text-sm text-violet-600">
            Créneaux structurés des cours de votre établissement.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon /> Ajouter un créneau
        </Button>
      </header>
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Chargement du planning...
            </p>
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
                        .filter((slot) => slot.dayOfWeek === Number(day.value))
                        .map((slot) => (
                          <article
                            key={slot.id}
                            className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs text-violet-950"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-extrabold">
                                {slot.startTime} – {slot.endTime}
                              </p>
                              <button
                                type="button"
                                aria-label={`Supprimer ${slot.course.title}`}
                                onClick={() => void deleteSlot(slot)}
                                className="text-violet-600 hover:text-rose-600"
                              >
                                <Trash2Icon className="size-4" />
                              </button>
                            </div>
                            <p className="mt-2 font-semibold">
                              {slot.course.code} · {slot.course.title}
                            </p>
                            <p className="mt-1 text-violet-700">{slot.room}</p>
                            <p className="mt-1 truncate text-violet-600">
                              {slot.course.teacher.user.email}
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={createSlot}>
            <DialogHeader>
              <DialogTitle>Ajouter un créneau</DialogTitle>
              <DialogDescription>
                Les chevauchements dans une même salle sont refusés
                automatiquement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="slot-course">Cours</Label>
                <Select
                  items={courses.map((course) => ({
                    value: course.id,
                    label: `${course.code} · ${course.title}`,
                  }))}
                  value={form.courseId}
                  onValueChange={(value) => setField('courseId', value ?? '')}
                >
                  <SelectTrigger id="slot-course">
                    <SelectValue placeholder="Choisir un cours" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} · {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-day">Jour</Label>
                <Select
                  items={DAYS}
                  value={form.dayOfWeek}
                  onValueChange={(value) => setField('dayOfWeek', value ?? '1')}
                >
                  <SelectTrigger id="slot-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TimeField
                  label="Début"
                  id="slot-start"
                  value={form.startTime}
                  onChange={(value) => setField('startTime', value)}
                />
                <TimeField
                  label="Fin"
                  id="slot-end"
                  value={form.endTime}
                  onChange={(value) => setField('endTime', value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-room">Salle</Label>
                <Input
                  id="slot-room"
                  value={form.room}
                  onChange={(event) => setField('room', event.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !form.courseId}>
                {saving ? 'Ajout...' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimeField({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}
