'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function DashboardIndexPage() {
  const router = useRouter();
  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((response) => {
        const userRole = response.data.data.user.role || 'STUDENT';
        // Redirection dynamique
        const paths: Record<string, string> = {
          STUDENT: '/dashboard/student',
          SCHOOL_ADMIN: '/dashboard/school',
          TEACHER: '/dashboard/teacher',
          MINISTRY: '/dashboard/ministry',
          ADMIN_GET: '/dashboard/admin',
        };
        router.replace(paths[userRole] || '/dashboard/student');
      })
      .catch(() => router.replace('/auth/login'));
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirection...</p>
    </div>
  );
}
