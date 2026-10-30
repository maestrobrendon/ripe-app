-- Feedback answers, gift baskets (paid through Paystack), and streak milestone rewards.
-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('PENDING', 'ACTIVE', 'CLAIMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'GIFT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "giftId" TEXT;

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "mood" INTEGER,
    "nps" INTEGER,
    "loves" TEXT[],
    "improve" TEXT[],
    "weeklyDriver" TEXT,
    "recipeWish" TEXT,
    "message" TEXT,
    "contactOk" BOOLEAN NOT NULL DEFAULT false,
    "contact" TEXT,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "senderId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientContact" TEXT,
    "message" TEXT,
    "design" TEXT NOT NULL DEFAULT 'mint',
    "status" "GiftStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreakReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreakReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_code_key" ON "Gift"("code");

-- CreateIndex
CREATE INDEX "Gift_senderId_createdAt_idx" ON "Gift"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StreakReward_userId_weeks_key" ON "StreakReward"("userId", "weeks");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreakReward" ADD CONSTRAINT "StreakReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

