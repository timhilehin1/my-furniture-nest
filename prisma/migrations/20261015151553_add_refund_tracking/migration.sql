-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_REQUIRED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "note" TEXT;
