'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArchiveIcon,
  BookOpenIcon,
  Edit3Icon,
  PlusIcon,
  SearchIcon,
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
  subjectId?: string | null;
  programId?: string | null;
  programLevel?: number | null;
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
  description: string;
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
  description: '',
  group: '',
  credits: '0',
  room: '',
  schedule: '',
  isPublished: 'true',
};
const PAGE_SIZE = 10;

export function CourseDirectory() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [teachers, setTeachers] = useState<TeacherAssignment[]>([]);
  const [programs, setPrograms] = useState<
    { id: string; name: string; durationYears: number; isActive: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseToDeactivate, setCourseToDeactivate] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

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

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      [course.code, course.title, course.teacher.user.email].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [courses, search]);
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const openCreate = () => {
    setSelectedCourse(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };
  const openEdit = (course: Course) => {
    setSelectedCourse(course);
    setForm({
      teacherId: course.teacherId,
      subjectId: course.subjectId || '',
      programId: course.programId || '',
      programLevel: course.programLevel ? String(course.programLevel) : '',
      code: course.code,
      description: course.description || '',
      group: course.group || '',
      credits: String(course.credits),
      room: course.room || '',
      schedule: course.schedule || '',
      isPublished: String(course.isPublished),
    });
    setDialogOpen(true);
  };
  const deactivateCourse = async () => {
    if (!courseToDeactivate) return;
    setDeactivating(true);
    try {
      await apiClient.put(`/schools/me/courses/${courseToDeactivate.id}`, {
        isPublished: false,
      });
      toast.success('Cours désactivé');
      setCourseToDeactivate(null);
      await fetchData();
    } catch (error: unknown) {
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      toast.error(responseMessage || 'Impossible de désactiver le cours');
    } finally {
      setDeactivating(false);
    }
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
        teacherId: form.teacherId,
        subjectId: form.subjectId,
        programId: form.programId,
        programLevel: Number(form.programLevel),
        code: form.code,
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
          ) : courses.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Aucun cours n&apos;est actuellement configuré.
            </div>
          ) : (
            <>
              <label className="relative mb-6 block">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-violet-500"
                  placeholder="Rechercher par code, titre ou professeur..."
                />
              </label>
              {filteredCourses.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Aucun cours ne correspond à votre recherche.
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedCourses.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                        <BookOpenIcon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#17204e]">
                          {course.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {course.code} · {course.level} ·{' '}
                          {course.teacher.user.email}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="min-h-11 min-w-11"
                          aria-label="Modifier le cours"
                          onClick={() => openEdit(course)}
                        >
                          <Edit3Icon />
                        </Button>
                        {course.isPublished && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="min-h-11 min-w-11 text-red-600"
                            aria-label={`Désactiver ${course.title}`}
                            onClick={() => setCourseToDeactivate(course)}
                          >
                            <ArchiveIcon />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <Pagination className="mt-5">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        className={
                          currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage > 1) setPage(currentPage - 1);
                        }}
                      />
                    </PaginationItem>
                    {Array.from(
                      { length: totalPages },
                      (_, index) => index + 1,
                    ).map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === pageNumber}
                          onClick={(event) => {
                            event.preventDefault();
                            setPage(pageNumber);
                          }}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        className={
                          currentPage === totalPages
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage < totalPages) setPage(currentPage + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
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
              <DialogDescription>
                Choisissez d&apos;abord un professeur puis une filière pour débloquer
                les champs suivants.
              </DialogDescription>
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
                {!form.teacherId ? (
                  <p className="text-xs text-slate-500">
                    Sélectionnez d&apos;abord un professeur.
                  </p>
                ) : !teacherSubjects.length ? (
                  <p className="text-xs text-red-600">
                    Ce professeur n’a aucune matière renseignée — modifiez son
                    affectation dans Professeurs.
                  </p>
                ) : null}
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
                {!selectedProgram && (
                  <p className="text-xs text-slate-500">
                    Sélectionnez d&apos;abord une filière.
                  </p>
                )}
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
      <Dialog
        open={courseToDeactivate !== null}
        onOpenChange={(open) => {
          if (!open && !deactivating) setCourseToDeactivate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver le cours</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment désactiver le cours « {courseToDeactivate?.title} » ?
              Les étudiants ayant une inscription active empêchent cette action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deactivating}
              onClick={() => setCourseToDeactivate(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivating}
              onClick={() => void deactivateCourse()}
            >
              {deactivating ? 'Désactivation...' : 'Désactiver'}
            </Button>
          </DialogFooter>
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
