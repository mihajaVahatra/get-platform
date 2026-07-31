'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Bell,
  BookOpen,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  Download,
  FileCheck2,
  LibraryBig,
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
  enrolledYear?: string | null;
  enrolledSchool?: { name: string } | null;
};

const schedule = [
  { time: '08:00 – 10:00', course: 'Algorithmique Avancée', room: 'Salle B204', state: 'En cours', active: true },
  { time: '10:15 – 12:15', course: 'Bases de Données', room: 'Salle B205', state: 'À venir' },
  { time: '14:00 – 16:00', course: 'Anglais Technique', room: 'Salle A102', state: 'À venir' },
  { time: '16:15 – 18:15', course: 'Mathématiques Discrètes', room: 'Salle B203', state: 'À venir' },
];

const tasks = [
  { title: 'Devoir Algorithmique', date: 'À rendre le 15 juin 2025', badge: 'Urgent', tone: 'bg-rose-50 text-rose-600' },
  { title: 'Projet Bases de Données', date: 'À rendre le 22 juin 2025', badge: 'Important', tone: 'bg-orange-50 text-orange-600' },
  { title: 'Préparer présentation Anglais', date: 'À rendre le 30 juin 2025', badge: 'À faire', tone: 'bg-blue-50 text-blue-600' },
  { title: 'Réviser pour l’examen', date: 'Algorithmique Avancée', badge: 'À faire', tone: 'bg-blue-50 text-blue-600' },
];

const courses = [
  { title: 'Algorithmique Avancée', teacher: 'Pr. A. Andrianarison', grade: '15,5/20', tone: 'bg-violet-50 text-violet-600' },
  { title: 'Bases de Données', teacher: 'Pr. T. Ravelomanana', grade: '14/20', tone: 'bg-emerald-50 text-emerald-600' },
  { title: 'Anglais Technique', teacher: 'Dr. L. Rakotomalala', grade: '16/20', tone: 'bg-blue-50 text-blue-600' },
];

const events = [
  { month: 'JUIN', day: '20', title: 'Journée des compétences', detail: 'Ateliers et formations', time: '08:00' },
  { month: 'JUIN', day: '25', title: 'Hackathon ESPA', detail: 'Compétition inter-écoles', time: '09:00' },
  { month: 'JUIL.', day: '05', title: 'Conférence Tech', detail: 'Invité : Expert du secteur', time: '14:00' },
];

