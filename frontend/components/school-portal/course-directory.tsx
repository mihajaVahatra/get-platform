'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Edit3Icon, PlusIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TeacherAssignment = { teacherId: string; department?: string | null; specialty?: string | null; teacher: { user: { email: string } } };
type Course = { id: string; teacherId: string; code: string; title: string; description?: string | null; level: string; group?: string | null; credits: number; room?: string | null; schedule?: string | null; isPublished: boolean; teacher: { user: { email: string } } };
type CourseForm = { teacherId: string; code: string; title: string; description: string; level: string; group: string; credits: string; room: string; schedule: string; isPublished: string };
const EMPTY_FORM: CourseForm = { teacherId: '', code: '', title: '', description: '', level: '', group: '', credits: '0', room: '', schedule: '', isPublished: 'true' };

export function CourseDirectory() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [coursesResponse, teachersResponse] = await Promise.all([
        apiClient.get('/schools/me/courses'),
        apiClient.get('/schools/me/teachers'),
      ]);
      setCourses(coursesResponse.data.data || []);
      setTeachers(teachersResponse.data.data || []);
    } catch (error) {
      console.error('Erreur chargement cours:', error);
      toast.error('Impossible de charger les cours');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return fetchData(); });
    return () => { active = false; };
  }, [fetchData]);

  const openCreate = () => { setSelectedCourse(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (course: Course) => {
    setSelectedCourse(course);
    setForm({ teacherId: course.teacherId, code: course.code, title: course.title, description: course.description || '', level: course.level, group: course.group || '', credits: String(course.credits), room: course.room || '', schedule: course.schedule || '', isPublished: String(course.isPublished) });
    setDialogOpen(true);
  };
  const setField = (field: keyof CourseForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      const payload = { ...form, description: form.description || undefined, group: form.group || undefined, room: form.room || undefined, schedule: form.schedule || undefined, credits: Number(form.credits), isPublished: form.isPublished === 'true' };
      try {
        if (selectedCourse) await apiClient.put(`/schools/me/courses/${selectedCourse.id}`, payload);
        else await apiClient.post('/schools/me/courses', payload);
        toast.success(selectedCourse ? 'Cours mis à jour' : 'Cours créé');
        setDialogOpen(false);
        await fetchData();
      } catch (error) {
        console.error('Erreur enregistrement cours:', error);
        toast.error('Impossible d’enregistrer le cours');
      } finally { setSaving(false); }
    })();
  };

  return <div className="mx-auto max-w-[1500px] space-y-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">Cours</h1><p className="mt-1 text-sm text-violet-600">Créez des cours et affectez-les à vos professeurs.</p></div><Button onClick={openCreate}><PlusIcon /> Créer un cours</Button></header><Card><CardContent className="p-5">{loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement des cours...</div> : courses.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">Aucun cours créé pour cet établissement.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><tr><th className="pb-3">Code</th><th className="pb-3">Cours</th><th className="pb-3">Niveau / groupe</th><th className="pb-3">Professeur</th><th className="pb-3">Crédits</th><th className="pb-3">Actions</th></tr></thead><tbody>{courses.map((course) => <tr key={course.id} className="border-b border-slate-50 text-slate-600"><td className="py-4 font-medium">{course.code}</td><td><p className="font-medium text-slate-800">{course.title}</p><p className="text-xs text-slate-500">{course.room || 'Salle non renseignée'}{course.schedule ? ` · ${course.schedule}` : ''}</p></td><td>{course.level}{course.group ? ` · ${course.group}` : ''}</td><td>{course.teacher.user.email}</td><td>{course.credits}</td><td><Button variant="ghost" size="icon-sm" aria-label="Modifier le cours" onClick={() => openEdit(course)}><Edit3Icon /></Button></td></tr>)}</tbody></table></div>}</CardContent></Card><Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-2xl"><form onSubmit={submit}><DialogHeader><DialogTitle>{selectedCourse ? 'Modifier le cours' : 'Créer un cours'}</DialogTitle><DialogDescription>Le professeur sélectionné doit être affecté activement à votre établissement.</DialogDescription></DialogHeader><div className="grid gap-4 py-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="course-teacher">Professeur</Label><Select value={form.teacherId} onValueChange={(value) => setField('teacherId', value ?? '')}><SelectTrigger id="course-teacher"><SelectValue placeholder="Choisir un professeur" /></SelectTrigger><SelectContent>{teachers.map((assignment) => <SelectItem key={assignment.teacherId} value={assignment.teacherId}>{assignment.teacher.user.email}{assignment.department ? ` · ${assignment.department}` : ''}</SelectItem>)}</SelectContent></Select>{teachers.length === 0 && <p className="text-xs text-amber-600">Aucun professeur actif n’est affecté à cet établissement.</p>}</div><Field label="Code" id="course-code" value={form.code} onChange={(value) => setField('code', value)} required /><Field label="Titre" id="course-title" value={form.title} onChange={(value) => setField('title', value)} required /><Field label="Niveau" id="course-level" value={form.level} onChange={(value) => setField('level', value)} required /><Field label="Groupe" id="course-group" value={form.group} onChange={(value) => setField('group', value)} /><Field label="Crédits" id="course-credits" type="number" value={form.credits} onChange={(value) => setField('credits', value)} required /><Field label="Salle" id="course-room" value={form.room} onChange={(value) => setField('room', value)} /><Field label="Emploi du temps" id="course-schedule" value={form.schedule} onChange={(value) => setField('schedule', value)} /><div className="space-y-2 sm:col-span-2"><Label htmlFor="course-description">Description</Label><textarea id="course-description" value={form.description} onChange={(event) => setField('description', event.target.value)} rows={3} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm" /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button type="submit" disabled={saving || !form.teacherId}>{saving ? 'Enregistrement...' : selectedCourse ? 'Enregistrer' : 'Créer le cours'}</Button></DialogFooter></form></DialogContent></Dialog></div>;
}

function Field({ label, id, type = 'text', value, onChange, required = false }: { label: string; id: string; type?: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} min={type === 'number' ? '0' : undefined} /></div>; }
