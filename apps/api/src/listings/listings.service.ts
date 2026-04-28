import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

function toJsonValue(value: Record<string, unknown> | undefined) {
  return value as Prisma.InputJsonValue | undefined;
}

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createListingDto: CreateListingDto) {
    const category = await this.prisma.category.findUnique({
      where: { slug: createListingDto.categorySlug },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.listing.create({
      data: {
        title: createListingDto.title,
        description: createListingDto.description,
        price: new Prisma.Decimal(createListingDto.price),
        currency: createListingDto.currency ?? 'AED',
        location: createListingDto.location,
        status: createListingDto.status ?? ListingStatus.DRAFT,
        attributes: toJsonValue(createListingDto.attributes),
        sellerId: userId,
        categoryId: category.id,
      },
      include: {
        category: true,
        seller: true,
      },
    });
  }

  async findAll(query: QueryListingsDto) {
    const where: Prisma.ListingWhereInput = {
      ...(query.status ? { status: query.status } : { status: ListingStatus.ACTIVE }),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.categorySlug
        ? {
            category: {
              slug: query.categorySlug,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { location: { contains: query.search, mode: 'insensitive' } },
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

    return this.prisma.listing.findMany({
      where,
      orderBy,
      take: query.take ?? 25,
      include: {
        category: true,
        seller: true,
      },
    });
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        category: true,
        seller: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  async update(userId: string, id: string, updateListingDto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
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
        status: updateListingDto.status,
        attributes: toJsonValue(updateListingDto.attributes),
        categoryId,
      },
      include: {
        category: true,
        seller: true,
      },
    });
  }

  async findMine(userId: string) {
    return this.prisma.listing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
      },
    });
  }
}
