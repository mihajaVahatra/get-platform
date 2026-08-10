import { StudentPortalView } from '@/components/student-portal/portal-view';
/**
 * Route `/dashboard/student/news` : server component qui délègue tout le rendu
 * (titre, fil d'actualités `SchoolNewsFeed`) à `StudentPortalView` pour la vue "actualités".
 */
export default function Page() { return <StudentPortalView view="news" />; }
