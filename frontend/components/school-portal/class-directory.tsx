'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, UsersRound } from 'lucide-react';
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

type AcademicYear = { id: string; label: string };
type Program = { id: string; name: string };
type Subject = { id: string; name: string };
type TeacherOption = {
  teacherId: string;
  teacher: { user: { email: string } };
  subjects: { subject: { id: string } }[];
};
type Requirement = {
  id: string;
  hoursPerWeek: number;
  subject: { id: string; name: string };
  assignment: {
    teacher: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      user: { email: string };
    };
  } | null;
};
type SchoolClass = {
  id: string;
  name: string;
  level: number | null;
  studentCount: number | null;
  academicYear: { id: string; label: string };
  programId: string | null;
  program: { id: string; name: string } | null;
  requirements: Requirement[];
};

export function ClassDirectory() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [classesRes, yearsRes, programsRes, subjectsRes, teachersRes] = await Promise.all([
        apiClient.get('/schools/me/classes'),
        apiClient.get('/academic-years'),
        apiClient.get('/schools/me/programs'),
        apiClient.get('/schools/me/subjects'),
        apiClient.get('/schools/me/teachers'),
      ]);
      setClasses(classesRes.data.data || []);
      setYears(yearsRes.data.data || []);
      setPrograms((programsRes.data.data || []).filter((program: { isActive: boolean }) => program.isActive));
      setSubjects(subjectsRes.data.data || []);
      setTeachers(teachersRes.data.data || []);
    } catch (error) {
      console.error('Erreur chargement classes:', error);
      toast.error('Impossible de charger les classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadAll();
    });
    return () => {
      active = false;
    };
  }, [loadAll]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">Classes</h1>
          <p className="mt-1 text-sm text-violet-600">
            Créez vos classes, définissez leurs besoins horaires par matière et affectez un professeur qualifié.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={years.length === 0}>
          <Plus /> Nouvelle classe
        </Button>
      </header>
      {years.length === 0 && !loading && (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
          Aucune année scolaire disponible. Demandez à l&apos;administrateur GET d&apos;en créer une.
        </p>
      )}
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement...</p>
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Aucune classe pour le moment.
        </p>
      ) : (
        <div className="space-y-3">
          {classes.map((schoolClass) => (
            <ClassCard
              key={schoolClass.id}
              schoolClass={schoolClass}
              subjects={subjects}
              teachers={teachers}
              programs={programs}
              expanded={expanded === schoolClass.id}
              onToggle={() =>
                setExpanded((current) => (current === schoolClass.id ? null : schoolClass.id))
              }
              onChanged={loadAll}
            />
          ))}
        </div>
      )}
      {createOpen && (
        <CreateClassDialog
          years={years}
          programs={programs}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void loadAll();
          }}
        />
      )}
    </div>
  );
}

