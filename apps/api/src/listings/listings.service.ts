import {
  BadRequestException,
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
import { SaveListingDraftDto } from './dto/save-listing-draft.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { defaultListings, demoSellers } from './listings.seed';

type BcryptModule = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
};

type ActingUser = {
  id: string;
  role: string;
};

type ListingCategory = {
  id: string;
  slug: string;
  listingExpiryDays: number;
};

type ListingLifecycleData = {
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  soldAt?: Date | null;
  removedAt?: Date | null;
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeFingerprintValue(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getListingFingerprint(listing: {
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  price: Prisma.Decimal | number | string;
  currency: string;
  location: string;
}) {
  return [
    listing.sellerId,
    listing.categoryId,
    normalizeFingerprintValue(listing.title),
    normalizeFingerprintValue(listing.description),
    listing.price.toString(),
    normalizeFingerprintValue(listing.currency),
    normalizeFingerprintValue(listing.location),
  ].join('|');
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

  private async expireDueListings() {
    await this.prisma.listing.updateMany({
      where: {
        status: ListingStatus.ACTIVE,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: ListingStatus.EXPIRED,
      },
    });
  }

  private getLifecycleDataForStatus(
    status: ListingStatus,
    category: ListingCategory,
  ): ListingLifecycleData {
    const now = new Date();

    if (status === ListingStatus.ACTIVE) {
      return {
        publishedAt: now,
        expiresAt: addDays(now, category.listingExpiryDays),
        soldAt: null,
        removedAt: null,
      };
    }

    if (status === ListingStatus.SOLD) {
      return {
        soldAt: now,
      };
    }

    if (status === ListingStatus.REMOVED || status === ListingStatus.DELETED) {
      return {
        removedAt: now,
      };
    }

    if (status === ListingStatus.DRAFT || status === ListingStatus.PENDING) {
      return {
        publishedAt: null,
        expiresAt: null,
        soldAt: null,
        removedAt: null,
      };
    }

    return {};
  }

  private async resolveCategory(categorySlug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async resolveDraftCategory(categorySlug?: string) {
    if (categorySlug) {
      return this.resolveCategory(categorySlug);
    }

    const category = await this.prisma.category.findFirst({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async getCategorySlugScope(categorySlug: string) {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        parentId: true,
      },
    });
    const selected = categories.find((category) => category.slug === categorySlug);

    if (!selected) {
      return [categorySlug];
    }

    const childrenByParent = new Map<string, typeof categories>();

    for (const category of categories) {
      if (!category.parentId) {
        continue;
      }

      const children = childrenByParent.get(category.parentId) ?? [];
      children.push(category);
      childrenByParent.set(category.parentId, children);
    }

    const scopedSlugs = new Set<string>();
    const queue = [selected];

    while (queue.length) {
      const category = queue.shift();

      if (!category || scopedSlugs.has(category.slug)) {
        continue;
      }

      scopedSlugs.add(category.slug);
      queue.push(...(childrenByParent.get(category.id) ?? []));
    }

    return Array.from(scopedSlugs);
  }

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
          ...this.getLifecycleDataForStatus(listing.status, category),
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
    const category = await this.resolveCategory(createListingDto.categorySlug);
    const clientDraftKey = createListingDto.clientDraftKey?.trim() || undefined;
    const images = toImageCreates(createListingDto.images);
    const status =
      createListingDto.status ??
      (isAdminRole(user.role) ? ListingStatus.ACTIVE : ListingStatus.PENDING);
    const data = {
      clientDraftKey,
      title: createListingDto.title,
      description: createListingDto.description,
      price: new Prisma.Decimal(createListingDto.price),
      currency: createListingDto.currency ?? 'AED',
      location: createListingDto.location,
      status,
      ...this.getLifecycleDataForStatus(status, category),
      attributes: toJsonValue(createListingDto.attributes),
      categoryId: category.id,
      images: images?.length ? { create: images } : undefined,
    };
    const keyedListing = clientDraftKey
      ? await this.prisma.listing.findUnique({
          where: {
            sellerId_clientDraftKey: {
              sellerId: user.id,
              clientDraftKey,
            },
          },
          include: listingInclude,
        })
      : null;

    if (keyedListing && keyedListing.status !== ListingStatus.DRAFT) {
      return withoutListHeavyAttributes(keyedListing);
    }

    const matchingDraft =
      keyedListing ??
      (await this.prisma.listing.findFirst({
        where: {
          sellerId: user.id,
          status: ListingStatus.DRAFT,
          categoryId: category.id,
          title: createListingDto.title,
          description: createListingDto.description,
          price: new Prisma.Decimal(createListingDto.price),
          currency: createListingDto.currency ?? 'AED',
          location: createListingDto.location,
        },
        orderBy: { updatedAt: 'desc' },
        include: listingInclude,
      }));

    if (matchingDraft) {
      return this.prisma.listing.update({
        where: { id: matchingDraft.id },
        data: {
          ...data,
          images: {
            deleteMany: {},
            create: images ?? [],
          },
        },
        include: listingInclude,
      });
    }

    return this.prisma.listing.create({
      data: {
        ...data,
        sellerId: user.id,
      },
      include: listingInclude,
    });
  }

  async saveDraft(user: ActingUser, draftDto: SaveListingDraftDto) {
    const clientDraftKey = draftDto.clientDraftKey.trim();

    if (!clientDraftKey) {
      throw new BadRequestException('Draft key is required');
    }

    const existing = draftDto.listingId
      ? await this.prisma.listing.findUnique({
          where: { id: draftDto.listingId },
        })
      : await this.prisma.listing.findUnique({
          where: {
            sellerId_clientDraftKey: {
              sellerId: user.id,
              clientDraftKey,
            },
          },
        });

    if (existing && existing.sellerId !== user.id && !isAdminRole(user.role)) {
      throw new ForbiddenException('You can only update your own drafts');
    }

    if (existing && existing.status !== ListingStatus.DRAFT) {
      const publishedListing = await this.prisma.listing.findUnique({
        where: { id: existing.id },
        include: listingInclude,
      });

      if (publishedListing) {
        return withoutListHeavyAttributes(publishedListing);
      }

      throw new BadRequestException('Only draft listings can be auto-saved');
    }

    const category = draftDto.categorySlug
      ? await this.resolveCategory(draftDto.categorySlug)
      : existing
        ? await this.prisma.category.findUnique({
            where: { id: existing.categoryId },
          })
        : await this.resolveDraftCategory();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const images = toImageCreates(draftDto.images);
    const baseData = {
      clientDraftKey,
      title: draftDto.title ?? existing?.title ?? 'Untitled draft',
      description: draftDto.description ?? existing?.description ?? '',
      price:
        typeof draftDto.price === 'number'
          ? new Prisma.Decimal(draftDto.price)
          : existing?.price ?? new Prisma.Decimal(0),
      currency: draftDto.currency ?? existing?.currency ?? 'AED',
      location: draftDto.location ?? existing?.location ?? '',
      status: ListingStatus.DRAFT,
      attributes:
        draftDto.attributes === undefined
          ? undefined
          : toJsonValue(draftDto.attributes),
      categoryId: category.id,
    };

    if (existing) {
      return this.prisma.listing.update({
        where: { id: existing.id },
        data: {
          ...baseData,
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

    return this.prisma.listing.create({
      data: {
        ...baseData,
        sellerId: user.id,
        images: images?.length ? { create: images } : undefined,
      },
      include: listingInclude,
    });
  }

  async publishDraft(
    user: ActingUser,
    id: string,
    createListingDto: CreateListingDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    const isAdmin = isAdminRole(user.role);

    if (!isAdmin && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only publish your own drafts');
    }

    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be published');
    }

    const category = await this.resolveCategory(createListingDto.categorySlug);
    const images = toImageCreates(createListingDto.images);
    const status = isAdmin ? ListingStatus.ACTIVE : ListingStatus.PENDING;

    return this.prisma.listing.update({
      where: { id },
      data: {
        title: createListingDto.title,
        description: createListingDto.description,
        price: new Prisma.Decimal(createListingDto.price),
        currency: createListingDto.currency ?? 'AED',
        location: createListingDto.location,
        status,
        ...this.getLifecycleDataForStatus(status, category),
        attributes: toJsonValue(createListingDto.attributes),
        categoryId: category.id,
        images: {
          deleteMany: {},
          create: images ?? [],
        },
      },
      include: listingInclude,
    });
  }

  async findAll(query: QueryListingsDto, includeHidden = false) {
    await this.expireDueListings();
    const categorySlugs = query.categorySlug
      ? await this.getCategorySlugScope(query.categorySlug)
      : undefined;

    const where: Prisma.ListingWhereInput = {
      ...(includeHidden
        ? query.status
          ? { status: query.status }
          : {}
        : { status: ListingStatus.ACTIVE }),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(categorySlugs
        ? {
            category: {
              slug: { in: categorySlugs },
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
    await this.expireDueListings();

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (
      !listing ||
      listing.status === ListingStatus.DELETED ||
      listing.status === ListingStatus.REMOVED ||
      listing.status === ListingStatus.DRAFT
    ) {
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
    let lifecycleCategory: ListingCategory | undefined;

    if (updateListingDto.categorySlug) {
      const category = await this.resolveCategory(updateListingDto.categorySlug);

      categoryId = category.id;
      lifecycleCategory = category;
    }

    const images = toImageCreates(updateListingDto.images);
    const ownerLifecycleStatus =
      updateListingDto.status === ListingStatus.SOLD ||
      updateListingDto.status === ListingStatus.REMOVED ||
      updateListingDto.status === ListingStatus.PAUSED
        ? updateListingDto.status
        : undefined;
    const nextStatus = isAdmin ? updateListingDto.status : ownerLifecycleStatus;

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
        status: nextStatus,
        ...(nextStatus
          ? this.getLifecycleDataForStatus(
              nextStatus,
              lifecycleCategory ??
                (await this.prisma.category.findUnique({
                  where: { id: categoryId },
                })) ??
                (await this.resolveDraftCategory()),
            )
          : {}),
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
    await this.expireDueListings();

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

    const publishedFingerprints = new Set(
      listings
        .filter((listing) => listing.status !== ListingStatus.DRAFT)
        .map((listing) => getListingFingerprint(listing)),
    );
    const visibleListings = listings.filter(
      (listing) =>
        listing.status !== ListingStatus.DRAFT ||
        !publishedFingerprints.has(getListingFingerprint(listing)),
    );

    return visibleListings.map((listing) => withoutListHeavyAttributes(listing));
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
        status: isAdminRole(user.role) ? ListingStatus.DELETED : ListingStatus.REMOVED,
        removedAt: new Date(),
      },
      include: listingInclude,
    });
  }

  async moderate(id: string, dto: ModerateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: dto.status,
        ...this.getLifecycleDataForStatus(dto.status, listing.category),
      },
      include: listingInclude,
    });
  }
}
