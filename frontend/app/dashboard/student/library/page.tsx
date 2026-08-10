import { StudentPortalView } from '@/components/student-portal/portal-view';
/**
 * Route `/dashboard/student/library` : server component qui délègue tout le rendu
 * (titre, contenu "à venir") à `StudentPortalView` pour la vue "bibliothèque".
 */
export default function Page() { return <StudentPortalView view="library" />; }
