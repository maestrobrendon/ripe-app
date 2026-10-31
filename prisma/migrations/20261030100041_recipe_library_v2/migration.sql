-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "alsoStrongIn" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "healthNote" TEXT,
ADD COLUMN     "healthTagline" TEXT,
ADD COLUMN     "nutrition" JSONB,
ADD COLUMN     "referenceImageUrl" TEXT,
ADD COLUMN     "serveWith" TEXT,
ADD COLUMN     "sourceSite" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "subtype" TEXT;
