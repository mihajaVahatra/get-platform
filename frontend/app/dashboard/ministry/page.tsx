import { Suspense } from 'react';
import { MinistryDashboard } from '@/components/ministry-portal/ministry-dashboard';

/**
 * Page racine du tableau de bord ministère (`/dashboard/ministry`).
 * Se contente d'englober le composant `MinistryDashboard` dans un `Suspense`
 * afin de gérer le chargement initial sans afficher de fallback visible.
 */
export default function MinistryDashboardPage() {
  return (
    <Suspense fallback={null}>
      <MinistryDashboard />
    </Suspense>
  );
}
