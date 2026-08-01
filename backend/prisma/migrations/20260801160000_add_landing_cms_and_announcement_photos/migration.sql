-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "financial_partners" ADD COLUMN     "logo" TEXT;

-- CreateTable
CREATE TABLE "landing_news_posts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ACTUALITÉ',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "landing_news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_news_posts_isPublished_displayOrder_idx" ON "landing_news_posts"("isPublished", "displayOrder");

