import { TeacherDirectory } from '@/components/school-portal/people-directory';

/**
 * Page « Enseignants » du tableau de bord établissement (route App Router `/dashboard/school/teachers`).
 * Server component qui affiche l'annuaire du personnel enseignant via `TeacherDirectory`.
 */
export default function TeachersPage() {
  return <TeacherDirectory />;
}
