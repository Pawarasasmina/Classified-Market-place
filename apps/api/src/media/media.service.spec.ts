import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  let prisma: {
    mediaAsset: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let storage: {
    storeListingImage: jest.Mock;
  };
  let service: MediaService;

  beforeEach(() => {
    prisma = {
      mediaAsset: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'asset-1',
          uploadedById: data.uploadedById,
          type: data.type,
          url: data.url,
          mimeType: data.mimeType,
          byteSize: data.byteSize,
        })),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    storage = {
      storeListingImage: jest.fn().mockResolvedValue({
        url: 'http://127.0.0.1:3001/uploads/listing-images/asset.jpg',
        storageKey: 'listing-images/asset.jpg',
        provider: 'local',
      }),
    };
    service = new MediaService(prisma as never, storage as never);
  });

  it('stores a valid listing image as an owned media asset', async () => {
    await expect(
      service.uploadListingImage('user-1', {
        originalname: 'phone.jpg',
        mimetype: 'image/jpeg',
        buffer: jpegBuffer,
      }),
    ).resolves.toMatchObject({
      id: 'asset-1',
      uploadedById: 'user-1',
      type: 'IMAGE',
      mimeType: 'image/jpeg',
    });

    expect(storage.storeListingImage).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: jpegBuffer,
        mimeType: 'image/jpeg',
        originalName: 'phone.jpg',
      }),
    );
  });

  it('rejects unsupported image mime types', async () => {
    await expect(
      service.uploadListingImage('user-1', {
        originalname: 'icon.svg',
        mimetype: 'image/svg+xml',
        buffer: Buffer.from('<svg />'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.storeListingImage).not.toHaveBeenCalled();
  });

  it('rejects files with mismatched image signatures', async () => {
    await expect(
      service.uploadListingImage('user-1', {
        originalname: 'fake.png',
        mimetype: 'image/png',
        buffer: Buffer.from('not a png'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.storeListingImage).not.toHaveBeenCalled();
  });

  it('rejects attaching another user image asset', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset-2',
      url: 'http://127.0.0.1:3001/uploads/listing-images/other.jpg',
      uploadedById: 'user-2',
      type: 'IMAGE',
      mimeType: 'image/jpeg',
      byteSize: 100,
    });

    await expect(
      service.getOwnedListingImageAsset('user-1', 'asset-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
