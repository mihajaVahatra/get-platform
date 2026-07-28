CREATE TABLE "teachers" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "schoolId" TEXT NOT NULL,
  "department" TEXT, "specialty" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "courses" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "teacherId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "level" TEXT NOT NULL, "group" TEXT, "credits" INTEGER NOT NULL DEFAULT 0,
  "room" TEXT, "schedule" TEXT, "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "course_enrollments" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "course_chapters" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "position" INTEGER NOT NULL, "isPublished" BOOLEAN NOT NULL DEFAULT false, "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_chapters_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "course_resources" (
  "id" TEXT NOT NULL, "chapterId" TEXT NOT NULL, "title" TEXT NOT NULL, "url" TEXT NOT NULL,
  "type" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_resources_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "evaluations" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL, "type" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3), "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "assignments" (
  "id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL, "instructions" TEXT,
  "dueAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "assignment_submissions" (
  "id" TEXT NOT NULL, "assignmentId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "contentUrl" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "grade" DOUBLE PRECISION, "feedback" TEXT,
  CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "grades" (
  "id" TEXT NOT NULL, "evaluationId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "value" DOUBLE PRECISION NOT NULL,
  "comment" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "teachers_userId_key" ON "teachers"("userId");
CREATE UNIQUE INDEX "courses_schoolId_code_group_key" ON "courses"("schoolId", "code", "group");
CREATE UNIQUE INDEX "course_enrollments_courseId_studentId_key" ON "course_enrollments"("courseId", "studentId");
CREATE UNIQUE INDEX "course_chapters_courseId_position_key" ON "course_chapters"("courseId", "position");
CREATE UNIQUE INDEX "assignment_submissions_assignmentId_studentId_key" ON "assignment_submissions"("assignmentId", "studentId");
CREATE UNIQUE INDEX "grades_evaluationId_studentId_key" ON "grades"("evaluationId", "studentId");
CREATE INDEX "courses_teacherId_isPublished_idx" ON "courses"("teacherId", "isPublished");
CREATE INDEX "course_enrollments_studentId_idx" ON "course_enrollments"("studentId");
CREATE INDEX "evaluations_courseId_scheduledAt_idx" ON "evaluations"("courseId", "scheduledAt");
CREATE INDEX "assignments_courseId_dueAt_idx" ON "assignments"("courseId", "dueAt");
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_resources" ADD CONSTRAINT "course_resources_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "course_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
