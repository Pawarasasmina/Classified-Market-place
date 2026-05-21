import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  BoostPlacement,
  BoostStatus,
  ListingStatus,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MAX_LISTING_IMAGES } from '../media/media.constants';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
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

type ExistingListingImage = {
  url: string;
  mediaAssetId?: string | null;
};

type PreparedListingImage = {
  url: string;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
  mediaAssetId?: string;
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
  boosts: {
    where: {
      status: BoostStatus.ACTIVE,
    },
    orderBy: [{ startsAt: 'desc' as const }],
  },
};

type ListingWithIncludes = Prisma.ListingGetPayload<{
  include: typeof listingInclude;
}>;

const boostPlacementPriority = [
  BoostPlacement.SEARCH_TOP,
  BoostPlacement.CATEGORY_TOP,
  BoostPlacement.FEATURED,
];

function isAdminRole(role: string) {
  return role.toUpperCase() === 'ADMIN';
}

function toJsonValue(value: Record<string, unknown> | undefined) {
  return value as Prisma.InputJsonValue | undefined;
}

function hasModeratedListingChanges(dto: UpdateListingDto) {
  return [
    dto.title,
    dto.description,
    dto.price,
    dto.currency,
    dto.location,
    dto.categorySlug,
    dto.attributes,
    dto.images,
  ].some((value) => value !== undefined);
}

