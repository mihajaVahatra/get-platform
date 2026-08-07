'use client';

import { Suspense } from 'react';
import { TeacherPortal } from '@/components/teacher-portal/teacher-portal';

export default function TeacherDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
          Chargement du portail professeur…
        </div>
      }
    >
      <TeacherPortal />
    </Suspense>
  );
}
