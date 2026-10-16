-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "reserved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sold" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expiresAt" TIMESTAMP(3);
ALTER TABLE "Inventory" ADD CONSTRAINT "inventory_reserved_non_negative" CHECK (reserved >= 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "inventory_sold_non_negative" CHECK (sold >= 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "inventory_not_oversold" CHECK (reserved + sold <= quantity);