function buildActiveBoostWhere(
  now: Date,
  placement?: BoostPlacement,
): Prisma.BoostListRelationFilter {
  return {
    some: {
      status: BoostStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
      ...(placement ? { placement } : {}),
    },
  };
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
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService?: MediaService,
    private readonly notifications?: NotificationsService,
  ) {}

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

    const images = await this.prepareListingImages(
      user.id,
      createListingDto.images,
    );

    const listing = await this.prisma.listing.create({
      data: {
        title: createListingDto.title,
        description: createListingDto.description,
        price: new Prisma.Decimal(createListingDto.price),
        currency: createListingDto.currency ?? 'AED',
        location: createListingDto.location,
        status: isAdminRole(user.role)
          ? (createListingDto.status ?? ListingStatus.ACTIVE)
          : ListingStatus.PENDING,
        attributes: toJsonValue(createListingDto.attributes),
        sellerId: user.id,
        categoryId: category.id,
        images: images?.length
          ? { create: images.map((image) => this.toListingImageCreate(image)) }
          : undefined,
      },
      include: listingInclude,
    });

    await this.attachPreparedImagesToListing(listing.id, images);

    return listing;
  }

  async findAll(query: QueryListingsDto, includeHidden = false) {
    const now = new Date();
    const activeBoostWhere = buildActiveBoostWhere(now, query.boostPlacement);
    const take = query.take ?? 25;
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
              OR: [
                { slug: query.categorySlug },
                { parent: { slug: query.categorySlug } },
              ],
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
              {
                title: { contains: query.search, mode: 'insensitive' as const },
              },
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

    if (includeHidden) {
      const listings = await this.prisma.listing.findMany({
        where,
        orderBy,
        take,
        include: listingInclude,
      });

      return listings.map((listing) => withoutListHeavyAttributes(listing));
    }

    const boostedListings: ListingWithIncludes[] = [];
    const boostedIds = new Set<string>();
    const placements = query.boostPlacement
      ? [query.boostPlacement]
      : boostPlacementPriority;

    for (const placement of placements) {
      if (boostedListings.length >= take) {
        break;
      }

      const placementBoostWhere = buildActiveBoostWhere(now, placement);
      const placementBoostedListings = await this.prisma.listing.findMany({
        where: {
          ...where,
          ...(boostedIds.size ? { id: { notIn: [...boostedIds] } } : {}),
          boosts: placementBoostWhere,
        },
        orderBy,
        take: take - boostedListings.length,
        include: {
          ...listingInclude,
          boosts: {
            where: placementBoostWhere.some,
            orderBy: [{ endsAt: 'asc' as const }],
          },
        },
      });

      for (const listing of placementBoostedListings) {
        boostedIds.add(listing.id);
      }

      boostedListings.push(...placementBoostedListings);
    }

    const normalListings =
      boostedListings.length >= take
        ? []
        : await this.prisma.listing.findMany({
            where: {
              ...where,
              id: { notIn: [...boostedIds] },
            },
            orderBy,
            take: take - boostedListings.length,
            include: listingInclude,
          });

    const listings = [...boostedListings, ...normalListings].slice(0, take);

    return listings.map((listing) => withoutListHeavyAttributes(listing));
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  async findOneForUser(user: ActingUser, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    if (!isAdminRole(user.role) && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only view your own draft listings');
    }

    return listing;
  }

  async update(
    user: ActingUser,
    id: string,
    updateListingDto: UpdateListingDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: true },
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

    const images = await this.prepareListingImages(
      user.id,
      updateListingDto.images,
      listing.images ?? [],
    );
    const shouldResubmitForModeration =
      !isAdmin && hasModeratedListingChanges(updateListingDto);

    const updatedListing = await this.prisma.listing.update({
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
        status: isAdmin
          ? updateListingDto.status
          : shouldResubmitForModeration
            ? ListingStatus.PENDING
            : undefined,
        attributes: toJsonValue(updateListingDto.attributes),
        categoryId,
        images:
          images === undefined
            ? undefined
            : {
                deleteMany: {},
                create: images.map((image) => this.toListingImageCreate(image)),
              },
      },
      include: listingInclude,
    });

    await this.attachPreparedImagesToListing(updatedListing.id, images);

    return updatedListing;
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

  async moderate(user: { id: string }, id: string, dto: ModerateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const updatedListing = await this.prisma.listing.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: listingInclude,
    });

    if (listing.status !== updatedListing.status) {
      try {
        await this.notifications?.notifyListingStatusChanged({
          userId: updatedListing.sellerId,
          actorId: user.id,
          listingId: updatedListing.id,
          listingTitle: updatedListing.title,
          status: updatedListing.status,
        });
      } catch (error) {
        this.logger.warn(
          `Could not persist listing moderation notification for ${id}`,
        );
      }
    }

    return updatedListing;
  }

  private async prepareListingImages(
    userId: string,
    images: ListingImageInputDto[] | undefined,
    existingImages: ExistingListingImage[] = [],
  ) {
    if (images === undefined) {
      return undefined;
    }

    if (images.length > MAX_LISTING_IMAGES) {
      throw new BadRequestException(
        `A listing can have up to ${MAX_LISTING_IMAGES} images`,
      );
    }

    if (!images.length) {
      return [];
    }

    const primaryIndex = Math.max(
      images.findIndex((image) => image.isPrimary),
      0,
    );

    return Promise.all(
      images.map(async (image, index) => {
        const resolvedImage = await this.resolveListingImage(
          userId,
          image,
          existingImages,
        );

        return {
          ...resolvedImage,
          altText: image.altText?.trim() || undefined,
          sortOrder: index,
          isPrimary: index === primaryIndex,
        } satisfies PreparedListingImage;
      }),
    );
  }

  private async resolveListingImage(
    userId: string,
    image: ListingImageInputDto,
    existingImages: ExistingListingImage[],
  ) {
    if (image.assetId) {
      const asset = await this.requireMediaService().getOwnedListingImageAsset(
        userId,
        image.assetId,
      );

      return { url: asset.url, mediaAssetId: asset.id };
    }

    const url = image.url?.trim();

    if (!url) {
      throw new BadRequestException('Listing image is missing an upload');
    }

    if (url.startsWith('data:image/')) {
      const asset =
        await this.requireMediaService().createListingImageAssetFromDataUrl(
          userId,
          url,
        );

      return { url: asset.url, mediaAssetId: asset.id };
    }

    const existingImage = existingImages.find((item) => item.url === url);

    if (existingImage) {
      return {
        url: existingImage.url,
        mediaAssetId: existingImage.mediaAssetId ?? undefined,
      };
    }

    throw new BadRequestException(
      'Upload listing images before attaching them',
    );
  }

  private toListingImageCreate(image: PreparedListingImage) {
    return {
      url: image.url,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      mediaAsset: image.mediaAssetId
        ? { connect: { id: image.mediaAssetId } }
        : undefined,
    };
  }

  private async attachPreparedImagesToListing(
    listingId: string,
    images: PreparedListingImage[] | undefined,
  ) {
    if (images === undefined) {
      return;
    }

    const assetIds =
      images?.flatMap((image) =>
        image.mediaAssetId ? [image.mediaAssetId] : [],
      ) ?? [];

    await this.mediaService?.attachImagesToListing(listingId, assetIds);
  }

  private requireMediaService() {
    if (!this.mediaService) {
      throw new BadRequestException('Image uploads are not configured');
    }

    return this.mediaService;
  }
}
