CREATE TABLE "school_requirements" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'DOCUMENT', "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "school_requirements_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "offer_requirements" (
  "offerId" TEXT NOT NULL, "requirementId" TEXT NOT NULL, "isRequired" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "offer_requirements_pkey" PRIMARY KEY ("offerId", "requirementId")
);
CREATE UNIQUE INDEX "school_requirements_schoolId_name_key" ON "school_requirements"("schoolId", "name");
CREATE INDEX "school_requirements_schoolId_isActive_idx" ON "school_requirements"("schoolId", "isActive");
ALTER TABLE "school_requirements" ADD CONSTRAINT "school_requirements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offer_requirements" ADD CONSTRAINT "offer_requirements_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offer_requirements" ADD CONSTRAINT "offer_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "school_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
