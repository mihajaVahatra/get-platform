'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  FileText,
  GraduationCap,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

export type AdminView =
  'schools' | 'users' | 'enrollments' | 'transactions' | 'reports' | 'settings';
type School = {
  name: string;
  city: string;
  contact: string;
  registrations: string;
  status: string;
};
type User = {
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
};

const initialSchools: School[] = [
  {
    name: 'ESPA – École Supérieure Polytechnique d’Antananarivo',
    city: 'Antananarivo',
    contact: '+261 20 22 345 67',
    registrations: '4 560',
    status: 'Actif',
  },
  {
    name: 'ISPM – Institut Supérieur Polytechnique de Madagascar',
    city: 'Antananarivo',
    contact: '+261 20 32 111 22',
    registrations: '3 845',
    status: 'Actif',
  },
  {
    name: 'ENI – École Nationale d’Informatique',
    city: 'Fianarantsoa',
    contact: '+261 20 22 355 44',
    registrations: '2 940',
    status: 'Actif',
  },
  {
    name: 'ESSCA – École Supérieure des Sciences Commerciales',
    city: 'Antananarivo',
    contact: '+261 20 32 556 66',
    registrations: '2 560',
    status: 'Actif',
  },
  {
    name: 'IST – Institut Supérieur de Technologie',
    city: 'Antananarivo',
    contact: '+261 20 44 555 11',
    registrations: '2 340',
    status: 'En attente',
  },
];
const initialUsers: User[] = [
  {
    name: 'Andriamihaja R.',
    role: 'Administrateur',
    email: 'andriamihaja.r@get.mg',
    phone: '034 12 345 67',
    status: 'Actif',
  },
  {
    name: 'Rakotomalala M.',
    role: 'Gestionnaire',
    email: 'rakotomalala.m@get.mg',
    phone: '033 45 678 90',
    status: 'Actif',
  },
  {
    name: 'Rasolonjato T.',
    role: 'Validateur',
    email: 'rasolonjato.t@get.mg',
    phone: '033 11 223 34',
    status: 'Actif',
  },
  {
    name: 'Rabeharisoa L.',
    role: 'Gestionnaire École',
    email: 'rabeharisoa.l@espa.mg',
    phone: '034 22 334 45',
    status: 'Actif',
  },
  {
    name: 'Randrianarisoa H.',
    role: 'Support',
    email: 'randrianarisoa.h@get.mg',
    phone: '032 55 667 89',
    status: 'Actif',
  },
];

export function AdminManagementView({ view }: { view: AdminView }) {
  if (view === 'reports') return <Reports />;
  if (view === 'settings') return <SettingsView />;
  return <Directory view={view} />;
}

