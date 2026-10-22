-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeliveryDay" ADD VALUE 'TUESDAY';
ALTER TYPE "DeliveryDay" ADD VALUE 'THURSDAY';
ALTER TYPE "DeliveryDay" ADD VALUE 'SATURDAY';
ALTER TYPE "DeliveryDay" ADD VALUE 'SUNDAY';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyPush" BOOLEAN NOT NULL DEFAULT true;

