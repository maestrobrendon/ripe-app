-- Kachi's memory: lasting things a customer told her, which they can see and delete in Account.
-- CreateEnum
CREATE TYPE "KachiMemoryKind" AS ENUM ('ALLERGY', 'DISLIKE', 'LIKE', 'HOUSEHOLD', 'ROUTINE', 'OTHER');

-- CreateTable
CREATE TABLE "KachiMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "KachiMemoryKind" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KachiMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KachiMemory_userId_idx" ON "KachiMemory"("userId");

-- AddForeignKey
ALTER TABLE "KachiMemory" ADD CONSTRAINT "KachiMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
