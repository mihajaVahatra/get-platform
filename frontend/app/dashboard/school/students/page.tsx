import { StudentImportDirectory } from '@/components/school-portal/student-import-directory';
/**
 * Page « Étudiants » du tableau de bord établissement (route App Router `/dashboard/school/students`).
 * Server component qui affiche l'annuaire/import des étudiants via `StudentImportDirectory`.
 */
export default function StudentsPage() { return <StudentImportDirectory />; }
