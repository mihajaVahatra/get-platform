'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  ArrowRight,
  Bell,
  BookOpen,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  CircleCheck,
  ClipboardCheck,
  Compass,
  Download,
  FileCheck2,
  FileUp,
  GraduationCap,
  LibraryBig,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { MessageIconLink } from '@/components/messages/message-icon-link';

type Student = {
  firstName: string;
  lastName?: string;
  // Un étudiant peut être inscrit activement dans plusieurs écoles à la
  // fois (double diplôme, cursus parallèle) : liste, jamais un objet unique.
  schoolEnrollments?: Array<{
    schoolId: string;
    enrolledYear?: string | null;
    school?: { name: string } | null;
  }>;
  profileCompleted?: boolean;
};

type CandidateApplication = {
  id: string;
  status: string;
  offer: { title: string; school: { name: string } };
};

type CandidateOffer = {
  id: string;
  title: string;
  diploma: string;
  school: { name: string; city: string };
};

const DECIDED_STATUSES = new Set([
  'ACCEPTED',
  'REJECTED',
  'WAITLISTED',
  'ENROLLED',
]);

const schedule = [
  {
    time: '08:00 – 10:00',
    course: 'Algorithmique Avancée',
    room: 'Salle B204',
    state: 'inProgress' as const,
    active: true,
  },
  {
    time: '10:15 – 12:15',
    course: 'Bases de Données',
    room: 'Salle B205',
    state: 'upcoming' as const,
  },
  {
    time: '14:00 – 16:00',
    course: 'Anglais Technique',
    room: 'Salle A102',
    state: 'upcoming' as const,
  },
  {
    time: '16:15 – 18:15',
    course: 'Mathématiques Discrètes',
    room: 'Salle B203',
    state: 'upcoming' as const,
  },
];

const tasks = [
  {
    title: 'Devoir Algorithmique',
    date: 'À rendre le 15 juin 2025',
    badge: 'urgent' as const,
    tone: 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300',
  },
  {
    title: 'Projet Bases de Données',
    date: 'À rendre le 22 juin 2025',
    badge: 'important' as const,
    tone: 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-300',
  },
  {
    title: 'Préparer présentation Anglais',
    date: 'À rendre le 30 juin 2025',
    badge: 'todo' as const,
    tone: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300',
  },
  {
    title: 'Réviser pour l’examen',
    date: 'Algorithmique Avancée',
    badge: 'todo' as const,
    tone: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300',
  },
];

