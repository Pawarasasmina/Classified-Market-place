export const MAX_LISTING_IMAGES = 10;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LISTING_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ListingImageMimeType =
  (typeof ALLOWED_LISTING_IMAGE_MIME_TYPES)[number];
