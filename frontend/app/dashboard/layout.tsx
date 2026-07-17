'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AvatarUpload } from '@/components/AvatarUpload';
import { apiClient } from '@/lib/api-client';
import { User, FileText, CreditCard, GraduationCap, Settings, LogOut, LayoutDashboard, School, Building2, ShieldCheck, BarChart3 } from 'lucide-react';

type UserRole = 'STUDENT' | 'SCHOOL_ADMIN' | 'MINISTRY' | 'ADMIN_GET' | null;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('accessToken='))
      ?.split('=')[1];

    if (!token) {
      router.push('/auth/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserRole(payload.role || 'STUDENT');
      setUser((prev) => ({
        ...prev,
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        gender: payload.gender || 'MALE',
      }));
    } catch {
      setUserRole('STUDENT');
    }
  }, []);

  // Charger le profil complet pour les étudiants
  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (userRole === 'STUDENT') {
          const response = await apiClient.get('/students/me');
          const studentData = response.data.data;
          setUser((prev) => ({
            ...prev,
            ...studentData,
            firstName: studentData.firstName || prev?.firstName || '',
            lastName: studentData.lastName || prev?.lastName || '',
            gender: studentData.gender || prev?.gender || 'MALE',
            avatarUrl: studentData.avatarUrl || prev?.avatarUrl || '',
          }));
          const statsRes = await apiClient.get('/students/me/stats');
          setStats(statsRes.data.data);
        }
      } catch (error) {
        console.error('Erreur chargement profil:', error);
      }
    };
    if (userRole) {
      fetchUser();
    }
  }, [userRole]);

  const handleLogout = () => {
    document.cookie = 'accessToken=; path=/; max-age=0';
    router.push('/auth/login');
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const isStudent = userRole === 'STUDENT';
  const isSchoolAdmin = userRole === 'SCHOOL_ADMIN';
  const isMinistry = userRole === 'MINISTRY';
  const isAdminGet = userRole === 'ADMIN_GET';

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || user?.lastName || 'Utilisateur';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto flex gap-6 items-start">
        
        <aside className="sticky top-6 w-72 shrink-0">
          <div className="bg-gradient-to-b from-purple-700 via-purple-800 to-purple-900 rounded-3xl p-5 text-white shadow-2xl shadow-purple-500/20 border border-white/10 backdrop-blur-sm">

            <div className="flex flex-col items-center text-center">
              {/* Avatar uniquement (sans badge) */}
              <AvatarUpload
                currentUrl={user?.avatarUrl}
                endpoint="/students/me/avatar"
                onUpload={(url) => setUser({ ...user, avatarUrl: url })}
                fallbackText={user && getInitials(user.firstName, user.lastName)}
                gender={user?.gender}
                firstName={user?.firstName}
                lastName={user?.lastName}
                size={96}
              />

              <h2 className="text-lg font-bold mt-2">{displayName}</h2>
              <p className="text-purple-200 text-sm capitalize">
                {userRole?.replace('_', ' ')?.toLowerCase() || 'Étudiant'}
              </p>
            </div>

            {isStudent && stats && (
              <div className="grid grid-cols-3 gap-2 text-center text-sm border-t border-white/10 pt-3 mt-3 mb-3">
                <div>
                  <p className="font-bold text-lg">{stats.totalApplications || 0}</p>
                  <p className="text-purple-200 text-[10px]">Candidatures</p>
                </div>
                <div>
                  <p className="font-bold text-lg text-green-300">{stats.acceptedApplications || 0}</p>
                  <p className="text-purple-200 text-[10px]">Acceptées</p>
                </div>
                <div>
                  <p className="font-bold text-lg text-yellow-300">{stats.pendingApplications || 0}</p>
                  <p className="text-purple-200 text-[10px]">En attente</p>
                </div>
              </div>
            )}

            <nav className="space-y-0.5">
              <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>

              {(isStudent || isAdminGet) && (
                <>
                  <div className="text-[10px] text-purple-300 uppercase tracking-wider px-3 pt-2 pb-1">Étudiant</div>
                  <Link href="/dashboard/student/profile" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    <User className="h-4 w-4" /> Profil
                  </Link>
                  <Link href="/dashboard/student/applications" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    <FileText className="h-4 w-4" /> Candidatures
                  </Link>
                  <Link href="/dashboard/student/offers" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    <GraduationCap className="h-4 w-4" /> Offres
                  </Link>
                  <Link href="/dashboard/student/payments" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    <CreditCard className="h-4 w-4" /> Paiements
                  </Link>
                </>
              )}

              {(isSchoolAdmin || isAdminGet) && (
                <>
                  <div className="text-[10px] text-purple-300 uppercase tracking-wider px-3 pt-2 pb-1">École</div>
                  <Link href="/dashboard/school" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    <School className="h-4 w-4" /> Dashboard
                  </Link>
                  <Link href="/dashboard/school/offers" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm pl-8">
                    📝 Offres
                  </Link>
                  <Link href="/dashboard/school/applications" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm pl-8">
                    📋 Candidatures
                  </Link>
                </>
              )}

              {(isMinistry || isAdminGet) && (
                <>
                  <div className="text-[10px] text-purple-300 uppercase tracking-wider px-3 pt-2 pb-1">Ministère</div>
                  <Link href="/dashboard/ministry" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    <BarChart3 className="h-4 w-4" /> Dashboard
                  </Link>
                  <Link href="/dashboard/ministry/compliance" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm pl-8">
                    <ShieldCheck className="h-4 w-4" /> Conformité
                  </Link>
                  <Link href="/dashboard/ministry/reports" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm pl-8">
                    📋 Rapports
                  </Link>
                </>
              )}

              {isAdminGet && (
                <>
                  <div className="text-[10px] text-purple-300 uppercase tracking-wider px-3 pt-2 pb-1">Admin</div>
                  <Link href="/dashboard/admin" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm">
                    <Building2 className="h-4 w-4" /> Dashboard
                  </Link>
                  <Link href="/dashboard/admin/users" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm pl-8">
                    👥 Utilisateurs
                  </Link>
                  <Link href="/dashboard/admin/schools" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm pl-8">
                    🏛️ Écoles
                  </Link>
                </>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-sm w-full text-left text-red-300 mt-2"
              >
                <LogOut className="h-4 w-4" /> Déconnexion
              </button>
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0 bg-white rounded-3xl shadow-sm p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
