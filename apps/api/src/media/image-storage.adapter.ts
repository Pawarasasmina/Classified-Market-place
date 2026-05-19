import { ListingImageMimeType } from './media.constants';

export const IMAGE_STORAGE_ADAPTER = Symbol('IMAGE_STORAGE_ADAPTER');

export type StoreImageInput = {
  buffer: Buffer;
  mimeType: ListingImageMimeType;
  originalName?: string;
};

export type StoredImage = {
  url: string;
  storageKey: string;
  provider: string;
};

export interface ImageStorageAdapter {
  storeListingImage(input: StoreImageInput): Promise<StoredImage>;
}
