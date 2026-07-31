'use client';

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isAxiosError } from 'axios';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  FileWarningIcon,
  MailIcon,
  UserIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type Application = {
  id: string;
  status: string;
  score?: number | null;
  submittedAt: string;
  interviewDate?: string | null;
  interviewLink?: string | null;
  decisionReason?: string | null;
  student: {
    firstName: string;
    lastName: string;
    user: {
      email: string;
    };
  };
  offer: {
    title: string;
    diploma: string;
    school: {
      name: string;
    };
  };
  timeline: {
    id: string;
    status: string;
    note?: string | null;
    createdAt: string;
  }[];
};

type DialogName = 'test' | 'interview' | 'score' | 'status' | null;

type Document = {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PRESELECTED: 'Présélectionné',
  TEST_SCHEDULED: 'Test planifié',
  TEST_COMPLETED: 'Test complété',
  INTERVIEW_SCHEDULED: 'Entretien planifié',
  INTERVIEW_COMPLETED: 'Entretien complété',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  WAITLISTED: "Liste d'attente",
  ENROLLED: 'Inscrit',
  CANCELLED: 'Annulé',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  PRESELECTED: 'bg-blue-500',
  TEST_SCHEDULED: 'bg-purple-500',
  TEST_COMPLETED: 'bg-indigo-500',
  INTERVIEW_SCHEDULED: 'bg-orange-500',
  INTERVIEW_COMPLETED: 'bg-amber-500',
  ACCEPTED: 'bg-green-500',
  REJECTED: 'bg-red-500',
  WAITLISTED: 'bg-slate-500',
  ENROLLED: 'bg-emerald-600',
  CANCELLED: 'bg-rose-500',
};

export default function SchoolApplicationDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">Chargement du dossier...</div>
      }
    >
      <SchoolApplicationDetailContent />
    </Suspense>
  );
}

function SchoolApplicationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogName>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testForm, setTestForm] = useState({ date: '', type: '', details: '' });
  const [interviewForm, setInterviewForm] = useState({ date: '', link: '' });
  const [scoreForm, setScoreForm] = useState({ score: '', comments: '' });
  const [statusForm, setStatusForm] = useState({
    status: '',
    reason: '',
    score: '',
  });

  const handleApiError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          toast.error(
            'Vous n’êtes pas autorisé à consulter ou modifier ce dossier.',
          );
          router.replace('/dashboard/school/applications');
          return;
        }

        if (error.response?.status === 404) {
          setNotFound(true);
          return;
        }

        const message = error.response?.data?.message;
        if (typeof message === 'string') {
          toast.error(message);
          return;
        }
      }

      toast.error(fallbackMessage);
    },
    [router],
  );

  const fetchApplication = useCallback(async () => {
    try {
      const response = await apiClient.get(`/applications/${id}`);
      setApplication(response.data.data);
      setNotFound(false);
    } catch (error) {
      handleApiError(error, 'Impossible de charger le dossier');
    } finally {
      setLoading(false);
    }
  }, [handleApiError, id]);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await apiClient.get(`/applications/${id}/documents`);
      setDocuments(response.data.data || []);
    } catch (error) {
      handleApiError(error, 'Impossible de charger les documents');
    } finally {
      setDocumentsLoading(false);
    }
  }, [handleApiError, id]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchApplication();
    });
    return () => {
      active = false;
    };
  }, [fetchApplication]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchDocuments();
    });
    return () => {
      active = false;
    };
  }, [fetchDocuments]);

  const timeline = useMemo(
    () =>
      [...(application?.timeline || [])].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [application?.timeline],
  );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatFileSize = (fileSize: number) => {
    if (fileSize < 1024 * 1024) return `${Math.ceil(fileSize / 1024)} Ko`;
    return `${(fileSize / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const runAction = async (
    request: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setSubmitting(true);
    try {
      await request();
      toast.success(successMessage);
      setActiveDialog(null);
      await fetchApplication();
    } catch (error) {
      handleApiError(error, 'Impossible d’enregistrer cette modification');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(
      () => apiClient.post(`/applications/${id}/schedule-test`, testForm),
      'Test planifié',
    );
  };

  const submitInterview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(
      () =>
        apiClient.post(`/applications/${id}/schedule-interview`, interviewForm),
      'Entretien planifié',
    );
  };

  const submitScore = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(
      () =>
        apiClient.post(`/applications/${id}/score`, {
          score: Number(scoreForm.score),
          comments: scoreForm.comments || undefined,
        }),
      'Note enregistrée',
    );
  };

  const submitStatus = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(
      () =>
        apiClient.put(`/applications/${id}/status`, {
          status: statusForm.status,
          reason: statusForm.reason || undefined,
          score: statusForm.score ? Number(statusForm.score) : undefined,
        }),
      'Statut mis à jour',
    );
  };

  const openStatusDialog = () => {
    setStatusForm({
      status: application?.status || 'PENDING',
      reason: application?.decisionReason || '',
      score: application?.score?.toString() || '',
    });
    setActiveDialog('status');
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">Chargement du dossier...</div>
    );
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <FileWarningIcon className="mx-auto h-12 w-12 text-slate-300" />
          <div>
            <h1 className="text-xl font-extrabold">Dossier introuvable</h1>
            <p className="mt-1 text-sm text-slate-500">
              Cette candidature n’existe pas ou n’est plus disponible.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.replace('/dashboard/school/applications')}
          >
            Retour aux candidatures
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!application) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-slate-500">Impossible de charger ce dossier.</p>
          <Button variant="outline" onClick={() => void fetchApplication()}>
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeftIcon /> Retour aux candidatures
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold">
              {application.student.firstName} {application.student.lastName}
            </h1>
            <p className="text-sm text-violet-600">
              Candidature pour {application.offer.title}
            </p>
          </div>
        </div>
        <Badge
          className={`${STATUS_COLORS[application.status] || 'bg-slate-500'} text-white`}
        >
          {STATUS_LABELS[application.status] || application.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations du dossier</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-2">
                <UserIcon className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Étudiant</p>
                  <p className="font-medium">
                    {application.student.firstName}{' '}
                    {application.student.lastName}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <MailIcon className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">E-mail</p>
                  <p className="font-medium">
                    {application.student.user.email}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Formation</p>
                <p className="font-medium">{application.offer.title}</p>
                <p className="text-sm text-slate-500">
                  {application.offer.diploma} · {application.offer.school.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Candidature soumise le</p>
                <p className="font-medium">
                  {formatDate(application.submittedAt)}
                </p>
                {application.score !== null &&
                  application.score !== undefined && (
                    <p className="mt-1 text-sm text-violet-700">
                      Note : {application.score}/100
                    </p>
                  )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique du dossier</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucun événement enregistré.
                </p>
              ) : (
                <ol className="space-y-4 border-l-2 border-slate-200 pl-4">
                  {timeline.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-violet-500" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={`${STATUS_COLORS[event.status] || 'bg-slate-500'} text-white`}
                        >
                          {STATUS_LABELS[event.status] || event.status}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                      {event.note && (
                        <p className="mt-1 text-sm text-slate-600">
                          {event.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" onClick={() => setActiveDialog('test')}>
                Planifier un test
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveDialog('interview')}
              >
                Planifier un entretien
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveDialog('score')}
              >
                Enregistrer une note
              </Button>
              <Button onClick={openStatusDialog}>Changer le statut</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents du candidat</CardTitle>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <p className="text-sm text-slate-500">
                  Chargement des documents...
                </p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun document déposé.</p>
              ) : (
                <ul className="space-y-3">
                  {documents.map((document) => (
                    <li
                      key={document.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <FileTextIcon className="h-5 w-5 shrink-0 text-violet-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {document.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {document.type} · {formatFileSize(document.fileSize)}{' '}
                          · {formatDate(document.uploadedAt)}
                        </p>
                      </div>
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium hover:bg-slate-50"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" /> Télécharger
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={activeDialog === 'test'}
        onOpenChange={(open) => setActiveDialog(open ? 'test' : null)}
      >
        <DialogContent>
          <form onSubmit={submitTest}>
            <DialogHeader>
              <DialogTitle>Planifier un test</DialogTitle>
              <DialogDescription>
                Le statut du dossier passera à « Test planifié ».
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-date">Date et heure</Label>
                <Input
                  id="test-date"
                  type="datetime-local"
                  required
                  value={testForm.date}
                  onChange={(event) =>
                    setTestForm({ ...testForm, date: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-type">Type de test</Label>
                <Input
                  id="test-type"
                  required
                  placeholder="Ex. QCM, entretien technique"
                  value={testForm.type}
                  onChange={(event) =>
                    setTestForm({ ...testForm, type: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-details">Détails (facultatif)</Label>
                <Input
                  id="test-details"
                  value={testForm.details}
                  onChange={(event) =>
                    setTestForm({ ...testForm, details: event.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDialog(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Planifier le test'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === 'interview'}
        onOpenChange={(open) => setActiveDialog(open ? 'interview' : null)}
      >
        <DialogContent>
          <form onSubmit={submitInterview}>
            <DialogHeader>
              <DialogTitle>Planifier un entretien</DialogTitle>
              <DialogDescription>
                Le statut du dossier passera à « Entretien planifié ».
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="interview-date">Date et heure</Label>
                <Input
                  id="interview-date"
                  type="datetime-local"
                  required
                  value={interviewForm.date}
                  onChange={(event) =>
                    setInterviewForm({
                      ...interviewForm,
                      date: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interview-link">
                  Lien de visioconférence (facultatif)
                </Label>
                <Input
                  id="interview-link"
                  type="url"
                  placeholder="https://..."
                  value={interviewForm.link}
                  onChange={(event) =>
                    setInterviewForm({
                      ...interviewForm,
                      link: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDialog(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Planifier l’entretien'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === 'score'}
        onOpenChange={(open) => setActiveDialog(open ? 'score' : null)}
      >
        <DialogContent>
          <form onSubmit={submitScore}>
            <DialogHeader>
              <DialogTitle>Enregistrer une note</DialogTitle>
              <DialogDescription>
                Le statut du dossier passera à « Test complété ».
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="score">Note sur 100</Label>
                <Input
                  id="score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={scoreForm.score}
                  onChange={(event) =>
                    setScoreForm({ ...scoreForm, score: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="score-comments">Commentaire (facultatif)</Label>
                <Input
                  id="score-comments"
                  value={scoreForm.comments}
                  onChange={(event) =>
                    setScoreForm({ ...scoreForm, comments: event.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDialog(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer la note'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDialog === 'status'}
        onOpenChange={(open) => setActiveDialog(open ? 'status' : null)}
      >
        <DialogContent>
          <form onSubmit={submitStatus}>
            <DialogHeader>
              <DialogTitle>Changer le statut</DialogTitle>
              <DialogDescription>
                Confirmez cette mise à jour pour l’ajouter à l’historique du
                dossier.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="application-status">Nouveau statut</Label>
                <Select
                  items={Object.entries(STATUS_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  value={statusForm.status}
                  onValueChange={(value) =>
                    setStatusForm({ ...statusForm, status: value ?? 'PENDING' })
                  }
                >
                  <SelectTrigger id="application-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-score">Note (facultatif)</Label>
                <Input
                  id="status-score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={statusForm.score}
                  onChange={(event) =>
                    setStatusForm({ ...statusForm, score: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-reason">
                  Motif / note interne (facultatif)
                </Label>
                <Input
                  id="status-reason"
                  value={statusForm.reason}
                  onChange={(event) =>
                    setStatusForm({ ...statusForm, reason: event.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDialog(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Confirmer le statut'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
