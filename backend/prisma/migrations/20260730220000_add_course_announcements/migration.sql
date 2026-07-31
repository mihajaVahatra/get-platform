ALTER TABLE "announcements" ADD COLUMN "courseId" TEXT;

CREATE INDEX "announcements_courseId_createdAt_idx"
  ON "announcements"("courseId", "createdAt");

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
