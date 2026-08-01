CREATE TABLE "announcements" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetClasses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_recipients" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  CONSTRAINT "announcement_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_schoolId_createdAt_idx" ON "announcements"("schoolId", "createdAt");
CREATE UNIQUE INDEX "announcement_recipients_notificationId_key" ON "announcement_recipients"("notificationId");
CREATE UNIQUE INDEX "announcement_recipients_announcementId_userId_key" ON "announcement_recipients"("announcementId", "userId");

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
