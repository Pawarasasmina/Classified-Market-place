import { PrismaClient } from '@prisma/client';
import { defaultCategories } from '../src/categories/categories.seed';
import { defaultListings, demoSellers } from '../src/listings/listings.seed';

const prisma = new PrismaClient();

async function seedCategories() {
  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        schemaDefinition: category.schemaDefinition,
        isActive: true,
      },
      create: category,
    });
  }
}

async function seedDemoSellers() {
  for (const seller of demoSellers) {
    await prisma.user.upsert({
      where: { email: seller.email },
      update: {
        displayName: seller.displayName,
        phone: seller.phone,
        phoneVerified: seller.phoneVerified,
        emailVerified: seller.emailVerified,
        role: seller.role,
      },
      create: {
        email: seller.email,
        displayName: seller.displayName,
        phone: seller.phone,
        phoneVerified: seller.phoneVerified,
        emailVerified: seller.emailVerified,
        role: seller.role,
        passwordHash: null,
      },
    });
  }
}

async function seedDefaultListings() {
  for (const listing of defaultListings) {
    const seller = await prisma.user.findUnique({
      where: { email: listing.sellerEmail },
      select: { id: true },
    });
    const category = await prisma.category.findUnique({
      where: { slug: listing.categorySlug },
      select: { id: true },
    });

    if (!seller || !category) {
      continue;
    }

    const existingListing = await prisma.listing.findFirst({
      where: {
        sellerId: seller.id,
        categoryId: category.id,
        title: listing.title,
      },
      select: { id: true },
    });

    if (existingListing) {
      await prisma.listing.update({
        where: { id: existingListing.id },
        data: {
          description: listing.description,
          price: listing.price,
          currency: listing.currency,
          location: listing.location,
          status: listing.status,
          attributes: listing.attributes,
        },
      });
      continue;
    }

    await prisma.listing.create({
      data: {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        currency: listing.currency,
        location: listing.location,
        status: listing.status,
        attributes: listing.attributes,
        sellerId: seller.id,
        categoryId: category.id,
      },
    });
  }
}

async function main() {
  await seedCategories();
  await seedDemoSellers();
  await seedDefaultListings();

  console.log(
    JSON.stringify(
      {
        ok: true,
        seededCategories: defaultCategories.length,
        seededSellers: demoSellers.length,
        seededListings: defaultListings.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
