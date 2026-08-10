'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { StudentIdentity } from '@/components/teacher-portal/student-identity';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Cours affecté au professeur, tel que listé dans le sélecteur de cours. */
type Course = {
  id: string;
  title: string;
  school: { name: string };
};

/** Devoir d'un cours ; `publishedAt` non renseigné signifie que le devoir est encore à l'état brouillon. */
type Assignment = {
  id: string;
  title: string;
  instructions?: string | null;
  dueAt?: string | null;
  publishedAt?: string | null;
};

/** Rendu d'un étudiant pour un devoir donné, avec sa note et son commentaire éventuels. */
type Submission = {
  id: string;
  contentUrl?: string | null;
  submittedAt: string;
  grade?: number | null;
  feedback?: string | null;
  student: {
    firstName: string;
    lastName: string;
    user: { email: string };
  };
};

/**
 * Vue "Devoirs" du portail professeur.
 *
 * Si `courseId` est fourni, la vue est verrouillée sur ce cours (pas de
 * sélecteur) ; sinon elle liste les cours du professeur et permet d'en
 * choisir un. Pour le cours actif, affiche la liste des devoirs (brouillon
 * ou publié), permet d'en créer un nouveau (`POST /teacher/courses/:id/assignments`),
 * de le publier (`PATCH /teacher/assignments/:id/publish`), et d'ouvrir la
 * boîte de dialogue des soumissions pour les noter
 * (`GET /teacher/assignments/:id/submissions`, `PATCH /teacher/submissions/:id/grade`).
 *
 * @param courseId - Identifiant du cours à afficher ; si omis, un sélecteur de cours est affiché.
 */
