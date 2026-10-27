import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CartService } from 'src/cart/cart.service';
import {
  EVERY_15_MINUTES,
  ORDER_STATUS_RESPONSES,
  REFUND_PENDING_RESPONSE,
} from 'src/constant';
import { CheckoutDto, GetOrdersQueryDto } from 'src/dto/order.dto';
import { Prisma } from 'src/generated/prisma/client';
import { OrderStatus, PaymentStatus } from 'src/generated/prisma/browser';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly configService: ConfigService,
  ) {}

  async createOrder(userId: string, data: CheckoutDto) {
    const cart = await this.cartService.buildCart(userId);

    if (cart.unavailableItems && cart.unavailableItems.length > 0) {
      throw new BadRequestException(
        `Some items in the cart are unavailable for user ${userId}.`,
      );
    }
    if (cart.items.length === 0) {
      throw new BadRequestException(
        `No items found in the cart for user ${userId}.`,
      );
    }

    const existingOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingOrder) {
      throw new ConflictException({
        message: 'An existing pending order already exists for this user',
        orderId: existingOrder.id,
        expiresAt: existingOrder.expiresAt,
      });
    }

    //use a transaction that acceps a callback to ccreate an atomic operation either everything goes or nothing goes at all, that is why we wrapped the order creation and orderItem creation in a transaction, so if one fails the other will not be created
    const newOrder = await this.prisma.$transaction(async (tx) => {
      // expire this user's stale pending order inline so the one-pending-order index can't fail before the cron runs
      const staleOrder = await tx.order.findFirst({
        where: {
          userId,
          status: OrderStatus.PENDING,
          expiresAt: { lte: new Date() },
        },
        include: { orderItems: true },
      });
      if (staleOrder) {
        await this.expireOrder(tx, staleOrder);
      }

      //check if item exists, reserve an item and reduce quantity so users don't pay for an item that is out of stock
      for (const item of cart.items) {
        const reservedRows = await tx.$executeRaw`
        UPDATE "Inventory"
        SET reserved = reserved + ${item.quantity}
        WHERE "productId" = ${item.productId}
        AND quantity - reserved - sold >= ${item.quantity}
        `;
        if (reservedRows === 0) {
          throw new BadRequestException(`${item.productName} is out of stock`);
        }
      }
      const expiryMinutes = Number(
        this.configService.get('ORDER_EXPIRY_MINUTES'),
      );

      // create an order in the order table with the details from the checkout dto and the subtotal from the cart
      const createdOrder = await tx.order.create({
        data: {
          userId,
          subtotal: cart.subTotal,
          total: cart.subTotal,
          shippingAddress: data.shippingAddress,
          shippingCity: data.shippingCity,
          shippingState: data.shippingState,
          shippingZipcode: data.shippingZipcode ?? '',
          shippingCountry: data.shippingCountry,
          phone: data.phone,
          email: data.email,
          expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000), // Set expiration time to 15 minutes from now
        },
      });

      //simple map operation to have order items in one array to be created in the orderItem table
      const orderItemsData = cart.items.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        productName: item.productName ?? '',
        imageUrl: item.imageUrl,
        lineTotal: item.lineTotal,
      }));

      // create order items
      // map over order items so they can be successfully created in the orderItem table
      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      return {
        createdOrder,
        orderItems: orderItemsData,
        message: 'Order created successfully.',
      };
    });
    return newOrder;
  }

  async getOrderStatus(userId: string, orderId: string) {
    //check if user is allow to check status of this order and set query to return only status
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: {
        status: true,
        payments: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }
    const paymentStatus = existingOrder.payments[0]?.status;
    const response =
      paymentStatus === PaymentStatus.REFUND_REQUIRED
        ? REFUND_PENDING_RESPONSE
        : ORDER_STATUS_RESPONSES[existingOrder.status];
    return { status: existingOrder.status, ...response };
  }

  async getOrders(query: GetOrdersQueryDto, userId: string) {
    // prisma  uses take and skip for its pagination
    // our parameter is limit and page
    //so when i pass limit. I am telling the server the amount of rows I want
    // when i pass page, it is returnning the order based on the limit
    // page 1, limit 2 means break all items into 2 items per group and the page returns the order
    // page 0 limit 10 will throw an error becuase page must be at least 1
    //page 2 limit 2 means give me 2 items but on the second grup, meaning if we have 5 titems, I will get 2 items
    //page 5 limit 10. will go to the 5th group and give me the 10 items in that group. skipping 40
    const where = { userId, status:query.status };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          shippingAddress: true,
          shippingCity: true,
          shippingState: true,
          shippingCountry: true,
          orderItems: {
            select: {
              productName: true,
              imageUrl: true,
              quantity: true,
              lineTotal: true,
            },
          },
          payments: {
            select: { status: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    const data = orders.map(({payments, ...order})=>({
      ...order,
      paymentStatus: payments[0]?.status ?? null,
    }))
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Cron(EVERY_15_MINUTES)
  async releaseExpiredOrders() {
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      include: { orderItems: true },
      take: 100,
    });
    this.logger.log(`expired orders: ${expiredOrders.length}`);

    for (const order of expiredOrders) {
      await this.prisma.$transaction((tx) => this.expireOrder(tx, order));
    }
  }

  private async expireOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      orderItems: { productId: string; quantity: number }[];
    },
  ) {
    const expiredResult = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.EXPIRED },
    });
    if (expiredResult.count === 0) return;

    for (const item of order.orderItems) {
      const released = await tx.inventory.updateMany({
        where: { productId: item.productId, reserved: { gte: item.quantity } },
        data: { reserved: { decrement: item.quantity } },
      });
      if (released.count === 0) {
        this.logger.warn(
          `Could not release ${item.quantity} reserved for product ${item.productId} (order ${order.id})`,
        );
      }
    }
  }
}
