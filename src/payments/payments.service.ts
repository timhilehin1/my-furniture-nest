import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALREADY_PAID } from 'src/constant';
import { Prisma } from 'src/generated/prisma/client';
import { OrderStatus, PaymentStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async initiatePayment(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
    });
    if (!order) {
      throw new BadRequestException(`Order with id  ${orderId} not found.`);
    }
    if (order.userId !== userId) {
      throw new BadRequestException(
        `Order with ${orderId} does not belong to user.`,
      );
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order with id ${orderId} is not pending.`);
    }
    const total = order.total * 100;
    const paystackSecretKey = this.configService.get('PAYSTACK_SECRET_KEY');
    const paystackBaseUrl = this.configService.get('PAYSTACK_BASE_URL');
    const headers = {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    };
    const paystackResponse = await fetch(
      `${paystackBaseUrl}/transaction/initialize`,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          amount: total,
          currency: 'NGN',
          reference: orderId,
          email: order.email,
        }),
      },
    );
    const paystackData = await paystackResponse.json();
    if (!paystackData.status) {
      throw new BadRequestException(
        `${paystackData.message}, next step:${paystackData.meta?.nextStep}`,
      );
    }
    return {
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      reference: paystackData.data.reference,
    };
  }

  async handleWebhook(rawBody: Buffer) {
    //anything coming here means paystack has charged and they want to reconcile
    // convert raw json to Javastring object
    const event = JSON.parse(rawBody.toString());
    if (event.event !== 'charge.success') {
      return { received: true };
    }
    // The signature proves Paystack sent this
    // Check the fields once here; everything below can trust `reference` and `amount`.
    const reference = event.data?.reference;
    const amount = event.data?.amount;
    if (
      typeof reference !== 'string' ||
      reference.length === 0 ||
      !Number.isInteger(amount)
    ) {
      console.error('Malformed Paystack webhook payload', {
        reference,
        amount,
      });
      return { received: true };
    }
    // fetch order with its items, if order is not found, early return
    const order = await this.prisma.order.findUnique({
      where: {
        id: reference,
      },
      include: { orderItems: true },
    });
    if (!order) {
      return { received: true };
    }
    //okay anything that comes here has been charged by paystack and is calling us to confirm, so if
    if (order.status !== OrderStatus.PENDING) {
      //paid already, dont bother
      //consider every other status as a refund required becuase customer hasnt gotten value and paystack has charged them, so we need to refund them
      if (ALREADY_PAID.includes(order.status)) {
        return { received: true };
      }
      await this.recordPaymentNeedingRefund(
        order.id,
        reference,
        amount,
        `Payment arrived after order was ${order.status}`,
      );
      return { received: true };
    }
    if (amount !== order.total * 100) {
      await this.recordPaymentNeedingRefund(
        order.id,
        reference,
        amount,
        `Charged ${event.data.amount / 100}, order total is ${order.total}`,
      );
      return { received: true };
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.updateMany({
          where: {
            id: reference,
            status: OrderStatus.PENDING,
          },
          data: {
            status: OrderStatus.PAID,
          },
        });
        if (updatedOrder.count === 0) {
          return { received: true };
        }
        for (const item of order.orderItems) {
          const orderItemResult = await tx.inventory.updateMany({
            where: {
              productId: item.productId,
              reserved: { gte: item.quantity },
            },
            data: {
              reserved: { decrement: item.quantity },
              sold: { increment: item.quantity },
            },
          });
          if (orderItemResult.count === 0) {
            throw new Error('Reservation missing');
          }
        }

        //delete all items in cart for customer
        await tx.cart.deleteMany({
          where: {
            userId: order.userId,
          },
        });

        await tx.payment.create({
          data: {
            orderId: order.id,
            paystackReference: reference,
            amount: order.total,
            status: PaymentStatus.SUCCESS,
          },
        });
      });
      return { received: true };
    } catch (err: any) {
      if (err.message === 'Reservation missing') {
        await this.recordPaymentNeedingRefund(
          order.id,
          reference,
          amount,
          'Reservation missing when payment arrived',
        );
        return { received: true };
      } else {
        throw err;
      }
    }
  }

  /**
   * Records money Paystack collected for an order we can't fulfil, so an admin can refund it.
   * Safe to call repeatedly with the same reference: only one row is ever written.
   */
  private async recordPaymentNeedingRefund(
    orderId: string,
    reference: string,
    amountKobo: number,
    note: string,
  ): Promise<void> {
    const existingPayment = await this.prisma.payment.findUnique({
      where: { paystackReference: reference },
    });
    if (existingPayment) return;

    try {
      await this.prisma.payment.create({
        data: {
          orderId,
          paystackReference: reference,
          amount: amountKobo / 100,
          status: PaymentStatus.REFUND_REQUIRED,
          note,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }

    console.error(
      `REFUND NEEDED: order ${orderId}, reference ${reference}: ${note}`,
    );
  }
}
