CREATE TABLE "course_slots" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "room" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_slots_courseId_dayOfWeek_startTime_endTime_room_key"
  ON "course_slots"("courseId", "dayOfWeek", "startTime", "endTime", "room");
CREATE INDEX "course_slots_courseId_idx" ON "course_slots"("courseId");
CREATE INDEX "course_slots_dayOfWeek_room_startTime_endTime_idx"
  ON "course_slots"("dayOfWeek", "room", "startTime", "endTime");

ALTER TABLE "course_slots" ADD CONSTRAINT "course_slots_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convert only the documented, unambiguous schedule format used by the seed.
-- Other free-text values deliberately remain unmigrated for manual review.
INSERT INTO "course_slots" ("id", "courseId", "dayOfWeek", "startTime", "endTime", "room", "createdAt", "updatedAt")
SELECT
  md5(c."id" || ':' || occurrence.ordinality::text),
  c."id",
  CASE occurrence.match[1]
    WHEN 'Lun' THEN 1 WHEN 'Mar' THEN 2 WHEN 'Mer' THEN 3 WHEN 'Jeu' THEN 4
    WHEN 'Ven' THEN 5 WHEN 'Sam' THEN 6 WHEN 'Dim' THEN 7
  END,
  occurrence.match[2],
  occurrence.match[3],
  COALESCE(c."room", 'Salle non renseignée'),
  c."createdAt",
  c."updatedAt"
FROM "courses" c
CROSS JOIN LATERAL regexp_matches(
  c."schedule",
  '(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)[[:space:]]+([0-2][0-9]:[0-5][0-9])[[:space:]]*[–-][[:space:]]*([0-2][0-9]:[0-5][0-9])',
  'g'
) WITH ORDINALITY AS occurrence(match, ordinality)
WHERE c."schedule" IS NOT NULL;
