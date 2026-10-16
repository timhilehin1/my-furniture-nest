import 'dotenv/config';
import { createClient } from '@sanity/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Starting stock for products Sanity marks as available. Sanity has no stock
// count, so edit real numbers afterwards in `npx prisma studio`.
const DEFAULT_QUANTITY = 10;

// Same client setup as PrismaService, but built by hand: no Nest DI here.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Same settings as the SANITY_CLIENT factory in sanity.module.ts.
// useCdn is off so the seed reads the latest published data.
const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION,
  useCdn: false,
});

async function main() {
  const products = await sanity.fetch<
    { _id: string; availabilityStatus: boolean }[]
  >(`*[_type == "product"]{ _id, availabilityStatus }`);

  let created = 0;
  for (const product of products) {
    const existing = await prisma.inventory.findUnique({
      where: { productId: product._id },
    });

    // update: {} so re-running never overwrites quantity, reserved or sold.
    await prisma.inventory.upsert({
      where: { productId: product._id },
      create: {
        productId: product._id,
        quantity: product.availabilityStatus ? DEFAULT_QUANTITY : 0,
      },
      update: {},
    });

    if (!existing) created++;
  }

  console.log(
    `Seeded inventory: ${created} created, ${products.length - created} already existed.`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
