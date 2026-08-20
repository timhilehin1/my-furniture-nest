import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { SanityClient } from '@sanity/client';
import { PRODUCT_FIELDS } from 'src/constant';
import { Product } from 'src/interface/product';

@Injectable()
export class SanityService {
  constructor(
    @Inject('SANITY_CLIENT')
    private readonly client: SanityClient,
  ) {}

  async getProductById(id: string): Promise<Product | null> {
    if (!id) {
      throw new BadRequestException('Product ID is required');
    }

    try {
      return await this.client.fetch(
        `*[_type == "product" && _id == $id][0]{
          ${PRODUCT_FIELDS}
        }`,
        { id },
      );
    } catch (error) {
      console.error('Sanity getProductById error:', error);

      throw new InternalServerErrorException(
        'Unable to retrieve product',
      );
    }
  }

  async getAllProducts(): Promise<Product[]> {
    try {
      return await this.client.fetch(`
        *[_type == "product"] | order(_createdAt desc){
          ${PRODUCT_FIELDS}
        }
      `);
    } catch (error) {
      console.error('Sanity getAllProducts error:', error);

      throw new InternalServerErrorException(
        'Unable to retrieve products',
      );
    }
  }

  async getAllProductsById(ids: string[]): Promise<Product[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    try {
      return await this.client.fetch<Product[]>(
        `
          *[_type == "product" && _id in $ids]{
            ${PRODUCT_FIELDS}
          }
        `,
        { ids },
      );
    } catch (error) {
      console.error('Sanity getAllProductsById error:', error);

      throw new InternalServerErrorException(
        'Unable to retrieve products',
      );
    }
  }
}