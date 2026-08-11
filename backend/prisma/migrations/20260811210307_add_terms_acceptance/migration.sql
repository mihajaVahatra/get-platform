-- AlterTable
ALTER TABLE "pending_registrations" ADD COLUMN     "acceptedTermsAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "acceptedTermsVersion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN     "acceptedTermsVersion" TEXT;

