'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookOpen, FileText, Search, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { SchoolNewsFeed } from '@/components/shared/school-news-feed';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeacherAssignments } from './teacher-assignments';
import { TeacherSchedule } from './teacher-schedule';
import { TeacherAvailabilityManager } from './teacher-availability';
import { MessagesScreen } from '@/components/messages/messages-screen';
import { TeacherDashboard } from './teacher-dashboard';
import { AvatarUpload } from '@/components/AvatarUpload';
import type {
  View,
  CourseTab,
  CourseSummary,
  TeacherSchool,
  TeacherResource,
  TeacherAnnouncement,
  TeacherProfile,
  ThemePreference,
} from './types';
import { CourseDetail } from './course-detail';
import {
  useTeacherCourses,
  CourseSelect,
  EvaluationPanel,
  GradeBook,
} from './evaluations';
import {
  Page,
  Card,
  AsyncState,
  ListPagination,
  CourseStudentList,
  LIST_PAGE_SIZE,
} from './shared';

/** Applique le thème clair/sombre au document en fonction de la préférence choisie (ou de la préférence système si `theme === 'system'`). */
function applyTheme(theme: string) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * Point d'entrée du portail professeur.
 *
 * Aiguille vers la vue à afficher en fonction du paramètre d'URL `?view=`
 * (dashboard, cours, étudiants, évaluations, notes, planning, disponibilités,
 * devoirs, ressources, messages, annonces, réglages), et vers l'onglet actif
 * (`?tab=`) et le cours consulté (`?courseId=`) pour la vue "Détail d'un cours".
 *
 * Au montage, récupère le profil du professeur (`GET /teacher/profile`) pour
 * appliquer sa préférence de thème clair/sombre à l'ensemble de la page.
 */
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
  if (view === 'availability') return <Availability />;
  if (view === 'assignments') return <Assignments />;
  if (view === 'resources') return <Resources />;
  if (view === 'messages') return <Messages />;
  if (view === 'announcements') return <Announcements />;
  if (view === 'settings') return <SettingsView />;
  return <Dashboard />;
}

/** Vue "Tableau de bord" : délègue l'affichage à `TeacherDashboard` dans le gabarit de page standard. */
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

