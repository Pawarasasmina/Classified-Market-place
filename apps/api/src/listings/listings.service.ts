import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingImageInputDto } from './dto/listing-image-input.dto';
import { ModerateListingDto } from './dto/moderate-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { defaultListings, demoSellers } from './listings.seed';

type BcryptModule = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
};

type ActingUser = {
  id: string;
  role: string;
};

const bcryptLib = bcrypt as BcryptModule;

const safeSellerSelect = {
  id: true,
  email: true,
  googleId: true,
  phone: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  location: true,
  emailVerified: true,
  phoneVerified: true,
  role: true,
  reputationScore: true,
  createdAt: true,
  updatedAt: true,
};

const listingInclude = {
  category: true,
  seller: {
    select: safeSellerSelect,
  },
  images: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
};

function isAdminRole(role: string) {
  return role.toUpperCase() === 'ADMIN';
}

function toJsonValue(value: Record<string, unknown> | undefined) {
  return value as Prisma.InputJsonValue | undefined;
}

function toImageCreates(images: ListingImageInputDto[] | undefined) {
  return images?.map((image, index) => ({
    url: image.url,
    altText: image.altText,
    sortOrder: index,
    isPrimary: image.isPrimary ?? index === 0,
  }));
}

function withoutListHeavyAttributes<
  T extends { attributes: Prisma.JsonValue | null },
>(listing: T) {
  if (
    !listing.attributes ||
    typeof listing.attributes !== 'object' ||
    Array.isArray(listing.attributes) ||
    !('__photos' in listing.attributes)
  ) {
    return listing;
  }

  const { __photos: _photos, ...attributes } = listing.attributes as Record<
    string,
    unknown
  >;

  return {
    ...listing,
    attributes,
  };
}

@Injectable()
export class ListingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  async seedDefaults() {
    const listingCount = await this.prisma.listing.count();

    if (listingCount > 0) {
      return;
    }

    for (const seller of demoSellers) {
      const passwordHash = await bcryptLib.hash(seller.password, 10);

      await this.prisma.user.upsert({
        where: { email: seller.email },
        update: {
          displayName: seller.displayName,
          phone: seller.phone,
          phoneVerified: seller.phoneVerified,
          emailVerified: seller.emailVerified,
          role: seller.role,
          passwordHash,
        },
        create: {
          email: seller.email,
          displayName: seller.displayName,
          phone: seller.phone,
          phoneVerified: seller.phoneVerified,
          emailVerified: seller.emailVerified,
          role: seller.role,
          passwordHash,
        },
      });
    }

    for (const listing of defaultListings) {
      const seller = await this.prisma.user.findUnique({
        where: { email: listing.sellerEmail },
      });
      const category = await this.prisma.category.findUnique({
        where: { slug: listing.categorySlug },
      });

      if (!seller || !category) {
        continue;
      }

      await this.prisma.listing.create({
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
          images: {
            create: listing.imageUrls.map((url, index) => ({
              url,
              altText: listing.title,
              sortOrder: index,
              isPrimary: index === 0,
            })),
          },
        },
      });
    }
  }

  async create(user: ActingUser, createListingDto: CreateListingDto) {
    const category = await this.prisma.category.findUnique({
      where: { slug: createListingDto.categorySlug },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const images = toImageCreates(createListingDto.images);

    return this.prisma.listing.create({
      data: {
        title: createListingDto.title,
        description: createListingDto.description,
        price: new Prisma.Decimal(createListingDto.price),
        currency: createListingDto.currency ?? 'AED',
        location: createListingDto.location,
        status:
          createListingDto.status ??
          (isAdminRole(user.role) ? ListingStatus.ACTIVE : ListingStatus.PENDING),
        attributes: toJsonValue(createListingDto.attributes),
        sellerId: user.id,
        categoryId: category.id,
        images: images?.length ? { create: images } : undefined,
      },
      include: listingInclude,
    });
  }

  async findAll(query: QueryListingsDto, includeHidden = false) {
    const where: Prisma.ListingWhereInput = {
      ...(includeHidden
        ? query.status
          ? { status: query.status }
          : {}
        : { status: ListingStatus.ACTIVE }),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.categorySlug
        ? {
            category: {
              slug: query.categorySlug,
            },
          }
        : {}),
      ...(query.location
        ? {
            location: {
              contains: query.location,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.minPrice != null || query.maxPrice != null
        ? {
            price: {
              ...(query.minPrice != null
                ? { gte: new Prisma.Decimal(query.minPrice) }
                : {}),
              ...(query.maxPrice != null
                ? { lte: new Prisma.Decimal(query.maxPrice) }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                location: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ListingOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const listings = await this.prisma.listing.findMany({
      where,
      orderBy,
      take: query.take ?? 25,
      include: listingInclude,
    });

    return listings.map((listing) => withoutListHeavyAttributes(listing));
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  async update(user: ActingUser, id: string, updateListingDto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    const isAdmin = isAdminRole(user.role);

    if (!isAdmin && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only update your own listings');
    }

    let categoryId = listing.categoryId;

    if (updateListingDto.categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: updateListingDto.categorySlug },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      categoryId = category.id;
    }

    const images = toImageCreates(updateListingDto.images);

    return this.prisma.listing.update({
      where: { id },
      data: {
        title: updateListingDto.title,
        description: updateListingDto.description,
        price:
          typeof updateListingDto.price === 'number'
            ? new Prisma.Decimal(updateListingDto.price)
            : undefined,
        currency: updateListingDto.currency,
        location: updateListingDto.location,
        status: isAdmin ? updateListingDto.status : undefined,
        attributes: toJsonValue(updateListingDto.attributes),
        categoryId,
        images:
          images === undefined
            ? undefined
            : {
                deleteMany: {},
                create: images,
              },
      },
      include: listingInclude,
    });
  }

  async findMine(userId: string) {
    const listings = await this.prisma.listing.findMany({
      where: {
        sellerId: userId,
        status: {
          not: ListingStatus.DELETED,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: listingInclude,
    });

    return listings.map((listing) => withoutListHeavyAttributes(listing));
  }

  async remove(user: ActingUser, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    if (!isAdminRole(user.role) && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only delete your own listings');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.DELETED,
      },
      include: listingInclude,
    });
  }

  async moderate(id: string, dto: ModerateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: listingInclude,
    });
  }
}
