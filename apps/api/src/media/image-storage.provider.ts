import { Provider } from '@nestjs/common';
import {
  IMAGE_STORAGE_ADAPTER,
  ImageStorageAdapter,
} from './image-storage.adapter';
import { LocalImageStorageAdapter } from './local-image-storage.adapter';

export const LOCAL_IMAGE_STORAGE_DRIVER = 'local';

type ImageStorageDriver = typeof LOCAL_IMAGE_STORAGE_DRIVER;

export function getImageStorageDriver(): ImageStorageDriver {
  const driver = (
    process.env.MEDIA_STORAGE_DRIVER ??
    process.env.IMAGE_STORAGE_DRIVER ??
    LOCAL_IMAGE_STORAGE_DRIVER
  ).toLowerCase();

  if (driver === LOCAL_IMAGE_STORAGE_DRIVER) {
    return LOCAL_IMAGE_STORAGE_DRIVER;
  }

  throw new Error(
    `Unsupported image storage driver "${driver}". Supported driver: local.`,
  );
}

export const imageStorageAdapterProvider: Provider<ImageStorageAdapter> = {
  provide: IMAGE_STORAGE_ADAPTER,
  inject: [LocalImageStorageAdapter],
  useFactory: (localStorage: LocalImageStorageAdapter) => {
    switch (getImageStorageDriver()) {
      case LOCAL_IMAGE_STORAGE_DRIVER:
        return localStorage;
    }
  },
};
