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
  async storeListingImage(input: StoreImageInput): Promise<StoredImage> {
    const extension = extensionForMimeType(input.mimeType);
    const fileName = `${randomUUID()}.${extension}`;
    const uploadRoot =
      process.env.LISTING_IMAGE_UPLOAD_DIR ??
      join(
        process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
        'listing-images',
      );
    const storageKey = `listing-images/${fileName}`;

    await mkdir(uploadRoot, { recursive: true });
    await writeFile(join(uploadRoot, fileName), input.buffer);

    return {
      url: `${getPublicApiBaseUrl()}/uploads/${storageKey}`,
      storageKey,
      provider: 'local',
    };
  }
}
