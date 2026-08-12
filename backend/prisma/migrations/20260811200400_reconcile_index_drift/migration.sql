-- DropIndex
DROP INDEX "offers_programId_idx";

-- CreateIndex
CREATE INDEX "course_resources_chapterId_idx" ON "course_resources"("chapterId");

-- CreateIndex
CREATE INDEX "grades_studentId_idx" ON "grades"("studentId");

