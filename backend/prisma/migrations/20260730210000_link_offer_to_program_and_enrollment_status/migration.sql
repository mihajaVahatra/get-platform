ALTER TABLE "offers" ADD COLUMN "programId" TEXT;
ALTER TABLE "students" ADD COLUMN "enrollmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "offers" ADD CONSTRAINT "offers_programId_fkey" FOREIGN KEY ("programId") REFERENCES "school_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "offers_programId_idx" ON "offers"("programId");
CREATE INDEX "students_enrolledSchoolId_enrollmentStatus_idx" ON "students"("enrolledSchoolId", "enrollmentStatus");
