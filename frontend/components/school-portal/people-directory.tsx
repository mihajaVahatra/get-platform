'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3Icon, PlusIcon, SearchIcon, Trash2Icon, UsersRoundIcon } from 'lucide-react';
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

type TeacherAssignment = {
  id: string;
  teacherId: string;
  department?: string | null;
  specialty?: string | null;
  isActive: boolean;
  teacher: {
    id: string;
    user: {
      email: string;
    };
  };
};

type AssignmentForm = {
  teacherId: string;
  department: string;
  specialty: string;
};

const EMPTY_FORM: AssignmentForm = { teacherId: '', department: '', specialty: '' };

export function TeacherDirectory() {
  const [teachers, setTeachers] = useState<TeacherAssignment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeDialog, setActiveDialog] = useState<'assign' | 'edit' | null>(null);
  const [selected, setSelected] = useState<TeacherAssignment | null>(null);
  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchTeachers = useCallback(async () => {
    try {
      const response = await apiClient.get('/schools/me/teachers');
      setTeachers(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement professeurs:', error);
      toast.error('Impossible de charger les professeurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchTeachers();
    });
    return () => {
      active = false;
    };
  }, [fetchTeachers]);

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter((assignment) =>
      [
        assignment.teacher.user.email,
        assignment.department || '',
        assignment.specialty || '',
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, teachers]);

  const openAssignDialog = () => {
    setForm(EMPTY_FORM);
    setSelected(null);
    setActiveDialog('assign');
  };

  const openEditDialog = (assignment: TeacherAssignment) => {
    setSelected(assignment);
    setForm({
      teacherId: assignment.teacherId,
      department: assignment.department || '',
      specialty: assignment.specialty || '',
    });
    setActiveDialog('edit');
  };

  const submitAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      setSaving(true);
      try {
        if (activeDialog === 'assign') {
          await apiClient.post('/schools/me/teachers', form);
          toast.success('Professeur affecté');
        } else if (selected) {
          await apiClient.patch(`/schools/me/teachers/${selected.id}`, {
            department: form.department || undefined,
            specialty: form.specialty || undefined,
          });
          toast.success('Affectation mise à jour');
        }
        setActiveDialog(null);
        await fetchTeachers();
      } catch (error) {
        console.error('Erreur enregistrement affectation:', error);
        toast.error('Impossible d’enregistrer cette affectation');
      } finally {
        setSaving(false);
      }
    })();
  };

  const deactivateAssignment = (assignment: TeacherAssignment) => {
    void (async () => {
      try {
        await apiClient.patch(`/schools/me/teachers/${assignment.id}`, { isActive: false });
        toast.success('Professeur retiré de l’établissement');
        await fetchTeachers();
      } catch (error) {
        console.error('Erreur retrait professeur:', error);
        toast.error('Impossible de retirer ce professeur');
      }
    })();
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">Professeurs</h1>
          <p className="mt-1 text-sm text-violet-600">Affectations actives de votre établissement.</p>
        </div>
        <Button onClick={openAssignDialog}><PlusIcon /> Affecter un professeur</Button>
      </header>

      <Card>
        <CardContent className="p-5">
          <label className="relative mb-6 block">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-violet-500" placeholder="Rechercher par e-mail, département ou spécialité..." />
          </label>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Chargement des professeurs...</div>
          ) : filteredTeachers.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">Aucun professeur affecté à cet établissement.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="pb-3 font-semibold">Professeur</th><th className="pb-3 font-semibold">Département</th><th className="pb-3 font-semibold">Spécialité</th><th className="pb-3 font-semibold">Statut</th><th className="pb-3 font-semibold">Actions</th></tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-slate-50 text-slate-600">
                      <td className="py-4"><span className="mr-2 inline-grid size-8 place-items-center rounded-full bg-violet-100 text-violet-600"><UsersRoundIcon className="size-4" /></span>{assignment.teacher.user.email}</td>
                      <td>{assignment.department || 'Non renseigné'}</td>
                      <td>{assignment.specialty || 'Non renseignée'}</td>
                      <td><Status /></td>
                      <td><div className="flex gap-2"><Button variant="ghost" size="icon-sm" aria-label="Modifier l’affectation" onClick={() => openEditDialog(assignment)}><Edit3Icon /></Button><Button variant="ghost" size="icon-sm" className="text-red-600" aria-label="Retirer le professeur" onClick={() => deactivateAssignment(assignment)}><Trash2Icon /></Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={activeDialog !== null} onOpenChange={(open) => setActiveDialog(open ? activeDialog : null)}>
        <DialogContent>
          <form onSubmit={submitAssignment}>
            <DialogHeader>
              <DialogTitle>{activeDialog === 'assign' ? 'Affecter un professeur' : 'Modifier l’affectation'}</DialogTitle>
              <DialogDescription>{activeDialog === 'assign' ? 'Saisissez l’identifiant d’un professeur déjà enregistré.' : 'Mettez à jour le département et la spécialité de ce professeur.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {activeDialog === 'assign' && <div className="space-y-2"><Label htmlFor="teacher-id">Identifiant du professeur</Label><Input id="teacher-id" required value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })} placeholder="UUID du professeur" /></div>}
              <div className="space-y-2"><Label htmlFor="teacher-department">Département</Label><Input id="teacher-department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Ex. Informatique" /></div>
              <div className="space-y-2"><Label htmlFor="teacher-specialty">Spécialité</Label><Input id="teacher-specialty" value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} placeholder="Ex. Algorithmique" /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setActiveDialog(null)}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? 'Enregistrement...' : activeDialog === 'assign' ? 'Affecter' : 'Enregistrer'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Status() {
  return <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">Actif</span>;
}
