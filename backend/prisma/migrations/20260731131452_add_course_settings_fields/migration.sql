-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "allowGroupMessages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnPublish" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "welcomeMessage" TEXT;
