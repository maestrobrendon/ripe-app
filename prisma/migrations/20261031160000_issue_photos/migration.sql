-- Photos a customer sends with a problem report (signed links to private images).
-- AlterTable
ALTER TABLE "OrderIssue" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