const courses = [
  {
    title: 'Algorithmique Avancée',
    teacher: 'Pr. A. Andrianarison',
    grade: '15,5/20',
    tone: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  },
  {
    title: 'Bases de Données',
    teacher: 'Pr. T. Ravelomanana',
    grade: '14/20',
    tone: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
  {
    title: 'Anglais Technique',
    teacher: 'Dr. L. Rakotomalala',
    grade: '16/20',
    tone: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300',
  },
];

const events = [
  {
    month: 'JUIN',
    day: '20',
    title: 'Journée des compétences',
    detail: 'Ateliers et formations',
    time: '08:00',
  },
  {
    month: 'JUIN',
    day: '25',
    title: 'Hackathon ESPA',
    detail: 'Compétition inter-écoles',
    time: '09:00',
  },
  {
    month: 'JUIL.',
    day: '05',
    title: 'Conférence Tech',
    detail: 'Invité : Expert du secteur',
    time: '14:00',
  },
];

export default function StudentDashboardPage() {
  const t = useTranslations('StudentDashboard');
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/students/me')
      .then((response) => setStudent(response.data.data))
      .catch((error) => console.error('Erreur chargement étudiant:', error))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm font-medium text-muted-foreground">
        {t('loadingSpace')}
      </div>
    );
  }

  const enrollments = student?.schoolEnrollments ?? [];
  if (student && enrollments.length === 0) {
    return <CandidateDashboard student={student} />;
  }

  // Un seul établissement : phrase habituelle. Plusieurs (double cursus) :
  // on les énumère plutôt que de n'en montrer qu'un seul arbitrairement.
  const school =
    enrollments.length > 1
      ? enrollments.map((enrollment) => enrollment.school?.name).filter(Boolean).join(t('schoolJoiner'))
      : (enrollments[0]?.school?.name ?? 'ESPA');
  const year =
    enrollments.length > 1 ? '' : (enrollments[0]?.enrolledYear ?? t('defaultYear'));

  return (
    <div className="mx-auto max-w-[1450px] space-y-4 text-[#111a4b]">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[27px]">
            {t('greeting', { name: student?.firstName || 'Toavina' })}{' '}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {t('welcomeTo', { school })}
            {year ? ` – ${year}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden w-72 md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              maxLength={150}
              placeholder={t('searchPlaceholder')}
              className="h-11 rounded-xl border-border bg-card pl-9 text-xs shadow-sm"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-indigo-50 dark:bg-indigo-500/15 px-1.5 py-1 text-[10px] text-indigo-500 dark:text-indigo-300">
              Ctrl K
            </kbd>
          </div>
          <NotificationBell />
          <MessageIconLink href="/dashboard/student/messages" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatWidget
          icon={BookOpen}
          title={t('statAverage')}
          value="15,2"
          suffix="/20"
          hint={t('statAverageHint')}
          tone="indigo"
        />
        <StatWidget
          icon={BookOpenCheck}
          title={t('statCredits')}
          value="18"
          suffix="/30"
          hint={t('statCreditsHint', { percent: 60 })}
          progress="60"
          tone="green"
        />
        <StatWidget
          icon={CalendarDays}
          title={t('statAbsences')}
          value="2"
          suffix=""
          hint={t('statAbsencesHint')}
          tone="orange"
        />
        <StatWidget
          icon={Award}
          title={t('statMerit')}
          value="120"
          suffix="pts"
          hint={t('statMeritHint')}
          tone="blue"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Widget
          className="xl:col-span-4"
          title={
            <>
              {t('scheduleTitle')}{' '}
              <span className="font-normal text-muted-foreground">{t('scheduleTodaySuffix')}</span>
            </>
          }
          action={t('viewAll')}
        >
          <div className="mt-4 space-y-1">
            {schedule.map((item) => (
              <div
                key={item.time}
                className="grid grid-cols-[108px_1fr_auto] items-center gap-3 py-2.5 text-xs"
              >
                <div className="relative border-r border-border pr-3 text-indigo-700 dark:text-indigo-300">
                  <span
                    className={`absolute -right-[5px] top-1/2 size-2 rounded-full border-2 border-white ${item.active ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  />
                  {item.time}
                </div>
                <div>
                  <p className="font-bold text-foreground">{item.course}</p>
                  <p className="mt-1 text-muted-foreground">{item.room}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.active ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-500 dark:text-indigo-300'}`}
                >
                  {t(`scheduleStates.${item.state}`)}
                </span>
              </div>
            ))}
          </div>
        </Widget>

        <Widget
          className="xl:col-span-4"
          title={t('tasksTitle')}
          action={t('viewAllFem')}
        >
          <div className="mt-3 divide-y divide-border">
            {tasks.map((task) => (
              <div
                key={task.title}
                className="flex items-center gap-3 py-3 first:pt-1"
              >
                <CheckSquare className="size-4 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">
                    {task.title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{task.date}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${task.tone}`}
                >
                  {t(`taskBadges.${task.badge}`)}
                </span>
              </div>
            ))}
          </div>
        </Widget>

        <div className="space-y-4 xl:col-span-4">
          <Widget title={t('newsTitle')} action={t('viewAll')}>
            <div className="mt-4 overflow-hidden rounded-xl bg-gradient-to-br from-[#27204d] via-[#5651a8] to-[#88a0bc] p-4 text-white shadow-inner">
              <span className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-bold">
                {t('importantBadge')}
              </span>
              <h3 className="mt-5 text-base font-bold">
                Réinscription 2025–2026
              </h3>
              <p className="mt-2 text-xs leading-5 text-indigo-50">
                La réinscription en ligne est ouverte jusqu&apos;au 30 juin
                2025.
              </p>
            </div>
            <div className="mt-3 divide-y divide-border">
              {[
                'Conférence : IA et avenir',
                'Résultats examens S1',
                'Club Robotique',
              ].map((news, index) => (
                <div key={news} className="flex items-center gap-3 py-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-500 dark:text-indigo-300">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">
                      {news}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {index === 0
                        ? '06 juin 2025'
                        : index === 1
                          ? '04 juin 2025'
                          : 'Rejoignez-nous !'}
                    </p>
                  </div>
                  {index < 2 && (
                    <span className="text-[10px] text-muted-foreground">
                      {index === 0 ? '06 juin' : '04 juin'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Widget>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Widget title={t('quickAccessTitle')}>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <QuickAction
                icon={Download}
                label={t('quickDownload')}
                detail={t('quickDownloadDetail')}
                tone="indigo"
                href="/dashboard/student/profile"
              />
              <QuickAction
                icon={FileCheck2}
                label={t('quickDocRequest')}
                detail={t('quickDocRequestDetail')}
                tone="green"
                href="/dashboard/student/profile"
              />
              <QuickAction
                icon={WalletCards}
                label={t('quickOnlinePayment')}
                detail={t('quickOnlinePaymentDetail')}
                tone="orange"
                href="/dashboard/student/payments"
              />
              <QuickAction
                icon={ShieldCheck}
                label={t('quickScholarship')}
                detail={t('quickScholarshipDetail')}
                tone="rose"
                href="/dashboard/student"
              />
              <QuickAction
                icon={BriefcaseBusiness}
                label={t('quickInternships')}
                detail={t('quickInternshipsDetail')}
                tone="blue"
                href="/dashboard/student"
              />
              <QuickAction
                icon={LibraryBig}
                label={t('quickLibrary')}
                detail={t('quickLibraryDetail')}
                tone="indigo"
                href="/dashboard/student"
              />
            </div>
          </Widget>
          <div className="grid gap-4 lg:grid-cols-2">
            <Widget title={t('coursesTitle')} action={t('viewAll')}>
              <div className="mt-3 divide-y divide-border">
                {courses.map((course) => (
                  <div
                    key={course.title}
                    className="flex items-center gap-3 py-3"
                  >
                    <span
                      className={`flex size-9 items-center justify-center rounded-lg ${course.tone}`}
                    >
                      <BookOpen className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground">
                        {course.title}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {course.teacher}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-300">
                      {course.grade}
                    </span>
                  </div>
                ))}
              </div>
            </Widget>
            <Widget title={t('financesTitle')} action={t('viewAll')}>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/15 p-4">
                  <p className="text-[11px] text-muted-foreground">{t('currentBalance')}</p>
                  <p className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-300">
                    125 000 Ar
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                    {t('available')}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('nextPayment')}
                  </p>
                  <p className="mt-2 text-xs font-bold text-foreground">
                    {t('tuitionS2')}
                  </p>
                  <p className="mt-2 text-lg font-extrabold text-emerald-600 dark:text-emerald-300">
                    350 000 Ar
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {t('payBefore', { date: '30 juin 2025' })}
                  </p>
                  <Link
                    href="/dashboard/student/payments"
                    className="mt-4 flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                  >
                    {t('payNow')}
                  </Link>
                </div>
              </div>
            </Widget>
          </div>
        </div>

        <Widget
          className="xl:col-span-4"
          title={t('upcomingEventsTitle')}
          action={t('viewAll')}
        >
          <div className="mt-3 divide-y divide-border">
            {events.map((event) => (
              <div key={event.title} className="flex items-center gap-3 py-3">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                  <span className="text-[9px] font-bold">{event.month}</span>
                  <span className="text-lg font-extrabold leading-4">
                    {event.day}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">
                    {event.title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {event.detail}
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {event.time}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/student?section=events"
            className="mt-3 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-300"
          >
            {t('viewAllEvents')}
          </Link>
        </Widget>
      </section>

      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-50 to-teal-50 px-4 py-3 text-xs text-indigo-700 dark:text-indigo-300">
        <Bell className="size-4 shrink-0" />
        <p>
          <span className="font-bold">{t('tipTitle')}</span> {t('tipText')}
        </p>
        <button className="ml-auto text-muted-foreground">×</button>
      </div>
    </div>
  );
}

function CandidateDashboard({ student }: { student: Student }) {
  const t = useTranslations('StudentDashboard');
  const [applications, setApplications] = useState<CandidateApplication[]>(
    [],
  );
  const [totalApplications, setTotalApplications] = useState(0);
  const [recentOffers, setRecentOffers] = useState<CandidateOffer[]>([]);
  const [totalOffers, setTotalOffers] = useState(0);

  useEffect(() => {
    apiClient
      .get('/applications/me?limit=100')
      .then((response) => {
        setApplications(response.data.data || []);
        setTotalApplications(response.data.meta?.total ?? 0);
      })
      .catch((error) =>
        console.error('Erreur chargement candidatures:', error),
      );
    apiClient
      .get('/offers?limit=3')
      .then((response) => {
        setRecentOffers(response.data.data || []);
        setTotalOffers(response.data.meta?.total ?? 0);
      })
      .catch((error) => console.error('Erreur chargement formations:', error));
  }, []);

  const hasDecision = applications.some((a) => DECIDED_STATUSES.has(a.status));
  const accepted = applications.filter((a) => a.status === 'ACCEPTED').length;
  const pending = totalApplications - applications.filter((a) => DECIDED_STATUSES.has(a.status)).length;

  const steps = [
    {
      title: t('step1Title'),
      text: t('step1Text'),
      icon: FileUp,
      done: Boolean(student.profileCompleted),
      href: '/dashboard/student/profile',
    },
    {
      title: t('step2Title'),
      text: t('step2Text'),
      icon: Compass,
      done: totalApplications > 0,
      href: '/dashboard/student/offers',
    },
    {
      title: t('step3Title'),
      text: t('step3Text'),
      icon: CircleCheck,
      done: hasDecision,
      href: '/dashboard/student/applications',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const dossierCard = student.profileCompleted
    ? { value: t('fileComplete'), text: t('fileCompleteText') }
    : {
        value: t('fileIncomplete'),
        text: t('fileIncompleteText'),
      };

  const applicationsCard =
    totalApplications === 0
      ? {
          value: t('noApplications'),
          text: t('noApplicationsText'),
        }
      : {
          value: t('applicationsCount', { count: totalApplications }),
          text:
            accepted > 0
              ? `${t('acceptedCount', { count: accepted })} · ${t('pendingCount', { count: pending })}`
              : t('pendingResponseCount', { count: pending }),
        };

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 text-[#111a4b]">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            {t('candidateSpace')}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[28px]">
            {t('candidateGreeting', { name: student.firstName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('candidateIntro')}
          </p>
        </div>
        <Link
          href="/dashboard/student/offers"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-teal-400 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:brightness-105"
        >
          <Compass className="size-4" />
          {t('discoverSchools')}
        </Link>
      </header>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2d1a8b] via-indigo-700 to-indigo-500 p-6 text-white shadow-[0_16px_35px_rgba(83,54,190,0.2)] sm:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
              <GraduationCap className="size-4" />
              {t('readyTitle')}
            </span>
            <h2 className="mt-4 max-w-2xl text-2xl font-extrabold leading-tight sm:text-3xl">
              {t('heroTitle')}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
              {t('heroText')}
            </p>
            <Link
              href="/dashboard/student/offers"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-bold text-indigo-700 dark:text-indigo-300 transition hover:bg-indigo-50 dark:bg-indigo-500/15"
            >
              {t('searchFormation')} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid size-28 place-items-center rounded-full border border-white/20 bg-white/10 sm:size-36">
            <GraduationCap className="size-14 text-white sm:size-16" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <CandidateCard
          icon={FileCheck2}
          tone="indigo"
          title={t('myFileTitle')}
          value={dossierCard.value}
          text={dossierCard.text}
          action={
            student.profileCompleted ? t('viewProfile') : t('completeProfile')
          }
          href="/dashboard/student/profile"
        />
        <CandidateCard
          icon={BookOpen}
          tone="blue"
          title={t('availableFormationsTitle')}
          value={
            totalOffers > 0
              ? t('formationsCount', { count: totalOffers })
              : t('noneAvailable')
          }
          text={t('formationsText')}
          action={t('exploreFormations')}
          href="/dashboard/student/offers"
        />
        <CandidateCard
          icon={ClipboardCheck}
          tone="green"
          title={t('myApplicationsTitle')}
          value={applicationsCard.value}
          text={applicationsCard.text}
          action={
            totalApplications === 0 ? t('startSearch') : t('viewApplications')
          }
          href={
            totalApplications === 0
              ? '/dashboard/student/offers'
              : '/dashboard/student/applications'
          }
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">
              {t('stepsTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('stepsSubtitle')}
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/15 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300">
            {t('stepsCompleted', { done: doneCount, total: steps.length })}
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              className={`group relative rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${step.done ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300' : 'border-border hover:border-indigo-200'}`}
            >
              <span
                className={`grid size-10 place-items-center rounded-xl ${step.done ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'}`}
              >
                {step.done ? (
                  <CircleCheck className="size-5" />
                ) : (
                  <step.icon className="size-5" />
                )}
              </span>
              <span
                className={`absolute right-4 top-4 grid size-6 place-items-center rounded-full border text-[10px] font-bold ${step.done ? 'border-emerald-300 text-emerald-600 dark:text-emerald-300' : 'border-border text-muted-foreground'}`}
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-sm font-extrabold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {step.text}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                {step.done ? t('stepDone') : t('stepStart')}{' '}
                <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
          <h2 className="text-sm font-extrabold">{t('latestFormationsTitle')}</h2>
          <div className="mt-4 space-y-3">
            {recentOffers.length === 0 ? (
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                {t('noFormationsAvailable')}
              </p>
            ) : (
              recentOffers.map((offer) => (
                <Link
                  href="/dashboard/student/offers"
                  key={offer.id}
                  className="flex items-center gap-3 rounded-xl bg-muted p-3 transition hover:bg-indigo-50 dark:bg-indigo-500/15"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-card text-indigo-600 dark:text-indigo-300 shadow-sm">
                    <BookOpen className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-xs text-foreground">
                      {offer.title}
                    </b>
                    <small className="block truncate text-[11px] text-muted-foreground">
                      {offer.school.name} · {offer.school.city}
                    </small>
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                    {offer.diploma}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
          <h2 className="text-sm font-extrabold">{t('helpTitle')}</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t('helpText')}
          </p>
          <div className="mt-5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 p-4">
            <MapPin className="size-5 text-indigo-600 dark:text-indigo-300" />
            <p className="mt-3 text-sm font-bold text-foreground">
              {t('findSchoolTitle')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('findSchoolText')}
            </p>
            <Link
              href="/dashboard/student/offers"
              className="mt-4 inline-flex text-xs font-bold text-indigo-600 dark:text-indigo-300"
            >
              {t('viewMap')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function CandidateCard({
  icon: Icon,
  tone,
  title,
  value,
  text,
  action,
  href,
}: {
  icon: typeof BookOpen;
  tone: 'indigo' | 'blue' | 'green';
  title: string;
  value: string;
  text: string;
  action: string;
  href: string;
}) {
  const tones = {
    indigo: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
    blue: 'bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-300',
    green: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
      <span
        className={`grid size-11 place-items-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-xs font-bold text-muted-foreground">{title}</p>
      <h2 className="mt-1 text-lg font-extrabold text-[#111a4b]">{value}</h2>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex text-xs font-bold text-indigo-600 dark:text-indigo-300"
      >
        {action} →
      </Link>
    </section>
  );
}

function StatWidget({
  icon: Icon,
  title,
  value,
  suffix,
  hint,
  tone,
  progress,
}: {
  icon: typeof BookOpen;
  title: string;
  value: string;
  suffix: string;
  hint: string;
  tone: 'indigo' | 'green' | 'orange' | 'blue';
  progress?: string;
}) {
  const styles = {
    indigo: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
    green: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    orange: 'bg-orange-50 dark:bg-orange-500/15 text-orange-500 dark:text-orange-300',
    blue: 'bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-300',
  };
  const valueStyles = {
    indigo: 'text-indigo-600 dark:text-indigo-300',
    green: 'text-emerald-600 dark:text-emerald-300',
    orange: 'text-orange-500 dark:text-orange-300',
    blue: 'text-blue-500 dark:text-blue-300',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
      <div className="flex gap-4">
        <span
          className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${styles[tone]}`}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">{title}</p>
          <p
            className={`mt-1 text-[28px] font-extrabold leading-8 ${valueStyles[tone]}`}
          >
            {value}
            <span className="ml-1 text-sm">{suffix}</span>
          </p>
          {progress && (
            <div className="mt-2 h-1.5 w-full max-w-44 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function Widget({
  title,
  action,
  children,
  className = '',
}: {
  title: React.ReactNode;
  action?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-[#111a4b]">{title}</h2>
        {action && (
          <button className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:text-indigo-300">
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function QuickAction({
  icon: Icon,
  label,
  detail,
  tone,
  href,
}: {
  icon: typeof Download;
  label: string;
  detail: string;
  tone: 'indigo' | 'green' | 'orange' | 'rose' | 'blue';
  href: string;
}) {
  const styles = {
    indigo: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
    green: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    orange: 'bg-orange-50 dark:bg-orange-500/15 text-orange-500 dark:text-orange-300',
    rose: 'bg-rose-50 dark:bg-rose-500/15 text-rose-500 dark:text-rose-300',
    blue: 'bg-blue-50 dark:bg-blue-500/15 text-blue-500 dark:text-blue-300',
  };
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl p-2 transition hover:bg-muted"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${styles[tone]}`}
      >
        <Icon className="size-4" />
      </span>
      <span className="text-[11px] font-bold leading-4 text-muted-foreground">
        {label}
        <br />
        {detail}
      </span>
    </Link>
  );
}
