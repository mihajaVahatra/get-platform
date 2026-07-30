CREATE TABLE "school_subjects" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teacher_school_subjects" (
  "id" TEXT NOT NULL,
  "teacherSchoolId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  CONSTRAINT "teacher_school_subjects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "courses" ADD COLUMN "subjectId" TEXT, ADD COLUMN "programId" TEXT, ADD COLUMN "programLevel" INTEGER;
CREATE UNIQUE INDEX "school_subjects_schoolId_name_key" ON "school_subjects"("schoolId", "name");
CREATE UNIQUE INDEX "teacher_school_subjects_teacherSchoolId_subjectId_key" ON "teacher_school_subjects"("teacherSchoolId", "subjectId");
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_school_subjects" ADD CONSTRAINT "teacher_school_subjects_teacherSchoolId_fkey" FOREIGN KEY ("teacherSchoolId") REFERENCES "teacher_schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_school_subjects" ADD CONSTRAINT "teacher_school_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_programId_fkey" FOREIGN KEY ("programId") REFERENCES "school_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
