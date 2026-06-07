import {
  getImageStorageDriver,
  LOCAL_IMAGE_STORAGE_DRIVER,
} from './image-storage.provider';

describe('image storage provider', () => {
  const originalMediaStorageDriver = process.env.MEDIA_STORAGE_DRIVER;
  const originalImageStorageDriver = process.env.IMAGE_STORAGE_DRIVER;

  afterEach(() => {
    if (originalMediaStorageDriver === undefined) {
      delete process.env.MEDIA_STORAGE_DRIVER;
    } else {
      process.env.MEDIA_STORAGE_DRIVER = originalMediaStorageDriver;
    }

    if (originalImageStorageDriver === undefined) {
      delete process.env.IMAGE_STORAGE_DRIVER;
    } else {
      process.env.IMAGE_STORAGE_DRIVER = originalImageStorageDriver;
    }
  });

  it('defaults to the local development storage adapter', () => {
    delete process.env.MEDIA_STORAGE_DRIVER;
    delete process.env.IMAGE_STORAGE_DRIVER;

    expect(getImageStorageDriver()).toBe(LOCAL_IMAGE_STORAGE_DRIVER);
  });

  it('accepts local as the configured storage driver', () => {
    process.env.MEDIA_STORAGE_DRIVER = 'local';

    expect(getImageStorageDriver()).toBe(LOCAL_IMAGE_STORAGE_DRIVER);
  });

  it('fails fast when an unimplemented storage driver is configured', () => {
    process.env.MEDIA_STORAGE_DRIVER = 's3';

    expect(() => getImageStorageDriver()).toThrow(
      'Unsupported image storage driver "s3"',
    );
  });
});
