import { Suspense } from 'react';
import { MinistryDashboard } from '@/components/ministry-portal/ministry-dashboard';

export default function MinistryDashboardPage() {
  return (
    <Suspense fallback={null}>
      <MinistryDashboard />
    </Suspense>
  );
}
