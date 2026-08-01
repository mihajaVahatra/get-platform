-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "examDate" TIMESTAMP(3),
    "registrationDeadline" TIMESTAMP(3),
    "capacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitions_schoolId_status_idx" ON "competitions"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_programId_fkey" FOREIGN KEY ("programId") REFERENCES "school_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
