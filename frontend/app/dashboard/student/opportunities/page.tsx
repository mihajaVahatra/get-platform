import { StudentPortalView } from '@/components/student-portal/portal-view';
/**
 * Route `/dashboard/student/opportunities` : server component qui délègue tout le rendu
 * (titre, écran "à venir") à `StudentPortalView` pour la vue "opportunités".
 */
export default function Page() { return <StudentPortalView view="opportunities" />; }
