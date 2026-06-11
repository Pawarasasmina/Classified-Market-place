import { MediaController } from './media.controller';

describe('MediaController', () => {
  let service: {
    uploadListingImage: jest.Mock;
    uploadAdvertisementBannerImage: jest.Mock;
  };
  let controller: MediaController;

  beforeEach(() => {
    service = {
      uploadListingImage: jest.fn().mockReturnValue({
        id: 'asset-1',
        url: 'http://127.0.0.1:3001/uploads/listing-images/asset.jpg',
      }),
      uploadAdvertisementBannerImage: jest.fn().mockReturnValue({
        id: 'asset-2',
        url: 'http://127.0.0.1:3001/uploads/advertisement-banners/asset.jpg',
      }),
    };
    controller = new MediaController(service as never);
  });

  it('uploads listing images for the current user', () => {
    const file = {
      originalname: 'phone.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    };

    expect(controller.uploadListingImage({ id: 'user-1' }, {}, file)).toEqual({
      id: 'asset-1',
      url: 'http://127.0.0.1:3001/uploads/listing-images/asset.jpg',
    });
    expect(service.uploadListingImage).toHaveBeenCalledWith(
      { id: 'user-1' },
      file,
      undefined,
    );
  });

  it('uploads advertisement banner images for admins', () => {
    const file = {
      originalname: 'banner.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    };

    expect(
      controller.uploadAdvertisementBannerImage({ id: 'admin-1' }, file),
    ).toEqual({
      id: 'asset-2',
      url: 'http://127.0.0.1:3001/uploads/advertisement-banners/asset.jpg',
    });
    expect(service.uploadAdvertisementBannerImage).toHaveBeenCalledWith(
      { id: 'admin-1' },
      file,
    );
  });
});
