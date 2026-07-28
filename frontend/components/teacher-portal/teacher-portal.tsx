'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Mail,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Send,
  UsersRound,
} from 'lucide-react';

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

const courses = [
  [
    'Algorithmique et Programmation',
    'L3 Informatique',
    'Groupe A',
    '28',
    '14,25',
  ],
  ['Base de données', 'L2 Informatique', 'Groupe B', '24', '12,50'],
  ['Génie Logiciel', 'L3 Informatique', 'Groupe A', '26', '16,75'],
  ['Atelier Projet', 'L3 Informatique', 'Groupe B', '22', '15,00'],
  ["Systèmes d'information", 'L2 Informatique', 'Groupe A', '20', '11,80'],
] as const;

const students = [
  [
    'Rasolonjatoavo Tina',
    '2301/INFO/001',
    'tina.raso@get.mg',
    'Algorithmique',
    '85%',
    '14,25',
  ],
  [
    'Rakotoarivelo Mamy',
    '2301/INFO/002',
    'mamy.rakoto@get.mg',
    'Base de données',
    '78%',
    '12,50',
  ],
  [
    'Andriamalala Fanja',
    '2301/INFO/003',
    'fanja.andria@get.mg',
    'Génie Logiciel',
    '92%',
    '16,75',
  ],
  [
    'Rabeharisoa Lala',
    '2301/INFO/004',
    'lala.rabe@get.mg',
    'Algorithmique',
    '65%',
    '10,25',
  ],
  [
    'Rakotovo Hery',
    '2301/INFO/005',
    'hery.rakoto@get.mg',
    'Atelier Projet',
    '80%',
    '15,00',
  ],
] as const;

const grades = [
  ['Rasolonjatoavo Tina', '13,00', '15,00', '12,00', '16,00', '15,00', '14,25'],
  ['Rakotoarivelo Mamy', '11,00', '12,00', '14,00', '15,00', '14,00', '12,50'],
  ['Andriamalala Fanja', '16,00', '17,00', '15,00', '17,00', '16,00', '16,75'],
  ['Rabeharisoa Lala', '9,00', '11,00', '10,00', '12,00', '10,00', '10,25'],
  ['Rakotovo Hery', '14,00', '16,00', '13,00', '15,00', '17,00', '15,00'],
] as const;

