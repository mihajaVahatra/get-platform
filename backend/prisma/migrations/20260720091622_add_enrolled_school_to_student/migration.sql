-- AlterTable
ALTER TABLE "students" ADD COLUMN     "enrolledSchoolId" TEXT,
ADD COLUMN     "enrolledYear" TEXT;

-- CreateIndex
CREATE INDEX "students_enrolledSchoolId_idx" ON "students"("enrolledSchoolId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_enrolledSchoolId_fkey" FOREIGN KEY ("enrolledSchoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