function CreateClassDialog({
  years,
  programs,
  onClose,
  onCreated,
}: {
  years: AcademicYear[];
  programs: Program[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [academicYearId, setAcademicYearId] = useState(years[0]?.id || '');
  const [programId, setProgramId] = useState('');
  const [level, setLevel] = useState('');
  const [studentCount, setStudentCount] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        await apiClient.post('/schools/me/classes', {
          name,
          academicYearId,
          programId: programId || undefined,
          level: level ? Number(level) : undefined,
          studentCount: studentCount ? Number(studentCount) : undefined,
        });
        toast.success('Classe créée');
        onCreated();
      } catch (error) {
        toast.error(axiosMessage(error) || 'Impossible de créer cette classe');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouvelle classe</DialogTitle>
            <DialogDescription>Ex. &quot;L2 Info - Groupe A&quot;.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">Nom</Label>
              <Input id="class-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-year">Année scolaire</Label>
              <Select
                items={years.map((year) => ({ value: year.id, label: year.label }))}
                value={academicYearId}
                onValueChange={(value) => setAcademicYearId(value ?? '')}
              >
                <SelectTrigger id="class-year">
                  <SelectValue placeholder="Choisir une année" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-program">Filière (facultatif)</Label>
              <select
                id="class-program"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-500"
                value={programId}
                onChange={(event) => setProgramId(event.target.value)}
              >
                <option value="">Aucune filière</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="class-level">Niveau (facultatif)</Label>
                <Input id="class-level" type="number" min={1} value={level} onChange={(event) => setLevel(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-count">Effectif (facultatif)</Label>
                <Input id="class-count" type="number" min={0} value={studentCount} onChange={(event) => setStudentCount(event.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !name || !academicYearId}>
              {saving ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassCard({
  schoolClass,
  subjects,
  teachers,
  programs,
  expanded,
  onToggle,
  onChanged,
}: {
  schoolClass: SchoolClass;
  subjects: Subject[];
  teachers: TeacherOption[];
  programs: Program[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [subjectId, setSubjectId] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('4');
  const [adding, setAdding] = useState(false);

  const updateProgram = async (programId: string) => {
    try {
      await apiClient.patch(`/schools/me/classes/${schoolClass.id}`, {
        programId: programId || null,
      });
      toast.success('Filière mise à jour');
      onChanged();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de mettre à jour la filière');
    }
  };

  const availableSubjects = useMemo(
    () => subjects.filter((subject) => !schoolClass.requirements.some((req) => req.subject.id === subject.id)),
    [subjects, schoolClass.requirements],
  );

  const addRequirement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setAdding(true);
      try {
        await apiClient.post(`/schools/me/classes/${schoolClass.id}/requirements`, {
          subjectId,
          academicYearId: schoolClass.academicYear.id,
          hoursPerWeek: Number(hoursPerWeek),
        });
        toast.success('Matière ajoutée');
        setSubjectId('');
        setHoursPerWeek('4');
        onChanged();
      } catch (error) {
        toast.error(axiosMessage(error) || 'Impossible d’ajouter cette matière');
      } finally {
        setAdding(false);
      }
    })();
  };

  const removeRequirement = async (requirementId: string) => {
    try {
      await apiClient.delete(`/schools/me/classes/${schoolClass.id}/requirements/${requirementId}`);
      toast.success('Matière retirée');
      onChanged();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de retirer cette matière');
    }
  };

  const assignTeacher = async (requirementId: string, teacherId: string) => {
    if (!teacherId) return;
    try {
      await apiClient.put(`/schools/me/classes/${schoolClass.id}/requirements/${requirementId}/teacher`, {
        teacherId,
      });
      toast.success('Professeur affecté');
      onChanged();
    } catch (error) {
      toast.error(axiosMessage(error) || "Impossible d'affecter ce professeur");
    }
  };

  const unassignTeacher = async (requirementId: string) => {
    try {
      await apiClient.delete(`/schools/me/classes/${schoolClass.id}/requirements/${requirementId}/teacher`);
      toast.success('Professeur retiré');
      onChanged();
    } catch (error) {
      toast.error(axiosMessage(error) || 'Impossible de retirer ce professeur');
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div>
            <p className="font-bold text-slate-800">{schoolClass.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {schoolClass.academicYear.label}
              {schoolClass.studentCount ? ` · ${schoolClass.studentCount} élèves` : ''}
              {' · '}
              {schoolClass.requirements.length} matière(s)
              {' · '}
              {schoolClass.program ? schoolClass.program.name : (
                <span className="text-amber-600">sans filière associée</span>
              )}
            </p>
          </div>
          {expanded ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
        </button>
        {expanded && (
          <div className="space-y-3 border-t border-slate-100 p-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Filière</span>
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-500"
                value={schoolClass.programId || ''}
                onChange={(event) => void updateProgram(event.target.value)}
              >
                <option value="">Aucune filière</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            {schoolClass.requirements.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune matière définie pour cette classe.</p>
            ) : (
              <div className="space-y-2">
                {schoolClass.requirements.map((requirement) => {
                  const qualifiedTeachers = teachers.filter((teacher) =>
                    teacher.subjects.some((s) => s.subject.id === requirement.subject.id),
                  );
                  return (
                    <div
                      key={requirement.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800">{requirement.subject.name}</p>
                        <p className="mt-0.5 text-slate-500">{requirement.hoursPerWeek} h/semaine</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <UsersRound className="size-4 text-slate-400" />
                        <select
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-violet-500"
                          value={requirement.assignment?.teacher.id || ''}
                          onChange={(event) =>
                            event.target.value
                              ? void assignTeacher(requirement.id, event.target.value)
                              : void unassignTeacher(requirement.id)
                          }
                        >
                          <option value="">Aucun professeur</option>
                          {qualifiedTeachers.map((teacher) => (
                            <option key={teacher.teacherId} value={teacher.teacherId}>
                              {teacher.teacher.user.email}
                            </option>
                          ))}
                        </select>
                        {qualifiedTeachers.length === 0 && (
                          <span className="text-[10px] text-amber-600">Aucun prof qualifié dans cette matière</span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Retirer ${requirement.subject.name}`}
                        onClick={() => void removeRequirement(requirement.id)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {availableSubjects.length > 0 && (
              <form onSubmit={addRequirement} className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
                <div className="min-w-[180px] flex-1 space-y-1">
                  <Label className="text-xs">Matière</Label>
                  <Select
                    items={availableSubjects.map((subject) => ({ value: subject.id, label: subject.name }))}
                    value={subjectId}
                    onValueChange={(value) => setSubjectId(value ?? '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une matière" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">h/semaine</Label>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    value={hoursPerWeek}
                    onChange={(event) => setHoursPerWeek(event.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" disabled={adding || !subjectId}>
                  <Plus /> Ajouter
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
