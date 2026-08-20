import { Cart } from "src/generated/prisma/client";
import { Product } from "./product";

export type UnavailableReason = "DELETED" | "OUT_OF_STOCK";

export interface UnavaliableItem extends Cart{
    reason: UnavailableReason
}

export interface MergedItem extends Cart{
      product: Product;
  unitPrice: number;
  lineTotal: number;
  reason?: string;
}