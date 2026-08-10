import { CourseDirectory } from '@/components/school-portal/course-directory';

/**
 * Page « Cours » du tableau de bord établissement (route App Router `/dashboard/school/courses`).
 * Server component qui affiche l'annuaire des cours via `CourseDirectory`.
 */
export default function CoursesPage() {
  return <CourseDirectory />;
}
