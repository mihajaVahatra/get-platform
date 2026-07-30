'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  Headphones,
  Home,
  LibraryBig,
  LogOut,
  Mail,
  Newspaper,
  Route,
  Settings,
  ShieldCheck,
  WalletCards,
  UsersRound,
  Layers3,
  ReceiptText,
  Megaphone,
  ChartNoAxesCombined,
  Building,
  UserCog,
  Trophy,
  Handshake,
  BellRing,
  ScrollText,
  ChartSpline,
  DatabaseBackup,
} from 'lucide-react';
import { AvatarUpload } from '@/components/AvatarUpload';
import { apiClient } from '@/lib/api-client';

type UserRole =
  'STUDENT' | 'SCHOOL_ADMIN' | 'TEACHER' | 'MINISTRY' | 'ADMIN_GET' | null;
type DashboardUser = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  avatarUrl?: string;
  enrolledYear?: string;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((response) => {
        const sessionUser = response.data.data.user;
        setUserRole(sessionUser.role || 'STUDENT');
        setUser({
          firstName: sessionUser.firstName || '',
          lastName: sessionUser.lastName || '',
          gender: sessionUser.gender || 'MALE',
        });
      })
      .catch(() => router.replace('/auth/login'));
  }, [router]);

  useEffect(() => {
    if (userRole !== 'STUDENT') return;
    apiClient
      .get('/students/me')
      .then((response) => {
        const student = response.data.data;
        setUser((current) => ({
          ...current,
          ...student,
          firstName: student.firstName || current?.firstName || '',
          lastName: student.lastName || current?.lastName || '',
          gender: student.gender || current?.gender || 'MALE',
        }));
      })
      .catch((error) => console.error('Erreur chargement profil:', error));
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'STUDENT') return;
    const refreshUnreadMessages = () => {
      apiClient
        .get('/messages/unread-count')
        .then((response) => setUnreadMessages(response.data.data?.count ?? 0))
        .catch(() => setUnreadMessages(0));
    };
    refreshUnreadMessages();
    window.addEventListener('messages:updated', refreshUnreadMessages);
    return () =>
      window.removeEventListener('messages:updated', refreshUnreadMessages);
  }, [userRole, pathname]);

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      router.replace('/auth/login');
    }
  };

  const initials =
    `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  const displayName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Étudiant';

  if (!userRole) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fbfbff] text-sm text-slate-500">
        Chargement de votre session…
      </div>
    );
  }

  if (userRole === 'STUDENT') {
    return (
      <div className="min-h-screen bg-[#fbfbff] text-slate-900 lg:flex">
        <StudentSidebar
          avatarUrl={user?.avatarUrl}
          displayName={displayName}
          initials={initials}
          year={user?.enrolledYear}
          gender={user?.gender}
          onAvatarUpload={(avatarUrl) =>
            setUser((current) => ({ ...current, avatarUrl }))
          }
          onLogout={logout}
          pathname={pathname}
          unreadMessages={unreadMessages}
        />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-9 lg:py-7">
          {children}
        </main>
      </div>
    );
  }

  if (userRole === 'SCHOOL_ADMIN' || userRole === 'TEACHER') {
    return (
      <div className="min-h-screen bg-[#fbfbff] text-slate-900 lg:flex">
        {userRole === 'TEACHER' ? (
          <Suspense fallback={null}>
            <TeacherSidebar
              pathname={pathname}
              displayName={
                displayName === 'Étudiant' ? 'Professeur' : displayName
              }
              onLogout={logout}
            />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <SchoolSidebar
              pathname={pathname}
              displayName={
                displayName === 'Étudiant' ? 'Administrateur' : displayName
              }
              onLogout={logout}
            />
          </Suspense>
        )}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    );
  }

  if (userRole === 'ADMIN_GET') {
    return (
      <div className="min-h-screen bg-[#fbfbff] text-slate-900 lg:flex">
        <Suspense fallback={null}>
          <AdminGetSidebar pathname={pathname} onLogout={logout} />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    );
  }

  if (userRole === 'MINISTRY') {
    return (
      <div className="min-h-screen bg-[#fbfbff] text-slate-900 lg:flex">
        <Suspense fallback={null}>
          <MinistrySidebar pathname={pathname} onLogout={logout} />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl gap-6 items-start">
        <aside className="sticky top-6 w-72 shrink-0 rounded-3xl bg-gradient-to-b from-violet-700 via-violet-800 to-violet-900 p-5 text-white shadow-2xl shadow-violet-500/20">
          <div className="mb-5 text-center">
            <p className="text-lg font-bold">GET</p>
            <p className="text-sm text-violet-200">
              {String(userRole ?? 'INCONNU').replace('_', ' ')}
            </p>
          </div>
          <nav className="space-y-1 text-sm">
            <NavItem
              href="/dashboard"
              label="Dashboard"
              icon={Home}
              active={pathname === '/dashboard'}
            />
            <button
              onClick={logout}
              className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-red-200 hover:bg-white/10"
            >
              <LogOut className="size-4" />
              Déconnexion
            </button>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 rounded-3xl bg-white p-6 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}

function useCurrentDashboardUrl(pathname: string) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function isNavigationActive(currentUrl: string, href: string) {
  const [currentPath, currentSearch = ''] = currentUrl.split('?');
  const [targetPath, targetSearch = ''] = href.split('?');
  const currentParams = new URLSearchParams(currentSearch);
  const targetParams = new URLSearchParams(targetSearch);
  if (
    targetPath === '/dashboard/teacher' &&
    targetParams.get('view') === 'courses' &&
    ['courses', 'course-detail'].includes(currentParams.get('view') || '')
  ) {
    return true;
  }
  if (targetSearch) {
    return currentPath === targetPath && currentSearch === targetSearch;
  }
  const isDashboardRoot =
    /^\/dashboard\/(student|school|teacher|admin|ministry)$/.test(targetPath);
  if (isDashboardRoot && currentSearch) return false;
  return (
    currentPath === targetPath ||
    (!isDashboardRoot && currentPath.startsWith(`${targetPath}/`))
  );
}

function TeacherSidebar({
  pathname,
  displayName,
  onLogout,
}: {
  pathname: string;
  displayName: string;
  onLogout: () => void;
}) {
  const currentUrl = useCurrentDashboardUrl(pathname);
  const items = [
    { label: 'Tableau de bord', icon: Home, href: '/dashboard/teacher' },
    {
      label: 'Mes cours',
      icon: BookOpen,
      href: '/dashboard/teacher?view=courses',
    },
    {
      label: 'Étudiants',
      icon: UsersRound,
      href: '/dashboard/teacher?view=students',
    },
    {
      label: 'Évaluations',
      icon: ClipboardList,
      href: '/dashboard/teacher?view=evaluations',
    },
    {
      label: 'Emploi du temps',
      icon: CalendarDays,
      href: '/dashboard/teacher?view=schedule',
    },
    {
      label: 'Devoirs',
      icon: FileText,
      href: '/dashboard/teacher?view=assignments',
    },
    {
      label: 'Ressources',
      icon: LibraryBig,
      href: '/dashboard/teacher?view=resources',
    },
    {
      label: 'Messages',
      icon: Mail,
      href: '/dashboard/teacher?view=messages',
      badge: '3',
    },
    {
      label: 'Notes & Bulletins',
      icon: Trophy,
      href: '/dashboard/teacher?view=grades',
    },
    {
      label: 'Annonces',
      icon: Megaphone,
      href: '/dashboard/teacher?view=announcements',
    },
  ];
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-100 bg-gradient-to-b from-[#13235e] via-[#162867] to-[#0d1b4d] px-4 py-6 text-white lg:flex lg:min-h-screen lg:flex-col">
      <Link href="/dashboard/teacher" className="mb-7 px-3">
        <div className="text-4xl font-black tracking-tight">
          GET<span className="text-violet-300">.</span>
        </div>
        <p className="mt-1 text-[10px] font-medium leading-4 text-blue-100">
          Grandes Écoles de
          <br />
          Tananarive et de Madagascar
        </p>
      </Link>
      <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-wide text-blue-200">
        Menu professeur
      </p>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavigationActive(currentUrl, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${active ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30' : 'text-blue-100 hover:bg-white/10'}`}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="grid size-5 place-items-center rounded-full bg-violet-400 text-[9px] text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold">{displayName}</p>
          <p className="mt-1 text-[10px] text-blue-100">
            Professeur · Informatique
          </p>
        </div>
        <Link
          href="/dashboard/teacher?view=settings"
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs ${isNavigationActive(currentUrl, '/dashboard/teacher?view=settings') ? 'bg-white/15 text-white' : 'text-blue-100 hover:text-white'}`}
        >
          <Settings className="size-4" />
          Paramètres
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 px-2 text-xs text-blue-100 hover:text-rose-300"
        >
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function SchoolSidebar({
  pathname,
  displayName,
  onLogout,
}: {
  pathname: string;
  displayName: string;
  onLogout: () => void;
}) {
  const currentUrl = useCurrentDashboardUrl(pathname);
  const academic = [
    {
      label: 'Étudiants',
      icon: UsersRound,
      href: '/dashboard/school/students',
    },
    { label: 'Cours', icon: BookOpen, href: '/dashboard/school/courses' },
    {
      label: 'Professeurs',
      icon: UserRoundIcon,
      href: '/dashboard/school/teachers',
    },
    {
      label: 'Salles & Emplois du temps',
      icon: CalendarDays,
      href: '/dashboard/school/schedule',
    },
    {
      label: 'Programmes',
      icon: Layers3,
      href: '/dashboard/school/settings',
    },
  ];
  const admin = [
    {
      label: 'Offres & admissions',
      icon: BriefcaseBusiness,
      href: '/dashboard/school/offers',
    },
    {
      label: 'Candidatures',
      icon: ClipboardList,
      href: '/dashboard/school/applications',
    },
    {
      label: 'Paiements',
      icon: ReceiptText,
      href: '/dashboard/school/payments',
    },
    {
      label: 'Documents',
      icon: FileText,
      href: '/dashboard/school/documents',
    },
    {
      label: 'Communications',
      icon: Megaphone,
      href: '/dashboard/school/communications',
    },
    {
      label: 'Rapports & Statistiques',
      icon: ChartNoAxesCombined,
      href: '/dashboard/school/reports',
    },
  ];
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-100 bg-white px-4 py-6 lg:flex lg:min-h-screen lg:flex-col">
      <Link href="/dashboard/school" className="mb-6 px-3">
        <div className="text-4xl font-black tracking-tight text-violet-600">
          GET<span className="text-blue-500">.</span>
        </div>
        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">
          Grandes Écoles de
          <br />
          Tananarive et de Madagascar
        </p>
      </Link>
      <nav className="space-y-1">
        <SchoolNav
          href="/dashboard/school"
          label="Tableau de bord"
          icon={Home}
          active={isNavigationActive(currentUrl, '/dashboard/school')}
        />
        <SidebarGroup
          label="Gestion académique"
          items={academic}
          currentUrl={currentUrl}
        />
        <SidebarGroup
          label="Administration"
          items={admin}
          currentUrl={currentUrl}
        />
        <SchoolNav
          href="/dashboard/school/settings"
          label="Paramètres"
          icon={Settings}
          active={isNavigationActive(currentUrl, '/dashboard/school/settings')}
        />
      </nav>
      <div className="mt-auto space-y-4">
        <div className="rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
              E
            </span>
            <div>
              <p className="text-sm font-bold">ESPA</p>
              <p className="text-[10px] leading-4 text-slate-500">
                École Supérieure
                <br />
                Polytechnique d’Antananarivo
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {displayName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{displayName}</p>
            <p className="text-[10px] text-slate-500">Administrateur</p>
          </div>
        </div>
        <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Headphones className="size-4" />
            Besoin d’aide ?
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Centre d’aide & support
          </p>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 px-2 text-xs font-semibold text-slate-500 hover:text-rose-600"
        >
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function SidebarGroup({
  label,
  items,
  currentUrl,
}: {
  label: string;
  items: Array<{
    label: string;
    icon: typeof Home;
    href: string;
    badge?: string;
  }>;
  currentUrl: string;
}) {
  return (
    <div className="py-3">
      <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {items.map((item) => (
        <SchoolNav
          key={item.label}
          {...item}
          active={isNavigationActive(currentUrl, item.href)}
        />
      ))}
    </div>
  );
}
function SchoolNav({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition ${active ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="grid size-5 place-items-center rounded-full bg-violet-600 text-[10px] text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
const UserRoundIcon = UsersRound;

function AdminGetSidebar({
  pathname,
  onLogout,
}: {
  pathname: string;
  onLogout: () => void;
}) {
  const currentUrl = useCurrentDashboardUrl(pathname);
  const global = [
    {
      label: 'Établissements',
      icon: Building,
      href: '/dashboard/admin/schools',
    },
    { label: 'Utilisateurs', icon: UserCog, href: '/dashboard/admin/users' },
    {
      label: 'Étudiants',
      icon: UsersRound,
      href: '/dashboard/admin?section=students',
    },
    {
      label: 'Inscriptions & Admissions',
      icon: ClipboardList,
      href: '/dashboard/admin/enrollments',
    },
    {
      label: 'Concours',
      icon: Trophy,
      href: '/dashboard/admin?section=competitions',
    },
    {
      label: 'Programmes & Filières',
      icon: BookOpen,
      href: '/dashboard/admin?section=programs',
    },
    {
      label: 'Salles & Ressources',
      icon: Building2,
      href: '/dashboard/admin?section=resources',
    },
  ];
  const finances = [
    {
      label: 'Transactions',
      icon: WalletCards,
      href: '/dashboard/admin/transactions',
    },
    {
      label: 'Revenus & Rapports',
      icon: ChartSpline,
      href: '/dashboard/admin/reports',
    },
    {
      label: 'Partenaires financiers',
      icon: Handshake,
      href: '/dashboard/admin?section=partners',
    },
  ];
  const communication = [
    {
      label: 'Notifications',
      icon: BellRing,
      href: '/dashboard/admin?section=notifications',
    },
    {
      label: 'Messages',
      icon: Mail,
      href: '/dashboard/admin?section=messages',
    },
    {
      label: 'Annonces',
      icon: Megaphone,
      href: '/dashboard/admin?section=announcements',
    },
  ];
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-100 bg-white px-4 py-6 lg:flex lg:min-h-screen lg:flex-col">
      <Link href="/dashboard/admin" className="mb-6 px-3">
        <div className="text-4xl font-black tracking-tight text-violet-600">
          GET<span className="text-blue-500">.</span>
        </div>
        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">
          Grandes Écoles de
          <br />
          Tananarive et de Madagascar
        </p>
      </Link>
      <nav className="space-y-1">
        <SchoolNav
          href="/dashboard/admin"
          label="Tableau de bord"
          icon={Home}
          active={isNavigationActive(currentUrl, '/dashboard/admin')}
        />
        <SidebarGroup
          label="Gestion globale"
          items={global}
          currentUrl={currentUrl}
        />
        <SidebarGroup
          label="Paiements & finances"
          items={finances}
          currentUrl={currentUrl}
        />
        <SidebarGroup
          label="Communication"
          items={communication}
          currentUrl={currentUrl}
        />
        <SidebarGroup
          label="Analytiques"
          items={[
            {
              label: 'Rapports & Statistiques',
              icon: BarChart3,
              href: '/dashboard/admin/reports',
            },
            {
              label: 'Tableaux de bord avancés',
              icon: ChartSpline,
              href: '/dashboard/admin?section=dashboards',
            },
          ]}
          currentUrl={currentUrl}
        />
        <div className="pt-3">
          <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">
            Paramètres
          </p>
          <SchoolNav
            href="/dashboard/admin/settings"
            label="Paramètres généraux"
            icon={Settings}
            active={isNavigationActive(currentUrl, '/dashboard/admin/settings')}
          />
          <SchoolNav
            href="/dashboard/admin?section=activity"
            label="Journal d’activité"
            icon={ScrollText}
            active={isNavigationActive(
              currentUrl,
              '/dashboard/admin?section=activity',
            )}
          />
        </div>
      </nav>
      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-700">
              AG
            </span>
            <div>
              <p className="text-sm font-bold">Admin GET</p>
              <p className="text-[10px] text-slate-500">Superadministrateur</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
          <div className="flex items-center gap-2 text-xs font-bold">
            <DatabaseBackup className="size-4" />
            Système sécurisé
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Sauvegarde quotidienne active
          </p>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 px-2 text-xs font-semibold text-slate-500 hover:text-rose-600"
        >
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function MinistrySidebar({
  pathname,
  onLogout,
}: {
  pathname: string;
  onLogout: () => void;
}) {
  const currentUrl = useCurrentDashboardUrl(pathname);
  const national = [
    {
      label: 'Établissements',
      icon: Building,
      href: '/dashboard/ministry?section=schools',
    },
    {
      label: 'Étudiants',
      icon: UsersRound,
      href: '/dashboard/ministry?section=students',
    },
    {
      label: 'Inscriptions & Admissions',
      icon: ClipboardList,
      href: '/dashboard/ministry?section=enrollments',
    },
    {
      label: 'Concours',
      icon: Trophy,
      href: '/dashboard/ministry?section=competitions',
    },
    {
      label: 'Paiements',
      icon: WalletCards,
      href: '/dashboard/ministry?section=payments',
    },
    {
      label: 'Statistiques & Rapports',
      icon: ChartNoAxesCombined,
      href: '/dashboard/ministry/reports',
    },
    {
      label: 'Communication',
      icon: Megaphone,
      href: '/dashboard/ministry?section=communication',
    },
  ];
  const settings = [
    {
      label: 'Utilisateurs',
      icon: UserCog,
      href: '/dashboard/ministry?section=users',
    },
    {
      label: 'Rôles & Permissions',
      icon: ShieldCheck,
      href: '/dashboard/ministry?section=roles',
    },
    {
      label: 'Paramètres système',
      icon: Settings,
      href: '/dashboard/ministry?section=settings',
    },
    {
      label: 'Journal d’activité',
      icon: ScrollText,
      href: '/dashboard/ministry?section=activity',
    },
  ];
  return (
    <aside className="hidden w-60 shrink-0 bg-gradient-to-b from-[#172c81] via-[#14266f] to-[#111d58] px-4 py-6 text-white lg:flex lg:min-h-screen lg:flex-col">
      <Link href="/dashboard/ministry" className="mb-8 px-3">
        <div className="text-4xl font-black tracking-tight text-white">
          GET<span className="text-violet-300">.</span>
        </div>
        <p className="mt-1 text-[10px] font-medium leading-4 text-violet-100">
          Grandes Écoles de
          <br />
          Tananarive et de Madagascar
        </p>
      </Link>
      <nav className="space-y-1">
        <MinistryNav
          href="/dashboard/ministry"
          label="Tableau de bord"
          icon={Home}
          active={isNavigationActive(currentUrl, '/dashboard/ministry')}
        />
        <p className="px-3 pb-2 pt-5 text-[9px] font-bold uppercase tracking-wide text-violet-200/70">
          Menu principal
        </p>
        {national.map((item) => (
          <MinistryNav
            key={item.label}
            {...item}
            active={isNavigationActive(currentUrl, item.href)}
          />
        ))}
        <p className="px-3 pb-2 pt-5 text-[9px] font-bold uppercase tracking-wide text-violet-200/70">
          Paramètres
        </p>
        {settings.map((item) => (
          <MinistryNav
            key={item.label}
            {...item}
            active={isNavigationActive(currentUrl, item.href)}
          />
        ))}
      </nav>
      <div className="mt-auto border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <span className="grid size-9 place-items-center rounded-full bg-white text-xs font-black text-violet-700">
            M
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">Ministère MESUPRES</p>
            <p className="text-[10px] text-violet-200">Administrateur</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-4 flex w-full items-center gap-2 px-3 text-xs font-semibold text-violet-100 transition hover:text-white"
        >
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function MinistryNav({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition ${active ? 'bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-lg shadow-black/20' : 'text-violet-50 hover:bg-white/10 hover:text-white'}`}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function StudentSidebar({
  avatarUrl,
  displayName,
  initials,
  year,
  gender,
  onAvatarUpload,
  onLogout,
  pathname,
  unreadMessages,
}: {
  avatarUrl?: string;
  displayName: string;
  initials: string;
  year?: string;
  gender?: string;
  onAvatarUpload: (url: string) => void;
  onLogout: () => void;
  pathname: string;
  unreadMessages: number;
}) {
  const items = [
    { label: 'Accueil', icon: Home, href: '/dashboard/student' },
    { label: 'Mon parcours', icon: Route, href: '/dashboard/student/parcours' },
    { label: 'Mes cours', icon: BookOpen, href: '/dashboard/student/courses' },
    {
      label: 'Emploi du temps',
      icon: CalendarDays,
      href: '/dashboard/student/schedule',
    },
    {
      label: 'Mes notes',
      icon: ClipboardList,
      href: '/dashboard/student/grades',
    },
    {
      label: 'Finances',
      icon: WalletCards,
      href: '/dashboard/student/payments',
    },
    {
      label: 'Documents',
      icon: FileText,
      href: '/dashboard/student/documents',
    },
    {
      label: 'Messages',
      icon: Mail,
      href: '/dashboard/student/messages',
      badge: unreadMessages ? String(unreadMessages) : undefined,
    },
    { label: 'Actualités', icon: Newspaper, href: '/dashboard/student/news' },
    {
      label: 'Stages & emplois',
      icon: BriefcaseBusiness,
      href: '/dashboard/student/opportunities',
    },
    {
      label: 'Bibliothèque',
      icon: LibraryBig,
      href: '/dashboard/student/library',
    },
    {
      label: 'Paramètres',
      icon: Settings,
      href: '/dashboard/student/settings',
    },
  ];

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-100 bg-white px-4 py-7 lg:flex lg:min-h-screen lg:flex-col">
      <Link href="/dashboard/student" className="mb-7 px-3">
        <div className="text-4xl font-black tracking-tight text-violet-600">
          GET<span className="text-blue-500">.</span>
        </div>
        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">
          Grandes Écoles de
          <br />
          Tananarive et de Madagascar
        </p>
      </Link>
      <nav className="space-y-1">
        {items.map(({ label, icon: Icon, href, badge }) => {
          const active =
            label === 'Accueil'
              ? pathname === '/dashboard/student'
              : pathname === href.split('?')[0] && !href.includes('?');
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition ${active ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="flex size-5 items-center justify-center rounded-full bg-violet-600 text-[10px] text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-4 pt-6">
        <div className="rounded-xl border border-slate-100 p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AvatarUpload
              currentUrl={avatarUrl}
              endpoint="/students/me/avatar"
              onUpload={onAvatarUpload}
              fallbackText={initials}
              gender={gender}
              firstName={displayName.split(' ')[0]}
              lastName={displayName.split(' ').slice(1).join(' ')}
              size={44}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{displayName}</p>
              <p className="truncate text-[11px] text-slate-500">
                {year || 'Étudiant inscrit'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/student/profile"
            className="mt-3 flex items-center justify-between text-xs font-semibold text-violet-600"
          >
            Voir mon profil <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Headphones className="size-4" />
            Besoin d’aide ?
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Centre d’aide & support
          </p>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 px-3 text-xs font-semibold text-slate-500 hover:text-rose-600"
        >
          <LogOut className="size-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${active ? 'bg-white/15' : 'hover:bg-white/10'}`}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
