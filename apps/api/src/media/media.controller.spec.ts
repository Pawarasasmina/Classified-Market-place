import { MediaController } from './media.controller';

describe('MediaController', () => {
  let service: {
    uploadListingImage: jest.Mock;
  };
  let controller: MediaController;

  beforeEach(() => {
    service = {
      uploadListingImage: jest.fn().mockReturnValue({
        id: 'asset-1',
        url: 'http://127.0.0.1:3001/uploads/listing-images/asset.jpg',
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
});
