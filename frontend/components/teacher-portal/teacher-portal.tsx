'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from 'lucide-react';
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { TeacherAssignments } from './teacher-assignments';
import { TeacherSchedule } from './teacher-schedule';
import { MessagesScreen } from '@/components/messages/messages-screen';
import { TeacherDashboard } from './teacher-dashboard';
import { AvatarUpload } from '@/components/AvatarUpload';
import { NotificationBell } from '@/components/notifications/notification-bell';

type View =
  | 'dashboard'
  | 'courses'
  | 'course-detail'
  | 'students'
  | 'evaluations'
  | 'grades'
  | 'schedule'
  | 'assignments'
  | 'resources'
  | 'messages'
  | 'announcements'
  | 'settings';

type CourseTab =
  | 'overview'
  | 'content'
  | 'students'
  | 'evaluations'
  | 'assignments'
  | 'grades'
  | 'settings';

type CourseSummary = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  level: string;
  group?: string | null;
  credits: number;
  room?: string | null;
  schedule?: string | null;
  isPublished: boolean;
  school: { id: string; name: string; slug: string };
  _count: {
    enrollments: number;
    chapters: number;
    evaluations: number;
    assignments: number;
  };
};

type TeacherSchool = {
  school: { id: string; name: string; slug: string };
};

type CourseResource = {
  id: string;
  title: string;
  url: string;
  type: string;
};

type TeacherResource = CourseResource & {
  createdAt: string;
  chapter: { title: string; course: { id: string; title: string } };
};

type CourseChapter = {
  id: string;
  title: string;
  description?: string | null;
  position: number;
  isPublished: boolean;
  publishedAt?: string | null;
  resources: CourseResource[];
};

type CourseDetailData = Omit<CourseSummary, 'school' | '_count'> & {
  schoolId: string;
  chapters: CourseChapter[];
  evaluations: unknown[];
  assignments: unknown[];
  _count: { enrollments: number };
  welcomeMessage?: string | null;
  allowGroupMessages: boolean;
  notifyOnPublish: boolean;
};

type CourseEnrollment = {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    user: { email: string };
  };
};

type Evaluation = {
  id: string;
  courseId: string;
  title: string;
  type: string;
  scheduledAt?: string | null;
  coefficient: number;
};

type EvaluationGrade = {
  id: string;
  studentId: string;
  value: number;
  comment?: string | null;
};

type EvaluationGradeEntry = {
  studentId: string;
  student: CourseEnrollment['student'];
  grade: EvaluationGrade | null;
};

type TeacherAnnouncement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  recipientCount: number;
  readCount: number;
};

type TeacherProfile = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  user: { email: string; theme?: string };
};

type ThemePreference = 'light' | 'dark' | 'system';

function applyTheme(theme: string) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

const LIST_PAGE_SIZE = 25;

