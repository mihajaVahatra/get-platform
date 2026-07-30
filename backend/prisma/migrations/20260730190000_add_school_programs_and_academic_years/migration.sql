ALTER TABLE "students"
  ADD COLUMN "academicYearId" TEXT,
  ADD COLUMN "programId" TEXT,
  ADD COLUMN "programLevel" INTEGER;

CREATE TABLE "school_programs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "diploma" TEXT NOT NULL,
  "durationYears" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "school_academic_years" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "enrollmentOpensAt" TIMESTAMP(3) NOT NULL,
  "enrollmentClosesAt" TIMESTAMP(3) NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_academic_years_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_programs_schoolId_isActive_idx" ON "school_programs"("schoolId", "isActive");
CREATE UNIQUE INDEX "school_programs_schoolId_name_key" ON "school_programs"("schoolId", "name");
CREATE INDEX "school_academic_years_schoolId_isCurrent_idx" ON "school_academic_years"("schoolId", "isCurrent");
CREATE UNIQUE INDEX "school_academic_years_schoolId_label_key" ON "school_academic_years"("schoolId", "label");

ALTER TABLE "students" ADD CONSTRAINT "students_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "school_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "school_academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school_programs" ADD CONSTRAINT "school_programs_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_academic_years" ADD CONSTRAINT "school_academic_years_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
