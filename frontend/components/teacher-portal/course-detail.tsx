'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
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
import { TeacherAssignments } from './teacher-assignments';
import type {
  CourseTab,
  CourseDetailData,
  CourseChapter,
  CourseResource,
} from './types';
import {
  Page,
  Card,
  Info,
  MiniStat,
  List,
  Status,
  AsyncState,
  CourseStudentList,
} from './shared';
import { EvaluationPanel, GradeBook } from './evaluations';

/**
 * Vue "Détail d'un cours" : charge la fiche complète du cours
 * (`GET /teacher/courses/:id`) et affiche l'onglet demandé (`tab`) parmi
 * aperçu, contenu, étudiants, évaluations, devoirs, notes et réglages.
 * Gère les états de chargement et d'échec (cours introuvable ou non
 * accessible avec le compte courant).
 */
export function CourseDetail({
  tab,
  courseId,
}: {
  tab: CourseTab;
  courseId: string | null;
}) {
  const [course, setCourse] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchCourse = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      setFailed(true);
      return;
    }
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get(`/teacher/courses/${courseId}`);
      setCourse(response.data.data);
    } catch (error) {
      console.error('Erreur chargement détail cours:', error);
      setFailed(true);
      toast.error('Impossible de charger ce cours');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchCourse();
    });
    return () => {
      active = false;
    };
  }, [fetchCourse]);

  if (loading)
    return (
      <Page
        title="Cours"
        subtitle="Chargement du contenu pédagogique…"
        back="/dashboard/teacher?view=courses"
      >
        <AsyncState status="loading" loadingMessage="Chargement du cours…" />
      </Page>
    );

  if (failed || !course)
    return (
      <Page
        title="Cours introuvable"
        subtitle="Ce cours n’est pas accessible avec votre compte."
        back="/dashboard/teacher?view=courses"
      >
        <AsyncState
          status="error"
          errorMessage="Le détail du cours n’a pas pu être chargé."
          onRetry={courseId ? () => void fetchCourse() : undefined}
        />
      </Page>
    );

  return (
    <Page
      title={course.title}
      subtitle={`${course.code} · ${course.level}${course.group ? ` · ${course.group}` : ''}`}
      back="/dashboard/teacher?view=courses"
    >
      <CourseTabs active={tab} courseId={course.id} />
      {tab === 'overview' && <CourseOverview course={course} />}
      {tab === 'content' && (
        <CourseContent course={course} onCourseChange={setCourse} />
      )}
      {tab === 'students' && <CourseStudents courseId={course.id} />}
      {tab === 'evaluations' && <CourseEvaluations courseId={course.id} />}
      {tab === 'assignments' && <CourseAssignments courseId={course.id} />}
      {tab === 'grades' && <CourseGrades courseId={course.id} />}
      {tab === 'settings' && (
        <CourseSettings course={course} onCourseChange={setCourse} />
      )}
    </Page>
  );
}

