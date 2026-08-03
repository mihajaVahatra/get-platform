-- Retire les champs d'inscription à une école unique sur `students`,
-- remplacés par la table `student_enrollments` (un étudiant peut être
-- inscrit dans plusieurs écoles à la fois). Exécuter le script de backfill
-- `prisma/remediation/2026-08-03-backfill-student-enrollments.ts` avant
-- d'appliquer cette migration sur un environnement contenant des données.

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_enrolledSchoolId_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_programId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "students_enrolledSchoolId_enrollmentStatus_idx";

-- DropIndex
DROP INDEX IF EXISTS "students_enrolledSchoolId_idx";

-- AlterTable
ALTER TABLE "students"
  DROP COLUMN IF EXISTS "academicYearId",
  DROP COLUMN IF EXISTS "enrolledSchoolId",
  DROP COLUMN IF EXISTS "enrolledYear",
  DROP COLUMN IF EXISTS "enrollmentStatus",
  DROP COLUMN IF EXISTS "programId",
  DROP COLUMN IF EXISTS "programLevel";
