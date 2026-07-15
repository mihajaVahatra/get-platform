'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Rediriger vers le dashboard étudiant
    router.push('/dashboard/student');
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirection...</p>
    </div>
  );
}
