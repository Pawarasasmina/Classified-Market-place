import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BoostPlacement, BoostStatus, ListingStatus } from '@prisma/client';
import { MAX_LISTING_IMAGES } from '../media/media.constants';
import { ListingsService } from './listings.service';

describe('ListingsService normal-user posting', () => {
  let service: ListingsService;
  let prisma: {
    category: {
      findUnique: jest.Mock;
    };
    listing: {
      count: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let mediaService: {
    createListingImageAssetFromDataUrl: jest.Mock;
    getOwnedListingImageAsset: jest.Mock;
    attachImagesToListing: jest.Mock;
  };
  let notifications: {
    notifyListingStatusChanged: jest.Mock;
  };

  const category = {
    id: 'category-1',
    slug: 'electronics',
    name: 'Electronics',
  };

  const listing = {
    id: 'listing-1',
    sellerId: 'user-1',
    categoryId: 'category-1',
    status: ListingStatus.PENDING,
    attributes: null,
  };

  beforeEach(() => {
    prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue(category),
      },
      listing: {
        count: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'listing-1',
          ...data,
        })),
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(listing),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...listing,
          ...data,
        })),
      },
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    mediaService = {
      createListingImageAssetFromDataUrl: jest
        .fn()
        .mockImplementation(
          (_userId: string, _dataUrl: string, index?: string) => ({
            id:
              index ??
              `asset-${mediaService.createListingImageAssetFromDataUrl.mock.calls.length}`,
            url: `http://127.0.0.1:3001/uploads/listing-images/${mediaService.createListingImageAssetFromDataUrl.mock.calls.length}.jpg`,
            uploadedById: 'user-1',
            type: 'IMAGE',
            mimeType: 'image/jpeg',
            byteSize: 100,
          }),
        ),
      getOwnedListingImageAsset: jest.fn(),
      attachImagesToListing: jest.fn(),
    };
    notifications = {
      notifyListingStatusChanged: jest.fn(),
    };

    service = new ListingsService(
      prisma as never,
      mediaService as never,
      notifications as never,
    );
  });

  it('lets regular users create listings without a seller role and forces moderation', async () => {
    await service.create(
      { id: 'user-1', role: 'USER' },
      {
        categorySlug: 'electronics',
        title: 'Clean phone',
        description: 'Barely used phone with box',
        price: 350,
        location: 'Dubai Marina',
        status: ListingStatus.ACTIVE,
      },
    );

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 'user-1',
          status: ListingStatus.PENDING,
        }),
      }),
    );
  });

  it('allows admins to create immediately active listings when needed', async () => {
    await service.create(
      { id: 'admin-1', role: 'ADMIN' },
      {
        categorySlug: 'electronics',
        title: 'Admin seeded item',
        description: 'Approved inventory listing',
        price: 100,
        location: 'Dubai',
      },
    );

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: 'admin-1',
          status: ListingStatus.ACTIVE,
        }),
      }),
    );
  });

  it('stores submitted data URL images and normalizes the primary image', async () => {
    await service.create(
      { id: 'user-1', role: 'USER' },
      {
        categorySlug: 'electronics',
        title: 'Clean phone',
        description: 'Barely used phone with box',
        price: 350,
        location: 'Dubai Marina',
        images: [
          {
            url: 'data:image/jpeg;base64,first',
            altText: 'Front',
          },
          {
            url: 'data:image/jpeg;base64,second',
            altText: 'Back',
            isPrimary: true,
          },
        ],
      },
    );

    const createCall = prisma.listing.create.mock.calls[0][0];
    const imageCreates = createCall.data.images.create;

    expect(
      mediaService.createListingImageAssetFromDataUrl,
    ).toHaveBeenCalledTimes(2);
    expect(imageCreates).toMatchObject([
      {
        altText: 'Front',
        sortOrder: 0,
        isPrimary: false,
        mediaAsset: { connect: { id: 'asset-1' } },
      },
      {
        altText: 'Back',
        sortOrder: 1,
        isPrimary: true,
        mediaAsset: { connect: { id: 'asset-2' } },
      },
    ]);
    expect(mediaService.attachImagesToListing).toHaveBeenCalledWith(
      'listing-1',
      ['asset-1', 'asset-2'],
    );
  });

  it('connects owned media assets to listing images', async () => {
    mediaService.getOwnedListingImageAsset.mockResolvedValue({
      id: 'asset-owned',
      url: 'http://127.0.0.1:3001/uploads/listing-images/owned.jpg',
      uploadedById: 'user-1',
      listingId: null,
      type: 'IMAGE',
      mimeType: 'image/jpeg',
      byteSize: 100,
    });

    await service.create(
      { id: 'user-1', role: 'USER' },
      {
        categorySlug: 'electronics',
        title: 'Clean phone',
        description: 'Barely used phone with box',
        price: 350,
        location: 'Dubai Marina',
        images: [{ assetId: 'asset-owned', altText: 'Front' }],
      },
    );

    const createCall = prisma.listing.create.mock.calls[0][0];

    expect(mediaService.getOwnedListingImageAsset).toHaveBeenCalledWith(
      'user-1',
      'asset-owned',
    );
    expect(createCall.data.images.create).toMatchObject([
      {
        url: 'http://127.0.0.1:3001/uploads/listing-images/owned.jpg',
        altText: 'Front',
        sortOrder: 0,
        isPrimary: true,
        mediaAsset: { connect: { id: 'asset-owned' } },
      },
    ]);
    expect(mediaService.attachImagesToListing).toHaveBeenCalledWith(
      'listing-1',
      ['asset-owned'],
    );
  });

  it('rejects attaching media assets not uploaded by the current user', async () => {
    mediaService.getOwnedListingImageAsset.mockRejectedValue(
      new ForbiddenException('You can only use images you uploaded'),
    );

    await expect(
      service.create(
        { id: 'user-1', role: 'USER' },
        {
          categorySlug: 'electronics',
          title: 'Clean phone',
          description: 'Barely used phone with box',
          price: 350,
          location: 'Dubai Marina',
          images: [{ assetId: 'asset-other-user' }],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  it('keeps exactly one primary image when multiple inputs are marked primary', async () => {
    await service.create(
      { id: 'user-1', role: 'USER' },
      {
        categorySlug: 'electronics',
        title: 'Clean phone',
        description: 'Barely used phone with box',
        price: 350,
        location: 'Dubai Marina',
        images: [
          {
            url: 'data:image/jpeg;base64,first',
            isPrimary: true,
          },
          {
            url: 'data:image/jpeg;base64,second',
            isPrimary: true,
          },
        ],
      },
    );

    const createCall = prisma.listing.create.mock.calls[0][0];
    const imageCreates = createCall.data.images.create;

    expect(imageCreates).toMatchObject([
      { isPrimary: true, sortOrder: 0 },
      { isPrimary: false, sortOrder: 1 },
    ]);
    expect(imageCreates.filter((image) => image.isPrimary)).toHaveLength(1);
  });

  it('rejects listings with too many images', async () => {
    await expect(
      service.create(
        { id: 'user-1', role: 'USER' },
        {
          categorySlug: 'electronics',
          title: 'Clean phone',
          description: 'Barely used phone with box',
          price: 350,
          location: 'Dubai Marina',
          images: Array.from(
            { length: MAX_LISTING_IMAGES + 1 },
            (_, index) => ({
              url: `data:image/jpeg;base64,${index}`,
            }),
          ),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  it('includes child categories when searching by a parent category', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.findAll({ categorySlug: 'motors' });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: {
            OR: [{ slug: 'motors' }, { parent: { slug: 'motors' } }],
          },
          status: ListingStatus.ACTIVE,
        }),
      }),
    );
  });

  it('sorts actively boosted listings above normal search results', async () => {
    const now = Date.now();
    const boostedListing = {
      id: 'boosted-listing',
      attributes: null,
      boosts: [
        {
          placement: BoostPlacement.SEARCH_TOP,
          status: BoostStatus.ACTIVE,
          startsAt: new Date(now - 60_000),
          endsAt: new Date(now + 60_000),
        },
      ],
    };
    const normalListing = {
      id: 'normal-listing',
      attributes: null,
      boosts: [],
    };
    prisma.listing.findMany
      .mockResolvedValueOnce([boostedListing])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([normalListing]);

    await expect(service.findAll({ take: 2 })).resolves.toMatchObject([
      { id: 'boosted-listing' },
      { id: 'normal-listing' },
    ]);

    expect(prisma.listing.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          boosts: {
            some: expect.objectContaining({
              status: BoostStatus.ACTIVE,
              startsAt: expect.objectContaining({ lte: expect.any(Date) }),
              endsAt: expect.objectContaining({ gt: expect.any(Date) }),
            }),
          },
        }),
      }),
    );
  });

  it('requires a valid active boost date range before a listing can affect ranking', async () => {
    const normalListing = {
      id: 'normal-listing',
      attributes: null,
      boosts: [],
    };
    prisma.listing.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([normalListing]);

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'normal-listing' },
    ]);

    const boostedSearchCalls = prisma.listing.findMany.mock.calls.slice(0, 3);

    for (const [query] of boostedSearchCalls) {
      expect(query.where.boosts.some).toEqual(
        expect.objectContaining({
          status: BoostStatus.ACTIVE,
          startsAt: expect.objectContaining({ lte: expect.any(Date) }),
          endsAt: expect.objectContaining({ gt: expect.any(Date) }),
        }),
      );
    }
  });

  it('can rank listings by a specific active boost placement', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.findAll({ boostPlacement: BoostPlacement.CATEGORY_TOP });

    expect(prisma.listing.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          boosts: {
            some: expect.objectContaining({
              placement: BoostPlacement.CATEGORY_TOP,
            }),
          },
        }),
      }),
    );
  });

  it('does not expose pending listings through public lookup', async () => {
    await expect(service.findOne('listing-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets the owner retrieve their pending listing for editing', async () => {
    await expect(
      service.findOneForUser({ id: 'user-1', role: 'USER' }, 'listing-1'),
    ).resolves.toMatchObject({
      id: 'listing-1',
      status: ListingStatus.PENDING,
    });
  });

  it('blocks other regular users from viewing a private listing edit record', async () => {
    await expect(
      service.findOneForUser({ id: 'user-2', role: 'USER' }, 'listing-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns regular-user edits to moderation and ignores submitted status', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      status: ListingStatus.ACTIVE,
    });

    await service.update({ id: 'user-1', role: 'USER' }, 'listing-1', {
      title: 'Updated title',
      status: ListingStatus.ACTIVE,
    });

    expect(prisma.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Updated title',
          status: ListingStatus.PENDING,
        }),
      }),
    );
  });

  it('keeps existing listing images during update without re-uploading them', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      status: ListingStatus.ACTIVE,
      images: [
        {
          url: 'http://127.0.0.1:3001/uploads/listing-images/existing.jpg',
          mediaAssetId: 'asset-existing',
        },
      ],
    });

    await service.update({ id: 'user-1', role: 'USER' }, 'listing-1', {
      images: [
        {
          url: 'http://127.0.0.1:3001/uploads/listing-images/existing.jpg',
        },
      ],
    });

    const updateCall = prisma.listing.update.mock.calls[0][0];

    expect(
      mediaService.createListingImageAssetFromDataUrl,
    ).not.toHaveBeenCalled();
    expect(updateCall.data.images.create).toMatchObject([
      {
        url: 'http://127.0.0.1:3001/uploads/listing-images/existing.jpg',
        sortOrder: 0,
        isPrimary: true,
        mediaAsset: { connect: { id: 'asset-existing' } },
      },
    ]);
  });

  it('preserves existing listing images when update omits images', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      status: ListingStatus.ACTIVE,
      images: [
        {
          url: 'http://127.0.0.1:3001/uploads/listing-images/existing.jpg',
          mediaAssetId: 'asset-existing',
        },
      ],
    });

    await service.update({ id: 'user-1', role: 'USER' }, 'listing-1', {
      title: 'Updated title',
    });

    const updateCall = prisma.listing.update.mock.calls[0][0];

    expect(updateCall.data.images).toBeUndefined();
    expect(mediaService.attachImagesToListing).not.toHaveBeenCalled();
  });

  it('notifies the seller when admin moderation changes listing status', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      title: 'Clean phone',
      status: ListingStatus.PENDING,
      sellerId: 'seller-1',
    });
    prisma.listing.update.mockResolvedValue({
      ...listing,
      id: 'listing-1',
      title: 'Clean phone',
      status: ListingStatus.ACTIVE,
      sellerId: 'seller-1',
    });

    await service.moderate({ id: 'admin-1' }, 'listing-1', {
      status: ListingStatus.ACTIVE,
    });

    expect(notifications.notifyListingStatusChanged).toHaveBeenCalledWith({
      userId: 'seller-1',
      actorId: 'admin-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      status: ListingStatus.ACTIVE,
    });
  });
});
