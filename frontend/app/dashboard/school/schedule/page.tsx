import { SchoolSchedulePortal } from '@/components/school-portal/schedule-board';

/**
 * Page « Emploi du temps » du tableau de bord établissement (route App Router `/dashboard/school/schedule`).
 * Server component qui affiche le tableau des horaires via `SchoolSchedulePortal`.
 */
export default function SchedulePage() {
  return <SchoolSchedulePortal />;
}