/**
 * Vue "Mes cours" : liste les cours du professeur avec filtre par
 * établissement, recherche texte et bascule entre cours actifs et archivés
 * (`isPublished`). Charge en parallèle les cours (`GET /teacher/courses`) et
 * les établissements (`GET /teacher/courses/schools`) au montage. Chaque
 * cours mène vers sa fiche détaillée (`CourseDetail`).
 */
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
        <div className="mb-4 block max-w-sm">
          <span className="mb-1 block text-xs font-bold text-[#34406b]">
            Établissement
          </span>
          <Select
            items={[
              { value: 'all', label: 'Tous les établissements' },
              ...schools.map(({ school }) => ({ value: school.id, label: school.name })),
            ]}
            value={selectedSchoolId}
            onValueChange={(value) => setSelectedSchoolId(value ?? 'all')}
          >
            <SelectTrigger className="h-10 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les établissements</SelectItem>
              {schools.map(({ school }) => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <label className="relative mb-4 block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={150}
          placeholder="Rechercher un cours..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-xs outline-none focus:border-indigo-500"
        />
      </label>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('active')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tab === 'active' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
        >
          Actifs ({activeCourses.length})
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tab === 'archived' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}
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
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                <BookOpen className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[#17204e]">
                  {course.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {course.level}
                  {course.group ? ` · ${course.group}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="flex items-center gap-1 text-xs font-bold text-[#17204e]">
                  <UsersRound className="size-3.5 text-muted-foreground" />
                  {course._count.enrollments}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
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

/**
 * Vue "Étudiants" : sélecteur de cours parmi ceux du professeur
 * (`GET /teacher/courses`) puis affichage de la liste paginée des inscrits
 * via `CourseStudentList`, avec un raccourci vers la fiche complète du cours.
 */
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
            <div className="min-w-60 flex-1">
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
            {selectedCourseId && (
              <Link
                href={`/dashboard/teacher?view=course-detail&courseId=${selectedCourseId}&tab=students`}
                className="h-10 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-300 transition hover:bg-indigo-50 dark:bg-indigo-500/15"
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

function Schedule() {
  return (
    <Page title="Emploi du temps" subtitle="Consultez votre planning de cours.">
      <TeacherSchedule />
    </Page>
  );
}

function Availability() {
  return (
    <Page
      title="Mes disponibilités"
      subtitle="Déclarez vos indisponibilités et vos temps de trajet entre écoles."
    >
      <TeacherAvailabilityManager />
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
      <p className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-500/15 px-4 py-3 text-xs text-indigo-800">
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
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-indigo-200"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#17204e]">
                  {resource.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {resource.chapter.course.title} · {resource.chapter.title}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {resource.type}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
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
  const [activeTab, setActiveTab] = useState<'course' | 'school'>('course');
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
      subtitle="Informez vos étudiants ou consultez les actualités de l'établissement."
    >
      <nav className="mb-4 flex gap-5 overflow-x-auto border-b border-border px-2 text-[10px] font-bold">
        <button
          className={`whitespace-nowrap border-b-2 px-1 py-3 ${activeTab === 'course' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-muted-foreground hover:text-indigo-600 dark:text-indigo-300'}`}
          onClick={() => setActiveTab('course')}
          type="button"
        >
          Mes annonces de cours
        </button>
        <button
          className={`whitespace-nowrap border-b-2 px-1 py-3 ${activeTab === 'school' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-muted-foreground hover:text-indigo-600 dark:text-indigo-300'}`}
          onClick={() => setActiveTab('school')}
          type="button"
        >
          Actualités de l&apos;établissement
        </button>
      </nav>
      {activeTab === 'school' && <SchoolNewsFeed />}
      {activeTab === 'course' && (
      <div className="space-y-4">
        <Card title="Nouvelle annonce">
          {courses.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              Aucun cours accessible pour envoyer une annonce.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={submitAnnouncement}>
              <div className="block text-xs font-bold text-foreground">
                Cours destinataire
                <Select
                  items={courses.map((course) => ({
                    value: course.id,
                    label: `${course.title} · ${course.school.name}`,
                  }))}
                  value={courseId}
                  onValueChange={(value) => setCourseId(value ?? '')}
                >
                  <SelectTrigger className="mt-1.5 h-9 w-full text-xs">
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
              <label className="block text-xs font-bold text-foreground">
                Titre
                <input
                  className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500"
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  required
                  value={title}
                />
              </label>
              <label className="block text-xs font-bold text-foreground">
                Message
                <textarea
                  className="mt-1.5 min-h-24 w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={5000}
                  required
                  value={body}
                />
              </label>
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="divide-y divide-border">
              {announcements.map((announcement) => (
                <article className="py-4" key={announcement.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-extrabold text-[#17204e]">
                        {announcement.title}
                      </h2>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                        {announcement.body}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/15 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      {announcement.readCount}/{announcement.recipientCount} lus
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Envoyée le{' '}
                    {new Date(announcement.createdAt).toLocaleString('fr-FR')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
      )}
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
      <nav className="mb-4 flex gap-5 overflow-x-auto border-b border-border px-2 text-[10px] font-bold">
        {tabs.map(([id, label]) => (
          <button
            className={`whitespace-nowrap border-b-2 px-1 py-3 ${activeTab === id ? 'border-indigo-600 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-muted-foreground hover:text-indigo-600 dark:text-indigo-300'}`}
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
          <p className="text-xs text-muted-foreground">{profile.user.email}</p>
        </div>
      </Card>
      <Card title="Informations personnelles">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold text-foreground">
            Prénom
            <input className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500" onChange={(event) => setFirstName(event.target.value)} value={firstName} maxLength={50} />
          </label>
          <label className="text-xs font-bold text-foreground">
            Nom
            <input className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500" onChange={(event) => setLastName(event.target.value)} value={lastName} maxLength={50} />
          </label>
          <label className="text-xs font-bold text-foreground">
            Téléphone
            <input className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500" onChange={(event) => setPhone(event.target.value)} value={phone} maxLength={30} />
          </label>
          <div className="text-xs font-bold text-foreground">
            E-mail
            <p className="mt-1.5 h-9 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-normal text-muted-foreground">{profile.user.email}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={saving} type="submit">
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
        <label className="block text-xs font-bold text-foreground">
          Mot de passe actuel
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        <label className="block text-xs font-bold text-foreground">
          Nouveau mot de passe
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        <label className="block text-xs font-bold text-foreground">
          Confirmer le nouveau mot de passe
          <input
            type="password"
            className="mt-1.5 h-9 w-full rounded-lg border border-border px-3 text-xs outline-none focus:border-indigo-500"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        <p className="text-[10px] text-muted-foreground">
          Au moins 8 caractères, avec une majuscule, une minuscule, un chiffre
          et un caractère spécial (@$!%*?&amp;).
        </p>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
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
      <p className="mb-4 text-xs text-muted-foreground">
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
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-border text-muted-foreground hover:border-indigo-200'
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

