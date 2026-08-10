import { ClassDirectory } from '@/components/school-portal/class-directory';
/**
 * Page « Classes » du tableau de bord établissement (route App Router `/dashboard/school/classes`).
 * Server component (pas de `'use client'`) qui délègue tout l'affichage et la logique
 * au composant `ClassDirectory` (annuaire des classes de l'établissement).
 */
export default function SchoolClassesPage() { return <ClassDirectory />; }
