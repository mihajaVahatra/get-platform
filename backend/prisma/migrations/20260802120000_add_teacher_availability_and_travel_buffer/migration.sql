-- CreateTable
CREATE TABLE "teacher_availabilities" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "date" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_travel_buffers" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolAId" TEXT NOT NULL,
    "schoolBId" TEXT NOT NULL,
    "minutesBuffer" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_travel_buffers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_availabilities_teacherId_idx" ON "teacher_availabilities"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_travel_buffers_teacherId_schoolAId_schoolBId_key" ON "teacher_travel_buffers"("teacherId", "schoolAId", "schoolBId");

-- AddForeignKey
ALTER TABLE "teacher_availabilities" ADD CONSTRAINT "teacher_availabilities_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_travel_buffers" ADD CONSTRAINT "teacher_travel_buffers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_travel_buffers" ADD CONSTRAINT "teacher_travel_buffers_schoolAId_fkey" FOREIGN KEY ("schoolAId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_travel_buffers" ADD CONSTRAINT "teacher_travel_buffers_schoolBId_fkey" FOREIGN KEY ("schoolBId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add teacherId nullable first (existing rows need a backfill before NOT NULL)
ALTER TABLE "course_slots" ADD COLUMN "teacherId" TEXT;

-- Backfill from the owning course's teacher
UPDATE "course_slots" cs
SET "teacherId" = c."teacherId"
FROM "courses" c
WHERE c.id = cs."courseId";

-- Now safe to enforce NOT NULL
ALTER TABLE "course_slots" ALTER COLUMN "teacherId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "course_slots_teacherId_dayOfWeek_idx" ON "course_slots"("teacherId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "course_slots" ADD CONSTRAINT "course_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Anti double-booking guarantee: a teacher cannot have two overlapping
-- CourseSlot rows on the same day, across ANY school (teacherId is global
-- to the Teacher, not scoped by school). This is what makes "two schools
-- can't book the same teacher at the same time" a database-level fact,
-- not just an application-level check that could race under concurrency.
--
-- startTime/endTime are cast to "minutes since midnight" via split_part +
-- integer cast (both IMMUTABLE) rather than a timestamp cast (which
-- Postgres considers STABLE, not IMMUTABLE, since it depends on the
-- session's DateStyle setting) — required because GiST exclusion
-- constraints only accept immutable expressions.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "course_slots" ADD CONSTRAINT "no_teacher_double_booking"
  EXCLUDE USING gist (
    "teacherId" WITH =,
    "dayOfWeek" WITH =,
    int4range(
      (split_part("startTime", ':', 1)::int * 60 + split_part("startTime", ':', 2)::int),
      (split_part("endTime", ':', 1)::int * 60 + split_part("endTime", ':', 2)::int)
    ) WITH &&
  );