export default function StudentDashboardPage() {
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    apiClient.get('/students/me')
      .then((response) => setStudent(response.data.data))
      .catch((error) => console.error('Erreur chargement étudiant:', error));
  }, []);

  const school = student?.enrolledSchool?.name ?? 'ESPA';
  const year = student?.enrolledYear ?? '2ᵉ année Informatique';

  return (
    <div className="mx-auto max-w-[1450px] space-y-4 text-[#111a4b]">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[27px]">Bonjour {student?.firstName || 'Toavina'} <span aria-hidden="true">👋</span></h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Bienvenue à {school} – {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden w-72 md:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input placeholder="Rechercher..." className="h-11 rounded-xl border-slate-200 bg-white pl-9 text-xs shadow-sm" /><kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-violet-50 px-1.5 py-1 text-[10px] text-violet-500">Ctrl K</kbd></div>
          <NotificationBell />
          <MessageIconLink href="/dashboard/student/messages" />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatWidget icon={BookOpen} title="Moyenne générale" value="15,2" suffix="/20" hint="↑ +1,3 vs semestre précédent" tone="violet" />
        <StatWidget icon={BookOpenCheck} title="Crédits validés" value="18" suffix="/30" hint="60% du programme" progress="60" tone="green" />
        <StatWidget icon={CalendarDays} title="Absences" value="2" suffix="" hint="Justifiées" tone="orange" />
        <StatWidget icon={Award} title="Points de mérite" value="120" suffix="pts" hint="Bravo ! Continue comme ça 💪" tone="blue" />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Widget className="xl:col-span-4" title={<>Emploi du temps <span className="font-normal text-slate-500">– Aujourd’hui</span></>} action="Voir tout">
          <div className="mt-4 space-y-1">
            {schedule.map((item) => <div key={item.time} className="grid grid-cols-[108px_1fr_auto] items-center gap-3 py-2.5 text-xs">
              <div className="relative border-r border-slate-200 pr-3 text-violet-700"><span className={`absolute -right-[5px] top-1/2 size-2 rounded-full border-2 border-white ${item.active ? 'bg-violet-600' : 'bg-slate-300'}`} />{item.time}</div>
              <div><p className="font-bold text-slate-800">{item.course}</p><p className="mt-1 text-slate-400">{item.room}</p></div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.active ? 'bg-violet-50 text-violet-600' : 'bg-indigo-50 text-indigo-500'}`}>{item.state}</span>
            </div>)}
          </div>
        </Widget>

        <Widget className="xl:col-span-4" title="Mes tâches" action="Voir toutes">
          <div className="mt-3 divide-y divide-slate-100">
            {tasks.map((task) => <div key={task.title} className="flex items-center gap-3 py-3 first:pt-1"><CheckSquare className="size-4 shrink-0 text-slate-300" /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-800">{task.title}</p><p className="mt-1 text-[11px] text-slate-500">{task.date}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${task.tone}`}>{task.badge}</span></div>)}
          </div>
        </Widget>

        <div className="space-y-4 xl:col-span-4">
          <Widget title="Actualités" action="Voir tout">
            <div className="mt-4 overflow-hidden rounded-xl bg-gradient-to-br from-[#27204d] via-[#5651a8] to-[#88a0bc] p-4 text-white shadow-inner">
              <span className="rounded bg-violet-600 px-2 py-1 text-[10px] font-bold">IMPORTANT</span><h3 className="mt-5 text-base font-bold">Réinscription 2025–2026</h3><p className="mt-2 text-xs leading-5 text-violet-50">La réinscription en ligne est ouverte jusqu&apos;au 30 juin 2025.</p>
            </div>
            <div className="mt-3 divide-y divide-slate-100">{['Conférence : IA et avenir', 'Résultats examens S1', 'Club Robotique'].map((news, index) => <div key={news} className="flex items-center gap-3 py-2"><span className="flex size-7 items-center justify-center rounded-lg bg-violet-50 text-violet-500"><Sparkles className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{news}</p><p className="text-[10px] text-slate-500">{index === 0 ? '06 juin 2025' : index === 1 ? '04 juin 2025' : 'Rejoignez-nous !'}</p></div>{index < 2 && <span className="text-[10px] text-slate-400">{index === 0 ? '06 juin' : '04 juin'}</span>}</div>)}</div>
          </Widget>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Widget title="Accès rapides">
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <QuickAction icon={Download} label="Télécharger" detail="attestation" tone="violet" href="/dashboard/student/profile" /><QuickAction icon={FileCheck2} label="Demande de" detail="document" tone="green" href="/dashboard/student/profile" /><QuickAction icon={WalletCards} label="Paiement en" detail="ligne" tone="orange" href="/dashboard/student/payments" /><QuickAction icon={ShieldCheck} label="Demande de" detail="bourse" tone="rose" href="/dashboard/student" /><QuickAction icon={BriefcaseBusiness} label="Stages &" detail="emplois" tone="blue" href="/dashboard/student" /><QuickAction icon={LibraryBig} label="Bibliothèque" detail="en ligne" tone="violet" href="/dashboard/student" />
            </div>
          </Widget>
          <div className="grid gap-4 lg:grid-cols-2">
            <Widget title="Mes cours" action="Voir tout">
              <div className="mt-3 divide-y divide-slate-100">{courses.map((course) => <div key={course.title} className="flex items-center gap-3 py-3"><span className={`flex size-9 items-center justify-center rounded-lg ${course.tone}`}><BookOpen className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-800">{course.title}</p><p className="mt-1 text-[11px] text-slate-500">{course.teacher}</p></div><span className="text-sm font-extrabold text-violet-600">{course.grade}</span></div>)}</div>
            </Widget>
            <Widget title="Finances" action="Voir tout">
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-[11px] text-slate-500">Solde actuel</p><p className="mt-2 text-xl font-extrabold text-emerald-600">125 000 Ar</p><span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-600">● Disponible</span></div><div><p className="text-[11px] text-slate-500">Prochain paiement</p><p className="mt-2 text-xs font-bold text-slate-700">Frais de scolarité S2</p><p className="mt-2 text-lg font-extrabold text-emerald-600">350 000 Ar</p><p className="mt-2 text-[10px] text-slate-500">À payer avant le 30 juin 2025</p><Link href="/dashboard/student/payments" className="mt-4 flex items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700">Payer maintenant</Link></div></div>
            </Widget>
          </div>
        </div>

        <Widget className="xl:col-span-4" title="Événements à venir" action="Voir tout">
          <div className="mt-3 divide-y divide-slate-100">{events.map((event) => <div key={event.title} className="flex items-center gap-3 py-3"><div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-violet-50 text-violet-600"><span className="text-[9px] font-bold">{event.month}</span><span className="text-lg font-extrabold leading-4">{event.day}</span></div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-800">{event.title}</p><p className="mt-1 text-[11px] text-slate-500">{event.detail}</p></div><span className="text-xs font-semibold text-slate-500">{event.time}</span></div>)}</div>
          <Link href="/dashboard/student?section=events" className="mt-3 flex items-center justify-center rounded-lg bg-violet-50 py-2 text-xs font-bold text-violet-600">Voir tous les événements</Link>
        </Widget>
      </section>

      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 text-xs text-violet-700"><Bell className="size-4 shrink-0" /><p><span className="font-bold">Astuce GET :</span> Active les notifications pour ne rien manquer de tes cours et événements !</p><button className="ml-auto text-slate-400">×</button></div>
    </div>
  );
}

