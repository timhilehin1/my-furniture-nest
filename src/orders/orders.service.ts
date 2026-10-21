import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CartService } from 'src/cart/cart.service';
import { ORDER_STATUS_RESPONSES, REFUND_PENDING_RESPONSE } from 'src/constant';
import { CheckoutDto } from 'src/dto/order.dto';
import { OrderStatus, PaymentStatus } from 'src/generated/prisma/browser';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class OrdersService {
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
      },
    });
    if (existingOrder) {
      throw new ConflictException(
        `An existing pending order already exists for this user`,
      );
    }

    //use a transaction that acceps a callback to ccreate an atomic operation either everything goes or nothing goes at all, that is why we wrapped the order creation and orderItem creation in a transaction, so if one fails the other will not be created
    const newOrder = await this.prisma.$transaction(async (tx) => {
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

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredOrders() {
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      include: { orderItems: true },
      take: 100,
    });
    console.log('expired orders:', expiredOrders.length);

    for (const order of expiredOrders) {
      await this.prisma.$transaction(async (tx) => {
        const expiredResult = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.PENDING,
          },
          data: {
            status: OrderStatus.EXPIRED,
          },
        });

        if (expiredResult.count === 0) return;

        for (const item of order.orderItems) {
          await tx.inventory.updateMany({
            where: {
              productId: item.productId,
              reserved: { gte: item.quantity },
            },
            data: {
              reserved: { decrement: item.quantity },
            },
          });
        }
      });
    }
  }
}
