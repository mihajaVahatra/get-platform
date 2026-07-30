'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Edit3Icon, PlusIcon } from 'lucide-react';
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

type TeacherAssignment = {
  teacherId: string;
  department?: string | null;
  specialty?: string | null;
  subjects?: { subject: { id: string; name: string; isActive: boolean } }[];
  teacher: { user: { email: string } };
};
type Course = {
  id: string;
  teacherId: string;
  code: string;
  title: string;
  description?: string | null;
  level: string;
  group?: string | null;
  credits: number;
  room?: string | null;
  schedule?: string | null;
  isPublished: boolean;
  teacher: { user: { email: string } };
};
type CourseForm = {
  teacherId: string;
  subjectId: string;
  programId: string;
  programLevel: string;
  code: string;
  title: string;
  description: string;
  level: string;
  group: string;
  credits: string;
  room: string;
  schedule: string;
  isPublished: string;
};
const EMPTY_FORM: CourseForm = {
  teacherId: '',
  subjectId: '',
  programId: '',
  programLevel: '',
  code: '',
  title: '',
  description: '',
  level: '',
  group: '',
  credits: '0',
  room: '',
  schedule: '',
  isPublished: 'true',
};

export function CourseDirectory() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<TeacherAssignment[]>([]);
  const [programs, setPrograms] = useState<
    { id: string; name: string; durationYears: number; isActive: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [coursesResponse, teachersResponse, programsResponse] =
        await Promise.all([
          apiClient.get('/schools/me/courses'),
          apiClient.get('/schools/me/teachers'),
          apiClient.get('/schools/me/programs'),
        ]);
      setCourses(coursesResponse.data.data || []);
      setTeachers(teachersResponse.data.data || []);
      setPrograms(
        (programsResponse.data.data || []).filter(
          (program: { isActive: boolean }) => program.isActive,
        ),
      );
    } catch (error) {
      console.error('Erreur chargement cours:', error);
      toast.error('Impossible de charger les cours');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchData();
    });
    return () => {
      active = false;
    };
  }, [fetchData]);

  const openCreate = () => {
    setSelectedCourse(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (course: Course) => {
    setSelectedCourse(course);
    setForm({
      teacherId: course.teacherId,
      subjectId: '',
      programId: '',
      programLevel: '',
      code: course.code,
      title: course.title,
      description: course.description || '',
      level: course.level,
      group: course.group || '',
      credits: String(course.credits),
      room: course.room || '',
      schedule: course.schedule || '',
      isPublished: String(course.isPublished),
    });
    setDialogOpen(true);
  };
  const setField = (field: keyof CourseForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const teacherSubjects =
    teachers
      .find((teacher) => teacher.teacherId === form.teacherId)
      ?.subjects?.map((item) => item.subject)
      .filter((subject) => subject.isActive) || [];
  const selectedProgram = programs.find(
    (program) => program.id === form.programId,
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      const payload = {
        ...form,
        description: form.description || undefined,
        group: form.group || undefined,
        room: form.room || undefined,
        schedule: form.schedule || undefined,
        credits: Number(form.credits),
        isPublished: form.isPublished === 'true',
      };
      try {
        if (selectedCourse)
          await apiClient.put(
            `/schools/me/courses/${selectedCourse.id}`,
            payload,
          );
        else await apiClient.post('/schools/me/courses', payload);
        toast.success(selectedCourse ? 'Cours mis à jour' : 'Cours créé');
        setDialogOpen(false);
        await fetchData();
      } catch (error) {
        console.error('Erreur enregistrement cours:', error);
        toast.error('Impossible d’enregistrer le cours');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#111949]">Cours</h1>
          <p className="text-sm text-violet-600">
            Cours structurés par professeur, matière et filière.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon /> Créer un cours
        </Button>
      </header>
      <Card>
        <CardContent className="p-5">
          {loading ? (
            'Chargement...'
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.code}</td>
                    <td>{course.title}</td>
                    <td>{course.level}</td>
                    <td>{course.teacher.user.email}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(course)}
                      >
                        <Edit3Icon />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>
                {selectedCourse ? 'Modifier le cours' : 'Créer un cours'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Label>
                Professeur
                <Select
                  items={teachers.map((teacher) => ({
                    value: teacher.teacherId,
                    label: teacher.teacher.user.email,
                  }))}
                  value={form.teacherId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      teacherId: value ?? '',
                      subjectId: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem
                        key={teacher.teacherId}
                        value={teacher.teacherId}
                      >
                        {teacher.teacher.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Label>
                Matière
                <Select
                  items={teacherSubjects.map((subject) => ({
                    value: subject.id,
                    label: subject.name,
                  }))}
                  value={form.subjectId}
                  disabled={!form.teacherId || teacherSubjects.length === 0}
                  onValueChange={(value) => setField('subjectId', value ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.teacherId && !teacherSubjects.length && (
                  <p className="text-xs text-red-600">
                    Ce professeur n’a aucune matière renseignée — modifiez son
                    affectation dans Professeurs.
                  </p>
                )}
              </Label>
              <Label>
                Filière
                <Select
                  items={programs.map((program) => ({
                    value: program.id,
                    label: program.name,
                  }))}
                  value={form.programId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      programId: value ?? '',
                      programLevel: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Label>
                Niveau
                <Select
                  items={Array.from(
                    { length: selectedProgram?.durationYears || 0 },
                    (_, index) => ({
                      value: String(index + 1),
                      label: `Année ${index + 1}`,
                    }),
                  )}
                  value={form.programLevel}
                  disabled={!selectedProgram}
                  onValueChange={(value) =>
                    setField('programLevel', value ?? '')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      { length: selectedProgram?.durationYears || 0 },
                      (_, index) => (
                        <SelectItem key={index + 1} value={String(index + 1)}>
                          Année {index + 1}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </Label>
              <Field
                label="Code"
                id="course-code"
                value={form.code}
                onChange={(value) => setField('code', value)}
                required
              />
              <Field
                label="Groupe"
                id="course-group"
                value={form.group}
                onChange={(value) => setField('group', value)}
              />
              <Field
                label="Crédits"
                id="course-credits"
                type="number"
                value={form.credits}
                onChange={(value) => setField('credits', value)}
                required
              />
              <Field
                label="Salle"
                id="course-room"
                value={form.room}
                onChange={(value) => setField('room', value)}
              />
              <Field
                label="Emploi du temps"
                id="course-schedule"
                value={form.schedule}
                onChange={(value) => setField('schedule', value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  saving ||
                  !form.teacherId ||
                  !form.subjectId ||
                  !form.programId ||
                  !form.programLevel
                }
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  type = 'text',
  value,
  onChange,
  required = false,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        min={type === 'number' ? '0' : undefined}
      />
    </div>
  );
}
