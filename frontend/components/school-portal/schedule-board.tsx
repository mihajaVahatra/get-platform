'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDaysIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'schedule' | 'time-slots'>('schedule');
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <nav className="flex gap-5 overflow-x-auto border-b border-slate-100 px-2 text-[10px] font-bold">
        {(
          [
            ['schedule', 'Emploi du temps'],
            ['time-slots', 'Créneaux-type'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`whitespace-nowrap border-b-2 px-1 py-3 ${activeTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-indigo-600'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {activeTab === 'schedule' && <ScheduleBoard />}
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

type AcademicYear = { id: string; label: string; isCurrent: boolean };
type SchoolClassOption = { id: string; name: string };
type SubjectOption = { id: string; name: string; isActive: boolean };
type RoomOption = { id: string; name: string };
type TeacherOption = {
  teacherId: string;
  teacher: { firstName: string | null; lastName: string | null; user: { email: string } };
  subjects: { subject: { id: string } }[];
};
type UnresolvedItem = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherName: string | null;
  hoursPerWeek: number;
  sessionsPlaced: number;
  sessionsNeeded: number;
  reason: string;
};

export function ScheduleBoard() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SlotForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [generateForm, setGenerateForm] = useState({
    academicYearId: '',
    classId: '',
    subjectId: '',
    teacherId: '',
    roomId: '',
  });
  const [generating, setGenerating] = useState(false);
  const [unresolved, setUnresolved] = useState<UnresolvedItem[] | null>(null);
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

  const openGenerateDialog = async () => {
    setGenerateOpen(true);
    try {
      const [yearsResponse, classesResponse, subjectsResponse, roomsResponse, teachersResponse] =
        await Promise.all([
          apiClient.get('/academic-years'),
          apiClient.get('/schools/me/classes'),
          apiClient.get('/schools/me/subjects'),
          apiClient.get('/schools/me/rooms'),
          apiClient.get('/schools/me/teachers'),
        ]);
      const years: AcademicYear[] = yearsResponse.data.data || [];
      setAcademicYears(years);
      setSchoolClasses(classesResponse.data.data || []);
      setSubjects((subjectsResponse.data.data || []).filter((s: SubjectOption) => s.isActive));
      setRooms(roomsResponse.data.data || []);
      setTeachers(teachersResponse.data.data || []);
      setGenerateForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || years.find((y) => y.isCurrent)?.id || years[0]?.id || '',
      }));
    } catch (error) {
      console.error('Erreur chargement des filtres de génération:', error);
      toast.error('Impossible de charger les filtres de génération');
    }
  };

  const generateSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setGenerating(true);
      try {
        const response = await apiClient.post('/schools/me/schedule/generate', {
          academicYearId: generateForm.academicYearId,
          classId: generateForm.classId || undefined,
          subjectId: generateForm.subjectId || undefined,
          teacherId: generateForm.teacherId || undefined,
          roomId: generateForm.roomId || undefined,
        });
        const result = response.data.data as { createdSlots: number; unresolved: UnresolvedItem[] };
        setUnresolved(result.unresolved);
        toast.success(
          result.createdSlots > 0
            ? `${result.createdSlots} créneau${result.createdSlots > 1 ? 'x' : ''} créé${result.createdSlots > 1 ? 's' : ''}`
            : 'Aucun nouveau créneau à créer',
        );
        setGenerateOpen(false);
        await loadSchedule();
      } catch (error) {
        console.error('Erreur génération emploi du temps:', error);
        toast.error(axiosMessage(error) || "Impossible de générer l'emploi du temps");
      } finally {
        setGenerating(false);
      }
    })();
  };

  const teacherTeachesSubject = (teacher: TeacherOption, subjectId: string) =>
    teacher.subjects.some((entry) => entry.subject.id === subjectId);

  // Chaque liste se restreint à ce que l'autre sélection rend cohérent : un
  // prof choisi ne montre que ses matières, une matière choisie ne montre que
  // les profs qui l'enseignent.
  const filteredSubjects = generateForm.teacherId
    ? subjects.filter((subject) => {
        const teacher = teachers.find((t) => t.teacherId === generateForm.teacherId);
        return teacher ? teacherTeachesSubject(teacher, subject.id) : true;
      })
    : subjects;
  const filteredTeachers = generateForm.subjectId
    ? teachers.filter((teacher) => teacherTeachesSubject(teacher, generateForm.subjectId))
    : teachers;

  const selectSubject = (subjectId: string) => {
    setGenerateForm((current) => {
      const teacher = teachers.find((t) => t.teacherId === current.teacherId);
      const teacherStillValid = !subjectId || !teacher || teacherTeachesSubject(teacher, subjectId);
      return { ...current, subjectId, teacherId: teacherStillValid ? current.teacherId : '' };
    });
  };

  const selectTeacher = (teacherId: string) => {
    setGenerateForm((current) => {
      const teacher = teachers.find((t) => t.teacherId === teacherId);
      const subjectStillValid =
        !teacherId || !current.subjectId || !teacher || teacherTeachesSubject(teacher, current.subjectId);
      return { ...current, teacherId, subjectId: subjectStillValid ? current.subjectId : '' };
    });
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            Emploi du temps
          </h1>
          <p className="mt-1 text-sm text-indigo-600">
            Créneaux structurés des cours de votre établissement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void openGenerateDialog()}>
            <SparklesIcon /> Générer l&apos;emploi du temps
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon /> Ajouter un créneau
          </Button>
        </div>
      </header>
      {unresolved && unresolved.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-900">
            {unresolved.length} besoin{unresolved.length > 1 ? 's' : ''} non résolu
            {unresolved.length > 1 ? 's' : ''} par la génération automatique
          </p>
          <div className="space-y-2">
            {unresolved.map((item, index) => (
              <div key={index} className="flex gap-3 rounded-lg bg-white p-3 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold text-amber-900">
                    {item.className} · {item.subjectName}
                  </p>
                  <p className="mt-1 text-amber-800">{item.reason}</p>
                  <p className="mt-1 text-amber-700">
                    {item.sessionsPlaced}/{item.sessionsNeeded} séance
                    {item.sessionsNeeded > 1 ? 's' : ''} placée
                    {item.sessionsPlaced > 1 ? 's' : ''}
                    {item.teacherName ? ` · ${item.teacherName}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
                            className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-950"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-extrabold">
                                {slot.startTime} – {slot.endTime}
                              </p>
                              <button
                                type="button"
                                aria-label={`Supprimer ${slot.course.title}`}
                                onClick={() => void deleteSlot(slot)}
                                className="text-indigo-600 hover:text-rose-600"
                              >
                                <Trash2Icon className="size-4" />
                              </button>
                            </div>
                            <p className="mt-2 font-semibold">
                              {slot.course.code} · {slot.course.title}
                            </p>
                            <p className="mt-1 text-indigo-700">{slot.room}</p>
                            <p className="mt-1 truncate text-indigo-600">
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
                  maxLength={100}
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
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <form onSubmit={generateSchedule}>
            <DialogHeader>
              <DialogTitle>Générer l&apos;emploi du temps</DialogTitle>
              <DialogDescription>
                Place automatiquement les séances manquantes pour couvrir le volume
                horaire de chaque matière, en respectant les disponibilités des
                professeurs et des salles.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="generate-year">Année scolaire</Label>
                <Select
                  items={academicYears.map((year) => ({ value: year.id, label: year.label }))}
                  value={generateForm.academicYearId}
                  onValueChange={(value) =>
                    setGenerateForm((current) => ({ ...current, academicYearId: value ?? '' }))
                  }
                >
                  <SelectTrigger id="generate-year">
                    <SelectValue placeholder="Choisir une année scolaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="generate-class">Classe (facultatif — sinon toute l&apos;école)</Label>
                <Select
                  items={[
                    { value: 'ALL', label: 'Toutes les classes' },
                    ...schoolClasses.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={generateForm.classId || 'ALL'}
                  onValueChange={(value) =>
                    setGenerateForm((current) => ({
                      ...current,
                      classId: !value || value === 'ALL' ? '' : value,
                    }))
                  }
                >
                  <SelectTrigger id="generate-class" className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les classes</SelectItem>
                    {schoolClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="generate-subject">Matière (facultatif)</Label>
                <Select
                  items={[
                    { value: 'ALL', label: 'Toutes les matières' },
                    ...filteredSubjects.map((subject) => ({ value: subject.id, label: subject.name })),
                  ]}
                  value={generateForm.subjectId || 'ALL'}
                  onValueChange={(value) => selectSubject(!value || value === 'ALL' ? '' : value)}
                >
                  <SelectTrigger id="generate-subject" className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les matières</SelectItem>
                    {filteredSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="generate-teacher">Professeur (facultatif)</Label>
                <Select
                  items={[
                    { value: 'ALL', label: 'Tous les professeurs' },
                    ...filteredTeachers.map((option) => ({
                      value: option.teacherId,
                      label:
                        [option.teacher.firstName, option.teacher.lastName].filter(Boolean).join(' ') ||
                        option.teacher.user.email,
                    })),
                  ]}
                  value={generateForm.teacherId || 'ALL'}
                  onValueChange={(value) => selectTeacher(!value || value === 'ALL' ? '' : value)}
                >
                  <SelectTrigger id="generate-teacher" className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les professeurs</SelectItem>
                    {filteredTeachers.map((option) => (
                      <SelectItem key={option.teacherId} value={option.teacherId}>
                        {[option.teacher.firstName, option.teacher.lastName].filter(Boolean).join(' ') ||
                          option.teacher.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="generate-room">Salle (facultatif)</Label>
                <Select
                  items={[
                    { value: 'ALL', label: 'Toutes les salles' },
                    ...rooms.map((room) => ({ value: room.id, label: room.name })),
                  ]}
                  value={generateForm.roomId || 'ALL'}
                  onValueChange={(value) =>
                    setGenerateForm((current) => ({
                      ...current,
                      roomId: !value || value === 'ALL' ? '' : value,
                    }))
                  }
                >
                  <SelectTrigger id="generate-room" className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les salles</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={generating || !generateForm.academicYearId}>
                {generating ? 'Génération...' : 'Générer'}
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
          <p className="mt-1 text-sm text-indigo-600">
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
                  maxLength={100}
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
