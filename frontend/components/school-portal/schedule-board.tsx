'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDaysIcon, DoorOpenIcon, PlusIcon, Trash2Icon } from 'lucide-react';
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

function axiosMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } }).response
    ?.data?.message;
}

export function SchoolSchedulePortal() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'rooms' | 'time-slots'>('schedule');
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <nav className="flex gap-5 overflow-x-auto border-b border-slate-100 px-2 text-[10px] font-bold">
        {(
          [
            ['schedule', 'Emploi du temps'],
            ['rooms', 'Salles'],
            ['time-slots', 'Créneaux-type'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`whitespace-nowrap border-b-2 px-1 py-3 ${activeTab === id ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-violet-600'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {activeTab === 'schedule' && <ScheduleBoard />}
      {activeTab === 'rooms' && <RoomsManager />}
      {activeTab === 'time-slots' && <TimeSlotsManager />}
    </div>
  );
}

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

const ROOM_TYPES = [
  ['STANDARD', 'Standard'],
  ['LAB', 'Laboratoire'],
  ['AMPHI', 'Amphithéâtre'],
  ['SPORT', 'Sport'],
] as const;

type Room = {
  id: string;
  name: string;
  capacity: number | null;
  type: string;
  isActive: boolean;
};

function RoomsManager() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [type, setType] = useState('STANDARD');
  const [saving, setSaving] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const response = await apiClient.get('/schools/me/rooms');
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement salles:', error);
      toast.error('Impossible de charger les salles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadRooms();
    });
    return () => {
      active = false;
    };
  }, [loadRooms]);

  const createRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        await apiClient.post('/schools/me/rooms', {
          name,
          capacity: capacity ? Number(capacity) : undefined,
          type,
        });
        toast.success('Salle ajoutée');
        setDialogOpen(false);
        setName('');
        setCapacity('');
        setType('STANDARD');
        await loadRooms();
      } catch (error) {
        toast.error(axiosMessage(error) || 'Impossible de créer cette salle');
      } finally {
        setSaving(false);
      }
    })();
  };

  const deleteRoom = async (room: Room) => {
    try {
      await apiClient.delete(`/schools/me/rooms/${room.id}`);
      toast.success('Salle supprimée');
      await loadRooms();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer cette salle');
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111949]">Salles</h1>
          <p className="mt-1 text-sm text-violet-600">
            Gérez les salles disponibles pour vos cours.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon /> Ajouter une salle
        </Button>
      </header>
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
          ) : rooms.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <DoorOpenIcon className="mx-auto size-8" />
              <p className="mt-3 text-sm">Aucune salle enregistrée.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">{room.name}</p>
                    <p className="mt-1 text-slate-500">
                      {ROOM_TYPES.find(([value]) => value === room.type)?.[1] || room.type}
                      {room.capacity ? ` · ${room.capacity} places` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Supprimer ${room.name}`}
                    onClick={() => void deleteRoom(room)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={createRoom}>
            <DialogHeader>
              <DialogTitle>Ajouter une salle</DialogTitle>
              <DialogDescription>
                Le nom doit être unique dans votre établissement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">Nom</Label>
                <Input id="room-name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-capacity">Capacité (facultatif)</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-type">Type</Label>
                <Select
                  items={ROOM_TYPES.map(([value, label]) => ({ value, label }))}
                  value={type}
                  onValueChange={(value) => setType(value ?? 'STANDARD')}
                >
                  <SelectTrigger id="room-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !name}>
                {saving ? 'Ajout...' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TimeSlotTemplate = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string | null;
};

function TimeSlotsManager() {
  const [slots, setSlots] = useState<TimeSlotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ dayOfWeek: '1', startTime: '08:00', endTime: '10:00', label: '' });
  const [saving, setSaving] = useState(false);

  const loadSlots = useCallback(async () => {
    try {
      const response = await apiClient.get('/schools/me/time-slots');
      setSlots(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement créneaux-type:', error);
      toast.error('Impossible de charger les créneaux-type');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadSlots();
    });
    return () => {
      active = false;
    };
  }, [loadSlots]);

  const setField = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const createSlot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        await apiClient.post('/schools/me/time-slots', {
          dayOfWeek: Number(form.dayOfWeek),
          startTime: form.startTime,
          endTime: form.endTime,
          label: form.label || undefined,
        });
        toast.success('Créneau-type ajouté');
        setDialogOpen(false);
        setForm({ dayOfWeek: '1', startTime: '08:00', endTime: '10:00', label: '' });
        await loadSlots();
      } catch (error) {
        toast.error(axiosMessage(error) || 'Impossible de créer ce créneau-type');
      } finally {
        setSaving(false);
      }
    })();
  };

  const deleteSlot = async (slot: TimeSlotTemplate) => {
    try {
      await apiClient.delete(`/schools/me/time-slots/${slot.id}`);
      toast.success('Créneau-type supprimé');
      await loadSlots();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de supprimer ce créneau-type');
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111949]">Créneaux-type</h1>
          <p className="mt-1 text-sm text-violet-600">
            Définissez la grille horaire propre à votre établissement.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon /> Ajouter un créneau-type
        </Button>
      </header>
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
          ) : slots.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CalendarDaysIcon className="mx-auto size-8" />
              <p className="mt-3 text-sm">Aucun créneau-type défini.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">
                      {DAYS.find((day) => Number(day.value) === slot.dayOfWeek)?.label}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {slot.startTime} – {slot.endTime}
                      {slot.label ? ` · ${slot.label}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Supprimer ce créneau-type"
                    onClick={() => void deleteSlot(slot)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={createSlot}>
            <DialogHeader>
              <DialogTitle>Ajouter un créneau-type</DialogTitle>
              <DialogDescription>
                Les chevauchements sur un même jour sont refusés automatiquement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ts-day">Jour</Label>
                <Select
                  items={DAYS}
                  value={form.dayOfWeek}
                  onValueChange={(value) => setField('dayOfWeek', value ?? '1')}
                >
                  <SelectTrigger id="ts-day">
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
                  id="ts-start"
                  value={form.startTime}
                  onChange={(value) => setField('startTime', value)}
                />
                <TimeField
                  label="Fin"
                  id="ts-end"
                  value={form.endTime}
                  onChange={(value) => setField('endTime', value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ts-label">Libellé (facultatif)</Label>
                <Input
                  id="ts-label"
                  value={form.label}
                  onChange={(event) => setField('label', event.target.value)}
                  placeholder="Ex. Créneau 1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Ajout...' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