export function TeacherPortal() {
  const params = useSearchParams();
  const view = (params.get('view') || 'dashboard') as View;
  const courseTab = (params.get('tab') || 'content') as CourseTab;
  const courseId = params.get('courseId');

  useEffect(() => {
    let active = true;
    void apiClient
      .get('/teacher/profile')
      .then((response) => {
        if (!active) return;
        const theme = (response.data.data as TeacherProfile).user.theme;
        if (theme) applyTheme(theme);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (view === 'courses') return <Courses />;
  if (view === 'course-detail')
    return <CourseDetail courseId={courseId} tab={courseTab} />;
  if (view === 'students') return <Students />;
  if (view === 'evaluations') return <Evaluations />;
  if (view === 'grades') return <Grades />;
  if (view === 'schedule') return <Schedule />;
  if (view === 'assignments') return <Assignments />;
  if (view === 'resources') return <Resources />;
  if (view === 'messages') return <Messages />;
  if (view === 'announcements') return <Announcements />;
  if (view === 'settings') return <SettingsView />;
  return <Dashboard />;
}

function Dashboard() {
  return (
    <Page
      title="Bonjour 👋"
      subtitle="Voici un aperçu de votre activité pédagogique."
    >
      <TeacherDashboard />
    </Page>
  );
}

function Courses() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [schools, setSchools] = useState<TeacherSchool[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const [coursesResponse, schoolsResponse] = await Promise.all([
        apiClient.get('/teacher/courses'),
        apiClient.get('/teacher/courses/schools'),
      ]);
      setCourses(coursesResponse.data.data || []);
      setSchools(schoolsResponse.data.data || []);
    } catch (error) {
      console.error('Erreur chargement cours professeur:', error);
      setFailed(true);
      toast.error('Impossible de charger vos cours');
    } finally {
      setLoading(false);
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

  const schoolFilteredCourses =
    selectedSchoolId === 'all'
      ? courses
      : courses.filter((course) => course.school.id === selectedSchoolId);
  const activeCourses = schoolFilteredCourses.filter(
    (course) => course.isPublished,
  );
  const archivedCourses = schoolFilteredCourses.filter(
    (course) => !course.isPublished,
  );
  const query = search.trim().toLowerCase();
  const displayedCourses = (
    tab === 'active' ? activeCourses : archivedCourses
  ).filter(
    (course) =>
      !query ||
      course.title.toLowerCase().includes(query) ||
      course.code.toLowerCase().includes(query),
  );

  return (
    <Page
      title="Mes cours"
      subtitle="Gérez et consultez tous les cours que vous enseignez."
    >
      {schools.length > 1 && (
        <label className="mb-4 block max-w-sm">
          <span className="mb-1 block text-xs font-bold text-[#34406b]">
            Établissement
          </span>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
            value={selectedSchoolId}
            onChange={(event) => setSelectedSchoolId(event.target.value)}
          >
            <option value="all">Tous les établissements</option>
            {schools.map(({ school }) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="relative mb-4 block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un cours..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-violet-500"
        />
      </label>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('active')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tab === 'active' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}
        >
          Actifs ({activeCourses.length})
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tab === 'archived' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}
        >
          Archives ({archivedCourses.length})
        </button>
      </div>
      {loading || failed || displayedCourses.length === 0 ? (
        <AsyncState
          status={loading ? 'loading' : failed ? 'error' : 'empty'}
          loadingMessage="Chargement de vos cours…"
          errorMessage="Vos cours n’ont pas pu être chargés."
          emptyMessage="Aucun cours ne correspond à cette sélection."
          onRetry={() => void fetchCourses()}
        />
      ) : (
        <div className="space-y-2">
          {displayedCourses.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/teacher?view=course-detail&courseId=${course.id}&tab=content`}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:border-violet-200 hover:shadow-md"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <BookOpen className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[#17204e]">
                  {course.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {course.level}
                  {course.group ? ` · ${course.group}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="flex items-center gap-1 text-xs font-bold text-[#17204e]">
                  <UsersRound className="size-3.5 text-slate-400" />
                  {course._count.enrollments}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {course._count.chapters} chap.
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}

function CourseDetail({
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

function CourseTabs({
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
    <nav className="mb-4 flex gap-5 overflow-x-auto border-b border-slate-100 px-2 text-[10px] font-bold">
      {tabs.map(([key, label]) => (
        <Link
          key={key}
          href={`/dashboard/teacher?view=course-detail&courseId=${courseId}&tab=${key}`}
          className={`whitespace-nowrap border-b-2 px-1 py-3 ${active === key ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-violet-600'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function CourseOverview({ course }: { course: CourseDetailData }) {
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
            <p className="text-xs text-slate-500">Aucune ressource publiée.</p>
          ) : (
            <List
              items={resources.slice(-4).map((resource) => resource.title)}
              icon={FileText}
            />
          )}
          <Link
            href="/dashboard/teacher?view=resources"
            className="mt-4 block text-xs font-bold text-violet-600"
          >
            Voir toutes les ressources →
          </Link>
        </Card>
      </div>
    </div>
  );
}

function CourseContent({
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
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white"
            onClick={() => setChapterDialogOpen(true)}
          >
            <Plus className="size-4" /> Ajouter un chapitre
          </button>
        </div>
        <div className="space-y-3">
          {course.chapters.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Aucun chapitre pour le moment.
            </p>
          ) : (
            course.chapters.map((chapter) => (
              <div
                className="rounded-lg border border-slate-100 p-3"
                key={chapter.id}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-xs font-bold text-violet-600">
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
                      <p className="mt-1 text-[10px] text-slate-500">
                        {chapter.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!chapter.isPublished && (
                      <button
                        className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-60"
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
                      className="min-h-11 min-w-11 rounded p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-600"
                      onClick={() => openEditChapter(chapter)}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      aria-label={`Supprimer ${chapter.title}`}
                      className="min-h-11 min-w-11 rounded p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => setChapterToDelete(chapter)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {chapter.resources.length === 0 ? (
                    <p className="text-[10px] text-slate-400">
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
                            className="truncate font-semibold text-violet-600 hover:underline"
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {resource.title}
                          </a>
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-slate-50 px-2 py-1 text-slate-500">
                              {resource.type}
                            </span>
                            <button
                              aria-label={`Modifier ${resource.title}`}
                              className="min-h-11 min-w-11 rounded p-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                              onClick={() => openEditResource(chapter.id, resource)}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              aria-label={`Supprimer ${resource.title}`}
                              className="min-h-11 min-w-11 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
                    className="mt-3 text-[10px] font-bold text-violet-600"
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
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  value={chapterTitle}
                  onChange={(event) => setChapterTitle(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Description (facultative)
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-violet-500"
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
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
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
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
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
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  placeholder="https://…"
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
              <label className="text-xs font-bold text-[#34406b]">
                Type
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-violet-500"
                  value={resourceType}
                  onChange={(event) => setResourceType(event.target.value)}
                >
                  <option value="PDF">PDF</option>
                  <option value="Lien">Lien</option>
                  <option value="Vidéo">Vidéo</option>
                  <option value="Document">Document</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
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
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  maxLength={160}
                  onChange={(event) => setEditingChapterTitle(event.target.value)}
                  required
                  value={editingChapterTitle}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Description (facultative)
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-violet-500"
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
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
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
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  maxLength={160}
                  onChange={(event) => setEditingResourceTitle(event.target.value)}
                  required
                  value={editingResourceTitle}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Lien
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  onChange={(event) => setEditingResourceUrl(event.target.value)}
                  required
                  type="url"
                  value={editingResourceUrl}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Type
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-violet-500"
                  onChange={(event) => setEditingResourceType(event.target.value)}
                  value={editingResourceType}
                >
                  <option value="PDF">PDF</option>
                  <option value="Lien">Lien</option>
                  <option value="Vidéo">Vidéo</option>
                  <option value="Document">Document</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <button
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
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

function CourseStudents({ courseId }: { courseId: string }) {
  return <CourseStudentList courseId={courseId} />;
}

function ListPagination({
  page,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / LIST_PAGE_SIZE);
  const currentPage = Math.min(page, totalPages);

  if (totalItems <= LIST_PAGE_SIZE) return null;

  return (
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
              if (currentPage > 1) onPageChange(currentPage - 1);
            }}
          />
        </PaginationItem>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                isActive={currentPage === pageNumber}
                onClick={(event) => {
                  event.preventDefault();
                  onPageChange(pageNumber);
                }}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            className={
              currentPage === totalPages ? 'pointer-events-none opacity-50' : ''
            }
            onClick={(event) => {
              event.preventDefault();
              if (currentPage < totalPages) onPageChange(currentPage + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function CourseStudentList({ courseId }: { courseId: string }) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get(
        `/teacher/courses/${courseId}/students`,
        { params: { page, limit: LIST_PAGE_SIZE } },
      );
      setEnrollments(response.data.data.items || []);
      setTotalItems(response.data.data.meta?.total || 0);
    } catch (error) {
      console.error('Erreur chargement étudiants cours:', error);
      setFailed(true);
      toast.error('Impossible de charger les étudiants de ce cours');
    } finally {
      setLoading(false);
    }
  }, [courseId, page]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchStudents();
    });
    return () => {
      active = false;
    };
  }, [fetchStudents]);

  if (loading || failed || totalItems === 0)
    return (
      <AsyncState
        status={loading ? 'loading' : failed ? 'error' : 'empty'}
        loadingMessage="Chargement des étudiants…"
        errorMessage="Les étudiants de ce cours n’ont pas pu être chargés."
        emptyMessage="Aucun étudiant n’est inscrit à ce cours."
        onRetry={() => void fetchStudents()}
      />
    );

  return (
    <Card title={`Étudiants inscrits (${totalItems})`}>
      <div className="space-y-2">
        {enrollments.map(({ id, student }) => {
          const name = `${student.firstName} ${student.lastName}`;
          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-xl border border-slate-50 p-2.5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                {`${student.firstName[0] || ''}${student.lastName[0] || ''}`.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#17204e]">
                  {name}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {student.user.email}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <ListPagination
        page={page}
        totalItems={totalItems}
        onPageChange={setPage}
      />
    </Card>
  );
}

function CourseEvaluations({ courseId }: { courseId: string }) {
  return <EvaluationPanel courseId={courseId} />;
}

function CourseAssignments({ courseId }: { courseId: string }) {
  return <TeacherAssignments courseId={courseId} />;
}

function CourseGrades({ courseId }: { courseId: string }) {
  return <GradeBook courseId={courseId} />;
}

function CourseSettings({
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
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 outline-none"
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
              className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-violet-500"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs font-semibold text-[#34406b]">
            <span>Autoriser les messages du groupe</span>
            <input
              type="checkbox"
              className="size-4"
              checked={allowGroupMessages}
              onChange={(event) => setAllowGroupMessages(event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs font-semibold text-[#34406b]">
            <span>Notifier les étudiants lors d’une publication</span>
            <input
              type="checkbox"
              className="size-4"
              checked={notifyOnPublish}
              onChange={(event) => setNotifyOnPublish(event.target.checked)}
            />
          </label>
          <button
            className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
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

function Students() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/teacher/courses');
      const assignedCourses = (response.data.data || []) as CourseSummary[];
      setCourses(assignedCourses);
      setSelectedCourseId((current) => current || assignedCourses[0]?.id || '');
    } catch (error) {
      console.error('Erreur chargement cours professeur:', error);
      setFailed(true);
      toast.error('Impossible de charger vos cours');
    } finally {
      setLoading(false);
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

  return (
    <Page
      title="Étudiants"
      subtitle="Consultez les étudiants inscrits à chacun de vos cours."
    >
      {loading || failed || courses.length === 0 ? (
        <AsyncState
          status={loading ? 'loading' : failed ? 'error' : 'empty'}
          loadingMessage="Chargement de vos cours…"
          errorMessage="Vos cours n’ont pas pu être chargés."
          emptyMessage="Aucun cours ne vous est actuellement affecté."
          onRetry={() => void fetchCourses()}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex max-w-xl flex-wrap items-end gap-3">
            <label className="min-w-60 flex-1">
              <span className="mb-1 block text-xs font-bold text-[#34406b]">
                Cours
              </span>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} · {course.school.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedCourseId && (
              <Link
                href={`/dashboard/teacher?view=course-detail&courseId=${selectedCourseId}&tab=students`}
                className="h-10 rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-600 transition hover:bg-violet-50"
              >
                Ouvrir la fiche du cours
              </Link>
            )}
          </div>
          {selectedCourseId && (
            <CourseStudentList
              key={selectedCourseId}
              courseId={selectedCourseId}
            />
          )}
        </div>
      )}
    </Page>
  );
}

function useTeacherCourses() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/teacher/courses');
      const assignedCourses = (response.data.data || []) as CourseSummary[];
      setCourses(assignedCourses);
      setSelectedCourseId((current) =>
        assignedCourses.some((course) => course.id === current)
          ? current
          : assignedCourses[0]?.id || '',
      );
    } catch (error) {
      console.error('Erreur chargement cours professeur:', error);
      setFailed(true);
      toast.error('Impossible de charger vos cours');
    } finally {
      setLoading(false);
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

  return {
    courses,
    selectedCourseId,
    setSelectedCourseId,
    loading,
    failed,
    fetchCourses,
  };
}

function CourseSelect({
  courses,
  value,
  onChange,
}: {
  courses: CourseSummary[];
  value: string;
  onChange: (courseId: string) => void;
}) {
  return (
    <label className="block max-w-xl">
      <span className="mb-1 block text-xs font-bold text-[#34406b]">Cours</span>
      <select
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title} · {course.school.name}
          </option>
        ))}
      </select>
    </label>
  );
}

type AsyncStateStyle = 'card' | 'inline';

function AsyncState({
  status,
  loadingMessage,
  errorMessage,
  emptyMessage,
  onRetry,
  retryLabel = 'Réessayer',
  variant = 'card',
  emptyVariant,
  bordered = true,
  textSize,
}: {
  status: 'loading' | 'error' | 'empty';
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: AsyncStateStyle;
  emptyVariant?: AsyncStateStyle;
  bordered?: boolean;
  textSize?: 'xs' | 'sm';
}) {
  const sizeClass = (forVariant: AsyncStateStyle) =>
    (textSize ?? (forVariant === 'card' ? 'sm' : 'xs')) === 'sm'
      ? 'text-sm'
      : 'text-xs';
  const textSizeClass = sizeClass(variant);

  if (status === 'loading') {
    if (variant === 'inline')
      return <p className={`${textSizeClass} text-slate-500`}>{loadingMessage}</p>;
    return (
      <p
        className={[
          'rounded-xl',
          bordered ? 'border border-slate-100' : '',
          'bg-white p-5',
          textSizeClass,
          'text-slate-500 shadow-sm',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {loadingMessage}
      </p>
    );
  }

  if (status === 'error') {
    if (variant === 'inline') {
      if (!errorMessage)
        return (
          <button
            type="button"
            className="text-xs font-bold text-violet-600"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        );
      return (
        <div>
          <p className={`${textSizeClass} text-rose-700`}>{errorMessage}</p>
          {onRetry && (
            <button
              type="button"
              className="mt-3 text-xs font-bold text-violet-600"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          )}
        </div>
      );
    }
    return (
      <div
        className={[
          'rounded-xl',
          bordered ? 'border border-rose-100' : '',
          'bg-rose-50 p-5',
          textSizeClass,
          'text-rose-700',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p>{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            className="mt-3 text-xs font-bold text-violet-600"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  const resolvedEmptyVariant = emptyVariant ?? variant;
  const emptyTextSizeClass = sizeClass(resolvedEmptyVariant);
  if (resolvedEmptyVariant === 'inline') {
    if (bordered === false)
      return (
        <p className={`${emptyTextSizeClass} text-slate-500`}>{emptyMessage}</p>
      );
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        {emptyMessage}
      </p>
    );
  }
  return (
    <p
      className={[
        'rounded-xl',
        bordered ? 'border border-slate-100' : '',
        'bg-white p-5',
        emptyTextSizeClass,
        'text-slate-500 shadow-sm',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {emptyMessage}
    </p>
  );
}

function Evaluations() {
  const courseState = useTeacherCourses();
  const unavailable = (
    <AsyncState
      status={
        courseState.loading
          ? 'loading'
          : courseState.failed
            ? 'error'
            : 'empty'
      }
      loadingMessage="Chargement de vos cours…"
      errorMessage="Vos cours n’ont pas pu être chargés."
      emptyMessage="Aucun cours ne vous est actuellement affecté."
      onRetry={() => void courseState.fetchCourses()}
    />
  );

  return (
    <Page
      title="Évaluations"
      subtitle="Créez et consultez les évaluations de vos cours."
    >
      {courseState.loading ||
      courseState.failed ||
      courseState.courses.length === 0 ? (
        unavailable
      ) : (
        <div className="space-y-5">
          <CourseSelect
            courses={courseState.courses}
            value={courseState.selectedCourseId}
            onChange={courseState.setSelectedCourseId}
          />
          {courseState.selectedCourseId && (
            <EvaluationPanel courseId={courseState.selectedCourseId} />
          )}
        </div>
      )}
    </Page>
  );
}

function EvaluationPanel({ courseId }: { courseId: string }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Contrôle');
  const [scheduledAt, setScheduledAt] = useState('');
  const [coefficient, setCoefficient] = useState('1');
  const [saving, setSaving] = useState(false);

  const fetchEvaluations = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get(
        `/teacher/courses/${courseId}/evaluations`,
      );
      setEvaluations(response.data.data || []);
    } catch (error) {
      console.error('Erreur chargement évaluations:', error);
      setFailed(true);
      toast.error('Impossible de charger les évaluations');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchEvaluations();
    });
    return () => {
      active = false;
    };
  }, [fetchEvaluations]);

  const createEvaluation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      try {
        setSaving(true);
        const response = await apiClient.post(
          `/teacher/courses/${courseId}/evaluations`,
          {
            title,
            type,
            scheduledAt: scheduledAt || undefined,
            coefficient: Number(coefficient),
          },
        );
        const evaluation = response.data.data as Evaluation;
        setEvaluations((current) =>
          [...current, evaluation].sort((first, second) =>
            (first.scheduledAt || '').localeCompare(second.scheduledAt || ''),
          ),
        );
        setDialogOpen(false);
        setTitle('');
        setType('Contrôle');
        setScheduledAt('');
        setCoefficient('1');
        toast.success('Évaluation créée');
      } catch (error) {
        console.error('Erreur création évaluation:', error);
        toast.error('Impossible de créer l’évaluation');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <>
      <Card title="Évaluations">
        <div className="mb-4 flex justify-end">
          <button
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" /> Nouvelle évaluation
          </button>
        </div>
        {loading || failed || evaluations.length === 0 ? (
          <AsyncState
            status={loading ? 'loading' : failed ? 'error' : 'empty'}
            variant="inline"
            loadingMessage="Chargement des évaluations…"
            retryLabel="Réessayer de charger les évaluations"
            emptyMessage="Aucune évaluation pour ce cours."
            onRetry={() => void fetchEvaluations()}
          />
        ) : (
          <div className="space-y-2">
            {evaluations.map((evaluation) => (
              <div
                key={evaluation.id}
                className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <ClipboardList className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#26305e]">
                    {evaluation.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {evaluation.type} ·{' '}
                    {evaluation.scheduledAt
                      ? new Date(evaluation.scheduledAt).toLocaleDateString(
                          'fr-FR',
                        )
                      : 'Non planifiée'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  Coef. {evaluation.coefficient}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={createEvaluation}>
            <DialogHeader>
              <DialogTitle>Nouvelle évaluation</DialogTitle>
              <DialogDescription>
                Elle sera ajoutée au cours sélectionné.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <label className="text-xs font-bold text-[#34406b]">
                Titre
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Type
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  maxLength={50}
                  required
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Date (facultative)
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </label>
              <label className="text-xs font-bold text-[#34406b]">
                Coefficient
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-violet-500"
                  value={coefficient}
                  onChange={(event) => setCoefficient(event.target.value)}
                  required
                />
              </label>
            </div>
            <DialogFooter>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Création…' : 'Créer'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Grades() {
  const courseState = useTeacherCourses();
  const unavailable = (
    <AsyncState
      status={
        courseState.loading
          ? 'loading'
          : courseState.failed
            ? 'error'
            : 'empty'
      }
      loadingMessage="Chargement de vos cours…"
      errorMessage="Vos cours n’ont pas pu être chargés."
      emptyMessage="Aucun cours ne vous est actuellement affecté."
      onRetry={() => void courseState.fetchCourses()}
    />
  );

  return (
    <Page
      title="Notes & Bulletins"
      subtitle="Saisissez les notes évaluation par évaluation."
    >
      {courseState.loading ||
      courseState.failed ||
      courseState.courses.length === 0 ? (
        unavailable
      ) : (
        <div className="space-y-5">
          <CourseSelect
            courses={courseState.courses}
            value={courseState.selectedCourseId}
            onChange={courseState.setSelectedCourseId}
          />
          {courseState.selectedCourseId && (
            <GradeBook
              key={courseState.selectedCourseId}
              courseId={courseState.selectedCourseId}
            />
          )}
        </div>
      )}
    </Page>
  );
}

function GradeBook({ courseId }: { courseId: string }) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [loadingEvaluations, setLoadingEvaluations] = useState(true);
  const [evaluationsFailed, setEvaluationsFailed] = useState(false);
  const [entries, setEntries] = useState<EvaluationGradeEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [gradesFailed, setGradesFailed] = useState(false);

  const fetchEvaluations = useCallback(async () => {
    try {
      setLoadingEvaluations(true);
      setEvaluationsFailed(false);
      const response = await apiClient.get(
        `/teacher/courses/${courseId}/evaluations`,
      );
      const courseEvaluations = (response.data.data || []) as Evaluation[];
      setEvaluations(courseEvaluations);
      setSelectedEvaluationId(courseEvaluations[0]?.id || '');
    } catch (error) {
      console.error('Erreur chargement évaluations:', error);
      setEvaluationsFailed(true);
      toast.error('Impossible de charger les évaluations');
    } finally {
      setLoadingEvaluations(false);
    }
  }, [courseId]);

  const fetchGrades = useCallback(async () => {
    if (!selectedEvaluationId) {
      setEntries([]);
      setTotalEntries(0);
      return;
    }
    try {
      setLoadingGrades(true);
      setGradesFailed(false);
      const response = await apiClient.get(
        `/teacher/evaluations/${selectedEvaluationId}/grades`,
        { params: { page, limit: LIST_PAGE_SIZE } },
      );
      setEntries(response.data.data.items || []);
      setTotalEntries(response.data.data.meta?.total || 0);
    } catch (error) {
      console.error('Erreur chargement notes:', error);
      setGradesFailed(true);
      toast.error('Impossible de charger les notes');
    } finally {
      setLoadingGrades(false);
    }
  }, [selectedEvaluationId, page]);

  const [pageResetKey, setPageResetKey] = useState(selectedEvaluationId);
  if (selectedEvaluationId !== pageResetKey) {
    setPageResetKey(selectedEvaluationId);
    setPage(1);
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchEvaluations();
    });
    return () => {
      active = false;
    };
  }, [fetchEvaluations]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchGrades();
    });
    return () => {
      active = false;
    };
  }, [fetchGrades]);

  const saveGrade = async (studentId: string, value: number) => {
    const response = await apiClient.post(
      `/teacher/evaluations/${selectedEvaluationId}/grades`,
      { studentId, value },
    );
    const grade = response.data.data as EvaluationGrade;
    setEntries((current) =>
      current.map((entry) =>
        entry.studentId === studentId ? { ...entry, grade } : entry,
      ),
    );
  };

  if (loadingEvaluations || evaluationsFailed || evaluations.length === 0)
    return (
      <AsyncState
        status={
          loadingEvaluations ? 'loading' : evaluationsFailed ? 'error' : 'empty'
        }
        variant="inline"
        emptyVariant="card"
        loadingMessage="Chargement des évaluations…"
        retryLabel="Réessayer de charger les évaluations"
        emptyMessage="Créez d’abord une évaluation pour saisir des notes."
        onRetry={() => void fetchEvaluations()}
      />
    );

  return (
    <div className="space-y-5">
      <label className="block max-w-xl">
        <span className="mb-1 block text-xs font-bold text-[#34406b]">
          Évaluation
        </span>
        <select
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
          value={selectedEvaluationId}
          onChange={(event) => setSelectedEvaluationId(event.target.value)}
        >
          {evaluations.map((evaluation) => (
            <option key={evaluation.id} value={evaluation.id}>
              {evaluation.title} · {evaluation.type}
            </option>
          ))}
        </select>
      </label>
      <Card title="Saisie des notes">
        <p className="mb-4 text-xs text-slate-500">
          Chaque note est enregistrée lorsque vous quittez son champ.
        </p>
        {loadingGrades || gradesFailed || totalEntries === 0 ? (
          <AsyncState
            status={loadingGrades ? 'loading' : gradesFailed ? 'error' : 'empty'}
            variant="inline"
            loadingMessage="Chargement des étudiants…"
            retryLabel="Réessayer de charger les notes"
            emptyMessage="Aucun étudiant n’est inscrit à ce cours."
            onRetry={() => void fetchGrades()}
          />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const name = `${entry.student.firstName} ${entry.student.lastName}`;
              return (
                <div
                  key={entry.studentId}
                  className="flex items-center gap-3 rounded-xl border border-slate-50 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <StudentName name={name} />
                  </div>
                  <GradeInput
                    key={`${entry.studentId}-${entry.grade?.value ?? 'empty'}`}
                    value={entry.grade?.value ?? null}
                    onSave={(value) => saveGrade(entry.studentId, value)}
                  />
                </div>
              );
            })}
          </div>
        )}
        <ListPagination
          page={page}
          totalItems={totalEntries}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}

function GradeInput({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (value: number) => Promise<void>;
}) {
  const initialValue = value === null ? '' : String(value);
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const saveOnBlur = () => {
    const parsedValue = Number(draft);
    if (!draft.trim()) return;
    if (!Number.isFinite(parsedValue)) {
      toast.error('La note doit être un nombre');
      setDraft(initialValue);
      return;
    }
    if (parsedValue === value) return;
    void (async () => {
      try {
        setSaving(true);
        await onSave(parsedValue);
      } catch (error) {
        console.error('Erreur enregistrement note:', error);
        toast.error('Impossible d’enregistrer cette note');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="w-28">
      <input
        type="number"
        step="0.01"
        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-violet-500"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={saveOnBlur}
        aria-label="Note"
      />
      {saving && (
        <span className="text-[9px] text-slate-400">Enregistrement…</span>
      )}
    </div>
  );
}

function Schedule() {
  return (
    <Page title="Emploi du temps" subtitle="Consultez votre planning de cours.">
      <TeacherSchedule />
    </Page>
  );
}

function Assignments() {
  return (
    <Page title="Devoirs" subtitle="Créez, publiez et notez les devoirs.">
      <TeacherAssignments />
    </Page>
  );
}

function Resources() {
  const [resources, setResources] = useState<TeacherResource[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/teacher/courses/resources', {
        params: { page, limit: LIST_PAGE_SIZE },
      });
      setResources(response.data.data.items || []);
      setTotalItems(response.data.data.meta?.total || 0);
    } catch (error) {
      console.error('Erreur chargement ressources:', error);
      setFailed(true);
      toast.error('Impossible de charger les ressources');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchResources();
    });
    return () => {
      active = false;
    };
  }, [fetchResources]);

  return (
    <Page
      title="Ressources pédagogiques"
      subtitle="Retrouvez les ressources de vos cours."
    >
      <p className="mb-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs text-violet-800">
        Ajoutez une ressource depuis la{' '}
        <Link
          href="/dashboard/teacher?view=courses"
          className="font-bold underline underline-offset-2"
        >
          page d&apos;un cours
        </Link>
        , dans le chapitre concerné.
      </p>
      {loading || failed || totalItems === 0 ? (
        <AsyncState
          status={loading ? 'loading' : failed ? 'error' : 'empty'}
          loadingMessage="Chargement des ressources…"
          errorMessage="Les ressources n'ont pas pu être chargées."
          emptyMessage="Aucune ressource n'a encore été ajoutée à vos cours."
        />
      ) : (
        <div className="space-y-2">
          {resources.map((resource) => (
            <a
              key={resource.id}
              href={resource.url}
              rel="noreferrer"
              target="_blank"
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-violet-200"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#17204e]">
                  {resource.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {resource.chapter.course.title} · {resource.chapter.title}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold text-slate-500">
                  {resource.type}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {new Date(resource.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
      <ListPagination
        page={page}
        totalItems={totalItems}
        onPageChange={setPage}
      />
    </Page>
  );
}

function Messages() {
  return <MessagesScreen />;
}

function Announcements() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [courseId, setCourseId] = useState('');
  const [announcements, setAnnouncements] = useState<TeacherAnnouncement[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const loadAnnouncements = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/teacher/courses/${courseId}/announcements`,
      );
      setAnnouncements(response.data.data);
    } catch (error) {
      console.error('Erreur chargement annonces:', error);
      toast.error('Impossible de charger les annonces');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await apiClient.get('/teacher/courses');
        if (!active) return;
        const teacherCourses = response.data.data as CourseSummary[];
        setCourses(teacherCourses);
        setCourseId(teacherCourses[0]?.id ?? '');
      } catch (error) {
        console.error('Erreur chargement cours annonces:', error);
        if (active) toast.error('Impossible de charger vos cours');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (courseId) {
      void Promise.resolve().then(() => {
        if (active) return loadAnnouncements();
      });
    }
    return () => {
      active = false;
    };
  }, [courseId, loadAnnouncements]);

  const submitAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseId || !title.trim() || !body.trim()) return;
    try {
      setSending(true);
      await apiClient.post(`/teacher/courses/${courseId}/announcements`, {
        title,
        body,
      });
      setTitle('');
      setBody('');
      toast.success('Annonce envoyée aux étudiants inscrits au cours');
      await loadAnnouncements();
    } catch (error) {
      console.error('Erreur envoi annonce:', error);
      toast.error("L'annonce n'a pas pu être envoyée");
    } finally {
      setSending(false);
    }
  };

  return (
    <Page
      title="Annonces"
      subtitle="Informez uniquement les étudiants inscrits à un cours."
    >
      <div className="space-y-4">
        <Card title="Nouvelle annonce">
          {courses.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">
              Aucun cours accessible pour envoyer une annonce.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={submitAnnouncement}>
              <label className="block text-xs font-bold text-slate-700">
                Cours destinataire
                <select
                  className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500"
                  onChange={(event) => setCourseId(event.target.value)}
                  value={courseId}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} · {course.school.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Titre
                <input
                  className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  value={title}
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Message
                <textarea
                  className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-violet-500"
                  onChange={(event) => setBody(event.target.value)}
                  required
                  value={body}
                />
              </label>
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={sending || !courseId}
                  type="submit"
                >
                  {sending ? 'Envoi…' : 'Envoyer aux étudiants du cours'}
                </button>
              </div>
            </form>
          )}
        </Card>
        <Card title="Historique du cours">
          {loading || announcements.length === 0 ? (
            <AsyncState
              status={loading ? 'loading' : 'empty'}
              variant="inline"
              bordered={false}
              textSize="sm"
              loadingMessage="Chargement des annonces…"
              emptyMessage="Aucune annonce n'a encore été envoyée pour ce cours."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {announcements.map((announcement) => (
                <article className="py-4" key={announcement.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-extrabold text-[#17204e]">
                        {announcement.title}
                      </h2>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                        {announcement.body}
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
                      {announcement.readCount}/{announcement.recipientCount} lus
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">
                    Envoyée le{' '}
                    {new Date(announcement.createdAt).toLocaleString('fr-FR')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}

function SettingsView() {
  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'preferences'
  >('profile');
  const tabs = [
    ['profile', 'Mon profil'],
    ['security', 'Sécurité'],
    ['preferences', 'Préférences'],
  ] as const;

  return (
    <Page
      title="Profil & Paramètres"
      subtitle="Gérez vos informations et préférences."
    >
      <nav className="mb-4 flex gap-5 overflow-x-auto border-b border-slate-100 px-2 text-[10px] font-bold">
        {tabs.map(([id, label]) => (
          <button
            className={`whitespace-nowrap border-b-2 px-1 py-3 ${activeTab === id ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-violet-600'}`}
            key={id}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      {activeTab === 'profile' && <TeacherProfileSettings />}
      {activeTab === 'security' && <TeacherSecuritySettings />}
      {activeTab === 'preferences' && <TeacherPreferencesSettings />}
    </Page>
  );
}

function TeacherProfileSettings() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const response = await apiClient.get('/teacher/profile');
        if (!active) return;
        const teacher = response.data.data as TeacherProfile;
        setProfile(teacher);
        setFirstName(teacher.firstName ?? '');
        setLastName(teacher.lastName ?? '');
        setPhone(teacher.phone ?? '');
      } catch (error) {
        console.error('Erreur chargement profil professeur:', error);
        if (active) toast.error('Impossible de charger votre profil');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      const response = await apiClient.patch('/teacher/profile', {
        firstName,
        lastName,
        phone,
      });
      setProfile(response.data.data as TeacherProfile);
      window.dispatchEvent(new Event('teacher:profile-updated'));
      toast.success('Profil mis à jour');
    } catch (error) {
      console.error('Erreur mise à jour profil professeur:', error);
      toast.error('Impossible de mettre à jour le profil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AsyncState
        status="loading"
        bordered={false}
        loadingMessage="Chargement du profil…"
      />
    );
  }
  if (!profile) {
    return (
      <AsyncState
        status="error"
        bordered={false}
        errorMessage="Le profil est indisponible."
      />
    );
  }

  const displayName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || 'Professeur';
  return (
    <form className="grid gap-4 xl:grid-cols-[300px_1fr]" onSubmit={saveProfile}>
      <Card title={displayName}>
        <div className="text-center">
          <div className="mx-auto w-fit">
            <AvatarUpload
              currentUrl={profile.avatarUrl ?? undefined}
              endpoint="/teacher/profile/avatar"
              fallbackText={displayName.slice(0, 2).toUpperCase()}
              firstName={profile.firstName ?? undefined}
              lastName={profile.lastName ?? undefined}
              onUpload={(avatarUrl) => {
                setProfile((current) =>
                  current ? { ...current, avatarUrl } : current,
                );
                window.dispatchEvent(new Event('teacher:profile-updated'));
              }}
            />
          </div>
          <p className="mt-3 font-bold text-[#16204d]">{displayName}</p>
          <p className="text-xs text-slate-500">{profile.user.email}</p>
        </div>
      </Card>
      <Card title="Informations personnelles">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">
            Prénom
            <input className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500" onChange={(event) => setFirstName(event.target.value)} value={firstName} />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Nom
            <input className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500" onChange={(event) => setLastName(event.target.value)} value={lastName} />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Téléphone
            <input className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500" onChange={(event) => setPhone(event.target.value)} value={phone} />
          </label>
          <div className="text-xs font-bold text-slate-700">
            E-mail
            <p className="mt-1.5 h-9 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-normal text-slate-500">{profile.user.email}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={saving} type="submit">
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </Card>
    </form>
  );
}

function TeacherSecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('La confirmation ne correspond pas au nouveau mot de passe');
      return;
    }
    void (async () => {
      try {
        setSaving(true);
        await apiClient.patch('/teacher/profile/password', {
          currentPassword,
          newPassword,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Mot de passe mis à jour');
      } catch (error) {
        console.error('Erreur changement de mot de passe:', error);
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        toast.error(
          status === 400
            ? 'Le mot de passe actuel est incorrect'
            : 'Impossible de mettre à jour le mot de passe',
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Card title="Mot de passe">
      <form className="max-w-sm space-y-4" onSubmit={submit}>
        <label className="block text-xs font-bold text-slate-700">
          Mot de passe actuel
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Nouveau mot de passe
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Confirmer le nouveau mot de passe
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <p className="text-[10px] text-slate-400">
          Au moins 8 caractères, avec une majuscule, une minuscule, un chiffre
          et un caractère spécial (@$!%*?&amp;).
        </p>
        <button
          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
        </button>
      </form>
    </Card>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'system', label: 'Système' },
];

function TeacherPreferencesSettings() {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTheme = useCallback(async () => {
    try {
      setLoading(true);
      setFailed(false);
      const response = await apiClient.get('/teacher/profile');
      const profile = response.data.data as TeacherProfile;
      setTheme((profile.user.theme as ThemePreference) || 'system');
    } catch (error) {
      console.error('Erreur chargement préférences professeur:', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchTheme();
    });
    return () => {
      active = false;
    };
  }, [fetchTheme]);

  const selectTheme = (value: ThemePreference) => {
    const previous = theme;
    setTheme(value);
    applyTheme(value);
    void (async () => {
      try {
        setSaving(true);
        await apiClient.patch('/teacher/profile/theme', { theme: value });
        toast.success('Préférence enregistrée');
      } catch (error) {
        console.error('Erreur mise à jour du thème:', error);
        setTheme(previous);
        applyTheme(previous);
        toast.error('Impossible d’enregistrer votre préférence');
      } finally {
        setSaving(false);
      }
    })();
  };

  if (loading || failed)
    return (
      <AsyncState
        status={loading ? 'loading' : 'error'}
        bordered={false}
        loadingMessage="Chargement des préférences…"
        errorMessage="Vos préférences n’ont pas pu être chargées."
        onRetry={() => void fetchTheme()}
      />
    );

  return (
    <Card title="Apparence">
      <p className="mb-4 text-xs text-slate-500">
        Choisissez l’apparence de l’application sur cet appareil.
      </p>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving}
            className={`rounded-lg border px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
              theme === option.value
                ? 'border-violet-600 bg-violet-600 text-white'
                : 'border-slate-200 text-slate-600 hover:border-violet-200'
            }`}
            onClick={() => selectTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Page({
  title,
  subtitle,
  children,
  action,
  back,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: string;
  back?: string;
}) {
  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {back && (
            <Link
              href={back}
              className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-violet-600"
            >
              <ChevronLeft className="size-4" /> Retour
            </Link>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
            {title}
          </h1>
          <p className="mt-1 text-xs text-violet-600">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 sm:flex">
            <CalendarDays className="size-4 text-violet-600" />
            Année académique 2024 · 2025
          </button>
          <NotificationBell />
          {action && (
            <button className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">
              <Plus className="size-4" />
              {action}
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-[#17204e]">{title}</h2>
        {action && (
          <button className="text-[10px] font-bold text-violet-600">
            {action}
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function List({ items, icon: Icon }: { items: string[]; icon: LucideIcon }) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <div className="flex gap-3 py-3" key={item}>
          <span className="grid size-7 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <Icon className="size-3.5" />
          </span>
          <p className="flex-1 text-xs font-semibold text-[#34406b]">{item}</p>
          <span className="text-[9px] text-slate-400">Il y a 2h</span>
        </div>
      ))}
    </div>
  );
}
function Info({ rows }: { rows: string[][] }) {
  return (
    <dl className="space-y-3 text-xs">
      {rows.map(([label, value]) => (
        <div className="grid grid-cols-[140px_1fr] gap-3" key={label}>
          <dt className="text-slate-400">{label}</dt>
          <dd className="whitespace-pre-line font-semibold text-[#34406b]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-violet-50 p-3">
      <b className="text-lg text-violet-700">{value}</b>
      <span className="mt-1 block text-[9px] text-slate-500">{label}</span>
    </div>
  );
}
function StudentName({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2 font-bold text-[#26305e]">
      <i className="grid size-7 place-items-center rounded-full bg-violet-100 text-[9px] not-italic text-violet-600">
        {name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 2)}
      </i>
      {name}
    </span>
  );
}
function Status({ value }: { value: string }) {
  const done =
    value === 'Corrigé' || value === 'En cours' || value === 'En cours';
  return (
    <span
      className={`whitespace-nowrap rounded px-2 py-1 text-[9px] font-bold ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}
    >
      {value}
    </span>
  );
}
