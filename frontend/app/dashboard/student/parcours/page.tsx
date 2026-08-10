import { StudentPortalView } from '@/components/student-portal/portal-view';
/**
 * Route `/dashboard/student/parcours` : server component qui délègue tout le rendu
 * (tableau de bord de progression pédagogique) à `StudentPortalView` pour la vue "parcours".
 */
export default function Page() { return <StudentPortalView view="parcours" />; }
