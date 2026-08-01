-- A teacher is a platform identity; an assignment links that teacher to an institution.
CREATE TABLE "teacher_schools" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "department" TEXT,
  "specialty" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teacher_schools_pkey" PRIMARY KEY ("id")
);

-- Preserve every existing teacher-to-school association before removing the old column.
INSERT INTO "teacher_schools" ("id", "teacherId", "schoolId", "department", "specialty", "isActive", "createdAt", "updatedAt")
SELECT
  md5("id" || ':' || "schoolId"),
  "id",
  "schoolId",
  "department",
  "specialty",
  true,
  "createdAt",
  "updatedAt"
FROM "teachers";

CREATE UNIQUE INDEX "teacher_schools_teacherId_schoolId_key" ON "teacher_schools"("teacherId", "schoolId");
CREATE INDEX "teacher_schools_schoolId_isActive_idx" ON "teacher_schools"("schoolId", "isActive");

ALTER TABLE "teacher_schools" ADD CONSTRAINT "teacher_schools_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_schools" ADD CONSTRAINT "teacher_schools_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teachers" DROP CONSTRAINT "teachers_schoolId_fkey";
DROP INDEX IF EXISTS "teachers_schoolId_idx";
ALTER TABLE "teachers" DROP COLUMN "schoolId", DROP COLUMN "department", DROP COLUMN "specialty";
