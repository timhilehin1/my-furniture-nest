import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AddCartDto, UpdateCartDto } from 'src/dto/cart';
import { MergedItem, UnavaliableItem } from 'src/interface/cart';
import { PrismaService } from 'src/prisma/prisma.service';
import { SanityService } from 'src/sanity/sanity.service';

@Injectable()
export class CartService {
  constructor(
    private readonly sanity: SanityService,
    private readonly prisma: PrismaService,
  ) {}
  async addToCart(data: AddCartDto, userId: string) {
    const { productId, quantity } = data;
    const product = await this.sanity.getProductById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }
    const existingItem = await this.prisma.cart.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    if (existingItem) {
      return this.prisma.cart.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: {
            increment: 1,
          },
        },
      });
    }
    return this.prisma.cart.create({
      data: {
        userId,
        productId,
        quantity: quantity ?? 1,
        productName: product.productName,
        imageUrl: product.productImages[0]?.url ?? null,
      },
    });
  }

  async buildCart(userId: string) {
    const cartItems = await this.prisma.cart.findMany({
      where: {
        userId,
      },
    });
    if (cartItems.length === 0) {
      return { items: [], subTotal: 0, unavailableItems: [] };
    }
    const productIds = cartItems.map((item) => item.productId);
    const products = await this.sanity.getAllProductsById(productIds);
    const productMap = new Map(
      products.map((product) => [product._id, product]),
    );
    const mergedItems: MergedItem[] = [];
    const unavailableItems: UnavaliableItem[] = [];
    for (const cartItem of cartItems) {
      const product = productMap.get(cartItem.productId);
      if (!product) {
        unavailableItems.push({ ...cartItem, reason: 'DELETED' });
        continue;
      }
      if (!product.availabilityStatus) {
        unavailableItems.push({ ...cartItem, reason: 'OUT_OF_STOCK' });
        continue;
      }
      let unitPrice: number;
      if (product.discountStatus && product.discountPrice === undefined) {
        console.warn(
          `Product ${product._id} has a discount status of true with a discount price of ${product.discountPrice}`,
        );
      }
      if (product.discountStatus && product.discountPrice !== undefined) {
        unitPrice = product.discountPrice;
      } else {
        unitPrice = product.productPrice;
      }

      const lineTotal = unitPrice * cartItem.quantity;
      mergedItems.push({ ...cartItem, product, unitPrice, lineTotal });
    }
    const subTotal = mergedItems.reduce((total, item) => {
      return total + item.lineTotal;
    }, 0);
    return {
      items: mergedItems,
      subTotal,
      unavailableItems,
    };
  }

  async updateCart(data: UpdateCartDto, productId: string, userId: string) {
    const { quantity } = data;
    const product = await this.sanity.getProductById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }
    if (!quantity) {
      throw new BadRequestException('Invalid quantity');
    }
    if (quantity && quantity <= 0) {
      throw new BadRequestException('Invalid quantity');
    }
    const existingItem = await this.prisma.cart.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    if (!existingItem) {
      throw new NotFoundException('Product not found');
    } else {
      return this.prisma.cart.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: quantity ?? 1,
        },
      });
    }
  }

  async deleteAllCartItem(userId: string) {
    const cartItems = await this.prisma.cart.deleteMany({
      where: {
        userId,
      },
    });
    return {
      message: 'Cart cleared successfully',
      count: cartItems.count,
    };
  }

  async deleteSingleCartItem(productId: string, userId: string) {
    const product = await this.sanity.getProductById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found.`);
    }
    const existingItem = await this.prisma.cart.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
    if (!existingItem) {
      throw new NotFoundException('Product not found');
    }
    return this.prisma.cart.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
  }
}
