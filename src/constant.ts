import { OrderStatus } from "./generated/prisma/enums";

export const PRODUCT_FIELDS = `
  _id,
  productName,
  productDescription,
  productPrice,
  discountPrice,
  discountStatus,
  availabilityStatus,
  "slug": slug.current,

  productImages[]{
    caption,
    attribution,
    "url": asset->url
  },

  productCategory[]->{
    _id,
    categoryName
  },

  productSection[]->{
    _id,
    sectionName
  },

  productSize[]->{
    _id,
    sizeName,
    abbreviation
  },

  productColor[]->{
    _id,
    colorName,
    colorCode
  }
`;


export const ALREADY_PAID: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export type StatusResponse = { message: string; isFinal: boolean };
export const CONFIRMED: StatusResponse = {
  message: 'Your order is confirmed.',
  isFinal: true,
};
export const ORDER_STATUS_RESPONSES: Record<OrderStatus, StatusResponse> = {
  PENDING: { message: 'Confirming your payment…', isFinal: false },
  PAID: {
    message: 'Payment successful! Your order is confirmed.',
    isFinal: true,
  },
  PROCESSING: CONFIRMED,
  SHIPPED: CONFIRMED,
  DELIVERED: CONFIRMED,
  EXPIRED: {
    message:
      'Your order expired before payment was received. Please check out again.',
    isFinal: true,
  },
  CANCELLED: { message: 'This order was cancelled.', isFinal: true },
  FAILED: {
    message:
      "Your payment didn't go through and you weren't charged. Please try again.",
    isFinal: true,
  },
  REFUNDED: { message: 'Your payment has been refunded.', isFinal: true },
};

export const REFUND_PENDING_RESPONSE: StatusResponse = {
  message:
    'Your payment arrived after the order closed. A refund is being processed.',
  isFinal: true,
};
