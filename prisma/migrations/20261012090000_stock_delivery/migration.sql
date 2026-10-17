-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'LIMITED', 'OUT_OF_STOCK', 'HIDDEN');

-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM ('RECEIVE', 'SALE', 'RETURN', 'WASTE', 'ADJUST', 'COUNT');

-- CreateEnum
CREATE TYPE "DeliveryRunStatus" AS ENUM ('PLANNING', 'OUT', 'DONE');

-- AlterTable
ALTER TABLE "DeliveryZone" ADD COLUMN     "cutoffHour" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "deliveryFee" INTEGER NOT NULL DEFAULT 2000;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryRunId" TEXT,
ADD COLUMN     "runSequence" INTEGER,
ADD COLUMN     "stockTakenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "costPrice" INTEGER,
ADD COLUMN     "reorderPoint" INTEGER,
ADD COLUMN     "stockOnHand" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "StockMovementKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "batchId" TEXT,
    "supplierId" TEXT,
    "unitCost" INTEGER,
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "received" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "unitCost" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestBefore" TIMESTAMP(3),

    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "market" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "fromValue" INTEGER,
    "toValue" INTEGER,
    "reason" TEXT,
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRun" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "riderId" TEXT,
    "status" "DeliveryRunStatus" NOT NULL DEFAULT 'PLANNING',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_at_idx" ON "StockMovement"("productId", "at");

-- CreateIndex
CREATE INDEX "StockMovement_kind_at_idx" ON "StockMovement"("kind", "at");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE INDEX "StockBatch_productId_remaining_idx" ON "StockBatch"("productId", "remaining");

-- CreateIndex
CREATE INDEX "StockBatch_bestBefore_idx" ON "StockBatch"("bestBefore");

-- CreateIndex
CREATE INDEX "PriceChange_productId_at_idx" ON "PriceChange"("productId", "at");

-- CreateIndex
CREATE INDEX "DeliveryRun_day_idx" ON "DeliveryRun"("day");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryRunId_fkey" FOREIGN KEY ("deliveryRunId") REFERENCES "DeliveryRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceChange" ADD CONSTRAINT "PriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: out of season already meant "limited this season" (still on sale).
UPDATE "Product" SET "availability" = 'LIMITED' WHERE "inSeason" = false;
