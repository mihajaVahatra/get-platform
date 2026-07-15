'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('accessToken='))
      ?.split('=')[1];

    if (!token) {
      router.push('/auth/login');
    }
  }, []);

  const handleLogout = () => {
    document.cookie = 'accessToken=; path=/; max-age=0';
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
        <h1 className="text-xl font-bold mb-8">GET</h1>
        <nav className="space-y-2">
          <Link href="/dashboard" className="block py-2 px-4 rounded hover:bg-gray-700">
            Dashboard
          </Link>
          <Link href="/dashboard/student/profile" className="block py-2 px-4 rounded hover:bg-gray-700">
            Mon Profil
          </Link>
          <Link href="/dashboard/student/applications" className="block py-2 px-4 rounded hover:bg-gray-700">
            Mes Candidatures
          </Link>
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