export function TeacherPortal() {
  const params = useSearchParams();
  const view = (params.get('view') || 'dashboard') as View;

  if (view === 'courses') return <Courses />;
  if (view === 'course-detail') return <CourseDetail />;
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
      title="Bonjour, Prof. Andrianiarina 👋"
      subtitle="Voici un aperçu de votre activité aujourd’hui."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CalendarDays}
          label="Cours aujourd’hui"
          value="3"
          tone="violet"
          detail="Prochain à 08:00"
        />
        <Metric
          icon={FileText}
          label="À corriger"
          value="18"
          tone="orange"
          detail="7 devoirs en retard"
        />
        <Metric
          icon={UsersRound}
          label="Étudiants à suivre"
          value="4"
          tone="blue"
          detail="Absences ou résultats faibles"
        />
        <Metric
          icon={Mail}
          label="Messages non lus"
          value="3"
          tone="violet"
          detail="2 conversations de groupe"
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.9fr_.9fr]">
        <Card title="Prochain cours" action="Voir l’emploi du temps">
          <div className="rounded-xl bg-gradient-to-r from-violet-700 to-indigo-500 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-100">
                  Dans 35 minutes · 08:00 – 10:00
                </p>
                <h2 className="mt-2 text-lg font-extrabold">
                  Algorithmique et Programmation
                </h2>
                <p className="mt-1 text-xs text-violet-100">
                  L3 Informatique · Groupe A · Salle 2.3
                </p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-white/15">
                <BookOpen className="size-5" />
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-violet-700">
                Ouvrir le cours
              </button>
              <button className="rounded-lg border border-white/30 px-3 py-2 text-[10px] font-bold text-white">
                Faire l’appel
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
            <span>28 étudiants inscrits</span>
            <span>Dernier contenu : Chapitre 3</span>
          </div>
        </Card>
        <Card title="À traiter" action="Tout voir">
          <div className="space-y-2">
            {[
              [
                'Corriger le TP Base de données',
                '24 copies · Échéance aujourd’hui',
                'Urgent',
              ],
              [
                'Saisir les notes du contrôle 2',
                'Algorithmique · Groupe A',
                'À faire',
              ],
              [
                'Publier le corrigé de l’exercice',
                'Génie Logiciel · 26 étudiants',
                'À faire',
              ],
              [
                'Répondre aux demandes d’étudiants',
                '3 messages en attente',
                'Nouveau',
              ],
            ].map(([title, detail, status]) => (
              <div
                className="flex gap-3 rounded-lg bg-slate-50 p-2.5"
                key={title}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-white text-violet-600">
                  <ClipboardCheck className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#26305e]">
                    {title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
                </div>
                <Status value={status} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Alertes étudiants" action="Voir les étudiants">
          <div className="space-y-3">
            {[
              [
                'Rabeharisoa Lala',
                'Moyenne 10,25/20 · À accompagner',
                'bg-orange-100 text-orange-600',
              ],
              [
                'Rakotovo Hery',
                '3 absences sur les 2 dernières semaines',
                'bg-rose-100 text-rose-600',
              ],
              [
                'Groupe L3 – A',
                '5 rendus manquants sur le TP en cours',
                'bg-violet-100 text-violet-600',
              ],
            ].map(([name, detail, tone]) => (
              <div className="flex items-start gap-3" key={name}>
                <span
                  className={`grid size-8 place-items-center rounded-full text-[10px] font-bold ${tone}`}
                >
                  {name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#26305e]">{name}</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_.9fr]">
        <Card title="Planning de la journée" action="Voir la semaine">
          <Timeline />
        </Card>
        <Card title="Mes cours" action="Voir tout">
          <CourseMiniList />
        </Card>
        <Card title="Messages récents" action="Voir les messages">
          <div className="space-y-3">
            {[
              [
                'Groupe Algorithmique A',
                'Question sur les arbres binaires',
                '11:20',
              ],
              [
                'Rasolonjatoavo Tina',
                'Demande de précision sur le TP',
                '10:35',
              ],
              [
                'Génie Logiciel – Groupe A',
                'Travail en groupe · 4 réponses',
                'Hier',
              ],
            ].map(([sender, text, time]) => (
              <div className="flex gap-2" key={sender}>
                <span className="grid size-8 place-items-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600">
                  {sender.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#26305e]">
                    {sender}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{text}</p>
                </div>
                <span className="text-[9px] text-slate-400">{time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card title="Suivi pédagogique" action="Voir les notes">
          <LineChart />
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <MiniStat value="12,45 /20" label="Moyenne globale" />
            <MiniStat value="85%" label="Présence moyenne" />
            <MiniStat value="76%" label="Devoirs corrigés" />
          </div>
        </Card>
        <Card title="Répartition des notes" action="Voir le détail">
          <GradeDistribution />
        </Card>
      </div>
    </Page>
  );
}

function Courses() {
  return (
    <Page
      title="Mes cours"
      subtitle="Gérez et consultez tous les cours que vous enseignez."
    >
      <Tabs labels={['Actifs (5)', 'Archivés (0)']} />
      <TableCard
        headers={[
          'Cours',
          'Niveau',
          'Groupe',
          'Étudiants',
          'Moyenne',
          'Actions',
        ]}
        rows={courses.map((course) => [
          <Link
            className="font-bold text-[#16204d] hover:text-violet-600"
            href="/dashboard/teacher?view=course-detail"
            key={course[0]}
          >
            {course[0]}
            <small className="mt-1 block font-normal text-slate-400">
              {course[1]}
            </small>
          </Link>,
          tag(course[1].slice(0, 2)),
          course[2],
          course[3],
          course[4],
          <MoreVertical className="size-4 text-violet-600" key="actions" />,
        ])}
      />
    </Page>
  );
}

function CourseDetail() {
  return (
    <Page
      title="Algorithmique et Programmation"
      subtitle="L3 Informatique · Groupe A"
      back="/dashboard/teacher?view=courses"
    >
      <Tabs
        labels={[
          'Aperçu',
          'Contenu',
          'Étudiants',
          'Évaluations',
          'Devoirs',
          'Notes',
          'Paramètres',
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card title="Informations générales">
          <Info
            rows={[
              ['Code du cours', 'INFO301'],
              ['Niveau', 'Licence 3'],
              ['Crédits', '6'],
              ['Enseignant', 'Prof. Andrianiarina'],
              ['Salle', 'Salle 2.3'],
              ['Horaires', 'Lun 08:00 – 10:00\nMer 08:00 – 10:00'],
              [
                'Description',
                'Ce cours couvre les concepts fondamentaux de la programmation et des algorithmes.',
              ],
            ]}
          />
        </Card>
        <div className="space-y-4">
          <Card title="Statistiques du cours">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat value="28" label="Étudiants inscrits" />
              <MiniStat value="24" label="Présents (85%)" />
              <MiniStat value="12,45" label="Moyenne générale" />
              <MiniStat value="85%" label="Taux de réussite" />
            </div>
          </Card>
          <Card title="Ressources récentes">
            <List
              items={['Cours_Algo_Chapitre3.pdf', 'Slides_Complexité.pdf']}
              icon={FileText}
            />
            <Link
              href="/dashboard/teacher?view=resources"
              className="mt-4 block text-xs font-bold text-violet-600"
            >
              Voir toutes les ressources →
            </Link>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function Students() {
  return (
    <Page
      title="Étudiants"
      subtitle="Consultez et gérez la liste des étudiants."
    >
      <TableCard
        headers={[
          'Étudiant',
          'Matricule',
          'Email',
          'Cours',
          'Progression',
          'Moyenne',
          'Actions',
        ]}
        rows={students.map((s) => [
          <StudentName key={s[0]} name={s[0]} />,
          s[1],
          s[2],
          s[3],
          <Progress key={`${s[0]}-p`} value={s[4]} />,
          s[5],
          <MoreVertical className="size-4 text-violet-600" key="a" />,
        ])}
      />
    </Page>
  );
}

function Evaluations() {
  const rows = [
    [
      'Contrôle 1 – Variables',
      'Contrôle',
      'Algorithmique et Prog.',
      '15/01/2025',
      '2',
      '12,90',
    ],
    [
      'TP – Structures de données',
      'TP',
      'Algorithmique et Prog.',
      '20/01/2025',
      '3',
      '14,00',
    ],
    [
      'Contrôle 2 – Algorithmes',
      'Contrôle',
      'Algorithmique et Prog.',
      '28/01/2025',
      '2',
      '11,75',
    ],
    [
      'Projet – Mini application',
      'Projet',
      'Génie Logiciel',
      '10/02/2025',
      '4',
      '15,00',
    ],
    [
      'Examen final',
      'Examen',
      'Algorithmique et Prog.',
      '25/02/2025',
      '5',
      '13,80',
    ],
  ];
  return (
    <Page
      title="Évaluations"
      subtitle="Gérez les évaluations et consultez les résultats."
      action="Nouvelle évaluation"
    >
      <Tabs
        labels={[
          'Toutes (12)',
          'Contrôles (5)',
          'Examens (2)',
          'Projets (3)',
          'Quiz (1)',
        ]}
      />
      <TableCard
        headers={[
          'Titre',
          'Type',
          'Cours',
          'Date',
          'Coefficient',
          'Moyenne',
          'Actions',
        ]}
        rows={rows.map((r) => [
          ...r,
          <MoreVertical className="size-4 text-violet-600" key={r[0]} />,
        ])}
      />
    </Page>
  );
}

function Grades() {
  return (
    <Page
      title="Notes & Bulletins"
      subtitle="Consultez et gérez les notes des étudiants."
    >
      <Tabs labels={['Algorithmique et Programmation']} />
      <TableCard
        headers={[
          'Étudiant',
          'Contrôle 1 (20)',
          'TP (20)',
          'Contrôle 2 (20)',
          'Projet (20)',
          'Examen (20)',
          'Moyenne /20',
        ]}
        rows={grades.map((grade) => [
          <StudentName key={grade[0]} name={grade[0]} />,
          ...grade.slice(1).map((v, i) => (
            <span
              className={i === 5 ? 'font-extrabold text-violet-600' : ''}
              key={`${grade[0]}-${i}`}
            >
              {v}
            </span>
          )),
        ])}
      />
    </Page>
  );
}

function Schedule() {
  const days = ['Lun 12', 'Mar 13', 'Mer 14', 'Jeu 15', 'Ven 16', 'Sam 17'];
  const slots = [
    ['08:00', 0, 'Algo. & Prog.\nL3 · Groupe A'],
    ['10:00', 1, 'Base de données\nL2 · Groupe B'],
    ['12:00', 3, 'Génie Logiciel\nL3 · Groupe A'],
    ['14:00', 4, 'Atelier Projet\nL3 · Groupe B'],
  ];
  return (
    <Page title="Emploi du temps" subtitle="Consultez votre planning de cours.">
      <Card title="12 – 18 mai 2025" action="Aujourd’hui">
        <div className="grid grid-cols-[64px_repeat(6,minmax(105px,1fr))] overflow-x-auto border-l border-t border-slate-100 text-[10px]">
          <div className="border-b border-r border-slate-100 p-3" />
          {days.map((d) => (
            <div
              className="border-b border-r border-slate-100 p-3 text-center font-bold text-slate-500"
              key={d}
            >
              {d}
            </div>
          ))}
          {['08:00', '10:00', '12:00', '14:00', '16:00'].map((time) => (
            <div className="contents" key={time}>
              <div className="border-b border-r border-slate-100 p-4 text-slate-400">
                {time}
              </div>
              {days.map((_, column) => {
                const slot = slots.find(
                  ([slotTime, index]) => slotTime === time && index === column,
                );
                return (
                  <div
                    className="min-h-24 border-b border-r border-slate-100 p-1"
                    key={`${time}-${column}`}
                  >
                    {slot && (
                      <div className="rounded-lg bg-violet-100 p-2 font-semibold text-violet-700 whitespace-pre-line">
                        {slot[2]}
                        <small className="mt-1 block font-normal">
                          Salle 2.3
                        </small>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

function Assignments() {
  const rows = [
    [
      'TP Base de données #1',
      'L2 Base de données',
      '25/05/2025',
      '20/24',
      '4',
      'En cours',
    ],
    [
      'Exercice – Tri et Recherche',
      'L3 Algo & Prog.',
      '15/05/2025',
      '26/28',
      '2',
      'En cours',
    ],
    [
      'Mini projet – Interface',
      'L3 Génie Logiciel',
      '05/06/2025',
      '18/26',
      '8',
      'À corriger',
    ],
    [
      'Étude de cas',
      'L3 Atelier Projet',
      '10/06/2025',
      '22/22',
      '0',
      'Corrigé',
    ],
  ];
  return (
    <Page
      title="Devoirs"
      subtitle="Gérez les devoirs et consultez les remises."
      action="Nouveau devoir"
    >
      <Tabs
        labels={[
          'Tous (10)',
          'À corriger (8)',
          'En retard (5)',
          'Corrigés (25)',
        ]}
      />
      <TableCard
        headers={[
          'Titre',
          'Cours',
          'Date limite',
          'Remis',
          'À corriger',
          'Statut',
        ]}
        rows={rows.map((r) => [
          ...r.slice(0, 5),
          <Status key={r[0]} value={r[5]} />,
        ])}
      />
    </Page>
  );
}

function Resources() {
  const rows = [
    [
      'Cours_Algorithmique_Chap1-3.pdf',
      'Algorithmique et Prog.',
      'PDF',
      '10/05/2025',
    ],
    [
      'Slides_Complexité_Algorithmes.pptx',
      'Algorithmique et Prog.',
      'PPTX',
      '08/05/2025',
    ],
    [
      'TP_Structures_de_données.zip',
      'Algorithmique et Prog.',
      'ZIP',
      '03/04/2025',
    ],
    ['Exemples_SQL.pdf', 'Base de données', 'PDF', '28/04/2025'],
    ['Guide_Génie_Logiciel.pdf', 'Génie Logiciel', 'PDF', '25/04/2025'],
  ];
  return (
    <Page
      title="Ressources pédagogiques"
      subtitle="Gérez et partagez vos ressources."
      action="Ajouter une ressource"
    >
      <TableCard
        headers={['Nom', 'Cours', 'Type', 'Date', 'Actions']}
        rows={rows.map((r) => [
          ...r,
          <span className="text-[10px] font-semibold text-slate-400" key={r[0]}>
            Consultation
          </span>,
        ])}
      />
    </Page>
  );
}

function Messages() {
  return (
    <Page title="Messages" subtitle="Communiquez avec vos étudiants.">
      <div className="grid min-h-[530px] overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-100 p-4">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-lg bg-slate-50 pl-9 text-xs outline-none"
              placeholder="Rechercher un message…"
            />
          </label>
          <div className="mt-4 space-y-2">
            {[
              'Groupe Algorithmique A',
              'Rasolonjatoavo Tina',
              'Rakotoarivelo Mamy',
              'Andriamalala Fanja',
              'Génie Logiciel – Groupe A',
              'Administration GET',
            ].map((name, i) => (
              <button
                key={name}
                className={`flex w-full gap-2 rounded-lg p-2 text-left ${i === 0 ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
              >
                <span className="grid size-8 place-items-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600">
                  {name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-xs text-[#1d2754]">
                    {name}
                  </b>
                  <small className="block truncate text-slate-500">
                    Bonjour Professeur, pourriez-vous…
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>
        <section className="flex flex-col">
          <header className="border-b border-slate-100 p-4">
            <b className="text-sm text-[#17204e]">Groupe Algorithmique A</b>
            <p className="text-[10px] text-slate-500">28 participants</p>
          </header>
          <div className="flex-1 space-y-4 p-5 text-xs">
            <div className="max-w-72 rounded-xl bg-slate-100 p-3 text-slate-600">
              Bonjour Professeur, pourriez-vous avoir plus de détails sur la
              partie “arbres binaires” du TP ?
            </div>
            <div className="ml-auto max-w-72 rounded-xl bg-violet-100 p-3 text-violet-700">
              Bonjour à tous, je publie un complément de cours cet après-midi.
            </div>
            <div className="max-w-72 rounded-xl bg-slate-100 p-3 text-slate-600">
              Merci beaucoup !
            </div>
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3">
              <Paperclip className="size-4 text-slate-400" />
              <input
                className="h-10 flex-1 bg-transparent text-xs outline-none"
                placeholder="Écrire un message…"
              />
              <button className="grid size-7 place-items-center rounded-full bg-violet-600 text-white">
                <Send className="size-3" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </Page>
  );
}

function Announcements() {
  const announcements = [
    [
      'Changement de salle – Algorithmique',
      'Algorithmique et Programmation',
      'Publiée',
      '10/05/2025',
    ],
    ['Rappel : contrôle continu', 'Base de données', 'Publiée', '08/05/2025'],
    ['Consignes du mini-projet', 'Génie Logiciel', 'Brouillon', '05/05/2025'],
  ];
  return (
    <Page
      title="Annonces"
      subtitle="Informez vos groupes et vos étudiants."
      action="Nouvelle annonce"
    >
      <TableCard
        headers={['Annonce', 'Cours / Groupe', 'Statut', 'Date', 'Actions']}
        rows={announcements.map((announcement) => [
          announcement[0],
          announcement[1],
          <Status key={announcement[0]} value={announcement[2]} />,
          announcement[3],
          <MoreVertical
            className="size-4 text-violet-600"
            key={`${announcement[0]}-actions`}
          />,
        ])}
      />
    </Page>
  );
}

function SettingsView() {
  return (
    <Page
      title="Profil & Paramètres"
      subtitle="Gérez vos informations et préférences."
    >
      <Tabs
        labels={['Mon profil', 'Sécurité', 'Notifications', 'Préférences']}
      />
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <Card title="Prof. Andrianiarina">
          <div className="text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-violet-100 text-xl font-black text-violet-600">
              PA
            </span>
            <p className="mt-3 font-bold text-[#16204d]">Prof. Andrianiarina</p>
            <p className="text-xs text-slate-500">
              Enseignant · Département Informatique
            </p>
            <button className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">
              Changer la photo
            </button>
          </div>
          <Info
            rows={[
              ['Email', 'andrianiarina.prof@get.mg'],
              ['Téléphone', '+261 34 12 345 67'],
              ['Salle / Bureau', 'Bâtiment A · Salle 2.3'],
            ]}
          />
        </Card>
        <Card title="Informations professionnelles">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nom complet" value="Prof. Andrianiarina" />
            <Field label="Spécialité" value="Informatique" />
            <Field label="Grade" value="Maître de Conférences" />
            <Field
              label="Biographie"
              value="Enseignant en informatique avec 8 ans d’expérience dans l’enseignement supérieur."
              wide
            />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">
              Annuler
            </button>
            <button className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white">
              Enregistrer les modifications
            </button>
          </div>
        </Card>
      </div>
    </Page>
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
          <span className="relative">
            <Bell className="size-5 text-[#17204e]" />
            <i className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-rose-500 text-[8px] not-italic text-white">
              2
            </i>
          </span>
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
function Metric({
  icon: Icon,
  label,
  value,
  tone,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: 'violet' | 'blue' | 'green' | 'orange';
  detail: string;
}) {
  const tones = {
    violet: 'bg-violet-100 text-violet-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-[10px] font-semibold text-slate-500">{label}</p>
          <p className="text-xl font-extrabold text-[#111949]">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-emerald-600">{detail}</p>
    </div>
  );
}
function Tabs({ labels }: { labels: string[] }) {
  return (
    <div className="mb-4 flex gap-5 overflow-x-auto border-b border-slate-100 px-2 text-[10px] font-bold">
      <span className="border-b-2 border-violet-600 px-1 py-3 text-violet-600">
        {labels[0]}
      </span>
      {labels.slice(1).map((label) => (
        <span
          key={label}
          className="whitespace-nowrap px-1 py-3 text-slate-400"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
function TableCard({
  headers,
  rows,
  exportable = false,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  exportable?: boolean;
}) {
  return (
    <Card
      title={exportable ? 'Liste des étudiants' : ' '}
      action={exportable ? 'Exporter' : undefined}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-lg border border-slate-200 pl-9 text-xs outline-none"
            placeholder="Rechercher…"
          />
        </label>
        <button className="rounded-lg border border-slate-200 px-3 text-xs text-slate-500">
          Tous les cours⌄
        </button>
        <button className="rounded-lg border border-slate-200 px-3 text-xs text-slate-500">
          Filtrer⌄
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[10px]">
          <thead className="border-b border-slate-100 text-slate-400">
            <tr>
              {headers.map((header) => (
                <th className="pb-3 font-semibold" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                className="border-b border-slate-50 text-slate-600"
                key={index}
              >
                {row.map((cell, cellIndex) => (
                  <td className="py-3 pr-3" key={cellIndex}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end gap-3 text-[10px] text-slate-500">
        <ChevronLeft className="size-4" />
        <b className="grid size-5 place-items-center rounded bg-violet-600 text-white">
          1
        </b>
        <span>2</span>
        <span>3</span>
        <ChevronRight className="size-4" />
      </div>
    </Card>
  );
}
function Timeline() {
  return (
    <div className="space-y-4 border-l border-violet-200 pl-4 text-[10px]">
      {[
        [
          '08:00 – 10:00',
          'Algorithmique et Programmation',
          'L3 Informatique · Groupe A',
          'En cours',
        ],
        [
          '10:15 – 12:15',
          'Base de données',
          'L2 Informatique · Groupe B',
          'À venir',
        ],
        [
          '13:30 – 15:30',
          'Génie Logiciel',
          'L3 Informatique · Groupe A',
          'À venir',
        ],
      ].map(([time, title, detail, status]) => (
        <div className="relative" key={time}>
          <i className="absolute -left-[19px] top-1 size-2 rounded-full bg-violet-600" />
          <div className="flex justify-between gap-3">
            <span className="font-bold text-violet-600">{time}</span>
            <span className="flex-1">
              <b className="block text-[#1c2754]">{title}</b>
              <small className="text-slate-400">{detail}</small>
            </span>
            <Status value={status} />
          </div>
        </div>
      ))}
    </div>
  );
}
function GradeDistribution() {
  return (
    <div className="flex items-center justify-center gap-6 py-3">
      <div
        className="grid size-32 place-items-center rounded-full"
        style={{
          background:
            'conic-gradient(#5139e5 0 28%, #33b98b 28% 60%, #ff9d25 60% 85%, #db2f91 85% 100%)',
        }}
      >
        <div className="grid size-20 place-items-center rounded-full bg-white text-center">
          <b className="text-xl text-[#17204e]">12,45</b>
          <span className="text-[9px] text-slate-500">/20</span>
        </div>
      </div>
      <div className="space-y-2 text-[10px] text-slate-600">
        {[
          ['Excellentes (14–20)', '28%', 'bg-violet-600'],
          ['Bonnes (11–13,99)', '32%', 'bg-emerald-500'],
          ['Moyennes (10–10,99)', '25%', 'bg-orange-400'],
          ['Faibles (&lt;10)', '15%', 'bg-pink-600'],
        ].map(([name, percentage, color]) => (
          <p className="flex items-center gap-2" key={name}>
            <i className={`size-2 rounded-full ${color}`} />
            <span>{name}</span>
            <b>{percentage}</b>
          </p>
        ))}
      </div>
    </div>
  );
}
function CourseMiniList() {
  return (
    <List
      icon={BookOpen}
      items={courses.map(
        (course) => `${course[0]} · ${course[1]} · ${course[3]} étudiants`,
      )}
    />
  );
}
function LineChart() {
  return (
    <div className="relative mt-6 h-36 border-b border-l border-slate-100">
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 300 120"
      >
        <polyline
          fill="none"
          points="0,82 42,65 84,70 126,48 168,73 210,55 252,39 300,62"
          stroke="#6747ef"
          strokeWidth="3"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-[-18px] flex justify-between text-[9px] text-slate-400">
        <span>Sept</span>
        <span>Oct</span>
        <span>Nov</span>
        <span>Déc</span>
        <span>Jan</span>
        <span>Fév</span>
        <span>Mar</span>
      </div>
    </div>
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
function Progress({ value }: { value: string }) {
  return (
    <span className="flex min-w-20 items-center gap-2">
      <i className="h-1 flex-1 overflow-hidden rounded bg-slate-100">
        <i
          className="block h-full rounded bg-violet-600"
          style={{ width: value }}
        />
      </i>
      <small>{value}</small>
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
function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="mb-1 block text-xs font-bold text-[#34406b]">
        {label}
      </span>
      <input
        defaultValue={value}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
      />
    </label>
  );
}
function tag(value: string) {
  return (
    <span className="rounded bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-600">
      {value}
    </span>
  );
}
