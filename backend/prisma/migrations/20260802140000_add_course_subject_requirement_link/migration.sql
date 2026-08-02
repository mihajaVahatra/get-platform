-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "subjectRequirementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "courses_subjectRequirementId_key" ON "courses"("subjectRequirementId");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectRequirementId_fkey" FOREIGN KEY ("subjectRequirementId") REFERENCES "subject_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