function StatWidget({ icon: Icon, title, value, suffix, hint, tone, progress }: { icon: typeof BookOpen; title: string; value: string; suffix: string; hint: string; tone: 'violet' | 'green' | 'orange' | 'blue'; progress?: string }) {
  const styles = { violet: 'bg-violet-50 text-violet-600', green: 'bg-emerald-50 text-emerald-600', orange: 'bg-orange-50 text-orange-500', blue: 'bg-blue-50 text-blue-500' };
  const valueStyles = { violet: 'text-violet-600', green: 'text-emerald-600', orange: 'text-orange-500', blue: 'text-blue-500' };
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_18px_rgba(68,50,140,0.05)]"><div className="flex gap-4"><span className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${styles[tone]}`}><Icon className="size-6" /></span><div className="min-w-0"><p className="text-xs font-bold text-slate-700">{title}</p><p className={`mt-1 text-[28px] font-extrabold leading-8 ${valueStyles[tone]}`}>{value}<span className="ml-1 text-sm">{suffix}</span></p>{progress && <div className="mt-2 h-1.5 w-44 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>}<p className="mt-2 text-[11px] text-slate-500">{hint}</p></div></div></div>;
}

function Widget({ title, action, children, className = '' }: { title: React.ReactNode; action?: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_18px_rgba(68,50,140,0.05)] ${className}`}><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold text-[#111a4b]">{title}</h2>{action && <button className="text-[11px] font-bold text-violet-600 hover:text-violet-700">{action}</button>}</div>{children}</section>;
}

function QuickAction({ icon: Icon, label, detail, tone, href }: { icon: typeof Download; label: string; detail: string; tone: 'violet' | 'green' | 'orange' | 'rose' | 'blue'; href: string }) {
  const styles = { violet: 'bg-violet-50 text-violet-600', green: 'bg-emerald-50 text-emerald-600', orange: 'bg-orange-50 text-orange-500', rose: 'bg-rose-50 text-rose-500', blue: 'bg-blue-50 text-blue-500' };
  return <Link href={href} className="flex items-center gap-2 rounded-xl p-2 transition hover:bg-slate-50"><span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${styles[tone]}`}><Icon className="size-4" /></span><span className="text-[11px] font-bold leading-4 text-slate-600">{label}<br />{detail}</span></Link>;
}
