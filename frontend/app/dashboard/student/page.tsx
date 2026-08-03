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
    state: 'En cours',
    active: true,
  },
  {
    time: '10:15 – 12:15',
    course: 'Bases de Données',
    room: 'Salle B205',
    state: 'À venir',
  },
  {
    time: '14:00 – 16:00',
    course: 'Anglais Technique',
    room: 'Salle A102',
    state: 'À venir',
  },
  {
    time: '16:15 – 18:15',
    course: 'Mathématiques Discrètes',
    room: 'Salle B203',
    state: 'À venir',
  },
];

const tasks = [
  {
    title: 'Devoir Algorithmique',
    date: 'À rendre le 15 juin 2025',
    badge: 'Urgent',
    tone: 'bg-rose-50 text-rose-600',
  },
  {
    title: 'Projet Bases de Données',
    date: 'À rendre le 22 juin 2025',
    badge: 'Important',
    tone: 'bg-orange-50 text-orange-600',
  },
  {
    title: 'Préparer présentation Anglais',
    date: 'À rendre le 30 juin 2025',
    badge: 'À faire',
    tone: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Réviser pour l’examen',
    date: 'Algorithmique Avancée',
    badge: 'À faire',
    tone: 'bg-blue-50 text-blue-600',
  },
];

const courses = [
  {
    title: 'Algorithmique Avancée',
    teacher: 'Pr. A. Andrianarison',
    grade: '15,5/20',
    tone: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Bases de Données',
    teacher: 'Pr. T. Ravelomanana',
    grade: '14/20',
    tone: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Anglais Technique',
    teacher: 'Dr. L. Rakotomalala',
    grade: '16/20',
    tone: 'bg-blue-50 text-blue-600',
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
      <div className="grid min-h-[50vh] place-items-center text-sm font-medium text-slate-500">
        Chargement de votre espace…
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
      ? enrollments.map((enrollment) => enrollment.school?.name).filter(Boolean).join(' et ')
      : (enrollments[0]?.school?.name ?? 'ESPA');
  const year =
    enrollments.length > 1 ? '' : (enrollments[0]?.enrolledYear ?? '2ᵉ année Informatique');

  return (
    <div className="mx-auto max-w-[1450px] space-y-4 text-[#111a4b]">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[27px]">
            Bonjour {student?.firstName || 'Toavina'}{' '}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Bienvenue à {school}
            {year ? ` – ${year}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden w-72 md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher..."
              className="h-11 rounded-xl border-slate-200 bg-white pl-9 text-xs shadow-sm"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-violet-50 px-1.5 py-1 text-[10px] text-violet-500">
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
          title="Moyenne générale"
          value="15,2"
          suffix="/20"
          hint="↑ +1,3 vs semestre précédent"
          tone="violet"
        />
        <StatWidget
          icon={BookOpenCheck}
          title="Crédits validés"
          value="18"
          suffix="/30"
          hint="60% du programme"
          progress="60"
          tone="green"
        />
        <StatWidget
          icon={CalendarDays}
          title="Absences"
          value="2"
          suffix=""
          hint="Justifiées"
          tone="orange"
        />
        <StatWidget
          icon={Award}
          title="Points de mérite"
          value="120"
          suffix="pts"
          hint="Bravo ! Continue comme ça 💪"
          tone="blue"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Widget
          className="xl:col-span-4"
          title={
            <>
              Emploi du temps{' '}
              <span className="font-normal text-slate-500">– Aujourd’hui</span>
            </>
          }
          action="Voir tout"
        >
          <div className="mt-4 space-y-1">
            {schedule.map((item) => (
              <div
                key={item.time}
                className="grid grid-cols-[108px_1fr_auto] items-center gap-3 py-2.5 text-xs"
              >
                <div className="relative border-r border-slate-200 pr-3 text-violet-700">
                  <span
                    className={`absolute -right-[5px] top-1/2 size-2 rounded-full border-2 border-white ${item.active ? 'bg-violet-600' : 'bg-slate-300'}`}
                  />
                  {item.time}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{item.course}</p>
                  <p className="mt-1 text-slate-400">{item.room}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.active ? 'bg-violet-50 text-violet-600' : 'bg-indigo-50 text-indigo-500'}`}
                >
                  {item.state}
                </span>
              </div>
            ))}
          </div>
        </Widget>

        <Widget
          className="xl:col-span-4"
          title="Mes tâches"
          action="Voir toutes"
        >
          <div className="mt-3 divide-y divide-slate-100">
            {tasks.map((task) => (
              <div
                key={task.title}
                className="flex items-center gap-3 py-3 first:pt-1"
              >
                <CheckSquare className="size-4 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800">
                    {task.title}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">{task.date}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${task.tone}`}
                >
                  {task.badge}
                </span>
              </div>
            ))}
          </div>
        </Widget>

        <div className="space-y-4 xl:col-span-4">
          <Widget title="Actualités" action="Voir tout">
            <div className="mt-4 overflow-hidden rounded-xl bg-gradient-to-br from-[#27204d] via-[#5651a8] to-[#88a0bc] p-4 text-white shadow-inner">
              <span className="rounded bg-violet-600 px-2 py-1 text-[10px] font-bold">
                IMPORTANT
              </span>
              <h3 className="mt-5 text-base font-bold">
                Réinscription 2025–2026
              </h3>
              <p className="mt-2 text-xs leading-5 text-violet-50">
                La réinscription en ligne est ouverte jusqu&apos;au 30 juin
                2025.
              </p>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {[
                'Conférence : IA et avenir',
                'Résultats examens S1',
                'Club Robotique',
              ].map((news, index) => (
                <div key={news} className="flex items-center gap-3 py-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-violet-50 text-violet-500">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {news}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {index === 0
                        ? '06 juin 2025'
                        : index === 1
                          ? '04 juin 2025'
                          : 'Rejoignez-nous !'}
                    </p>
                  </div>
                  {index < 2 && (
                    <span className="text-[10px] text-slate-400">
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
          <Widget title="Accès rapides">
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <QuickAction
                icon={Download}
                label="Télécharger"
                detail="attestation"
                tone="violet"
                href="/dashboard/student/profile"
              />
              <QuickAction
                icon={FileCheck2}
                label="Demande de"
                detail="document"
                tone="green"
                href="/dashboard/student/profile"
              />
              <QuickAction
                icon={WalletCards}
                label="Paiement en"
                detail="ligne"
                tone="orange"
                href="/dashboard/student/payments"
              />
              <QuickAction
                icon={ShieldCheck}
                label="Demande de"
                detail="bourse"
                tone="rose"
                href="/dashboard/student"
              />
              <QuickAction
                icon={BriefcaseBusiness}
                label="Stages &"
                detail="emplois"
                tone="blue"
                href="/dashboard/student"
              />
              <QuickAction
                icon={LibraryBig}
                label="Bibliothèque"
                detail="en ligne"
                tone="violet"
                href="/dashboard/student"
              />
            </div>
          </Widget>
          <div className="grid gap-4 lg:grid-cols-2">
            <Widget title="Mes cours" action="Voir tout">
              <div className="mt-3 divide-y divide-slate-100">
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
                      <p className="text-xs font-bold text-slate-800">
                        {course.title}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {course.teacher}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-violet-600">
                      {course.grade}
                    </span>
                  </div>
                ))}
              </div>
            </Widget>
            <Widget title="Finances" action="Voir tout">
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-[11px] text-slate-500">Solde actuel</p>
                  <p className="mt-2 text-xl font-extrabold text-emerald-600">
                    125 000 Ar
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                    ● Disponible
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">
                    Prochain paiement
                  </p>
                  <p className="mt-2 text-xs font-bold text-slate-700">
                    Frais de scolarité S2
                  </p>
                  <p className="mt-2 text-lg font-extrabold text-emerald-600">
                    350 000 Ar
                  </p>
                  <p className="mt-2 text-[10px] text-slate-500">
                    À payer avant le 30 juin 2025
                  </p>
                  <Link
                    href="/dashboard/student/payments"
                    className="mt-4 flex items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
                  >
                    Payer maintenant
                  </Link>
                </div>
              </div>
            </Widget>
          </div>
        </div>

        <Widget
          className="xl:col-span-4"
          title="Événements à venir"
          action="Voir tout"
        >
          <div className="mt-3 divide-y divide-slate-100">
            {events.map((event) => (
              <div key={event.title} className="flex items-center gap-3 py-3">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <span className="text-[9px] font-bold">{event.month}</span>
                  <span className="text-lg font-extrabold leading-4">
                    {event.day}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800">
                    {event.title}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {event.detail}
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {event.time}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/student?section=events"
            className="mt-3 flex items-center justify-center rounded-lg bg-violet-50 py-2 text-xs font-bold text-violet-600"
          >
            Voir tous les événements
          </Link>
        </Widget>
      </section>

      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 text-xs text-violet-700">
        <Bell className="size-4 shrink-0" />
        <p>
          <span className="font-bold">Astuce GET :</span> Active les
          notifications pour ne rien manquer de tes cours et événements !
        </p>
        <button className="ml-auto text-slate-400">×</button>
      </div>
    </div>
  );
}

function CandidateDashboard({ student }: { student: Student }) {
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
      title: 'Complète ton dossier',
      text: 'Ajoute tes informations personnelles et ton parcours scolaire.',
      icon: FileUp,
      done: Boolean(student.profileCompleted),
      href: '/dashboard/student/profile',
    },
    {
      title: 'Candidate aux formations qui t’intéressent',
      text: 'Explore les établissements et postule en ligne.',
      icon: Compass,
      done: totalApplications > 0,
      href: '/dashboard/student/offers',
    },
    {
      title: 'Suis tes admissions',
      text: 'Retrouve ici les réponses et la suite à donner.',
      icon: CircleCheck,
      done: hasDecision,
      href: '/dashboard/student/applications',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const dossierCard = student.profileCompleted
    ? { value: 'Complet', text: 'Ton dossier est prêt pour candidater.' }
    : {
        value: 'À compléter',
        text: 'Renseigne tes informations pour pouvoir postuler.',
      };

  const applicationsCard =
    totalApplications === 0
      ? {
          value: 'Aucune candidature',
          text: 'Tu n’as pas encore envoyé de dossier.',
        }
      : {
          value: `${totalApplications} candidature${totalApplications > 1 ? 's' : ''}`,
          text:
            accepted > 0
              ? `${accepted} accepté${accepted > 1 ? 'es' : 'e'} · ${pending} en attente`
              : `${pending} en attente de réponse`,
        };

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 text-[#111a4b]">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
            Espace candidat
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[28px]">
            Bonjour {student.firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ton parcours d’études commence ici. Trouve la formation qui te
            ressemble.
          </p>
        </div>
        <Link
          href="/dashboard/student/offers"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:brightness-105"
        >
          <Compass className="size-4" />
          Découvrir les établissements
        </Link>
      </header>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2d1a8b] via-violet-700 to-indigo-500 p-6 text-white shadow-[0_16px_35px_rgba(83,54,190,0.2)] sm:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
              <GraduationCap className="size-4" />
              Prêt(e) à construire ton avenir ?
            </span>
            <h2 className="mt-4 max-w-2xl text-2xl font-extrabold leading-tight sm:text-3xl">
              Explore les meilleures écoles et formations de Madagascar.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-violet-100">
              Complète ton dossier, choisis tes programmes, puis envoie tes
              candidatures depuis un seul espace.
            </p>
            <Link
              href="/dashboard/student/offers"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
            >
              Rechercher une formation <ArrowRight className="size-4" />
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
          tone="violet"
          title="Mon dossier"
          value={dossierCard.value}
          text={dossierCard.text}
          action={
            student.profileCompleted ? 'Voir mon profil' : 'Compléter mon profil'
          }
          href="/dashboard/student/profile"
        />
        <CandidateCard
          icon={BookOpen}
          tone="blue"
          title="Formations disponibles"
          value={
            totalOffers > 0
              ? `${totalOffers} formation${totalOffers > 1 ? 's' : ''}`
              : '—'
          }
          text="Des programmes à découvrir selon ton projet."
          action="Explorer les formations"
          href="/dashboard/student/offers"
        />
        <CandidateCard
          icon={ClipboardCheck}
          tone="green"
          title="Mes candidatures"
          value={applicationsCard.value}
          text={applicationsCard.text}
          action={
            totalApplications === 0 ? 'Commencer ma recherche' : 'Voir mes candidatures'
          }
          href={
            totalApplications === 0
              ? '/dashboard/student/offers'
              : '/dashboard/student/applications'
          }
        />
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">
              Les étapes de ton parcours
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Avance à ton rythme : tout se fait en ligne.
            </p>
          </div>
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600">
            {doneCount} / {steps.length} terminées
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              className={`group relative rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${step.done ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300' : 'border-slate-100 hover:border-violet-200'}`}
            >
              <span
                className={`grid size-10 place-items-center rounded-xl ${step.done ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}
              >
                {step.done ? (
                  <CircleCheck className="size-5" />
                ) : (
                  <step.icon className="size-5" />
                )}
              </span>
              <span
                className={`absolute right-4 top-4 grid size-6 place-items-center rounded-full border text-[10px] font-bold ${step.done ? 'border-emerald-300 text-emerald-600' : 'border-slate-200 text-slate-500'}`}
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-sm font-extrabold text-slate-800">
                {step.title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {step.text}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-600">
                {step.done ? 'Terminé — revoir' : 'Commencer'}{' '}
                <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
          <h2 className="text-sm font-extrabold">Dernières formations publiées</h2>
          <div className="mt-4 space-y-3">
            {recentOffers.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                Aucune formation disponible pour le moment.
              </p>
            ) : (
              recentOffers.map((offer) => (
                <Link
                  href="/dashboard/student/offers"
                  key={offer.id}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-violet-50"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-white text-violet-600 shadow-sm">
                    <BookOpen className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-xs text-slate-800">
                      {offer.title}
                    </b>
                    <small className="block truncate text-[11px] text-slate-500">
                      {offer.school.name} · {offer.school.city}
                    </small>
                  </span>
                  <span className="text-[10px] font-bold text-violet-600">
                    {offer.diploma}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
          <h2 className="text-sm font-extrabold">Besoin d’aide ?</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Notre guide t’accompagne pour choisir une formation et préparer ton
            dossier.
          </p>
          <div className="mt-5 rounded-xl bg-violet-50 p-4">
            <MapPin className="size-5 text-violet-600" />
            <p className="mt-3 text-sm font-bold text-slate-800">
              Trouve une école près de chez toi
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Explore les établissements par ville et par filière.
            </p>
            <Link
              href="/dashboard/student/offers"
              className="mt-4 inline-flex text-xs font-bold text-violet-600"
            >
              Voir la carte des établissements →
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
  tone: 'violet' | 'blue' | 'green';
  title: string;
  value: string;
  text: string;
  action: string;
  href: string;
}) {
  const tones = {
    violet: 'bg-violet-50 text-violet-600',
    blue: 'bg-blue-50 text-blue-500',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
      <span
        className={`grid size-11 place-items-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-xs font-bold text-slate-500">{title}</p>
      <h2 className="mt-1 text-lg font-extrabold text-[#111a4b]">{value}</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex text-xs font-bold text-violet-600"
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
  tone: 'violet' | 'green' | 'orange' | 'blue';
  progress?: string;
}) {
  const styles = {
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-500',
    blue: 'bg-blue-50 text-blue-500',
  };
  const valueStyles = {
    violet: 'text-violet-600',
    green: 'text-emerald-600',
    orange: 'text-orange-500',
    blue: 'text-blue-500',
  };
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_18px_rgba(68,50,140,0.05)]">
      <div className="flex gap-4">
        <span
          className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${styles[tone]}`}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700">{title}</p>
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
          <p className="mt-2 text-[11px] text-slate-500">{hint}</p>
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
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-[#111a4b]">{title}</h2>
        {action && (
          <button className="text-[11px] font-bold text-violet-600 hover:text-violet-700">
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
  tone: 'violet' | 'green' | 'orange' | 'rose' | 'blue';
  href: string;
}) {
  const styles = {
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-500',
    rose: 'bg-rose-50 text-rose-500',
    blue: 'bg-blue-50 text-blue-500',
  };
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl p-2 transition hover:bg-slate-50"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${styles[tone]}`}
      >
        <Icon className="size-4" />
      </span>
      <span className="text-[11px] font-bold leading-4 text-slate-600">
        {label}
        <br />
        {detail}
      </span>
    </Link>
  );
}