function Directory({
  view,
}: {
  view: Exclude<AdminView, 'reports' | 'settings'>;
}) {
  const isSchools = view === 'schools';
  const isUsers = view === 'users';
  const [schools, setSchools] = useState(initialSchools);
  const [users, setUsers] = useState(initialUsers);
  const [modal, setModal] = useState<'school' | 'user' | null>(null);
  const title = isSchools
    ? 'Établissements'
    : isUsers
      ? 'Utilisateurs'
      : view === 'enrollments'
        ? 'Inscriptions & Admissions'
        : 'Transactions';
  const rows = isSchools
    ? schools
    : isUsers
      ? users
      : view === 'enrollments'
        ? [
            ['Rasolonjato T.', 'Informatique', '10 mai 2025', 'Validée'],
            ['Rakotoarivelo M.', 'Génie Civil', '09 mai 2025', 'Validée'],
            ['Andriamiadana F.', 'Management', '08 mai 2025', 'En attente'],
            ['Rakotomalala J.', 'Électrotechnique', '06 mai 2025', 'En cours'],
          ]
        : [
            [
              'TRX-2025-0001',
              'Rasolonjato T.',
              'ESPA',
              '500 000 Ar',
              'Mobile Money',
              'Réussie',
            ],
            [
              'TRX-2025-0002',
              'Rakotoarivelo M.',
              'ISPM',
              '300 000 Ar',
              'Banque',
              'Réussie',
            ],
            [
              'TRX-2025-0003',
              'Andriamiadana F.',
              'ENI',
              '450 000 Ar',
              'Carte bancaire',
              'Échouée',
            ],
            [
              'TRX-2025-0004',
              'Rabeharisoa L.',
              'ESSCA',
              '350 000 Ar',
              'Mobile Money',
              'Réussie',
            ],
          ];
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title={title}
        subtitle={
          isSchools
            ? 'Gérez la liste de tous les établissements partenaires.'
            : isUsers
              ? 'Gérez les comptes des utilisateurs de la plateforme.'
              : view === 'enrollments'
                ? 'Suivez et gérez les demandes d’inscription des étudiants.'
                : 'Consultez toutes les transactions effectuées sur la plateforme.'
        }
        action={
          isSchools
            ? 'Ajouter un établissement'
            : isUsers
              ? 'Ajouter un utilisateur'
              : undefined
        }
        onAction={() => setModal(isSchools ? 'school' : 'user')}
      />
      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <Toolbar
          placeholder={
            isSchools
              ? 'Rechercher un établissement...'
              : isUsers
                ? 'Rechercher un utilisateur...'
                : view === 'enrollments'
                  ? 'Rechercher un étudiant...'
                  : 'Rechercher une transaction...'
          }
          exportable={view === 'transactions'}
        />
        {isSchools ? (
          <SchoolTable rows={schools} />
        ) : isUsers ? (
          <UserTable rows={users} />
        ) : (
          <GenericTable view={view} rows={rows as string[][]} />
        )}
        <Pagination
          text={
            isSchools
              ? 'Affichage 1 à 5 sur 156 établissements'
              : isUsers
                ? 'Affichage 1 à 5 sur 245 utilisateurs'
                : view === 'enrollments'
                  ? 'Affichage 1 à 4 sur 18 245 inscriptions'
                  : 'Affichage 1 à 4 sur 3 256 transactions'
          }
        />
      </section>
      {modal === 'school' && (
        <SchoolForm
          onClose={() => setModal(null)}
          onSave={(school) => {
            setSchools((current) => [school, ...current]);
            setModal(null);
          }}
        />
      )}
      {modal === 'user' && (
        <UserForm
          onClose={() => setModal(null)}
          onSave={(user) => {
            setUsers((current) => [user, ...current]);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
function PageHead({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111949]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-violet-600">{subtitle}</p>
      </div>
      <div className="flex gap-3">
        <button className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#34406b]">
          <CalendarDays className="size-4 text-violet-600" />
          01 mai – 31 mai 2025
        </button>
        {action && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200"
          >
            <Plus className="size-4" />
            {action}
          </button>
        )}
      </div>
    </header>
  );
}
function Toolbar({
  placeholder,
  exportable,
}: {
  placeholder: string;
  exportable?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <label className="relative min-w-[240px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-violet-500"
          placeholder={placeholder}
        />
      </label>
      {['Statut', 'Ville', 'Rôle'].map((label) => (
        <button
          key={label}
          className="h-10 min-w-24 rounded-lg border border-slate-200 px-3 text-left text-xs text-slate-500"
        >
          {label}
          <span className="float-right">⌄</span>
        </button>
      ))}
      {exportable && (
        <button className="flex h-10 items-center gap-2 rounded-lg bg-violet-50 px-3 text-xs font-bold text-violet-600">
          <Download className="size-4" />
          Exporter
        </button>
      )}
    </div>
  );
}
function SchoolTable({ rows }: { rows: School[] }) {
  return (
    <div className="space-y-2 text-[11px]">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <Building className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-[#28315e]">{row.name}</p>
            <p className="mt-0.5 truncate text-slate-500">
              {row.city} · {row.contact} · {row.registrations} inscriptions
            </p>
            <div className="mt-1.5">
              <Status value={row.status} />
            </div>
          </div>
          <Actions />
        </div>
      ))}
    </div>
  );
}
function UserTable({ rows }: { rows: User[] }) {
  return (
    <div className="space-y-2 text-[11px]">
      {rows.map((row) => (
        <div
          key={row.email}
          className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <UserRound className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-[#28315e]">{row.name}</p>
            <p className="mt-0.5 truncate text-slate-500">
              {row.role} · {row.email} · {row.phone}
            </p>
            <div className="mt-1.5">
              <Status value={row.status} />
            </div>
          </div>
          <Actions />
        </div>
      ))}
    </div>
  );
}
function GenericTable({
  view,
  rows,
}: {
  view: 'enrollments' | 'transactions';
  rows: string[][];
}) {
  const headers =
    view === 'enrollments'
      ? ['Étudiant', 'Filière choisie', 'Date inscription', 'Statut']
      : [
          'Référence',
          'Étudiant',
          'Établissement',
          'Montant',
          'Méthode',
          'Statut',
        ];
  return (
    <div className="space-y-2 text-[11px]">
      {rows.map((row) => (
        <div
          key={row[0]}
          className="flex items-center gap-3 rounded-xl border border-slate-50 p-3"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-[#28315e]">{row[0]}</p>
            <p className="mt-0.5 truncate text-slate-500">
              {row
                .slice(1, -1)
                .map((cell, index) => `${headers[index + 1]}: ${cell}`)
                .join(' · ')}
            </p>
            <div className="mt-1.5">
              <Status value={row[row.length - 1]} />
            </div>
          </div>
          <Actions />
        </div>
      ))}
    </div>
  );
}
function Actions() {
  return (
    <span aria-hidden="true" className="flex gap-2 text-violet-600">
      <Edit3 className="size-4" />
      <MoreHorizontal className="size-4" />
    </span>
  );
}
function Pagination({ text }: { text: string }) {
  return (
    <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
      <span>{text}</span>
      <span className="flex gap-3">
        <ChevronRight className="size-4 rotate-180" />
        <b className="grid size-6 place-items-center rounded bg-violet-600 text-white">
          1
        </b>
        <span>2</span>
        <span>3</span>
        <ChevronRight className="size-4" />
      </span>
    </div>
  );
}
function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-violet-100 bg-[#fbfcff] shadow-[-18px_0_50px_rgba(29,24,88,0.14)] md:w-[calc(100%-15rem)]">
      <section className="mx-auto min-h-full max-w-[980px] p-6 sm:p-8">
        <header className="flex justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-violet-600">
              {title.includes('utilisateur')
                ? 'Utilisateurs › Ajouter un utilisateur'
                : 'Établissements › Ajouter un établissement'}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#111949]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-9 place-items-center rounded-lg text-violet-700 transition hover:bg-violet-50"
          >
            <X className="size-5" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function SchoolForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (school: School) => void;
}) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('Antananarivo');
  const submit = () => {
    if (!name.trim()) return;
    onSave({
      name,
      city,
      contact: '+261 34 12 345 67',
      registrations: '0',
      status: 'Actif',
    });
  };
  return (
    <Modal
      title="Ajouter un établissement"
      subtitle="Enregistrez un nouvel établissement sur la plateforme"
      onClose={onClose}
    >
      <div className="mt-6 space-y-5">
        <FormBox icon={Building} title="Informations générales">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nom de l’établissement *"
              value={name}
              onChange={setName}
              placeholder="Entrez le nom complet de l’établissement"
            />
            <Input label="Sigle *" placeholder="Ex : ESPA" />
            <Select
              label="Type d’établissement *"
              options={[
                'Université',
                'Institut supérieur',
                'École spécialisée',
              ]}
            />
            <Select
              label="Ville *"
              value={city}
              onChange={setCity}
              options={[
                'Antananarivo',
                'Fianarantsoa',
                'Toamasina',
                'Mahajanga',
              ]}
            />
            <Input
              label="Adresse *"
              placeholder="Entrez l’adresse complète"
              wide
              multiline
            />
            <Input label="Téléphone" placeholder="+261 20 22 222 22" />
            <Input
              label="Email officiel *"
              placeholder="contact@etablissement.mg"
            />
            <Input label="Site web" placeholder="https://www.exemple.mg" />
            <UploadBox
              label="Logo de l’établissement"
              preview={
                <div className="flex h-28 items-center gap-3 rounded-lg border border-slate-100 bg-white px-4">
                  <span className="grid size-12 place-items-center rounded-xl bg-violet-100 text-lg font-black text-violet-700">
                    ▥
                  </span>
                  <span>
                    <b className="block text-xs text-[#17204e]">Aperçu</b>
                    <small className="text-[10px] text-slate-500">
                      Votre logo apparaîtra ici
                    </small>
                  </span>
                </div>
              }
            />
          </div>
        </FormBox>
        <FormBox icon={GraduationCap} title="Informations académiques">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre d’étudiants approximatif"
              placeholder="Ex : 2500"
            />
            <Input label="Année de création" placeholder="Ex : 1990" />
            <Input
              label="Numéro d’agrément"
              placeholder="Ex : 123/MESUPRES/2020"
              wide
            />
            <Input
              label="Description"
              placeholder="Présentez brièvement votre établissement, ses missions et ses valeurs..."
              wide
              multiline
            />
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-xs font-bold text-[#34406b]">
                Agréé par le MESUPRES
              </legend>
              <div className="flex gap-5 text-xs text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accreditation"
                    defaultChecked
                    className="accent-violet-600"
                  />
                  Oui
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="accreditation"
                    className="accent-violet-600"
                  />
                  Non
                </label>
              </div>
            </fieldset>
          </div>
        </FormBox>
        <FormBox icon={UserRound} title="Contact principal">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom complet *" placeholder="Entrez le nom complet" />
            <Input label="Fonction *" placeholder="Ex : Directeur Général" />
            <Input label="Téléphone" placeholder="+261 34 12 345 67" />
            <Input
              label="Email *"
              placeholder="contact.principal@etablissement.mg"
            />
          </div>
        </FormBox>
      </div>
      <Footer
        onClose={onClose}
        onSave={submit}
        label="Enregistrer l’établissement"
        icon={Building}
      />
    </Modal>
  );
}
function UserForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (user: User) => void;
}) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const submit = () => {
    if (!first.trim() || !email.trim()) return;
    onSave({
      name: `${first} ${last}`.trim(),
      role: 'Gestionnaire',
      email,
      phone: '034 12 345 67',
      status: 'Actif',
    });
  };
  return (
    <Modal
      title="Ajouter un utilisateur"
      subtitle="Créez un nouveau compte utilisateur sur la plateforme"
      onClose={onClose}
    >
      <div className="mt-6 space-y-5">
        <FormBox icon={UserRound} title="Informations personnelles">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Prénom *"
              value={first}
              onChange={setFirst}
              placeholder="Entrez le prénom"
            />
            <Input
              label="Nom *"
              value={last}
              onChange={setLast}
              placeholder="Entrez le nom"
            />
            <Input
              label="Email *"
              value={email}
              onChange={setEmail}
              placeholder="exemple@email.com"
              wide
            />
            <Input label="Téléphone *" placeholder="+261 34 12 345 67" wide />
            <UploadBox label="Photo de profil" />
          </div>
        </FormBox>
        <FormBox icon={LockKeyhole} title="Informations du compte">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Rôle *"
              options={[
                'Administrateur',
                'Gestionnaire',
                'Validateur',
                'Gestionnaire École',
                'Support',
              ]}
            />
            <Select
              label="Établissement (si applicable)"
              options={['ESPA', 'ISPM', 'ENI', 'ESSCA']}
            />
            <Input
              label="Nom d’utilisateur *"
              placeholder="Entrez le nom d’utilisateur"
            />
            <label>
              <span className="mb-1.5 block text-xs font-bold text-[#34406b]">
                Mot de passe temporaire *
              </span>
              <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <input
                  placeholder="Générez ou saisissez un mot de passe"
                  className="min-w-0 flex-1 px-3 text-xs outline-none"
                />
                <button
                  type="button"
                  className="border-l border-violet-100 bg-violet-50 px-3 text-[10px] font-bold text-violet-600"
                >
                  Générer
                </button>
              </div>
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              defaultChecked
              className="accent-violet-600"
            />
            Envoyer les identifiants par email à l’utilisateur
          </label>
        </FormBox>
        <FormBox icon={ShieldCheck} title="Permissions">
          <div className="grid grid-cols-5 gap-3">
            {[
              'Tableau de bord',
              'Étudiants',
              'Inscriptions',
              'Paiements',
              'Rapports',
            ].map((name) => (
              <label
                key={name}
                className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-center text-[10px] font-bold text-[#34406b]"
              >
                <Check className="mx-auto mb-2 size-5 text-violet-600" />
                {name}
                <input
                  type="checkbox"
                  defaultChecked
                  className="mt-2 accent-violet-600"
                />
              </label>
            ))}
          </div>
        </FormBox>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-4 text-xs font-bold text-[#34406b]"
        >
          Options avancées <ChevronDown className="size-4 text-violet-600" />
        </button>
      </div>
      <Footer
        onClose={onClose}
        onSave={submit}
        label="Créer l’utilisateur"
        icon={UserPlus}
      />
    </Modal>
  );
}
function FormBox({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4">
      <h3 className="flex items-center gap-2 font-extrabold text-[#17204e]">
        <Icon className="size-5 text-violet-600" />
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Input({
  label,
  value,
  onChange,
  placeholder,
  wide = false,
  multiline = false,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  wide?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className={wide ? 'sm:col-span-2' : ''}>
      <span className="mb-1.5 block text-xs font-bold text-[#34406b]">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-violet-500"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500"
        />
      )}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options = ['Administrateur', 'Gestionnaire', 'Validateur'],
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  options?: string[];
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-[#34406b]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-500"
      >
        <option>Sélectionnez une option</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
function UploadBox({
  label,
  preview,
}: {
  label: string;
  preview?: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-[#34406b]">
        {label}
      </span>
      <div className={preview ? 'grid gap-3 sm:grid-cols-2' : ''}>
        <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-violet-200 bg-violet-50/50 text-xs font-bold text-violet-600">
          <Upload className="mb-2 size-5" />
          Cliquez pour téléverser
          <small className="mt-1 text-[10px] text-slate-500">
            PNG, JPG ou WEBP (max. 2Mo)
          </small>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
          />
        </label>
        {preview}
      </div>
    </div>
  );
}
function Footer({
  onClose,
  onSave,
  label,
  icon: Icon,
}: {
  onClose: () => void;
  onSave: () => void;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <footer className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button
        onClick={onClose}
        className="rounded-lg border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600"
      >
        Annuler
      </button>
      <button
        onClick={onSave}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-500 px-5 py-2.5 text-xs font-bold text-white"
      >
        <Icon className="size-4" />
        {label}
      </button>
    </footer>
  );
}
function Reports() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Rapports & Statistiques"
        subtitle="Analysez les performances de la plateforme."
      />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <ChartCard title="Inscriptions par jour" />
        <Card title="Top 5 Filières">
          <Bars
            items={[
              ['Informatique', 6382],
              ['Gestion', 4540],
              ['Génie Civil', 2845],
              ['Électrotechnique', 2010],
              ['Droit', 1468],
            ]}
          />
        </Card>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Stat icon={ShieldCheck} label="Taux de réussite" value="76,4%" />
        <Stat
          icon={FileText}
          label="Délai moyen traitement"
          value="2,4 jours"
        />
        <Stat
          icon={UsersRound}
          label="Satisfaction étudiants"
          value="4,6 / 5"
        />
      </div>
    </div>
  );
}
function SettingsView() {
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHead
        title="Paramètres"
        subtitle="Gérez les paramètres généraux de la plateforme."
      />
      <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex gap-6 border-b border-slate-100 pb-4 text-xs font-bold">
          <span className="text-violet-600">Général</span>
          <span className="text-slate-500">Sécurité</span>
          <span className="text-slate-500">Notifications</span>
          <span className="text-slate-500">Paiements</span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            <h2 className="font-bold text-[#17204e]">Informations générales</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input
                label="Nom de la plateforme"
                placeholder="GET – Grandes Écoles de Tananarive"
                wide
              />
              <Input label="Email de contact" placeholder="contact@get.mg" />
              <Input label="Téléphone" placeholder="+261 34 12 345 67" />
              <Input
                label="Adresse"
                placeholder="Lot II 4B, Antananarivo, Madagascar"
                wide
              />
            </div>
          </div>
          <div className="rounded-xl bg-violet-50 p-5">
            <h3 className="font-bold text-[#17204e]">Logo de la plateforme</h3>
            <span className="mt-5 grid size-20 place-items-center rounded-full bg-violet-700 text-xl font-black text-white">
              GET
            </span>
            <button className="mt-4 text-xs font-bold text-violet-600">
              Changer le logo
            </button>
          </div>
        </div>
        <Footer
          onClose={() => undefined}
          onSave={() => undefined}
          label="Enregistrer les modifications"
          icon={Settings}
        />
      </section>
    </div>
  );
}
function ChartCard({ title }: { title: string }) {
  return (
    <Card title={title}>
      <div className="relative h-56 border-b border-l border-slate-100">
        <div className="absolute inset-x-5 bottom-5 top-7 flex items-end gap-2">
          {[35, 55, 42, 70, 66, 82, 74, 93, 45, 72, 54, 88].map(
            (height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t bg-gradient-to-t from-violet-500 to-violet-200"
                style={{ height: `${height}%` }}
              />
            ),
          )}
        </div>
      </div>
    </Card>
  );
}
function Bars({ items }: { items: Array<[string, number]> }) {
  const largest = Math.max(...items.map(([, value]) => value));
  return (
    <div className="space-y-5">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-28 text-xs text-slate-600">{label}</span>
          <div className="h-2 flex-1 rounded bg-slate-100">
            <div
              className="h-2 rounded bg-violet-600"
              style={{ width: `${(value / largest) * 100}%` }}
            />
          </div>
          <b className="text-xs text-[#34406b]">
            {value.toLocaleString('fr-FR')}
          </b>
        </div>
      ))}
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <Icon className="size-6 text-violet-600" />
      <p className="mt-4 text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#17204e]">{value}</p>
      <p className="mt-2 text-[10px] text-emerald-600">↗ +5,2% vs avril</p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`rounded px-2 py-1 text-[10px] font-bold ${value === 'Actif' || value === 'Validée' || value === 'Réussie' ? 'bg-emerald-50 text-emerald-600' : value === 'Échouée' ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-500'}`}
    >
      {value}
    </span>
  );
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-[#17204e]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
