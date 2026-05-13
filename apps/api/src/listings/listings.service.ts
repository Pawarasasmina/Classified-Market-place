import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingMediaDto } from './dto/listing-media.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingStatusDto } from './dto/update-listing-status.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

const MAX_LISTING_MEDIA = 3;
const MAX_SINGLE_MEDIA_BYTES = 1_500_000;
const MAX_COMBINED_MEDIA_BYTES = 4_500_000;

const mediaExtensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type StoredMediaAsset = {
  absolutePath: string;
  createData: {
    originalFileName: string;
    storageKey: string;
    publicUrl: string;
    mimeType: string;
    byteSize: number;
    width?: number;
    height?: number;
    sortOrder: number;
    isPrimary: boolean;
  };
};

const listingInclude = {
  category: true,
  seller: true,
  media: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
} satisfies Prisma.ListingInclude;

function toJsonValue(value: Record<string, unknown> | undefined) {
  return value as Prisma.InputJsonValue | undefined;
}

function markSaved<T>(listing: T) {
  return {
    ...listing,
    saved: true,
  };
}

function removeReservedListingAttributes(
  attributes: Record<string, unknown> | undefined,
) {
  if (!attributes) {
    return attributes;
  }

  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => key !== '__photos'),
  );
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim() || 'listing-photo';

  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}

function isPrivilegedRole(role: string | undefined) {
  const normalizedRole = role?.trim().toLowerCase();
  return normalizedRole === 'admin' || normalizedRole === 'moderator';
}

function normalizePrimitiveAttributeValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed === '') {
      return undefined;
    }

    if (trimmed === 'true') {
      return true;
    }

    if (trimmed === 'false') {
      return false;
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  private getMediaBaseUrl() {
    return (
      process.env.MARKETPLACE_MEDIA_BASE_URL ??
      `http://127.0.0.1:${process.env.PORT ?? '3001'}`
    ).replace(/\/+$/, '');
  }

  private getUploadRootDir() {
    return (
      process.env.MARKETPLACE_MEDIA_UPLOAD_DIR ??
      join(process.cwd(), 'uploads', 'listings')
    );
  }

  private async ensureUploadDir() {
    await fs.mkdir(this.getUploadRootDir(), { recursive: true });
  }

  private validateMediaPayload(media: ListingMediaDto[] | undefined) {
    if (!media?.length) {
      return [];
    }

    if (media.length > MAX_LISTING_MEDIA) {
      throw new BadRequestException(
        `A listing can have up to ${MAX_LISTING_MEDIA} images.`,
      );
    }

    const totalBytes = media.reduce((sum, item) => sum + item.byteSize, 0);

    if (totalBytes > MAX_COMBINED_MEDIA_BYTES) {
      throw new BadRequestException(
        'The selected images are too large to upload together.',
      );
    }

    const tooLargeAsset = media.find(
      (item) => item.byteSize > MAX_SINGLE_MEDIA_BYTES,
    );

    if (tooLargeAsset) {
      throw new BadRequestException(
        `${tooLargeAsset.fileName} exceeds the maximum image size.`,
      );
    }

    const primaryAssets = media.filter((item) => item.isPrimary);

    if (primaryAssets.length > 1) {
      throw new BadRequestException(
        'Only one listing image can be marked as primary.',
      );
    }

    return media
      .map((item, index) => ({
        ...item,
        sortOrder: index,
        isPrimary: primaryAssets.length === 0 ? index === 0 : item.isPrimary,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private async writeListingMediaFiles(
    listingId: string,
    media: ListingMediaDto[] | undefined,
  ) {
    const normalizedMedia = this.validateMediaPayload(media);

    if (!normalizedMedia.length) {
      return [];
    }

    await this.ensureUploadDir();

    const uploadRootDir = this.getUploadRootDir();
    const mediaBaseUrl = this.getMediaBaseUrl();
    const listingDir = join(uploadRootDir, listingId);

    await fs.mkdir(listingDir, { recursive: true });

    const storedAssets: StoredMediaAsset[] = [];

    try {
      for (const asset of normalizedMedia) {
        const extension =
          mediaExtensionByMimeType[asset.mimeType.toLowerCase()];

        if (!extension) {
          throw new BadRequestException(
            'Only JPEG, PNG, and WEBP images are supported.',
          );
        }

        const buffer = Buffer.from(asset.base64Data, 'base64');

        if (!buffer.length) {
          throw new BadRequestException(
            'A listing image was empty after decode.',
          );
        }

        if (buffer.length > MAX_SINGLE_MEDIA_BYTES) {
          throw new BadRequestException(
            `${asset.fileName} exceeds the maximum image size.`,
          );
        }

        const fileId = randomUUID();
        const safeFileName = sanitizeFileName(asset.fileName);
        const fileName = `${fileId}.${extension}`;
        const storageKey = `listings/${listingId}/${fileName}`;
        const absolutePath = join(listingDir, fileName);

        await fs.writeFile(absolutePath, buffer);

        storedAssets.push({
          absolutePath,
          createData: {
            originalFileName: safeFileName,
            storageKey,
            publicUrl: `${mediaBaseUrl}/uploads/${storageKey.replace(/\\/g, '/')}`,
            mimeType: asset.mimeType,
            byteSize: buffer.length,
            width: asset.width,
            height: asset.height,
            sortOrder: asset.sortOrder,
            isPrimary: asset.isPrimary,
          },
        });
      }
    } catch (error) {
      await Promise.all(
        storedAssets.map((asset) =>
          fs.unlink(asset.absolutePath).catch(() => undefined),
        ),
      );
      throw error;
    }

    return storedAssets;
  }

  private async cleanupFiles(paths: string[]) {
    await Promise.all(
      paths.map((absolutePath) =>
        fs.unlink(absolutePath).catch(() => undefined),
      ),
    );
  }

  private async ensureUserCanPublish(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneVerified: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phoneVerified) {
      throw new ForbiddenException(
        'Verify your phone number before publishing a listing.',
      );
    }
  }

  private assertPriceRange(query: QueryListingsDto) {
    if (
      typeof query.minPrice === 'number' &&
      typeof query.maxPrice === 'number' &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException(
        'Minimum price cannot be greater than maximum price.',
      );
    }
  }

  private parseAttributeFilters(attributeFilters: string | undefined) {
    if (!attributeFilters) {
      return [];
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(attributeFilters);
    } catch {
      throw new BadRequestException('Attribute filters must be valid JSON.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestException('Attribute filters must be a JSON object.');
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(
        ([key, value]) =>
          [key.trim(), normalizePrimitiveAttributeValue(value)] as const,
      )
      .filter(
        (entry): entry is readonly [string, string | number | boolean] =>
          Boolean(entry[0]) && entry[1] !== undefined,
      );

    return entries;
  }

  private async validateAttributeFilterKeys(
    categorySlug: string | undefined,
    attributeFilterEntries: ReadonlyArray<
      readonly [string, string | number | boolean]
    >,
  ) {
    if (!attributeFilterEntries.length) {
      return;
    }

    if (!categorySlug) {
      throw new BadRequestException(
        'Attribute filters require a categorySlug filter.',
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
      select: {
        schemaDefinition: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const schemaFields = Array.isArray(
      (
        category.schemaDefinition as {
          fields?: Array<{ key?: unknown }>;
        } | null
      )?.fields,
    )
      ? (
          category.schemaDefinition as {
            fields: Array<{ key?: unknown }>;
          }
        ).fields
      : [];
    const allowedKeys = new Set(
      schemaFields
        .map((field) => (typeof field.key === 'string' ? field.key.trim() : ''))
        .filter(Boolean),
    );

    if (!allowedKeys.size) {
      throw new BadRequestException(
        'This category does not expose filterable attributes yet.',
      );
    }

    const unsupportedKey = attributeFilterEntries.find(
      ([key]) => !allowedKeys.has(key),
    )?.[0];

    if (unsupportedKey) {
      throw new BadRequestException(
        `Unsupported attribute filter "${unsupportedKey}" for this category.`,
      );
    }
  }

  private canViewListing(
    listing: {
      sellerId: string;
      status: ListingStatus;
    },
    viewer?: {
      id: string;
      role?: string;
    },
  ) {
    if (listing.status === ListingStatus.ACTIVE) {
      return true;
    }

    if (!viewer) {
      return false;
    }

    return viewer.id === listing.sellerId || isPrivilegedRole(viewer.role);
  }

  private resolveListingStatusFilter(
    query: QueryListingsDto,
    viewer?: {
      id: string;
      role?: string;
    },
  ) {
    if (isPrivilegedRole(viewer?.role)) {
      return query.status ? { equals: query.status } : undefined;
    }

    const ownerScopedQuery =
      Boolean(viewer?.id) && query.sellerId && viewer?.id === query.sellerId;

    if (ownerScopedQuery) {
      return query.status ? { equals: query.status } : undefined;
    }

    if (query.status && query.status !== ListingStatus.ACTIVE) {
      throw new ForbiddenException(
        'Only moderators or the listing owner can browse non-public listing statuses.',
      );
    }

    return { equals: ListingStatus.ACTIVE };
  }

  private resolveNextSellerStatus(
    currentStatus: ListingStatus,
    action: UpdateListingStatusDto['action'],
  ) {
    switch (action) {
      case 'publish':
        if (
          currentStatus === ListingStatus.DRAFT ||
          currentStatus === ListingStatus.EXPIRED
        ) {
          return ListingStatus.ACTIVE;
        }
        break;
      case 'archive':
        if (currentStatus === ListingStatus.ACTIVE) {
          return ListingStatus.EXPIRED;
        }
        break;
      case 'mark_sold':
        if (currentStatus === ListingStatus.ACTIVE) {
          return ListingStatus.SOLD;
        }
        break;
      case 'delete':
        if (currentStatus !== ListingStatus.REMOVED) {
          return ListingStatus.REMOVED;
        }
        break;
      default:
        break;
    }

    throw new BadRequestException(
      `You cannot ${action.replace('_', ' ')} a listing that is currently ${currentStatus.toLowerCase()}.`,
    );
  }

  async create(userId: string, createListingDto: CreateListingDto) {
    if (
      (createListingDto.status ?? ListingStatus.DRAFT) === ListingStatus.ACTIVE
    ) {
      await this.ensureUserCanPublish(userId);
    }

    if (
      createListingDto.status &&
      createListingDto.status !== ListingStatus.DRAFT &&
      createListingDto.status !== ListingStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'New listings can only start as draft or active.',
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { slug: createListingDto.categorySlug },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const listingId = randomUUID();
    const storedAssets = await this.writeListingMediaFiles(
      listingId,
      createListingDto.media,
    );

    try {
      return await this.prisma.listing.create({
        data: {
          id: listingId,
          title: createListingDto.title,
          description: createListingDto.description,
          price: new Prisma.Decimal(createListingDto.price),
          currency: createListingDto.currency ?? 'AED',
          location: createListingDto.location,
          status: createListingDto.status ?? ListingStatus.DRAFT,
          attributes: toJsonValue(
            removeReservedListingAttributes(createListingDto.attributes),
          ),
          sellerId: userId,
          categoryId: category.id,
          media: storedAssets.length
            ? {
                create: storedAssets.map((asset) => asset.createData),
              }
            : undefined,
        },
        include: listingInclude,
      });
    } catch (error) {
      await this.cleanupFiles(storedAssets.map((asset) => asset.absolutePath));
      throw error;
    }
  }

  async save(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    await this.prisma.$executeRaw`
      INSERT INTO "SavedListing" ("id", "createdAt", "userId", "listingId")
      VALUES (${randomUUID()}, NOW(), ${userId}, ${listingId})
      ON CONFLICT ("userId", "listingId") DO NOTHING
    `;

    return {
      saved: true,
      message: 'Listing saved successfully.',
    };
  }

  async unsave(userId: string, listingId: string) {
    await this.prisma.$executeRaw`
      DELETE FROM "SavedListing"
      WHERE "userId" = ${userId} AND "listingId" = ${listingId}
    `;

    return {
      saved: false,
      message: 'Listing removed from saved items.',
    };
  }

  async findAll(
    query: QueryListingsDto,
    viewer?: {
      id: string;
      role?: string;
    },
  ) {
    this.assertPriceRange(query);
    const attributeFilterEntries = this.parseAttributeFilters(
      query.attributeFilters,
    );
    await this.validateAttributeFilterKeys(
      query.categorySlug,
      attributeFilterEntries,
    );

    const page = query.page ?? 1;
    const take = query.take ?? 25;
    const skip = (page - 1) * take;
    const statusFilter = this.resolveListingStatusFilter(query, viewer);

    const where: Prisma.ListingWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
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
              mode: 'insensitive',
            },
          }
        : {}),
      ...(typeof query.minPrice === 'number' ||
      typeof query.maxPrice === 'number'
        ? {
            price: {
              ...(typeof query.minPrice === 'number'
                ? { gte: new Prisma.Decimal(query.minPrice) }
                : {}),
              ...(typeof query.maxPrice === 'number'
                ? { lte: new Prisma.Decimal(query.maxPrice) }
                : {}),
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
      ...(attributeFilterEntries.length
        ? {
            AND: attributeFilterEntries.map(([key, value]) => ({
              attributes: {
                path: [key],
                equals: value,
              },
            })),
          }
        : {}),
    };

    const orderBy: Prisma.ListingOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy,
        skip,
        take,
        include: listingInclude,
      }),
      this.prisma.listing.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / take));

    return {
      items,
      pagination: {
        page,
        take,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(
    id: string,
    viewer?: {
      id: string;
      role?: string;
    },
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (!this.canViewListing(listing, viewer)) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  async findSaved(userId: string) {
    const savedListingIds = await this.prisma.$queryRaw<
      Array<{ listingId: string }>
    >`
      SELECT "listingId"
      FROM "SavedListing"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
    `;

    if (!savedListingIds.length) {
      return [];
    }

    const listings = await this.prisma.listing.findMany({
      where: {
        id: {
          in: savedListingIds.map((item) => item.listingId),
        },
      },
      include: listingInclude,
    });

    const listingsById = new Map(
      listings.map((listing) => [listing.id, listing]),
    );

    return savedListingIds
      .map((item) => listingsById.get(item.listingId))
      .filter((listing): listing is NonNullable<typeof listing> =>
        Boolean(listing),
      )
      .map(markSaved);
  }

  async update(userId: string, id: string, updateListingDto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        media: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only update your own listings');
    }

    if (listing.status === ListingStatus.REMOVED) {
      throw new BadRequestException(
        'Removed listings can no longer be edited.',
      );
    }

    if (typeof updateListingDto.status !== 'undefined') {
      throw new BadRequestException(
        'Use the dedicated listing status endpoint to publish, archive, sell, or delete a listing.',
      );
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

    const storedAssets = updateListingDto.media
      ? await this.writeListingMediaFiles(id, updateListingDto.media)
      : [];

    try {
      const updatedListing = await this.prisma.$transaction(async (tx) => {
        if (updateListingDto.media) {
          await tx.listingMedia.deleteMany({
            where: { listingId: id },
          });
        }

        return tx.listing.update({
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
            attributes: toJsonValue(
              removeReservedListingAttributes(updateListingDto.attributes),
            ),
            categoryId,
            media:
              updateListingDto.media && storedAssets.length
                ? {
                    create: storedAssets.map((asset) => asset.createData),
                  }
                : undefined,
          },
          include: listingInclude,
        });
      });

      if (updateListingDto.media) {
        await this.cleanupFiles(
          listing.media.map((asset) =>
            join(
              this.getUploadRootDir(),
              asset.storageKey.replace(/^listings[\\/]/, ''),
            ),
          ),
        );
      }

      return updatedListing;
    } catch (error) {
      await this.cleanupFiles(storedAssets.map((asset) => asset.absolutePath));
      throw error;
    }
  }

  async findMine(userId: string) {
    return this.prisma.listing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });
  }

  async transitionStatus(
    userId: string,
    id: string,
    updateListingStatusDto: UpdateListingStatusDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You can only manage your own listings');
    }

    if (updateListingStatusDto.action === 'publish') {
      await this.ensureUserCanPublish(userId);
    }

    if (listing.status === ListingStatus.REMOVED) {
      throw new BadRequestException(
        'Removed listings cannot be republished or edited.',
      );
    }

    const nextStatus = this.resolveNextSellerStatus(
      listing.status,
      updateListingStatusDto.action,
    );

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: nextStatus,
      },
      include: listingInclude,
    });
  }
}
