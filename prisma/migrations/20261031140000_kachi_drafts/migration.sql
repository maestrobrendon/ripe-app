-- Kachi's weekly basket suggestions: changes she proposes for a delivery date, which the customer accepts or declines.
-- CreateEnum
CREATE TYPE "KachiDraftStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "KachiDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "basketId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "KachiDraftStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "recipeSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "KachiDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KachiDraft_userId_status_idx" ON "KachiDraft"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KachiDraft_basketId_deliveryDate_key" ON "KachiDraft"("basketId", "deliveryDate");

-- AddForeignKey
ALTER TABLE "KachiDraft" ADD CONSTRAINT "KachiDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KachiDraft" ADD CONSTRAINT "KachiDraft_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "Basket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
