'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardIndexPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

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
      const userRole = payload.role || 'STUDENT';
      setRole(userRole);

      // Redirection dynamique
      const paths: Record<string, string> = {
        STUDENT: '/dashboard/student',
        SCHOOL_ADMIN: '/dashboard/school',
        MINISTRY: '/dashboard/ministry',
        ADMIN_GET: '/dashboard/admin',
      };
      router.push(paths[userRole] || '/dashboard/student');
    } catch {
      router.push('/dashboard/student');
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirection...</p>
    </div>
  );
}
