import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MediaAsset, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_STORAGE_ADAPTER } from './image-storage.adapter';
import type { ImageStorageAdapter } from './image-storage.adapter';
import {
  ALLOWED_LISTING_IMAGE_MIME_TYPES,
  ListingImageMimeType,
  MAX_LISTING_IMAGE_BYTES,
} from './media.constants';

export type UploadedImageFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export type MediaUploadActor = {
  id: string;
  role?: string;
};

export type ListingImageAsset = Pick<
  MediaAsset,
  'id' | 'url' | 'uploadedById' | 'listingId' | 'type' | 'mimeType' | 'byteSize'
>;

const dataUrlPattern =
  /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=\s]+)$/i;

function isAllowedMimeType(value: string): value is ListingImageMimeType {
  return ALLOWED_LISTING_IMAGE_MIME_TYPES.includes(
    value.toLowerCase() as ListingImageMimeType,
  );
}

function assertImageSignature(buffer: Buffer, mimeType: ListingImageMimeType) {
  const valid =
    (mimeType === 'image/jpeg' &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (mimeType === 'image/png' &&
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )) ||
    (mimeType === 'image/webp' &&
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP');

  if (!valid) {
    throw new BadRequestException('Image content does not match its file type');
  }
}

function validateImageBuffer(buffer: Buffer, mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase();

  if (!isAllowedMimeType(normalizedMimeType)) {
    throw new BadRequestException(
      'Only JPG, PNG, or WEBP images are supported',
    );
  }

  if (!buffer.length) {
    throw new BadRequestException('Image file cannot be empty');
  }

  if (buffer.byteLength > MAX_LISTING_IMAGE_BYTES) {
    throw new BadRequestException('Image file must be 5 MB or smaller');
  }

  assertImageSignature(buffer, normalizedMimeType);

  return normalizedMimeType;
}

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(dataUrlPattern);

  if (!match?.[1] || !match[2]) {
    throw new BadRequestException(
      'Images must be uploaded as JPG, PNG, or WEBP files',
    );
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s/g, '');
  const buffer = Buffer.from(base64, 'base64');

  return {
    buffer,
    mimeType: validateImageBuffer(buffer, mimeType),
  };
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMAGE_STORAGE_ADAPTER)
    private readonly imageStorage: ImageStorageAdapter,
  ) {}

  async uploadListingImage(
    actor: string | MediaUploadActor,
    file: UploadedImageFile | undefined,
    listingId?: string,
  ) {
    if (!file?.buffer || !file.mimetype) {
      throw new BadRequestException('Choose an image file to upload');
    }

    const mimeType = validateImageBuffer(file.buffer, file.mimetype);
    const userId = typeof actor === 'string' ? actor : actor.id;

    if (listingId) {
      await this.assertCanAttachToListing(
        typeof actor === 'string' ? { id: actor } : actor,
        listingId,
      );
    }

    return this.createListingImageAsset(userId, {
      buffer: file.buffer,
      mimeType,
      originalName: file.originalname,
      listingId,
    });
  }

  async createListingImageAssetFromDataUrl(
    userId: string,
    dataUrl: string,
    originalName?: string,
  ) {
    const image = parseImageDataUrl(dataUrl);

    return this.createListingImageAsset(userId, {
      ...image,
      originalName,
    });
  }

  async getOwnedListingImageAsset(userId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        url: true,
        uploadedById: true,
        listingId: true,
        type: true,
        mimeType: true,
        byteSize: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Image asset not found');
    }

    if (asset.type !== 'IMAGE') {
      throw new BadRequestException('Only image assets can be attached');
    }

    if (asset.uploadedById !== userId) {
      throw new ForbiddenException('You can only use images you uploaded');
    }

    return asset;
  }

  async attachImagesToListing(listingId: string, assetIds: string[]) {
    const uniqueAssetIds = [...new Set(assetIds)];

    if (!uniqueAssetIds.length) {
      return;
    }

    await this.prisma.mediaAsset.updateMany({
      where: { id: { in: uniqueAssetIds } },
      data: { listingId },
    });
  }

  private async createListingImageAsset(
    userId: string,
    input: {
      buffer: Buffer;
      mimeType: ListingImageMimeType;
      originalName?: string;
      listingId?: string;
    },
  ) {
    const stored = await this.imageStorage.storeListingImage(input);
    const metadata: Prisma.InputJsonObject = {
      storageProvider: stored.provider,
      ...(input.originalName ? { originalName: input.originalName } : {}),
    };

    return this.prisma.mediaAsset.create({
      data: {
        uploadedById: userId,
        listingId: input.listingId,
        type: 'IMAGE',
        url: stored.url,
        storageKey: stored.storageKey,
        mimeType: input.mimeType,
        byteSize: input.buffer.byteLength,
        metadata,
      },
      select: {
        id: true,
        url: true,
        uploadedById: true,
        listingId: true,
        type: true,
        mimeType: true,
        byteSize: true,
      },
    });
  }

  private async assertCanAttachToListing(
    actor: MediaUploadActor,
    listingId: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (actor.role?.toUpperCase() === 'ADMIN' || listing.sellerId === actor.id) {
      return;
    }

    throw new ForbiddenException('You can only attach images to your listings');
  }
}
