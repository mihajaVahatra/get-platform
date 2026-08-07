'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { MegaphoneIcon, SearchIcon, SendIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Announcement = {
  id: string;
  title: string;
  body: string;
  targetType: string;
  targetClasses: string[];
  imageUrl?: string | null;
  createdAt: string;
  recipientCount: number;
  readCount: number;
};
type Student = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  user: { email: string };
};
type TeacherAssignment = {
  id: string;
  teacherId: string;
  department?: string | null;
  specialty?: string | null;
  teacher: { user: { email: string } };
};
type Meta = { page: number; totalPages: number };

const TARGETS: Record<string, string> = {
  ALL_STUDENTS: 'Tous les étudiants',
  CLASSES: 'Classes spécifiques',
  STUDENTS: 'Étudiants spécifiques',
  TEACHERS: 'Professeurs',
  EVERYONE: 'Tout le monde (étudiants et professeurs)',
};

export default function SchoolCommunicationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('ALL_STUDENTS');
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOptions, setStudentOptions] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teachers, setTeachers] = useState<TeacherAssignment[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [historyMeta, setHistoryMeta] = useState<Meta>({
    page: 1,
    totalPages: 1,
  });
  const [sending, setSending] = useState(false);

  const loadHistory = useCallback(async (page = 1) => {
    try {
      const response = await apiClient.get(
        `/schools/me/announcements?page=${page}&limit=10`,
      );
      setHistory(response.data.data || []);
      setHistoryMeta(response.data.meta || { page, totalPages: 1 });
    } catch (error) {
      console.error('Erreur chargement annonces:', error);
      toast.error("Impossible de charger l'historique des annonces");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const [classesResponse, teachersResponse] = await Promise.all([
          apiClient.get('/schools/me/students/classes'),
          apiClient.get('/schools/me/teachers'),
        ]);
        if (!active) return;
        setClasses(classesResponse.data.data || []);
        setTeachers(teachersResponse.data.data || []);
      } catch (error) {
        if (active)
          console.error('Erreur chargement des destinataires:', error);
      }
      if (active) await loadHistory();
    });
    return () => {
      active = false;
    };
  }, [loadHistory]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void apiClient
        .get(
          `/schools/me/students?search=${encodeURIComponent(studentSearch)}&page=1&limit=20`,
        )
        .then((response) => {
          if (active) setStudentOptions(response.data.data || []);
        })
        .catch((error) => {
          if (active) console.error('Erreur recherche étudiants:', error);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [studentSearch]);

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter((item) =>
      [
        item.teacher.user.email,
        item.department || '',
        item.specialty || '',
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [teacherSearch, teachers]);

  const toggle = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) =>
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (targetType === 'CLASSES' && selectedClasses.length === 0)
      return toast.error('Choisissez au moins une classe');
    if (targetType === 'STUDENTS' && selectedStudentIds.length === 0)
      return toast.error('Choisissez au moins un étudiant');
    if (targetType === 'TEACHERS' && selectedTeacherIds.length === 0)
      return toast.error('Choisissez au moins un professeur');
    void (async () => {
      setSending(true);
      try {
        const payload = {
          title,
          body,
          targetType,
          ...(targetType === 'CLASSES' ? { classes: selectedClasses } : {}),
          ...(targetType === 'STUDENTS'
            ? { studentIds: selectedStudentIds }
            : {}),
          ...(targetType === 'TEACHERS'
            ? { teacherIds: selectedTeacherIds }
            : {}),
        };
        const response = await apiClient.post(
          '/schools/me/announcements',
          payload,
        );
        const announcementId = response.data.data?.announcementId;
        if (photo && announcementId) {
          const form = new FormData();
          form.append('file', photo);
          await apiClient.post(
            `/schools/me/announcements/${announcementId}/photo`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } },
          );
        }
        toast.success(
          `Annonce envoyée à ${response.data.data?.recipientCount ?? 0} destinataire(s)`,
        );
        setTitle('');
        setBody('');
        setPhoto(null);
        setSelectedClasses([]);
        setSelectedStudentIds([]);
        setSelectedTeacherIds([]);
        await loadHistory(1);
      } catch (error: unknown) {
        console.error('Erreur envoi annonce:', error);
        const message = (
          error as { response?: { data?: { message?: string } } }
        ).response?.data?.message;
        toast.error(message || "Impossible d'envoyer l'annonce");
      } finally {
        setSending(false);
      }
    })();
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          Communications
        </h1>
        <p className="mt-1 text-sm text-indigo-600">
          Diffusez une annonce et suivez sa lecture dans les notifications des
          destinataires.
        </p>
      </header>
      <Card>
        <CardContent className="p-6">
          <div className="mb-6 flex gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-800">
            <MegaphoneIcon className="mt-0.5 size-5 shrink-0" />
            <p>
              Les destinataires sont toujours résolus à partir de votre école.
              Les identifiants d’une autre école sont ignorés sans révéler leur
              existence.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="announcement-title">Titre</Label>
              <Input
                id="announcement-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                placeholder="Ex. Réinscription 2026–2027"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-target">Destinataires</Label>
              <Select
                items={Object.entries(TARGETS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                value={targetType}
                onValueChange={(value) =>
                  setTargetType(value ?? 'ALL_STUDENTS')
                }
              >
                <SelectTrigger id="announcement-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TARGETS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {targetType === 'CLASSES' && (
              <TargetList
                label="Classes"
                empty="Aucune classe inscrite pour le moment."
                items={classes.map((item) => ({ id: item, label: item }))}
                selected={selectedClasses}
                onToggle={(id) => toggle(id, setSelectedClasses)}
              />
            )}
            {targetType === 'STUDENTS' && (
              <TargetList
                label="Étudiants"
                search={studentSearch}
                onSearch={setStudentSearch}
                empty="Aucun étudiant trouvé."
                items={studentOptions.map((student) => ({
                  id: student.id,
                  label: studentName(student),
                  detail: student.user.email,
                }))}
                selected={selectedStudentIds}
                onToggle={(id) => toggle(id, setSelectedStudentIds)}
              />
            )}
            {targetType === 'TEACHERS' && (
              <TargetList
                label="Professeurs"
                search={teacherSearch}
                onSearch={setTeacherSearch}
                empty="Aucun professeur affecté trouvé."
                items={filteredTeachers.map((assignment) => ({
                  id: assignment.teacherId,
                  label: assignment.teacher.user.email,
                  detail: [assignment.department, assignment.specialty]
                    .filter(Boolean)
                    .join(' · '),
                }))}
                selected={selectedTeacherIds}
                onToggle={(id) => toggle(id, setSelectedTeacherIds)}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="announcement-photo">Photo (facultative)</Label>
              <input
                id="announcement-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setPhoto(event.target.files?.[0] ?? null)
                }
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-body">Message</Label>
              <textarea
                id="announcement-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={5000}
                required
                rows={7}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500"
                placeholder="Rédigez votre annonce…"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={sending}>
                {sending ? (
                  'Envoi...'
                ) : (
                  <>
                    <SendIcon /> Envoyer l’annonce
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <section>
        <h2 className="mb-3 text-lg font-extrabold text-[#17204e]">
          Historique des annonces
        </h2>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Aucune annonce envoyée.
            </p>
          ) : (
            history.map((announcement) => (
              <Card key={announcement.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {announcement.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={announcement.imageUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <h3 className="font-bold text-slate-800">
                          {announcement.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {announcement.body}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(announcement.createdAt).toLocaleDateString(
                        'fr-FR',
                      )}
                    </p>
                  </div>
                  <p className="mt-3 text-xs font-medium text-indigo-700">
                    {targetSummary(announcement)} · {announcement.readCount}/
                    {announcement.recipientCount} lu(s)
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        {historyMeta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={historyMeta.page <= 1}
              onClick={() => void loadHistory(historyMeta.page - 1)}
            >
              Précédent
            </Button>
            <span>
              Page {historyMeta.page} / {historyMeta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={historyMeta.page >= historyMeta.totalPages}
              onClick={() => void loadHistory(historyMeta.page + 1)}
            >
              Suivant
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function TargetList({
  label,
  search,
  onSearch,
  items,
  selected,
  onToggle,
  empty,
}: {
  label: string;
  search?: string;
  onSearch?: (value: string) => void;
  items: { id: string; label: string; detail?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  empty: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {onSearch && (
        <label className="relative block">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="pl-9"
            maxLength={150}
            placeholder={`Rechercher un ${label.toLowerCase().slice(0, -1)}...`}
          />
        </label>
      )}
      <p className="text-xs text-slate-500">{selected.length} sélectionné(s)</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span>
                <span className="block">{item.label}</span>
                {item.detail && (
                  <span className="block text-xs text-slate-500">
                    {item.detail}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function studentName(student: Student) {
  return (
    [student.firstName, student.lastName].filter(Boolean).join(' ') ||
    student.user.email
  );
}

function targetSummary(announcement: Announcement) {
  if (announcement.targetType === 'CLASSES')
    return `Classe${announcement.targetClasses.length > 1 ? 's' : ''} : ${announcement.targetClasses.join(', ')}`;
  if (announcement.targetType === 'STUDENTS')
    return `${announcement.recipientCount} étudiant(s)`;
  if (announcement.targetType === 'TEACHERS')
    return `${announcement.recipientCount} professeur(s)`;
  if (announcement.targetType === 'EVERYONE')
    return 'Tout le monde (étudiants et professeurs)';
  return 'Tous les étudiants';
}
