'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type UserRole = 'STUDENT' | 'SCHOOL_ADMIN' | 'MINISTRY' | 'ADMIN_GET' | null;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userName, setUserName] = useState('');

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
      // On peut aussi récupérer le nom depuis le payload si présent
      setUserName(payload.firstName || '');
    } catch {
      setUserRole('STUDENT');
    }
  }, []);

  const handleLogout = () => {
    document.cookie = 'accessToken=; path=/; max-age=0';
    router.push('/auth/login');
  };

  const isStudent = userRole === 'STUDENT';
  const isSchoolAdmin = userRole === 'SCHOOL_ADMIN';
  const isMinistry = userRole === 'MINISTRY';
  const isAdminGet = userRole === 'ADMIN_GET';

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
        <h1 className="text-xl font-bold mb-8">GET</h1>
        <nav className="space-y-2">
          {/* ===== SECTION COMMUNE ===== */}
          <Link href="/dashboard" className="block py-2 px-4 rounded hover:bg-gray-700">
            Dashboard
          </Link>

          {/* ===== SECTION ÉTUDIANT ===== */}
          {(isStudent || isAdminGet) && (
            <>
              <div className="pt-4 pb-2 border-t border-gray-700">
                <p className="text-xs text-gray-400 px-4 uppercase tracking-wider">Étudiant</p>
              </div>
              <Link href="/dashboard/student/profile" className="block py-2 px-4 rounded hover:bg-gray-700">
                Mon Profil
              </Link>
              <Link href="/dashboard/student/applications" className="block py-2 px-4 rounded hover:bg-gray-700">
                Mes Candidatures
              </Link>
              <Link href="/dashboard/student/offers" className="block py-2 px-4 rounded hover:bg-gray-700">
                Rechercher des offres
              </Link>
              <Link href="/dashboard/student/payments" className="block py-2 px-4 rounded hover:bg-gray-700">
                Mes Paiements
              </Link>
            </>
          )}

          {/* ===== SECTION ÉCOLE ===== */}
          {(isSchoolAdmin || isAdminGet) && (
            <>
              <div className="pt-4 pb-2 border-t border-gray-700">
                <p className="text-xs text-gray-400 px-4 uppercase tracking-wider">École</p>
              </div>
              <Link href="/dashboard/school" className="block py-2 px-4 rounded hover:bg-gray-700">
                Dashboard École
              </Link>
              <Link href="/dashboard/school/offers" className="block py-2 px-4 rounded hover:bg-gray-700 ml-4">
                Mes offres
              </Link>
              <Link href="/dashboard/school/applications" className="block py-2 px-4 rounded hover:bg-gray-700 ml-4">
                Candidatures reçues
              </Link>
            </>
          )}

          {/* ===== SECTION MINISTÈRE ===== */}
          {(isMinistry || isAdminGet) && (
            <>
              <div className="pt-4 pb-2 border-t border-gray-700">
                <p className="text-xs text-gray-400 px-4 uppercase tracking-wider">Ministère</p>
              </div>
              <Link href="/dashboard/ministry" className="block py-2 px-4 rounded hover:bg-gray-700">
                Dashboard National
              </Link>
              <Link href="/dashboard/ministry/compliance" className="block py-2 px-4 rounded hover:bg-gray-700 ml-4">
                Conformité
              </Link>
              <Link href="/dashboard/ministry/reports" className="block py-2 px-4 rounded hover:bg-gray-700 ml-4">
                Rapports
              </Link>
            </>
          )}

          {/* ===== SECTION ADMIN ===== */}
          {isAdminGet && (
            <>
              <div className="pt-4 pb-2 border-t border-gray-700">
                <p className="text-xs text-gray-400 px-4 uppercase tracking-wider">Administration</p>
              </div>
              <Link href="/dashboard/admin" className="block py-2 px-4 rounded hover:bg-gray-700">
                Admin Dashboard
              </Link>
              <Link href="/dashboard/admin/users" className="block py-2 px-4 rounded hover:bg-gray-700 ml-4">
                Utilisateurs
              </Link>
              <Link href="/dashboard/admin/schools" className="block py-2 px-4 rounded hover:bg-gray-700 ml-4">
                Écoles
              </Link>
            </>
          )}

          {/* ===== DÉCONNEXION ===== */}
          <button
            onClick={handleLogout}
            className="block w-full text-left py-2 px-4 rounded hover:bg-gray-700 mt-8"
          >
            Déconnexion
          </button>
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  );
}