/** Barre d'onglets de navigation entre les sous-vues de la fiche d'un cours (aperçu, contenu, étudiants, etc.). */
export function CourseTabs({
  active,
  courseId,
}: {
  active: CourseTab;
  courseId: string;
}) {
  const tabs: Array<[CourseTab, string]> = [
    ['overview', 'Aperçu'],
    ['content', 'Contenu'],
    ['students', 'Étudiants'],
    ['evaluations', 'Évaluations'],
    ['assignments', 'Devoirs'],
    ['grades', 'Notes'],
    ['settings', 'Réglages'],
  ];
  return (
    <nav className="mb-4 flex gap-5 overflow-x-auto border-b border-border px-2 text-[10px] font-bold">
      {tabs.map(([key, label]) => (
        <Link
          key={key}
          href={`/dashboard/teacher?view=course-detail&courseId=${courseId}&tab=${key}`}
          className={`whitespace-nowrap border-b-2 px-1 py-3 ${active === key ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-muted-foreground hover:text-indigo-600 dark:text-indigo-300'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Onglet "Aperçu" d'un cours : informations générales, statistiques (inscrits, chapitres, évaluations, devoirs) et dernières ressources publiées. */
export function CourseOverview({ course }: { course: CourseDetailData }) {
  const resources = course.chapters.flatMap((chapter) => chapter.resources);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Card title="Informations générales">
        <Info
          rows={[
            ['Code du cours', course.code],
            ['Niveau', course.level],
            ['Crédits', String(course.credits)],
            ['Salle', course.room || 'Non renseignée'],
            ['Horaires', course.schedule || 'Non renseignés'],
            [
              'Description',
              course.description || 'Aucune description renseignée.',
            ],
          ]}
        />
      </Card>
      <div className="space-y-4">
        <Card title="Statistiques du cours">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MiniStat
              value={String(course._count.enrollments)}
              label="Étudiants inscrits"
            />
            <MiniStat
              value={String(course.chapters.length)}
              label="Chapitres"
            />
            <MiniStat
              value={String(course.evaluations.length)}
              label="Évaluations"
            />
            <MiniStat
              value={String(course.assignments.length)}
              label="Devoirs"
            />
          </div>
        </Card>
        <Card title="Ressources récentes">
          {resources.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune ressource publiée.</p>
          ) : (
            <List
              items={resources.slice(-4).map((resource) => resource.title)}
              icon={FileText}
            />
          )}
          <Link
            href="/dashboard/teacher?view=resources"
            className="mt-4 block text-xs font-bold text-indigo-600 dark:text-indigo-300"
          >
            Voir toutes les ressources →
          </Link>
        </Card>
      </div>
    </div>
  );
}

/**
 * Onglet "Contenu" d'un cours : gestion complète des chapitres et de leurs
 * ressources pédagogiques (CRUD). Chaque mutation appelle l'API puis met à
 * jour l'objet `course` via `onCourseChange` pour garder l'état du parent
 * synchronisé (pas de rechargement complet de la fiche).
 *
 * Endpoints utilisés : création/modification/suppression de chapitre
 * (`POST|PATCH|DELETE /teacher/courses/:id/chapters[/:chapterId]`),
 * publication de chapitre (`PATCH .../chapters/:chapterId/publish`), et
 * création/modification/suppression de ressource
 * (`POST|PATCH|DELETE .../chapters/:chapterId/resources[/:resourceId]`).
 */
export function CourseContent({
  course,
  onCourseChange,
}: {
  course: CourseDetailData;
  onCourseChange: (course: CourseDetailData) => void;
}) {
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [resourceChapter, setResourceChapter] = useState<CourseChapter | null>(
    null,
  );
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterDescription, setChapterDescription] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceType, setResourceType] = useState('PDF');
  const [editingChapter, setEditingChapter] = useState<CourseChapter | null>(
    null,
  );
  const [editingChapterTitle, setEditingChapterTitle] = useState('');
  const [editingChapterDescription, setEditingChapterDescription] =
    useState('');
  const [editingResource, setEditingResource] = useState<{
    chapterId: string;
    resource: CourseResource;
  } | null>(null);
  const [editingResourceTitle, setEditingResourceTitle] = useState('');
  const [editingResourceUrl, setEditingResourceUrl] = useState('');
  const [editingResourceType, setEditingResourceType] = useState('PDF');
  const [chapterToDelete, setChapterToDelete] = useState<CourseChapter | null>(
    null,
  );
  const [resourceToDelete, setResourceToDelete] = useState<{
    chapterId: string;
    resource: CourseResource;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingChapter, setDeletingChapter] = useState(false);
  const [deletingResource, setDeletingResource] = useState(false);
  const [publishingChapterId, setPublishingChapterId] = useState<string | null>(
    null,
  );

  const submitChapter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      try {
        setSaving(true);
        const response = await apiClient.post(
          `/teacher/courses/${course.id}/chapters`,
          {
            title: chapterTitle,
            description: chapterDescription || undefined,
          },
        );
        const chapter = response.data.data as CourseChapter;
        onCourseChange({
          ...course,
          chapters: [
            ...course.chapters,
            { ...chapter, resources: chapter.resources || [] },
          ].sort((first, second) => first.position - second.position),
        });
        setChapterDialogOpen(false);
        setChapterTitle('');
        setChapterDescription('');
        toast.success('Chapitre ajouté');
      } catch (error) {
        console.error('Erreur ajout chapitre:', error);
        toast.error('Impossible d’ajouter le chapitre');
      } finally {
        setSaving(false);
      }
    })();
  };

  const publishChapter = (chapterId: string) => {
    void (async () => {
      try {
        setPublishingChapterId(chapterId);
        const response = await apiClient.patch(
          `/teacher/courses/${course.id}/chapters/${chapterId}/publish`,
        );
        const publishedChapter = response.data.data as CourseChapter;
        onCourseChange({
          ...course,
          chapters: course.chapters.map((chapter) =>
            chapter.id === chapterId
              ? {
                  ...chapter,
                  ...publishedChapter,
                  resources: chapter.resources,
                }
              : chapter,
          ),
        });
        toast.success('Chapitre publié');
      } catch (error) {
        console.error('Erreur publication chapitre:', error);
        toast.error('Impossible de publier le chapitre');
      } finally {
        setPublishingChapterId(null);
      }
    })();
  };

  const submitResource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resourceChapter) return;
    void (async () => {
      try {
        setSaving(true);
        const endpoint = `/teacher/courses/${course.id}/chapters/${resourceChapter.id}/resources`;
        // Deux modes d'ajout de ressource : upload de fichier (multipart/form-data) ou
        // simple lien externe (JSON) — l'URL n'est envoyée que dans ce second cas.
        const response = resourceFile
          ? await (() => {
              const formData = new FormData();
              formData.append('title', resourceTitle);
              formData.append('type', resourceType);
              formData.append('file', resourceFile);
              return apiClient.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
            })()
          : await apiClient.post(endpoint, {
              title: resourceTitle,
              url: resourceUrl,
              type: resourceType,
            });
        const resource = response.data.data as CourseResource;
        onCourseChange({
          ...course,
          chapters: course.chapters.map((chapter) =>
            chapter.id === resourceChapter.id
              ? { ...chapter, resources: [...chapter.resources, resource] }
              : chapter,
          ),
        });
        setResourceChapter(null);
        setResourceTitle('');
        setResourceUrl('');
        setResourceFile(null);
        setResourceType('PDF');
        toast.success('Ressource ajoutée');
      } catch (error) {
        console.error('Erreur ajout ressource:', error);
        toast.error('Impossible d’ajouter la ressource');
      } finally {
        setSaving(false);
      }
    })();
  };

  const openEditChapter = (chapter: CourseChapter) => {
    setEditingChapter(chapter);
    setEditingChapterTitle(chapter.title);
    setEditingChapterDescription(chapter.description || '');
  };

  const submitChapterEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingChapter) return;
    void (async () => {
      try {
        setSaving(true);
        const response = await apiClient.patch(
          `/teacher/courses/${course.id}/chapters/${editingChapter.id}`,
          {
            title: editingChapterTitle,
            description: editingChapterDescription || undefined,
          },
        );
        const updatedChapter = response.data.data as CourseChapter;
        onCourseChange({
          ...course,
          chapters: course.chapters.map((chapter) =>
            chapter.id === updatedChapter.id
              ? { ...updatedChapter, resources: chapter.resources }
              : chapter,
          ),
        });
        setEditingChapter(null);
        toast.success('Chapitre modifié');
      } catch (error) {
        console.error('Erreur modification chapitre:', error);
        toast.error('Impossible de modifier le chapitre');
      } finally {
        setSaving(false);
      }
    })();
  };

  const deleteChapter = async () => {
    if (!chapterToDelete) return;
    setDeletingChapter(true);
    try {
      await apiClient.delete(
        `/teacher/courses/${course.id}/chapters/${chapterToDelete.id}`,
      );
      onCourseChange({
        ...course,
        chapters: course.chapters.filter(
          (item) => item.id !== chapterToDelete.id,
        ),
      });
      setChapterToDelete(null);
      toast.success('Chapitre supprimé');
    } catch (error) {
      console.error('Erreur suppression chapitre:', error);
      toast.error('Impossible de supprimer le chapitre');
    } finally {
      setDeletingChapter(false);
    }
  };

  const openEditResource = (chapterId: string, resource: CourseResource) => {
    setEditingResource({ chapterId, resource });
    setEditingResourceTitle(resource.title);
    setEditingResourceUrl(resource.url);
    setEditingResourceType(resource.type);
  };

  const submitResourceEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingResource) return;
    void (async () => {
      try {
        setSaving(true);
        const response = await apiClient.patch(
          `/teacher/courses/${course.id}/chapters/${editingResource.chapterId}/resources/${editingResource.resource.id}`,
          {
            title: editingResourceTitle,
            url: editingResourceUrl,
            type: editingResourceType,
          },
        );
        const updatedResource = response.data.data as CourseResource;
        onCourseChange({
          ...course,
          chapters: course.chapters.map((chapter) =>
            chapter.id === editingResource.chapterId
              ? {
                  ...chapter,
                  resources: chapter.resources.map((resource) =>
                    resource.id === updatedResource.id
                      ? updatedResource
                      : resource,
                  ),
                }
              : chapter,
          ),
        });
        setEditingResource(null);
        toast.success('Ressource modifiée');
      } catch (error) {
        console.error('Erreur modification ressource:', error);
        toast.error('Impossible de modifier la ressource');
      } finally {
        setSaving(false);
      }
    })();
  };

  const deleteResource = async () => {
    if (!resourceToDelete) return;
    setDeletingResource(true);
    try {
      await apiClient.delete(
        `/teacher/courses/${course.id}/chapters/${resourceToDelete.chapterId}/resources/${resourceToDelete.resource.id}`,
      );
      onCourseChange({
        ...course,
        chapters: course.chapters.map((chapter) =>
          chapter.id === resourceToDelete.chapterId
            ? {
                ...chapter,
                resources: chapter.resources.filter(
                  (item) => item.id !== resourceToDelete.resource.id,
                ),
              }
            : chapter,
        ),
      });
      setResourceToDelete(null);
      toast.success('Ressource supprimée');
    } catch (error) {
      console.error('Erreur suppression ressource:', error);
      toast.error('Impossible de supprimer la ressource');
    } finally {
      setDeletingResource(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Card title="Contenu pédagogique">
        <div className="mb-4 flex justify-end">
          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
            onClick={() => setChapterDialogOpen(true)}
          >
            <Plus className="size-4" /> Ajouter un chapitre
          </button>
        </div>
        <div className="space-y-3">
          {course.chapters.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Aucun chapitre pour le moment.
            </p>
          ) : (
            course.chapters.map((chapter) => (
              <div
                className="rounded-lg border border-border p-3"
                key={chapter.id}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                    {chapter.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-[#26305e]">
                        {chapter.title}
                      </p>
                      <Status
                        value={chapter.isPublished ? 'Publié' : 'Brouillon'}
                      />
                    </div>
                    {chapter.description && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {chapter.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!chapter.isPublished && (
                      <button
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-60"
                        disabled={publishingChapterId === chapter.id}
                        onClick={() => publishChapter(chapter.id)}
                      >
                        {publishingChapterId === chapter.id
                          ? 'Publication…'
                          : 'Publier'}
                      </button>
                    )}
                    <button
                      aria-label={`Modifier ${chapter.title}`}
                      className="min-h-11 min-w-11 rounded p-2 text-muted-foreground hover:bg-indigo-50 dark:bg-indigo-500/15 hover:text-indigo-600 dark:text-indigo-300"
                      onClick={() => openEditChapter(chapter)}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      aria-label={`Supprimer ${chapter.title}`}
                      className="min-h-11 min-w-11 rounded p-2 text-muted-foreground hover:bg-rose-50 dark:bg-rose-500/15 hover:text-rose-600 dark:text-rose-300"
                      onClick={() => setChapterToDelete(chapter)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  {chapter.resources.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">
                      Aucune ressource.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {chapter.resources.map((resource) => (
                        <li
                          key={resource.id}
                          className="flex items-center justify-between gap-2 text-[10px]"
                        >
                          <a
                            className="truncate font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {resource.title}
                          </a>
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
                              {resource.type}
                            </span>
                            <button
                              aria-label={`Modifier ${resource.title}`}
                              className="min-h-11 min-w-11 rounded p-1 text-muted-foreground hover:bg-indigo-50 dark:bg-indigo-500/15 hover:text-indigo-600 dark:text-indigo-300"
                              onClick={() => openEditResource(chapter.id, resource)}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              aria-label={`Supprimer ${resource.title}`}
                              className="min-h-11 min-w-11 rounded p-1 text-muted-foreground hover:bg-rose-50 dark:bg-rose-500/15 hover:text-rose-600 dark:text-rose-300"
                              onClick={() =>
                                setResourceToDelete({
                                  chapterId: chapter.id,
                                  resource,
                                })
                              }
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    className="mt-3 text-[10px] font-bold text-indigo-600 dark:text-indigo-300"
                    onClick={() => setResourceChapter(chapter)}
                  >
                    Ajouter une ressource
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      <Card title="Résumé du cours">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniStat
            value={String(course._count.enrollments)}
            label="Étudiants inscrits"
          />
          <MiniStat value={String(course.chapters.length)} label="Chapitres" />
          <MiniStat
            value={String(course.evaluations.length)}
            label="Évaluations"
          />
          <MiniStat value={String(course.assignments.length)} label="Devoirs" />
        </div>
      </Card>
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent>
          <form onSubmit={submitChapter}>
            <DialogHeader>
              <DialogTitle>Ajouter un chapitre</DialogTitle>
              <DialogDescription>
                Le chapitre sera créé en brouillon et pourra être publié
                ensuite.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <label className="text-xs font-bold text-[#34406b]">
                Titre
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={chapterTitle}
                  onChange={(event) => setChapterTitle(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Description (facultative)
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-border p-3 font-normal outline-none focus:border-indigo-500"
                  value={chapterDescription}
                  onChange={(event) =>
                    setChapterDescription(event.target.value)
                  }
                  maxLength={5000}
                />
              </label>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(resourceChapter)}
        onOpenChange={(open) => !open && setResourceChapter(null)}
      >
        <DialogContent>
          <form onSubmit={submitResource}>
            <DialogHeader>
              <DialogTitle>Ajouter une ressource</DialogTitle>
              <DialogDescription>
                {resourceChapter
                  ? `Chapitre : ${resourceChapter.title}. Ajoutez un lien externe ou un fichier.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <label className="text-xs font-bold text-[#34406b]">
                Titre
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  value={resourceTitle}
                  onChange={(event) => setResourceTitle(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Lien externe
                <input
                  type="url"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  placeholder="https://…"
                  maxLength={2048}
                  value={resourceUrl}
                  onChange={(event) => setResourceUrl(event.target.value)}
                  required={!resourceFile}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Fichier (PDF, image, PPTX, DOCX, XLSX ou ZIP)
                <input
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.pptx,.docx,.xlsx,.zip"
                  className="mt-1 block w-full text-xs font-normal"
                  onChange={(event) =>
                    setResourceFile(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
              </label>
              <div className="text-xs font-bold text-[#34406b]">
                Type
                <Select
                  value={resourceType}
                  onValueChange={(value) => setResourceType(value ?? 'PDF')}
                >
                  <SelectTrigger className="mt-1 h-10 w-full font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="Lien">Lien</SelectItem>
                    <SelectItem value="Vidéo">Vidéo</SelectItem>
                    <SelectItem value="Document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editingChapter)}
        onOpenChange={(open) => !open && setEditingChapter(null)}
      >
        <DialogContent>
          <form onSubmit={submitChapterEdit}>
            <DialogHeader>
              <DialogTitle>Modifier le chapitre</DialogTitle>
              <DialogDescription>
                Corrigez le titre ou la description du chapitre.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <label className="text-xs font-bold text-[#34406b]">
                Titre
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  maxLength={160}
                  onChange={(event) => setEditingChapterTitle(event.target.value)}
                  required
                  value={editingChapterTitle}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Description (facultative)
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-border p-3 font-normal outline-none focus:border-indigo-500"
                  maxLength={5000}
                  onChange={(event) =>
                    setEditingChapterDescription(event.target.value)
                  }
                  value={editingChapterDescription}
                />
              </label>
            </div>
            <DialogFooter>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editingResource)}
        onOpenChange={(open) => !open && setEditingResource(null)}
      >
        <DialogContent>
          <form onSubmit={submitResourceEdit}>
            <DialogHeader>
              <DialogTitle>Modifier la ressource</DialogTitle>
              <DialogDescription>
                Corrigez son titre, son lien ou son type.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <label className="text-xs font-bold text-[#34406b]">
                Titre
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  maxLength={160}
                  onChange={(event) => setEditingResourceTitle(event.target.value)}
                  required
                  value={editingResourceTitle}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Lien
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 font-normal outline-none focus:border-indigo-500"
                  onChange={(event) => setEditingResourceUrl(event.target.value)}
                  required
                  type="url"
                  maxLength={2048}
                  value={editingResourceUrl}
                />
              </label>
              <div className="text-xs font-bold text-[#34406b]">
                Type
                <Select
                  value={editingResourceType}
                  onValueChange={(value) => setEditingResourceType(value ?? 'PDF')}
                >
                  <SelectTrigger className="mt-1 h-10 w-full font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="Lien">Lien</SelectItem>
                    <SelectItem value="Vidéo">Vidéo</SelectItem>
                    <SelectItem value="Document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={chapterToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingChapter) setChapterToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le chapitre</DialogTitle>
            <DialogDescription>
              Le chapitre « {chapterToDelete?.title} » et ses{' '}
              {chapterToDelete?.resources.length ?? 0} ressource(s) seront
              supprimés définitivement. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingChapter}
              onClick={() => setChapterToDelete(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingChapter}
              onClick={() => void deleteChapter()}
            >
              {deletingChapter ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={resourceToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingResource) setResourceToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la ressource</DialogTitle>
            <DialogDescription>
              La ressource « {resourceToDelete?.resource.title} » sera
              supprimée définitivement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletingResource}
              onClick={() => setResourceToDelete(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingResource}
              onClick={() => void deleteResource()}
            >
              {deletingResource ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Onglet "Étudiants" d'un cours : délègue à `CourseStudentList` pour afficher la liste paginée des inscrits. */
export function CourseStudents({ courseId }: { courseId: string }) {
  return <CourseStudentList courseId={courseId} />;
}

/** Onglet "Évaluations" d'un cours : délègue à `EvaluationPanel`. */
export function CourseEvaluations({ courseId }: { courseId: string }) {
  return <EvaluationPanel courseId={courseId} />;
}

/** Onglet "Devoirs" d'un cours : réutilise le composant partagé `TeacherAssignments` verrouillé sur ce cours. */
export function CourseAssignments({ courseId }: { courseId: string }) {
  return <TeacherAssignments courseId={courseId} />;
}

/** Onglet "Notes" d'un cours : délègue à `GradeBook`. */
export function CourseGrades({ courseId }: { courseId: string }) {
  return <GradeBook courseId={courseId} />;
}

/**
 * Onglet "Réglages" d'un cours : permet de modifier le message d'accueil et
 * deux options pédagogiques (autorisation des messages de groupe,
 * notification des étudiants à la publication de contenu) via
 * `PATCH /teacher/courses/:id/settings`. Le nom du cours est affiché en
 * lecture seule : sa modification est réservée à l'administration de
 * l'établissement (changement structurel).
 */
export function CourseSettings({
  course,
  onCourseChange,
}: {
  course: CourseDetailData;
  onCourseChange: (course: CourseDetailData) => void;
}) {
  const [welcomeMessage, setWelcomeMessage] = useState(
    course.welcomeMessage || '',
  );
  const [allowGroupMessages, setAllowGroupMessages] = useState(
    course.allowGroupMessages,
  );
  const [notifyOnPublish, setNotifyOnPublish] = useState(
    course.notifyOnPublish,
  );
  const [saving, setSaving] = useState(false);

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await apiClient.patch(
        `/teacher/courses/${course.id}/settings`,
        { welcomeMessage, allowGroupMessages, notifyOnPublish },
      );
      onCourseChange({ ...course, ...response.data.data });
      toast.success('Réglages enregistrés');
    } catch (error) {
      console.error('Erreur enregistrement réglages cours:', error);
      toast.error('Impossible d’enregistrer les réglages');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_.8fr]">
      <Card title="Réglages pédagogiques">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[#34406b]">
              Nom du cours
            </span>
            <input
              disabled
              value={course.title}
              className="h-10 w-full rounded-lg border border-border bg-muted px-3 text-xs text-muted-foreground outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[#34406b]">
              Message d’accueil
            </span>
            <textarea
              value={welcomeMessage}
              onChange={(event) => setWelcomeMessage(event.target.value)}
              maxLength={2000}
              placeholder="Bienvenue dans l’espace du cours…"
              className="min-h-24 w-full rounded-lg border border-border p-3 text-xs outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-muted p-3 text-xs font-semibold text-[#34406b]">
            <span>Autoriser les messages du groupe</span>
            <input
              type="checkbox"
              className="size-4"
              checked={allowGroupMessages}
              onChange={(event) => setAllowGroupMessages(event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-muted p-3 text-xs font-semibold text-[#34406b]">
            <span>Notifier les étudiants lors d’une publication</span>
            <input
              type="checkbox"
              className="size-4"
              checked={notifyOnPublish}
              onChange={(event) => setNotifyOnPublish(event.target.checked)}
            />
          </label>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            disabled={saving}
            onClick={() => void saveSettings()}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer les réglages'}
          </button>
        </div>
      </Card>
      <Card title="Accès du cours">
        <Info
          rows={[
            [
              'Visibilité',
              course.group ? `Groupe ${course.group}` : 'Tous les groupes',
            ],
            [
              'Inscrits',
              `${course._count.enrollments} étudiant${course._count.enrollments > 1 ? 's' : ''}`,
            ],
            [
              'Modification structurelle',
              'Réservée à l’administration de l’établissement',
            ],
          ]}
        />
      </Card>
    </div>
  );
}