export function TeacherAssignments({ courseId }: { courseId?: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(!courseId);
  const [coursesFailed, setCoursesFailed] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentsFailed, setAssignmentsFailed] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionsFailed, setSubmissionsFailed] = useState(false);

  const activeCourseId = courseId || selectedCourseId;

  /** Charge les cours du professeur (ignoré si `courseId` est imposé par le parent) et sélectionne le premier par défaut. */
  const fetchCourses = useCallback(async () => {
    if (courseId) return;
    try {
      setLoadingCourses(true);
      setCoursesFailed(false);
      const response = await apiClient.get('/teacher/courses');
      const assignedCourses = (response.data.data || []) as Course[];
      setCourses(assignedCourses);
      setSelectedCourseId((current) =>
        assignedCourses.some((course) => course.id === current)
          ? current
          : assignedCourses[0]?.id || '',
      );
    } catch (error) {
      console.error('Erreur chargement cours devoirs:', error);
      setCoursesFailed(true);
      toast.error('Impossible de charger vos cours');
    } finally {
      setLoadingCourses(false);
    }
  }, [courseId]);

  /** Charge les devoirs du cours actif ; réinitialise la liste si aucun cours n'est sélectionné. */
  const fetchAssignments = useCallback(async () => {
    if (!activeCourseId) {
      setAssignments([]);
      setLoadingAssignments(false);
      return;
    }
    try {
      setLoadingAssignments(true);
      setAssignmentsFailed(false);
      const response = await apiClient.get(
        `/teacher/courses/${activeCourseId}`,
      );
      setAssignments(response.data.data.assignments || []);
    } catch (error) {
      console.error('Erreur chargement devoirs:', error);
      setAssignmentsFailed(true);
      toast.error('Impossible de charger les devoirs');
    } finally {
      setLoadingAssignments(false);
    }
  }, [activeCourseId]);

  /** Charge les soumissions d'un devoir donné (utilisé à l'ouverture de la boîte de dialogue de notation). */
  const fetchSubmissions = useCallback(async (assignmentId: string) => {
    try {
      setLoadingSubmissions(true);
      setSubmissionsFailed(false);
      const response = await apiClient.get(
        `/teacher/assignments/${assignmentId}/submissions`,
      );
      setSubmissions(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement soumissions:', error);
      setSubmissionsFailed(true);
      toast.error('Impossible de charger les soumissions');
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchCourses();
    });
    return () => {
      active = false;
    };
  }, [fetchCourses]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchAssignments();
    });
    return () => {
      active = false;
    };
  }, [fetchAssignments]);

  /** Crée un nouveau devoir en brouillon pour le cours actif et l'ajoute à la liste locale. */
  const createAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeCourseId) return;
    void (async () => {
      try {
        setSaving(true);
        const response = await apiClient.post(
          `/teacher/courses/${activeCourseId}/assignments`,
          {
            title,
            instructions: instructions || undefined,
            dueAt: dueAt || undefined,
          },
        );
        setAssignments((current) => [
          ...current,
          response.data.data as Assignment,
        ]);
        setCreationOpen(false);
        setTitle('');
        setInstructions('');
        setDueAt('');
        toast.success('Devoir créé en brouillon');
      } catch (error) {
        console.error('Erreur création devoir:', error);
        toast.error('Impossible de créer le devoir');
      } finally {
        setSaving(false);
      }
    })();
  };

  /** Publie un devoir en brouillon, le rendant visible et soumissible par les étudiants. */
  const publishAssignment = (assignmentId: string) => {
    void (async () => {
      try {
        setPublishingId(assignmentId);
        const response = await apiClient.patch(
          `/teacher/assignments/${assignmentId}/publish`,
        );
        const assignment = response.data.data as Assignment;
        setAssignments((current) =>
          current.map((item) => (item.id === assignmentId ? assignment : item)),
        );
        toast.success('Devoir publié');
      } catch (error) {
        console.error('Erreur publication devoir:', error);
        toast.error('Impossible de publier le devoir');
      } finally {
        setPublishingId(null);
      }
    })();
  };

  /** Ouvre la boîte de dialogue de notation pour un devoir et charge ses soumissions. */
  const openSubmissions = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setSubmissions([]);
    void fetchSubmissions(assignment.id);
  };

  /** Enregistre la note et le commentaire d'une soumission, puis met à jour la liste locale avec la réponse serveur. */
  const saveSubmission = (
    submissionId: string,
    grade: number,
    feedback: string,
  ) =>
    apiClient
      .patch(`/teacher/submissions/${submissionId}/grade`, {
        grade,
        feedback: feedback || undefined,
      })
      .then((response) => {
        const submission = response.data.data as Submission;
        setSubmissions((current) =>
          current.map((item) => (item.id === submissionId ? submission : item)),
        );
      });

  if (loadingCourses)
    return <p className="text-sm text-muted-foreground">Chargement de vos cours…</p>;

  if (coursesFailed)
    return (
      <div className="rounded-xl border border-rose-100 bg-rose-50 dark:bg-rose-500/15 p-5 text-sm text-rose-700 dark:text-rose-300">
        <p>Vos cours n’ont pas pu être chargés.</p>
        <button
          className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-300"
          onClick={() => void fetchCourses()}
        >
          Réessayer
        </button>
      </div>
    );

  if (!courseId && courses.length === 0)
    return (
      <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Aucun cours ne vous est actuellement affecté.
      </p>
    );

  return (
    <div className="space-y-5">
      {!courseId && (
        <div className="block max-w-xl">
          <span className="mb-1 block text-xs font-bold text-[#34406b]">
            Cours
          </span>
          <Select
            items={courses.map((course) => ({
              value: course.id,
              label: `${course.title} · ${course.school.name}`,
            }))}
            value={selectedCourseId}
            onValueChange={(value) => setSelectedCourseId(value ?? '')}
          >
            <SelectTrigger className="h-10 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title} · {course.school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-[#17204e]">Devoirs</h2>
          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
            onClick={() => setCreationOpen(true)}
          >
            <Plus className="size-4" /> Nouveau devoir
          </button>
        </div>
        {loadingAssignments ? (
          <p className="text-xs text-muted-foreground">Chargement des devoirs…</p>
        ) : assignmentsFailed ? (
          <button
            className="text-xs font-bold text-indigo-600 dark:text-indigo-300"
            onClick={() => void fetchAssignments()}
          >
            Réessayer de charger les devoirs
          </button>
        ) : assignments.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Aucun devoir pour ce cours.
          </p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const published = Boolean(assignment.publishedAt);
              return (
                <article
                  className={`rounded-lg border p-3 ${published ? 'border-emerald-100 bg-emerald-50/40' : 'border-amber-200 bg-amber-50 dark:bg-amber-500/15'}`}
                  key={assignment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-bold text-[#26305e]">
                          {assignment.title}
                        </h3>
                        <span
                          className={`rounded px-2 py-1 text-[9px] font-bold ${published ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}
                        >
                          {published ? 'Publié' : 'Brouillon'}
                        </span>
                      </div>
                      {assignment.instructions && (
                        <p className="mt-2 max-w-2xl text-[11px] text-muted-foreground">
                          {assignment.instructions}
                        </p>
                      )}
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Date limite :{' '}
                        {assignment.dueAt
                          ? new Date(assignment.dueAt).toLocaleDateString(
                              'fr-FR',
                            )
                          : 'Non renseignée'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {published ? (
                        <button
                          className="rounded-lg border border-emerald-200 bg-card px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                          onClick={() => openSubmissions(assignment)}
                        >
                          Voir les soumissions
                        </button>
                      ) : (
                        <button
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-60"
                          disabled={publishingId === assignment.id}
                          onClick={() => publishAssignment(assignment.id)}
                        >
                          {publishingId === assignment.id
                            ? 'Publication…'
                            : 'Publier'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
      <Dialog open={creationOpen} onOpenChange={setCreationOpen}>
        <DialogContent>
          <form onSubmit={createAssignment}>
            <DialogHeader>
              <DialogTitle>Nouveau devoir</DialogTitle>
              <DialogDescription>
                Le devoir sera créé en brouillon avant publication.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <label className="text-xs font-bold text-[#34406b]">
                Titre
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Consignes (facultatives)
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-border p-3 font-normal outline-none focus:border-indigo-500"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  maxLength={5000}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Date limite (facultative)
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Création…' : 'Créer'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedAssignment)}
        onOpenChange={(open) => !open && setSelectedAssignment(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Soumissions · {selectedAssignment?.title}</DialogTitle>
            <DialogDescription>
              Notez chaque soumission et ajoutez un retour à l’étudiant.
            </DialogDescription>
          </DialogHeader>
          {loadingSubmissions ? (
            <p className="py-4 text-xs text-muted-foreground">
              Chargement des soumissions…
            </p>
          ) : submissionsFailed ? (
            <button
              className="text-xs font-bold text-indigo-600 dark:text-indigo-300"
              onClick={() =>
                selectedAssignment &&
                void fetchSubmissions(selectedAssignment.id)
              }
            >
              Réessayer de charger les soumissions
            </button>
          ) : submissions.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">
              Aucune soumission reçue pour le moment.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {submissions.map((submission) => (
                // La clé inclut note et feedback pour forcer un remount du formulaire (et donc
                // la réinitialisation de son état local) quand la soumission est mise à jour côté serveur.
                <SubmissionGradingForm
                  key={`${submission.id}-${submission.grade ?? 'empty'}-${submission.feedback ?? ''}`}
                  submission={submission}
                  onSave={(grade, feedback) =>
                    saveSubmission(submission.id, grade, feedback)
                  }
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Formulaire de notation d'une soumission d'étudiant : saisie de la note
 * (0-20) et d'un commentaire, avec validation locale du format numérique
 * avant l'appel à `onSave` (délégué au composant parent, qui effectue la
 * requête `PATCH /teacher/submissions/:id/grade`).
 */
function SubmissionGradingForm({
  submission,
  onSave,
}: {
  submission: Submission;
  onSave: (grade: number, feedback: string) => Promise<void>;
}) {
  const [grade, setGrade] = useState(
    submission.grade === null || submission.grade === undefined
      ? ''
      : String(submission.grade),
  );
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [saving, setSaving] = useState(false);

  // Valide que la note saisie est bien un nombre exploitable avant d'appeler l'API,
  // pour éviter d'envoyer une valeur invalide (ex. champ vide ou non numérique).
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericGrade = Number(grade);
    if (!grade.trim() || !Number.isFinite(numericGrade)) {
      toast.error('La note doit être un nombre');
      return;
    }
    void (async () => {
      try {
        setSaving(true);
        await onSave(numericGrade, feedback);
        toast.success('Soumission notée');
      } catch (error) {
        console.error('Erreur notation soumission:', error);
        toast.error('Impossible d’enregistrer cette note');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <form
      className="rounded-xl border border-slate-50 p-2.5"
      onSubmit={submit}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <StudentIdentity
            firstName={submission.student.firstName}
            lastName={submission.student.lastName}
            email={submission.student.user.email}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Remis le {new Date(submission.submittedAt).toLocaleDateString('fr-FR')}
          </p>
          {submission.contentUrl && (
            <a
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:underline"
              href={submission.contentUrl}
              target="_blank"
              rel="noreferrer"
            >
              <FileText className="size-3" /> Ouvrir le rendu
            </a>
          )}
        </div>
        <label className="text-[10px] font-bold text-[#34406b]">
          Note
          <input
            type="number"
            step="0.01"
            min={0}
            max={20}
            className="mt-1 block h-8 w-24 rounded-lg border border-border px-2 text-xs font-normal outline-none focus:border-indigo-500"
            value={grade}
            onChange={(event) => setGrade(event.target.value.slice(0, 5))}
            required
          />
        </label>
      </div>
      <label className="mt-3 block text-[10px] font-bold text-[#34406b]">
        Commentaire
        <textarea
          className="mt-1 min-h-16 w-full rounded-lg border border-border p-2 text-xs font-normal outline-none focus:border-indigo-500"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          maxLength={2000}
        />
      </label>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
