'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileText,
  Headphones,
  Home,
  LibraryBig,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Route,
  Settings,
  ShieldCheck,
  WalletCards,
  UsersRound,
  ReceiptText,
  Megaphone,
  ChartNoAxesCombined,
  Building,
  UserCog,
  Trophy,
  Handshake,
  BellRing,
  ScrollText,
  DatabaseBackup,
  LayoutTemplate,
  Layers,
  CalendarRange,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AvatarUpload } from '@/components/AvatarUpload';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { apiClient } from '@/lib/api-client';
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

type UserRole =
  'STUDENT' | 'SCHOOL_ADMIN' | 'TEACHER' | 'MINISTRY' | 'ADMIN_GET' | null;

// Racine de section propre à chaque rôle. En dehors de `/dashboard` lui-même
// (page de redirection générique), un rôle ne doit jamais rendre une page
// commençant par la racine d'un autre rôle — sans ce garde-fou côté client,
// la sidebar affichée dépend du rôle mais la page réellement demandée était
// rendue quel que soit le rôle (défense en profondeur absente, le seul
// rempart restant étant le 403 du RolesGuard backend).
const ROLE_HOME: Record<Exclude<UserRole, null>, string> = {
  STUDENT: '/dashboard/student',
  SCHOOL_ADMIN: '/dashboard/school',
  TEACHER: '/dashboard/teacher',
  ADMIN_GET: '/dashboard/admin',
  MINISTRY: '/dashboard/ministry',
};
type StudentSchoolEnrollment = {
  schoolId: string;
  enrolledYear?: string;
  school?: { name?: string };
};
type DashboardUser = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  avatarUrl?: string;
  // Un étudiant peut être inscrit activement dans plusieurs écoles à la
  // fois (double diplôme, cursus parallèle) : liste, jamais un objet unique.
  schoolEnrollments?: StudentSchoolEnrollment[];
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tStudentNav = useTranslations('StudentNav');
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Referme le tiroir mobile à chaque changement de page plutôt que d'exiger
  // un onClick de fermeture sur chacun des dizaines de liens de navigation.
  // Ajusté pendant le rendu (pattern recommandé par React) plutôt que via un
  // useEffect, pour éviter un rendu en cascade évitable.
  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setMobileMenuOpen(false);
  }

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
    if (userRole !== 'STUDENT' && userRole !== 'TEACHER') return;
    const profileEndpoint =
      userRole === 'TEACHER' ? '/teacher/profile' : '/students/me';
    const loadProfile = () => {
      apiClient
        .get(profileEndpoint)
        .then((response) => {
          const profile = response.data.data;
          setUser((current) => ({
            ...current,
            ...profile,
            firstName: profile.firstName || current?.firstName || '',
            lastName: profile.lastName || current?.lastName || '',
            gender: profile.gender || current?.gender || 'MALE',
          }));
        })
        .catch((error) => console.error('Erreur chargement profil:', error));
    };
    loadProfile();
    if (userRole === 'TEACHER') {
      window.addEventListener('teacher:profile-updated', loadProfile);
      return () =>
        window.removeEventListener('teacher:profile-updated', loadProfile);
    }
  }, [userRole]);

  useEffect(() => {
    if (!userRole || userRole === 'MINISTRY') return;
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

  useEffect(() => {
    if (!userRole) return;
    const allowedPrefix = ROLE_HOME[userRole];
    if (pathname !== '/dashboard' && !pathname.startsWith(allowedPrefix)) {
      router.replace(allowedPrefix);
    }
  }, [userRole, pathname, router]);

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
  const isEnrolled = Boolean(user?.schoolEnrollments?.length);
  // Un seul établissement : on garde l'affichage habituel (année · filière).
  // Plusieurs : on liste les écoles plutôt que de tronquer un texte trop
  // long (double cursus) dans ce sous-titre compact.
  const enrollmentSummary =
    user?.schoolEnrollments && user.schoolEnrollments.length > 1
      ? user.schoolEnrollments
          .map((enrollment) => enrollment.school?.name)
          .filter(Boolean)
          .join(' + ')
      : user?.schoolEnrollments?.[0]?.enrolledYear;

  if (!userRole) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fbfbff] text-sm text-slate-500">
        Chargement de votre session…
      </div>
    );
  }

  const allowedPrefix = ROLE_HOME[userRole];
  const isOnOwnSection =
    pathname === '/dashboard' || pathname.startsWith(allowedPrefix);
  if (!isOnOwnSection) {
    // L'effet ci-dessus déclenche déjà la redirection ; ce garde de rendu
    // évite en plus d'afficher, même brièvement, le contenu d'une section
    // qui n'appartient pas au rôle courant pendant que la navigation a lieu.
    return (
      <div className="grid min-h-screen place-items-center bg-[#fbfbff] text-sm text-slate-500">
        Redirection…
      </div>
    );
  }

  if (userRole === 'STUDENT') {
    return (
      <div className="min-h-screen bg-background text-foreground lg:flex">
        <MobileTopBar onOpenMenu={() => setMobileMenuOpen(true)} />
        {mobileMenuOpen && (
          <MobileBackdrop onClick={() => setMobileMenuOpen(false)} />
        )}
        <StudentSidebar
          avatarUrl={user?.avatarUrl}
          displayName={displayName}
          initials={initials}
          year={enrollmentSummary}
          gender={user?.gender}
          isEnrolled={isEnrolled}
          onAvatarUpload={(avatarUrl) =>
            setUser((current) => ({ ...current, avatarUrl }))
          }
          onLogout={logout}
          pathname={pathname}
          unreadMessages={unreadMessages}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-7 lg:px-9 lg:py-7 lg:pb-7">
          {children}
        </main>
        <Suspense fallback={null}>
          <MobileBottomNav
            items={
              isEnrolled
                ? [
                    { icon: Home, label: tStudentNav('home'), href: '/dashboard/student' },
                    {
                      icon: BookOpen,
                      label: tStudentNav('coursesShort'),
                      href: '/dashboard/student/courses',
                    },
                    {
                      icon: Mail,
                      label: tStudentNav('messages'),
                      href: '/dashboard/student/messages',
                    },
                    {
                      icon: Settings,
                      label: tStudentNav('profile'),
                      href: '/dashboard/student/settings',
                    },
                  ]
                : [
                    { icon: Home, label: tStudentNav('home'), href: '/dashboard/student' },
                    {
                      icon: Compass,
                      label: tStudentNav('offers'),
                      href: '/dashboard/student/offers',
                    },
                    {
                      icon: ClipboardCheck,
                      label: tStudentNav('applicationsShort'),
                      href: '/dashboard/student/applications',
                    },
                    {
                      icon: Settings,
                      label: tStudentNav('profile'),
                      href: '/dashboard/student/settings',
                    },
                  ]
            }
            composeHref="/dashboard/student/messages?compose=1"
          />
        </Suspense>
      </div>
    );
  }

  if (userRole === 'SCHOOL_ADMIN' || userRole === 'TEACHER') {
    return (
      <div className="min-h-screen bg-background text-foreground lg:flex">
        <MobileTopBar
          onOpenMenu={() => setMobileMenuOpen(true)}
          dark={userRole === 'TEACHER'}
        />
        {mobileMenuOpen && (
          <MobileBackdrop onClick={() => setMobileMenuOpen(false)} />
        )}
        {userRole === 'TEACHER' ? (
          <Suspense fallback={null}>
            <TeacherSidebar
              pathname={pathname}
              displayName={
                displayName === 'Étudiant' ? 'Professeur' : displayName
              }
              onLogout={logout}
              unreadMessages={unreadMessages}
              avatarUrl={user?.avatarUrl}
              onAvatarUpload={(avatarUrl) =>
                setUser((current) => ({ ...current, avatarUrl }))
              }
              mobileOpen={mobileMenuOpen}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <SchoolSidebar
              pathname={pathname}
              displayName={
                displayName === 'Étudiant' ? 'Administrateur' : displayName
              }
              gender={user?.gender}
              onLogout={logout}
              unreadMessages={unreadMessages}
              mobileOpen={mobileMenuOpen}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </Suspense>
        )}
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-7 lg:px-8 lg:py-6 lg:pb-6">
          {children}
        </main>
        <Suspense fallback={null}>
          {userRole === 'TEACHER' ? (
            <MobileBottomNav
              dark
              items={[
                { icon: Home, label: 'Accueil', href: '/dashboard/teacher' },
                {
                  icon: BookOpen,
                  label: 'Cours',
                  href: '/dashboard/teacher?view=courses',
                },
                {
                  icon: Mail,
                  label: 'Messages',
                  href: '/dashboard/teacher?view=messages',
                },
                {
                  icon: Settings,
                  label: 'Profil',
                  href: '/dashboard/teacher?view=settings',
                },
              ]}
              composeHref="/dashboard/teacher?view=messages&compose=1"
            />
          ) : (
            <MobileBottomNav
              items={[
                { icon: Home, label: 'Accueil', href: '/dashboard/school' },
                {
                  icon: BookOpen,
                  label: 'Cours',
                  href: '/dashboard/school/courses',
                },
                {
                  icon: Mail,
                  label: 'Messages',
                  href: '/dashboard/school/messages',
                },
                {
                  icon: Settings,
                  label: 'Profil',
                  href: '/dashboard/school/settings',
                },
              ]}
              composeHref="/dashboard/school/messages?compose=1"
            />
          )}
        </Suspense>
      </div>
    );
  }

  if (userRole === 'ADMIN_GET') {
    return (
      <div className="min-h-screen bg-[#fbfbff] text-slate-900 lg:flex">
        <MobileTopBar onOpenMenu={() => setMobileMenuOpen(true)} />
        {mobileMenuOpen && (
          <MobileBackdrop onClick={() => setMobileMenuOpen(false)} />
        )}
        <Suspense fallback={null}>
          <AdminGetSidebar
            pathname={pathname}
            onLogout={logout}
            unreadMessages={unreadMessages}
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-7 lg:px-8 lg:py-6 lg:pb-6">
          {children}
        </main>
        <Suspense fallback={null}>
          <MobileBottomNav
            items={[
              { icon: Home, label: 'Accueil', href: '/dashboard/admin' },
              {
                icon: Building,
                label: 'Écoles',
                href: '/dashboard/admin/schools',
              },
              {
                icon: Mail,
                label: 'Messages',
                href: '/dashboard/admin?section=messages',
              },
              {
                icon: Settings,
                label: 'Profil',
                href: '/dashboard/admin/settings',
              },
            ]}
            composeHref="/dashboard/admin?section=messages&compose=1"
          />
        </Suspense>
      </div>
    );
  }

  if (userRole === 'MINISTRY') {
    return (
      <div className="min-h-screen bg-[#fbfbff] text-slate-900 lg:flex">
        <MobileTopBar onOpenMenu={() => setMobileMenuOpen(true)} dark />
        {mobileMenuOpen && (
          <MobileBackdrop onClick={() => setMobileMenuOpen(false)} />
        )}
        <Suspense fallback={null}>
          <MinistrySidebar
            pathname={pathname}
            onLogout={logout}
            mobileOpen={mobileMenuOpen}
            onMobileClose={() => setMobileMenuOpen(false)}
          />
        </Suspense>
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-7 lg:px-8 lg:py-6 lg:pb-6">
          {children}
        </main>
        <Suspense fallback={null}>
          <MobileBottomNav
            dark
            items={[
              { icon: Home, label: 'Accueil', href: '/dashboard/ministry' },
              {
                icon: ChartNoAxesCombined,
                label: 'Rapports',
                href: '/dashboard/ministry/reports',
              },
              {
                icon: ShieldCheck,
                label: 'Conformité',
                href: '/dashboard/ministry/compliance',
              },
            ]}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl gap-6 items-start">
        <aside className="sticky top-6 w-72 shrink-0 rounded-3xl bg-gradient-to-b from-indigo-700 via-indigo-800 to-indigo-900 p-5 text-white shadow-2xl shadow-indigo-500/20">
          <div className="mb-5 text-center">
            <p className="text-lg font-bold">GET</p>
            <p className="text-sm text-indigo-200">
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

function MobileTopBar({
  onOpenMenu,
  dark = false,
}: {
  onOpenMenu: () => void;
  dark?: boolean;
}) {
  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden ${dark ? 'border-white/10 bg-indigo-950 text-white' : 'border-border bg-card text-foreground'}`}
    >
      <Logo variant="mark" tone={dark ? 'light' : 'color'} size={32} />
      <button
        onClick={onOpenMenu}
        aria-label="Ouvrir le menu de navigation"
        className={`grid size-9 place-items-center rounded-lg ${dark ? 'bg-white/10' : 'bg-muted'}`}
      >
        <Menu className="size-5" />
      </button>
    </header>
  );
}

function MobileBackdrop({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="animate-backdrop-fade-in fixed inset-0 z-40 bg-black/40 lg:hidden"
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

function MobileCloseButton({
  onClick,
  dark = false,
}: {
  onClick: () => void;
  dark?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label="Fermer le menu"
      className={`absolute right-3 top-3 grid size-8 place-items-center rounded-lg lg:hidden ${dark ? 'bg-white/10 text-white' : 'bg-muted text-muted-foreground'}`}
    >
      <X className="size-4" />
    </button>
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
  unreadMessages,
  avatarUrl,
  onAvatarUpload,
  mobileOpen,
  onMobileClose,
}: {
  pathname: string;
  displayName: string;
  onLogout: () => void;
  unreadMessages: number;
  avatarUrl?: string;
  onAvatarUpload: (url: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
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
      label: 'Mes disponibilités',
      icon: CalendarRange,
      href: '/dashboard/teacher?view=availability',
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
      badge: unreadMessages ? String(unreadMessages) : undefined,
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
    <aside
      className={`${mobileOpen ? 'fixed inset-y-0 right-0 z-50 flex animate-bubble-in' : 'hidden'} flex-col w-64 max-w-[85vw] shrink-0 border-r border-slate-100 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 px-4 py-5 text-white lg:static lg:z-auto lg:flex lg:w-60 lg:min-h-screen lg:max-w-none lg:overflow-y-auto lg:py-6`}
    >
      <MobileCloseButton onClick={onMobileClose} dark />
      <Link href="/dashboard/teacher" className="mb-4 shrink-0 px-3 lg:mb-7">
        <Logo variant="lockup" tone="light" size={40} />
      </Link>
      <div className="mb-3 flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 lg:hidden">
        <AvatarUpload
          currentUrl={avatarUrl}
          endpoint="/teacher/profile/avatar"
          fallbackText={displayName.slice(0, 2).toUpperCase()}
          firstName={displayName.split(' ')[0]}
          lastName={displayName.split(' ').slice(1).join(' ')}
          onUpload={onAvatarUpload}
          size={40}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{displayName}</p>
          <p className="mt-0.5 text-[11px] text-indigo-100">Professeur</p>
        </div>
      </div>
      <p className="mb-2 shrink-0 px-3 text-[9px] font-bold uppercase tracking-wide text-indigo-200">
        Menu professeur
      </p>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavigationActive(currentUrl, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' : 'text-indigo-100 hover:bg-white/10'}`}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="grid size-5 place-items-center rounded-full bg-indigo-400 text-[9px] text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-2 shrink-0 space-y-3 pt-2">
        <div className="hidden rounded-xl border border-white/10 bg-white/5 p-3 lg:block">
          <div className="flex items-center gap-2.5">
            <AvatarUpload
              currentUrl={avatarUrl}
              endpoint="/teacher/profile/avatar"
              fallbackText={displayName.slice(0, 2).toUpperCase()}
              firstName={displayName.split(' ')[0]}
              lastName={displayName.split(' ').slice(1).join(' ')}
              onUpload={onAvatarUpload}
              size={40}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{displayName}</p>
              <p className="mt-1 text-[10px] text-indigo-100">Professeur</p>
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/teacher?view=settings"
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs ${isNavigationActive(currentUrl, '/dashboard/teacher?view=settings') ? 'bg-white/15 text-white' : 'text-indigo-100 hover:text-white'}`}
        >
          <Settings className="size-4" />
          Paramètres
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 px-2 text-xs text-indigo-100 hover:text-rose-300"
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
  gender,
  onLogout,
  unreadMessages,
  mobileOpen,
  onMobileClose,
}: {
  pathname: string;
  displayName: string;
  gender?: string;
  onLogout: () => void;
  unreadMessages: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const currentUrl = useCurrentDashboardUrl(pathname);
  const academic = [
    {
      label: 'Étudiants',
      icon: UsersRound,
      href: '/dashboard/school/students',
    },
    { label: 'Cours', icon: BookOpen, href: '/dashboard/school/courses' },
    { label: 'Classes', icon: Layers, href: '/dashboard/school/classes' },
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
      label: 'Messages',
      icon: Mail,
      href: '/dashboard/school/messages',
      badge: unreadMessages ? String(unreadMessages) : undefined,
    },
    {
      label: 'Rapports & Statistiques',
      icon: ChartNoAxesCombined,
      href: '/dashboard/school/reports',
    },
  ];
  return (
    <aside
      className={`${mobileOpen ? 'fixed inset-y-0 right-0 z-50 flex animate-bubble-in' : 'hidden'} flex-col w-64 max-w-[85vw] shrink-0 border-r border-slate-100 bg-white px-4 py-5 lg:static lg:z-auto lg:flex lg:w-60 lg:min-h-screen lg:max-w-none lg:overflow-y-auto lg:py-6`}
    >
      <MobileCloseButton onClick={onMobileClose} />
      <Link href="/dashboard/school" className="mb-4 shrink-0 px-3 lg:mb-6">
        <Logo variant="lockup" size={40} />
      </Link>
      <div className="mb-3 flex shrink-0 items-center gap-3 rounded-xl border border-slate-100 p-2.5 shadow-sm lg:hidden">
        <DefaultAvatar gender={gender} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{displayName}</p>
          <p className="text-[11px] text-slate-500">Administrateur</p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
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
      <div className="mt-2 shrink-0 space-y-3 pt-2">
        <div className="hidden rounded-xl border border-slate-100 p-3 shadow-sm lg:block">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-indigo-100 text-sm font-black text-indigo-700">
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
        <div className="hidden items-center gap-2 border-t border-slate-100 pt-3 lg:flex">
          <DefaultAvatar gender={gender} size={36} />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{displayName}</p>
            <p className="text-[10px] text-slate-500">Administrateur</p>
          </div>
        </div>
        <div className="hidden rounded-xl bg-indigo-50 p-3 text-indigo-700 lg:block">
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
    <div className="py-2">
      <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
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
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="grid size-5 place-items-center rounded-full bg-indigo-600 text-[10px] text-white">
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
  unreadMessages,
  mobileOpen,
  onMobileClose,
}: {
  pathname: string;
  onLogout: () => void;
  unreadMessages: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const currentUrl = useCurrentDashboardUrl(pathname);
  const global = [
    {
      label: 'Établissements',
      icon: Building,
      href: '/dashboard/admin/schools',
    },
    {
      label: 'Années scolaires',
      icon: CalendarDays,
      href: '/dashboard/admin/academic-years',
    },
    {
      label: 'Conflits professeurs',
      icon: AlertTriangle,
      href: '/dashboard/admin?section=teacher-conflicts',
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
  ];
  const finances = [
    {
      label: 'Transactions',
      icon: WalletCards,
      href: '/dashboard/admin/transactions',
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
      badge: unreadMessages ? String(unreadMessages) : undefined,
    },
    {
      label: 'Annonces',
      icon: Megaphone,
      href: '/dashboard/admin?section=announcements',
    },
  ];
  const siteVitrine = [
    {
      label: 'Contenu général',
      icon: LayoutTemplate,
      href: '/dashboard/admin?section=landing-content',
    },
    {
      label: 'Actualités du site',
      icon: Newspaper,
      href: '/dashboard/admin?section=landing-news',
    },
  ];
  return (
    <aside
      className={`${mobileOpen ? 'fixed inset-y-0 right-0 z-50 flex animate-bubble-in' : 'hidden'} flex-col w-64 max-w-[85vw] shrink-0 border-r border-slate-100 bg-white px-4 py-5 lg:static lg:z-auto lg:flex lg:w-60 lg:min-h-screen lg:max-w-none lg:overflow-y-auto lg:py-6`}
    >
      <MobileCloseButton onClick={onMobileClose} />
      <Link href="/dashboard/admin" className="mb-4 shrink-0 px-3 lg:mb-6">
        <Logo variant="lockup" size={40} />
      </Link>
      <div className="mb-3 flex shrink-0 items-center gap-3 rounded-xl border border-slate-100 p-2.5 shadow-sm lg:hidden">
        <span className="grid size-10 place-items-center rounded-full bg-indigo-100 text-sm font-black text-indigo-700">
          AG
        </span>
        <div>
          <p className="text-sm font-bold">Admin GET</p>
          <p className="text-[11px] text-slate-500">Superadministrateur</p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
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
          label="Site vitrine"
          items={siteVitrine}
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
          ]}
          currentUrl={currentUrl}
        />
        <div className="pt-2">
          <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
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
      <div className="mt-2 shrink-0 space-y-3 pt-2">
        <div className="hidden rounded-xl border border-slate-100 p-3 shadow-sm lg:block">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
              AG
            </span>
            <div>
              <p className="text-sm font-bold">Admin GET</p>
              <p className="text-[10px] text-slate-500">Superadministrateur</p>
            </div>
          </div>
        </div>
        <div className="hidden rounded-xl bg-indigo-50 p-3 text-indigo-700 lg:block">
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
  mobileOpen,
  onMobileClose,
}: {
  pathname: string;
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const currentUrl = useCurrentDashboardUrl(pathname);
  const navigation = [
    {
      label: 'Rapports',
      icon: ChartNoAxesCombined,
      href: '/dashboard/ministry/reports',
    },
    {
      label: 'Conformité',
      icon: ShieldCheck,
      href: '/dashboard/ministry/compliance',
    },
  ];
  return (
    <aside
      className={`${mobileOpen ? 'fixed inset-y-0 right-0 z-50 flex animate-bubble-in' : 'hidden'} flex-col w-64 max-w-[85vw] shrink-0 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 px-4 py-5 text-white lg:static lg:z-auto lg:flex lg:w-60 lg:min-h-screen lg:max-w-none lg:overflow-y-auto lg:py-6`}
    >
      <MobileCloseButton onClick={onMobileClose} dark />
      <Link href="/dashboard/ministry" className="mb-4 shrink-0 px-3 lg:mb-8">
        <Logo variant="lockup" tone="light" size={40} />
      </Link>
      <div className="mb-3 flex shrink-0 items-center gap-3 rounded-xl bg-white/10 p-2.5 lg:hidden">
        <span className="grid size-10 place-items-center rounded-full bg-white text-sm font-black text-indigo-700">
          M
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Ministère MESUPRES</p>
          <p className="text-[11px] text-indigo-200">Administrateur</p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        <MinistryNav
          href="/dashboard/ministry"
          label="Tableau de bord"
          icon={Home}
          active={isNavigationActive(currentUrl, '/dashboard/ministry')}
        />
        <p className="px-3 pb-2 pt-4 text-[9px] font-bold uppercase tracking-wide text-indigo-200/70">
          Pilotage agrégé
        </p>
        {navigation.map((item) => (
          <MinistryNav
            key={item.label}
            {...item}
            active={isNavigationActive(currentUrl, item.href)}
          />
        ))}
      </nav>
      <div className="mt-2 shrink-0 border-t border-white/10 pt-3">
        <div className="hidden items-center gap-3 rounded-xl bg-white/10 p-3 lg:flex">
          <span className="grid size-9 place-items-center rounded-full bg-white text-xs font-black text-indigo-700">
            M
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">Ministère MESUPRES</p>
            <p className="text-[10px] text-indigo-200">Administrateur</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-3 flex w-full items-center gap-2 px-3 text-xs font-semibold text-indigo-100 transition hover:text-white"
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
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${active ? 'bg-indigo-500 text-white shadow-lg shadow-black/20' : 'text-indigo-50 hover:bg-white/10 hover:text-white'}`}
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[10px] text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function StudentSidebar({
  avatarUrl,
  displayName,
  initials,
  year,
  gender,
  isEnrolled,
  onAvatarUpload,
  onLogout,
  pathname,
  unreadMessages,
  mobileOpen,
  onMobileClose,
}: {
  avatarUrl?: string;
  displayName: string;
  initials: string;
  year?: string;
  gender?: string;
  isEnrolled: boolean;
  onAvatarUpload: (url: string) => void;
  onLogout: () => void;
  pathname: string;
  unreadMessages: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const t = useTranslations('StudentNav');

  // Tant qu'aucune école n'a accepté le candidat, le menu ne montre que ce
  // qui le concerne réellement (découvrir, candidater, suivre) : les liens
  // vers cours/emploi du temps/notes/devoirs n'ont aucun contenu avant
  // l'inscription et redirigeraient vers des écrans vides ou trompeurs.
  const items = isEnrolled
    ? [
        { label: t('home'), icon: Home, href: '/dashboard/student' },
        {
          label: t('myJourney'),
          icon: Route,
          href: '/dashboard/student/parcours',
        },
        {
          label: t('myCourses'),
          icon: BookOpen,
          href: '/dashboard/student/courses',
        },
        {
          label: t('schedule'),
          icon: CalendarDays,
          href: '/dashboard/student/schedule',
        },
        {
          label: t('myGrades'),
          icon: ClipboardList,
          href: '/dashboard/student/grades',
        },
        {
          label: t('assignments'),
          icon: FileText,
          href: '/dashboard/student/assignments',
        },
        {
          label: t('finances'),
          icon: WalletCards,
          href: '/dashboard/student/payments',
        },
        {
          label: t('documents'),
          icon: FileText,
          href: '/dashboard/student/documents',
        },
        {
          label: t('messages'),
          icon: Mail,
          href: '/dashboard/student/messages',
          badge: unreadMessages ? String(unreadMessages) : undefined,
        },
        {
          label: t('news'),
          icon: Newspaper,
          href: '/dashboard/student/news',
        },
        {
          label: t('opportunities'),
          icon: BriefcaseBusiness,
          href: '/dashboard/student/opportunities',
        },
        {
          label: t('library'),
          icon: LibraryBig,
          href: '/dashboard/student/library',
        },
        {
          label: t('settings'),
          icon: Settings,
          href: '/dashboard/student/settings',
        },
      ]
    : [
        { label: t('home'), icon: Home, href: '/dashboard/student' },
        {
          label: t('myFile'),
          icon: FileText,
          href: '/dashboard/student/profile',
        },
        {
          label: t('myDocuments'),
          icon: FileText,
          href: '/dashboard/student/documents',
        },
        {
          label: t('offers'),
          icon: Compass,
          href: '/dashboard/student/offers',
        },
        {
          label: t('myApplications'),
          icon: ClipboardCheck,
          href: '/dashboard/student/applications',
        },
        {
          label: t('payments'),
          icon: WalletCards,
          href: '/dashboard/student/payments',
        },
        {
          label: t('messages'),
          icon: Mail,
          href: '/dashboard/student/messages',
          badge: unreadMessages ? String(unreadMessages) : undefined,
        },
        {
          label: t('settings'),
          icon: Settings,
          href: '/dashboard/student/settings',
        },
      ];

  return (
    <aside
      className={`${mobileOpen ? 'fixed inset-y-0 right-0 z-50 flex animate-bubble-in' : 'hidden'} flex-col w-64 max-w-[85vw] shrink-0 border-r border-border bg-card px-4 py-5 lg:static lg:z-auto lg:flex lg:w-60 lg:min-h-screen lg:max-w-none lg:overflow-y-auto lg:py-7`}
    >
      <MobileCloseButton onClick={onMobileClose} />
      <Link href="/dashboard/student" className="mb-4 shrink-0 px-3 lg:mb-7">
        <Logo variant="lockup" size={40} />
      </Link>
      <div className="mb-3 flex shrink-0 items-center gap-2.5 rounded-xl border border-border p-2.5 shadow-sm lg:hidden">
        <AvatarUpload
          currentUrl={avatarUrl}
          endpoint="/students/me/avatar"
          onUpload={onAvatarUpload}
          fallbackText={initials}
          gender={gender}
          firstName={displayName.split(' ')[0]}
          lastName={displayName.split(' ').slice(1).join(' ')}
          size={40}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{displayName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {year || t('enrolledStudent')}
          </p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {items.map(({ label, icon: Icon, href, badge }) => {
          const active =
            href === '/dashboard/student'
              ? pathname === '/dashboard/student'
              : pathname === href.split('?')[0] && !href.includes('?');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-muted-foreground hover:bg-indigo-50 hover:text-indigo-700'}`}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="flex size-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-2 shrink-0 space-y-3 pt-2">
        <div className="hidden rounded-xl border border-border p-3 shadow-sm lg:block">
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
              <p className="truncate text-[11px] text-muted-foreground">
                {year || t('candidate')}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/student/profile"
            className="mt-3 flex items-center justify-between text-xs font-semibold text-indigo-600"
          >
            {t('viewProfile')} <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="hidden rounded-xl bg-indigo-50 p-3 text-indigo-700 lg:block">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Headphones className="size-4" />
            {t('needHelp')}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('helpCenter')}
          </p>
        </div>
        <LanguageSwitcher variant="sidebar" className="w-full justify-center" />
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 px-3 text-xs font-semibold text-muted-foreground hover:text-rose-600"
        >
          <LogOut className="size-4" />
          {t('logout')}
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
