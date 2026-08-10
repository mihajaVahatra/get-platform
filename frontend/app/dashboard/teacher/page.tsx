'use client';

import { Suspense } from 'react';
import { TeacherPortal } from '@/components/teacher-portal/teacher-portal';

/**
 * Page racine du tableau de bord professeur (route `/dashboard/teacher`).
 *
 * Se contente d'englober le composant `TeacherPortal` (qui contient toute la
 * logique et les vues du portail) dans un `Suspense` avec un état de
 * chargement dédié, le temps que les données et sous-composants soient prêts.
 */
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
