-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "amounts" JSONB,
ADD COLUMN     "basketSlugs" TEXT[],
ADD COLUMN     "elsewhere" TEXT[],
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "imageAlt" TEXT,
ADD COLUMN     "membersOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minutes" INTEGER,
ADD COLUMN     "onMenu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serves" INTEGER,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "RecipeStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "steps" TEXT[],
ADD COLUMN     "tools" TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Recipe_onMenu_status_sortOrder_idx" ON "Recipe"("onMenu", "status", "sortOrder");

