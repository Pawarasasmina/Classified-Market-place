import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ImageStorageAdapter,
  StoreImageInput,
  StoredImage,
} from './image-storage.adapter';

function extensionForMimeType(mimeType: StoreImageInput['mimeType']) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function getPublicApiBaseUrl() {
  const configured =
    process.env.API_PUBLIC_URL ?? process.env.PUBLIC_API_URL ?? undefined;

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return `http://127.0.0.1:${process.env.PORT || 3001}`;
}

@Injectable()
export class LocalImageStorageAdapter implements ImageStorageAdapter {
  private async storeImage(
    input: StoreImageInput,
    options: {
      directoryName: string;
      uploadDirEnvKey: string;
    },
  ): Promise<StoredImage> {
    const extension = extensionForMimeType(input.mimeType);
    const fileName = `${randomUUID()}.${extension}`;
    const uploadRoot =
      process.env[options.uploadDirEnvKey] ??
      join(
        process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
        options.directoryName,
      );
    const storageKey = `${options.directoryName}/${fileName}`;

    await mkdir(uploadRoot, { recursive: true });
    await writeFile(join(uploadRoot, fileName), input.buffer);

    return {
      url: `${getPublicApiBaseUrl()}/uploads/${storageKey}`,
      storageKey,
      provider: 'local',
    };
  }

  async storeListingImage(input: StoreImageInput): Promise<StoredImage> {
    return this.storeImage(input, {
      directoryName: 'listing-images',
      uploadDirEnvKey: 'LISTING_IMAGE_UPLOAD_DIR',
    });
  }

  async storeAdvertisementBannerImage(
    input: StoreImageInput,
  ): Promise<StoredImage> {
    return this.storeImage(input, {
      directoryName: 'advertisement-banners',
      uploadDirEnvKey: 'ADVERTISEMENT_BANNER_UPLOAD_DIR',
    });
  }
}
