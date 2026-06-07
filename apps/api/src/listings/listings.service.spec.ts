import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BoostPlacement,
  BoostStatus,
  ListingPaymentMode,
  ListingPriorityRuleTarget,
  ListingStatus,
  Prisma,
  SellerReviewStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
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
    marketplaceSetting: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    sellerRating: {
      groupBy: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mediaService: {
    createListingImageAssetFromDataUrl: jest.Mock;
    getOwnedListingImageAsset: jest.Mock;
    attachImagesToListing: jest.Mock;
  };
  let notifications: {
    notifyListingStatusChanged: jest.Mock;
  };
  let paymentsService: {
    completeListingFeePaymentForActor: jest.Mock;
    createListingFeePaymentIntent: jest.Mock;
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
        count: jest.fn().mockResolvedValue(0),
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
      marketplaceSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      sellerRating: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      transaction: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'transaction-1',
          ...data,
        })),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'transaction-1',
          ...data,
        })),
      },
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
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
    paymentsService = {
      completeListingFeePaymentForActor: jest.fn(),
      createListingFeePaymentIntent: jest.fn().mockResolvedValue({
        provider: 'dev',
        providerRef: 'dev-listing-payment-1',
        checkoutUrl:
          'http://127.0.0.1:3001/payments/dev/checkout/dev-listing-payment-1',
      }),
    };

    service = new ListingsService(
      prisma as never,
      mediaService as never,
      notifications as never,
      paymentsService as never,
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
    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingPaymentMode: ListingPaymentMode.FREE,
        }),
      }),
    );
  });

  it('falls back to a paid listing transaction when free quota is exhausted', async () => {
    prisma.listing.count.mockResolvedValue(3);

    await service.create(
      { id: 'user-1', role: 'USER' },
      {
        categorySlug: 'electronics',
        title: 'Paid fallback phone',
        description: 'Phone after using all free listing quota',
        price: 350,
        location: 'Dubai Marina',
      },
    );

    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingPaymentMode: ListingPaymentMode.PAID,
          status: ListingStatus.PENDING,
        }),
      }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingId: 'listing-1',
          type: TransactionType.LISTING_FEE,
          status: TransactionStatus.PENDING,
          amount: expect.any(Prisma.Decimal),
          currency: 'AED',
        }),
      }),
    );
    expect(paymentsService.createListingFeePaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'transaction-1',
        userId: 'user-1',
        listingId: 'listing-1',
        listingTitle: 'Paid fallback phone',
      }),
    );
  });

  it('returns the persisted free listing quota balance for the seller', async () => {
    prisma.marketplaceSetting.findUnique.mockResolvedValue({
      key: 'seller_listing_quota',
      value: {
        freeListingAllowance: 5,
        listingFeeAmount: 35,
        listingFeeCurrency: 'AED',
      },
    });
    prisma.listing.count.mockResolvedValue(2);

    await expect(service.getMyListingQuota('user-1')).resolves.toEqual({
      freeListingAllowance: 5,
      freeListingUsed: 2,
      freeListingRemaining: 3,
      listingFeeAmount: '35.00',
      listingFeeCurrency: 'AED',
      paidListingFallbackEnabled: true,
    });
    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: {
        sellerId: 'user-1',
        listingPaymentMode: ListingPaymentMode.FREE,
        status: { in: [ListingStatus.PENDING, ListingStatus.ACTIVE] },
      },
    });
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

  it('includes priority score factors in admin listing results', async () => {
    const adminListing = {
      id: 'admin-ranked-listing',
      attributes: null,
      categoryId: 'electronics-category',
      category: { parentId: null },
      boosts: [{ placement: BoostPlacement.TOP_LISTING }],
      transactions: [{ id: 'listing-fee-transaction' }],
      seller: {
        sellerPriorityTier: 'NONE',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 20,
      },
    };
    prisma.listing.findMany.mockResolvedValue([adminListing]);

    await expect(service.findAll({ take: 1 }, true)).resolves.toMatchObject([
      {
        id: 'admin-ranked-listing',
        priorityRanking: {
          score: 1527,
          overrideApplied: false,
          factors: [
            { key: 'boosted_listing', label: 'Boosted listing', score: 1000 },
            { key: 'paid_listing', label: 'Paid listing', score: 500 },
            {
              key: 'seller_rating',
              label: 'Seller rating',
              score: 20,
              detail: '20 x 1',
            },
            { key: 'boost_placement', label: 'Boost placement', score: 7 },
          ],
        },
      },
    ]);
  });

  it('sorts actively boosted listings above normal search results', async () => {
    const now = Date.now();
    const boostedListing = {
      id: 'boosted-listing',
      attributes: null,
      boosts: [
        {
          placement: BoostPlacement.TOP_LISTING,
          status: BoostStatus.ACTIVE,
          startsAt: new Date(now - 60_000),
          endsAt: new Date(now + 60_000),
        },
      ],
      transactions: [],
    };
    const normalListing = {
      id: 'normal-listing',
      attributes: null,
      boosts: [],
      transactions: [],
    };
    prisma.listing.findMany.mockImplementation(
      (() => {
        let callCount = 0;

        return () => {
          callCount += 1;

          if (callCount === 1) {
            return Promise.resolve([boostedListing]);
          }

          if (callCount === 11) {
            return Promise.resolve([normalListing]);
          }

          return Promise.resolve([]);
        };
      })(),
    );

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

  it('honors price low to high before priority score', async () => {
    const boostedListing = {
      id: 'expensive-boosted-listing',
      price: 500,
      createdAt: new Date('2026-05-24T00:00:00Z'),
      attributes: null,
      boosts: [{ placement: BoostPlacement.TOP_LISTING }],
      transactions: [],
    };
    const cheaperListing = {
      id: 'cheaper-normal-listing',
      price: 50,
      createdAt: new Date('2026-05-23T00:00:00Z'),
      attributes: null,
      boosts: [],
      transactions: [],
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: {
          boosts?: { some?: { placement?: BoostPlacement } };
          transactions?: unknown;
          AND?: unknown;
        };
        orderBy?: unknown;
      }) => {
        if (where.boosts?.some?.placement === BoostPlacement.TOP_LISTING) {
          return Promise.resolve([boostedListing]);
        }

        if (where.boosts || where.transactions || where.AND) {
          return Promise.resolve([]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([]);
        }

        return Promise.resolve([cheaperListing]);
      },
    );

    await expect(
      service.findAll({ take: 2, sort: 'price_asc' }),
    ).resolves.toMatchObject([
      { id: 'cheaper-normal-listing' },
      { id: 'expensive-boosted-listing' },
    ]);
  });

  it('honors newest sort before priority score', async () => {
    const olderBoostedListing = {
      id: 'older-boosted-listing',
      createdAt: new Date('2026-05-20T00:00:00Z'),
      attributes: null,
      boosts: [{ placement: BoostPlacement.TOP_LISTING }],
      transactions: [],
    };
    const newerListing = {
      id: 'newer-normal-listing',
      createdAt: new Date('2026-05-24T00:00:00Z'),
      attributes: null,
      boosts: [],
      transactions: [],
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: {
          boosts?: { some?: { placement?: BoostPlacement } };
          transactions?: unknown;
          AND?: unknown;
        };
        orderBy?: unknown;
      }) => {
        if (where.boosts?.some?.placement === BoostPlacement.TOP_LISTING) {
          return Promise.resolve([olderBoostedListing]);
        }

        if (where.boosts || where.transactions || where.AND) {
          return Promise.resolve([]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([]);
        }

        return Promise.resolve([newerListing]);
      },
    );

    await expect(
      service.findAll({ take: 2, sort: 'newest' }),
    ).resolves.toMatchObject([
      { id: 'newer-normal-listing' },
      { id: 'older-boosted-listing' },
    ]);
  });

  it('applies all customer filters before recommending boosted over VIP listings', async () => {
    const filteredBoostedListing = {
      id: 'filtered-boosted-listing',
      price: 450,
      createdAt: new Date('2026-05-20T00:00:00Z'),
      attributes: null,
      boosts: [{ placement: BoostPlacement.TOP_LISTING }],
      transactions: [],
    };
    const filteredVipListing = {
      id: 'filtered-vip-listing',
      price: 450,
      createdAt: new Date('2026-05-24T00:00:00Z'),
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'VIP',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 0,
      },
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: {
          boosts?: { some?: { placement?: BoostPlacement } };
          AND?: unknown;
        };
        orderBy?: unknown;
      }) => {
        if (where.boosts?.some?.placement === BoostPlacement.TOP_LISTING) {
          return Promise.resolve([filteredBoostedListing]);
        }

        if (where.boosts || where.AND) {
          return Promise.resolve([]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([filteredVipListing]);
        }

        return Promise.resolve([]);
      },
    );

    await expect(
      service.findAll({
        search: 'phone',
        categorySlug: 'electronics',
        location: 'Colombo',
        minPrice: 100,
        maxPrice: 600,
        sort: 'recommended',
        take: 2,
      }),
    ).resolves.toMatchObject([
      { id: 'filtered-boosted-listing' },
      { id: 'filtered-vip-listing' },
    ]);

    const sharedFilteredWhere = {
      status: ListingStatus.ACTIVE,
      category: {
        OR: [{ slug: 'electronics' }, { parent: { slug: 'electronics' } }],
      },
      location: { contains: 'Colombo', mode: 'insensitive' },
      price: {
        gte: new Prisma.Decimal(100),
        lte: new Prisma.Decimal(600),
      },
      OR: [
        { title: { contains: 'phone', mode: 'insensitive' } },
        { description: { contains: 'phone', mode: 'insensitive' } },
        { location: { contains: 'phone', mode: 'insensitive' } },
      ],
    };

    expect(prisma.listing.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining(sharedFilteredWhere),
      }),
    );
    expect(prisma.listing.findMany).toHaveBeenNthCalledWith(
      11,
      expect.objectContaining({
        where: expect.objectContaining(sharedFilteredWhere),
      }),
    );
  });

  it.each([
    ['newest', 'filtered-vip-listing'],
    ['price_asc', 'filtered-vip-listing'],
    ['price_desc', 'filtered-boosted-listing'],
  ] as const)(
    'honors filtered %s ordering before boosted and VIP priority',
    async (sort, expectedFirstId) => {
      const filteredBoostedListing = {
        id: 'filtered-boosted-listing',
        price: 900,
        createdAt: new Date('2026-05-20T00:00:00Z'),
        attributes: null,
        boosts: [{ placement: BoostPlacement.TOP_LISTING }],
        transactions: [],
      };
      const filteredVipListing = {
        id: 'filtered-vip-listing',
        price: 100,
        createdAt: new Date('2026-05-24T00:00:00Z'),
        attributes: null,
        boosts: [],
        transactions: [],
        seller: {
          sellerPriorityTier: 'VIP',
          emailVerified: false,
          phoneVerified: false,
          reputationScore: 0,
        },
      };

      prisma.listing.findMany.mockImplementation(
        ({
          where,
          orderBy,
        }: {
          where: {
            boosts?: { some?: { placement?: BoostPlacement } };
            AND?: unknown;
          };
          orderBy?: unknown;
        }) => {
          if (where.boosts?.some?.placement === BoostPlacement.TOP_LISTING) {
            return Promise.resolve([filteredBoostedListing]);
          }

          if (where.boosts || where.AND) {
            return Promise.resolve([]);
          }

          if (Array.isArray(orderBy)) {
            return Promise.resolve([filteredVipListing]);
          }

          return Promise.resolve([]);
        },
      );

      const results = await service.findAll({
        search: 'phone',
        categorySlug: 'electronics',
        location: 'Colombo',
        minPrice: 50,
        maxPrice: 1000,
        sort,
        take: 2,
      });

      expect(results[0]).toMatchObject({ id: expectedFirstId });
    },
  );

  it.each(['newest', 'price_asc', 'price_desc'] as const)(
    'uses priority to break filtered %s ties between boosted and VIP listings',
    async (sort) => {
      const createdAt = new Date('2026-05-24T00:00:00Z');
      const boostedListing = {
        id: 'tied-boosted-listing',
        price: 450,
        createdAt,
        attributes: null,
        boosts: [{ placement: BoostPlacement.TOP_LISTING }],
        transactions: [],
      };
      const vipListing = {
        id: 'tied-vip-listing',
        price: 450,
        createdAt,
        attributes: null,
        boosts: [],
        transactions: [],
        seller: {
          sellerPriorityTier: 'VIP',
          emailVerified: false,
          phoneVerified: false,
          reputationScore: 0,
        },
      };

      prisma.listing.findMany.mockImplementation(
        ({
          where,
          orderBy,
        }: {
          where: {
            boosts?: { some?: { placement?: BoostPlacement } };
            AND?: unknown;
          };
          orderBy?: unknown;
        }) => {
          if (where.boosts?.some?.placement === BoostPlacement.TOP_LISTING) {
            return Promise.resolve([boostedListing]);
          }

          if (where.boosts || where.AND) {
            return Promise.resolve([]);
          }

          if (Array.isArray(orderBy)) {
            return Promise.resolve([vipListing]);
          }

          return Promise.resolve([]);
        },
      );

      await expect(
        service.findAll({
          location: 'Colombo',
          minPrice: 100,
          maxPrice: 600,
          sort,
          take: 2,
        }),
      ).resolves.toMatchObject([
        { id: 'tied-boosted-listing' },
        { id: 'tied-vip-listing' },
      ]);
    },
  );

  it('requires a valid active boost date range before a listing can affect ranking', async () => {
    const normalListing = {
      id: 'normal-listing',
      attributes: null,
      boosts: [],
      transactions: [],
    };
    prisma.listing.findMany.mockImplementation(() =>
      Promise.resolve(
        prisma.listing.findMany.mock.calls.length === 11 ? [normalListing] : [],
      ),
    );

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'normal-listing' },
    ]);

    const boostedSearchCalls = prisma.listing.findMany.mock.calls.slice(0, 8);

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

  it('allows a package-specific boost rule to outrank an earlier boost placement', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.BOOST_PACKAGE,
          boostPackageId: 'standard-package',
          weight: 200,
        },
        {
          target: ListingPriorityRuleTarget.BOOST_PACKAGE,
          boostPackageId: 'platinum-package',
          weight: 1500,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );

    const standardListing = {
      id: 'standard-listing',
      attributes: null,
      boosts: [
        {
          packageId: 'standard-package',
          placement: BoostPlacement.HOMEPAGE_PROMOTION,
        },
      ],
      transactions: [],
    };
    const platinumListing = {
      id: 'platinum-listing',
      attributes: null,
      boosts: [
        {
          packageId: 'platinum-package',
          placement: BoostPlacement.HIGHLIGHTED_LISTING,
        },
      ],
      transactions: [],
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
      }: {
        where: { boosts?: { some?: { placement?: BoostPlacement } } };
      }) => {
        const placement = where.boosts?.some?.placement;

        if (placement === BoostPlacement.HOMEPAGE_PROMOTION) {
          return Promise.resolve([standardListing]);
        }

        if (placement === BoostPlacement.HIGHLIGHTED_LISTING) {
          return Promise.resolve([platinumListing]);
        }

        return Promise.resolve([]);
      },
    );

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'platinum-listing' },
    ]);
  });

  it('combines active boost and package-specific ranking scores', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.BOOSTED_LISTING,
          weight: 1000,
        },
        {
          target: ListingPriorityRuleTarget.BOOST_PACKAGE,
          boostPackageId: 'premium-package',
          weight: 300,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'premium-listing',
        attributes: null,
        boosts: [
          {
            packageId: 'premium-package',
            placement: BoostPlacement.TOP_LISTING,
          },
        ],
        transactions: [],
      },
    ]);

    await expect(service.findAll({ take: 1 }, true)).resolves.toMatchObject([
      {
        id: 'premium-listing',
        priorityRanking: {
          score: 1307,
          factors: [
            { key: 'boosted_listing', score: 1000 },
            { key: 'boost_package', score: 300 },
            { key: 'boost_placement', score: 7 },
          ],
        },
      },
    ]);
  });

  it('ranks a listing with persisted paid priority above unpaid results', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.PAID_LISTING,
          boostPackageId: null,
          weight: 500,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );

    const paidListing = {
      id: 'paid-listing',
      attributes: null,
      boosts: [],
      paidPriorityEnabled: true,
      transactions: [],
    };
    const unpaidListing = {
      id: 'unpaid-listing',
      attributes: null,
      boosts: [],
      transactions: [],
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: {
          boosts?: { some?: { placement?: BoostPlacement } };
          AND?: unknown;
        };
        orderBy?: unknown;
      }) => {
        if (JSON.stringify(where.AND ?? []).includes('paidPriorityEnabled')) {
          return Promise.resolve([paidListing]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([]);
        }

        if (!where.boosts && !where.AND) {
          return Promise.resolve([unpaidListing]);
        }

        return Promise.resolve([]);
      },
    );

    const results = await service.findAll({ take: 1 });

    expect(results).toMatchObject([{ id: 'paid-listing' }]);
    expect(results[0]).not.toHaveProperty('transactions');
  });

  it('orders VIP sellers above verified and authorized sellers', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.AUTHORIZED_SELLER,
          weight: 100,
        },
        {
          target: ListingPriorityRuleTarget.VERIFIED_SELLER,
          weight: 200,
        },
        {
          target: ListingPriorityRuleTarget.VIP_SELLER,
          weight: 300,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );

    const authorizedListing = {
      id: 'authorized-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'AUTHORIZED',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 0,
      },
    };
    const verifiedListing = {
      id: 'verified-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'VERIFIED',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 0,
      },
    };
    const vipListing = {
      id: 'vip-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'VIP',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 0,
      },
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: { boosts?: unknown; transactions?: unknown; AND?: unknown };
        orderBy?: unknown;
      }) => {
        if (where.boosts || where.transactions || where.AND) {
          return Promise.resolve([]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([
            authorizedListing,
            verifiedListing,
            vipListing,
          ]);
        }

        return Promise.resolve([]);
      },
    );

    await expect(service.findAll({ take: 3 })).resolves.toMatchObject([
      { id: 'vip-listing' },
      { id: 'verified-listing' },
      { id: 'authorized-listing' },
    ]);
  });

  it('ignores disabled rules by loading only active priority rules', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.VERIFIED_SELLER,
          weight: 200,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );

    const vipListing = {
      id: 'vip-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'VIP',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 0,
      },
    };
    const verifiedListing = {
      id: 'verified-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'VERIFIED',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 0,
      },
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: { boosts?: unknown; transactions?: unknown; AND?: unknown };
        orderBy?: unknown;
      }) => {
        if (where.boosts || where.transactions || where.AND) {
          return Promise.resolve([]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([vipListing, verifiedListing]);
        }

        return Promise.resolve([]);
      },
    );

    await expect(service.findAll({ take: 2 })).resolves.toMatchObject([
      { id: 'verified-listing' },
      { id: 'vip-listing' },
    ]);
    expect(prioritizedPrisma.listingPriorityRule.findMany).toHaveBeenCalledWith(
      {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }],
      },
    );
  });

  it('ranks listings from higher-reputation sellers above lower-rated sellers', async () => {
    const highlyRatedListing = {
      id: 'highly-rated-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'NONE',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 95,
      },
    };
    const lowRatedListing = {
      id: 'low-rated-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: {
        sellerPriorityTier: 'NONE',
        emailVerified: false,
        phoneVerified: false,
        reputationScore: 5,
      },
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: { boosts?: unknown; transactions?: unknown; AND?: unknown };
        orderBy?: unknown;
      }) => {
        if (where.boosts || where.transactions) {
          return Promise.resolve([]);
        }

        if (where.AND) {
          return Promise.resolve([]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([highlyRatedListing]);
        }

        return Promise.resolve([lowRatedListing]);
      },
    );

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'highly-rated-listing' },
    ]);
  });

  it('applies a configured seller rating multiplier rule', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.PAID_LISTING,
          weight: 500,
        },
        {
          target: ListingPriorityRuleTarget.SELLER_RATING,
          weight: 10,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );

    const paidListing = {
      id: 'paid-listing',
      attributes: null,
      boosts: [],
      transactions: [{ id: 'listing-fee-transaction' }],
      seller: { reputationScore: 0 },
    };
    const ratedListing = {
      id: 'rated-listing',
      attributes: null,
      boosts: [],
      transactions: [],
      seller: { reputationScore: 60 },
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: { boosts?: unknown; transactions?: unknown; AND?: unknown };
        orderBy?: unknown;
      }) => {
        if (where.boosts) {
          return Promise.resolve([]);
        }

        if (where.transactions) {
          return Promise.resolve([paidListing]);
        }

        if (where.AND) {
          return Promise.resolve([]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([ratedListing]);
        }

        return Promise.resolve([]);
      },
    );

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'rated-listing' },
    ]);
  });

  it('uses an active manual admin score instead of automated ranking', async () => {
    const now = Date.now();
    const boostedListing = {
      id: 'boosted-listing',
      attributes: null,
      boosts: [{ placement: BoostPlacement.TOP_LISTING }],
      transactions: [],
    };
    const manuallyPrioritizedListing = {
      id: 'manually-prioritized-listing',
      attributes: null,
      adminPriorityPinned: false,
      adminPriorityScore: 5000,
      adminPriorityStartsAt: new Date(now - 60_000),
      adminPriorityExpiresAt: new Date(now + 60_000),
      boosts: [],
      transactions: [],
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: {
          boosts?: { some?: { placement?: BoostPlacement } };
          transactions?: unknown;
          AND?: unknown;
        };
        orderBy?: unknown;
      }) => {
        if (where.boosts?.some?.placement === BoostPlacement.TOP_LISTING) {
          return Promise.resolve([boostedListing]);
        }

        if (JSON.stringify(where.AND ?? []).includes('paidPriorityEnabled')) {
          return Promise.resolve([]);
        }

        if (where.transactions) {
          return Promise.resolve([]);
        }

        if (where.AND) {
          return Promise.resolve([manuallyPrioritizedListing]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([]);
        }

        return Promise.resolve([]);
      },
    );

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'manually-prioritized-listing' },
    ]);
  });

  it('does not apply a scheduled manual admin score before its start date', async () => {
    prisma.listing.findMany.mockResolvedValue([
      {
        id: 'scheduled-priority-listing',
        attributes: null,
        adminPriorityPromoted: true,
        adminPriorityPinned: false,
        adminPriorityScore: 5000,
        adminPriorityStartsAt: new Date(Date.now() + 60_000),
        adminPriorityExpiresAt: new Date(Date.now() + 120_000),
        boosts: [],
        transactions: [],
      },
    ]);

    await expect(service.findAll({ take: 1 }, true)).resolves.toMatchObject([
      {
        id: 'scheduled-priority-listing',
        priorityRanking: {
          score: 0,
          overrideApplied: false,
        },
      },
    ]);
  });

  it('uses the manual admin priority rule for promoted listings', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.MANUAL_ADMIN_PRIORITY,
          weight: 2200,
        },
        {
          target: ListingPriorityRuleTarget.BOOSTED_LISTING,
          weight: 1000,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );

    const boostedListing = {
      id: 'boosted-listing',
      attributes: null,
      boosts: [{ placement: BoostPlacement.TOP_LISTING }],
      transactions: [],
    };
    const promotedListing = {
      id: 'promoted-listing',
      attributes: null,
      adminPriorityPromoted: true,
      adminPriorityPinned: false,
      adminPriorityScore: null,
      adminPriorityStartsAt: new Date(Date.now() - 60_000),
      adminPriorityExpiresAt: new Date(Date.now() + 60_000),
      boosts: [],
      transactions: [],
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: {
          boosts?: { some?: { placement?: BoostPlacement } };
          transactions?: unknown;
          AND?: unknown;
        };
        orderBy?: unknown;
      }) => {
        if (where.boosts?.some?.placement === BoostPlacement.TOP_LISTING) {
          return Promise.resolve([boostedListing]);
        }

        if (JSON.stringify(where.AND ?? []).includes('paidPriorityEnabled')) {
          return Promise.resolve([]);
        }

        if (where.transactions) {
          return Promise.resolve([]);
        }

        if (where.AND) {
          return Promise.resolve([promotedListing]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([]);
        }

        return Promise.resolve([]);
      },
    );

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'promoted-listing' },
    ]);
  });

  it('ranks child-category listings using a parent category priority rule', async () => {
    const prioritizedPrisma = prisma as typeof prisma & {
      listingPriorityRule: {
        findMany: jest.Mock;
      };
    };
    prioritizedPrisma.listingPriorityRule = {
      findMany: jest.fn().mockResolvedValue([
        {
          target: ListingPriorityRuleTarget.CATEGORY_PRIORITY,
          categoryId: 'property-category',
          weight: 750,
        },
      ]),
    };
    service = new ListingsService(
      prioritizedPrisma as never,
      mediaService as never,
      notifications as never,
    );

    const propertyListing = {
      id: 'apartment-listing',
      categoryId: 'apartments-category',
      category: { parentId: 'property-category' },
      attributes: null,
      boosts: [],
      transactions: [],
    };
    const generalListing = {
      id: 'general-listing',
      categoryId: 'electronics-category',
      category: { parentId: null },
      attributes: null,
      boosts: [],
      transactions: [],
    };

    prisma.listing.findMany.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: { boosts?: unknown; transactions?: unknown; AND?: unknown };
        orderBy?: unknown;
      }) => {
        if (where.boosts || where.transactions) {
          return Promise.resolve([]);
        }

        if (JSON.stringify(where.AND ?? []).includes('paidPriorityEnabled')) {
          return Promise.resolve([]);
        }

        if (JSON.stringify(where.AND ?? []).includes('adminPriorityPinned')) {
          return Promise.resolve([]);
        }

        if (where.AND) {
          return Promise.resolve([propertyListing]);
        }

        if (Array.isArray(orderBy)) {
          return Promise.resolve([]);
        }

        return Promise.resolve([generalListing]);
      },
    );

    await expect(service.findAll({ take: 1 })).resolves.toMatchObject([
      { id: 'apartment-listing' },
    ]);
  });

  it('can rank listings by a specific active boost placement', async () => {
    prisma.listing.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.findAll({ boostPlacement: BoostPlacement.CATEGORY_PRIORITY });

    expect(prisma.listing.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          boosts: {
            some: expect.objectContaining({
              placement: BoostPlacement.CATEGORY_PRIORITY,
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

  it('includes seller average rating details in listing responses', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      status: ListingStatus.ACTIVE,
      seller: {
        id: 'user-1',
        displayName: 'Seller One',
        reputationScore: 93,
      },
    });
    prisma.sellerRating.groupBy
      .mockResolvedValueOnce([
        {
          sellerId: 'user-1',
          _avg: { stars: 4.666 },
          _count: { _all: 3 },
        },
      ])
      .mockResolvedValueOnce([
        {
          sellerId: 'user-1',
          _count: { _all: 2 },
        },
      ]);

    await expect(service.findOne('listing-1')).resolves.toMatchObject({
      seller: {
        averageRating: 4.7,
        ratingCount: 3,
        reviewCount: 2,
      },
    });
    expect(prisma.sellerRating.groupBy).toHaveBeenNthCalledWith(1, {
      by: ['sellerId'],
      where: { sellerId: { in: ['user-1'] } },
      _avg: { stars: true },
      _count: { _all: true },
    });
    expect(prisma.sellerRating.groupBy).toHaveBeenNthCalledWith(2, {
      by: ['sellerId'],
      where: {
        sellerId: { in: ['user-1'] },
        review: { not: null },
        reviewStatus: SellerReviewStatus.APPROVED,
      },
      _count: { _all: true },
    });
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

  it('lets admins set and clear a manual listing priority override', async () => {
    const startsAt = new Date(Date.now() - 60_000);
    const expiresAt = new Date(Date.now() + 60_000);

    await service.updatePriorityOverride('listing-1', {
      paid: true,
      promoted: true,
      pinned: true,
      score: 4500,
      startsAt,
      expiresAt,
    });

    expect(prisma.listing.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'listing-1' },
        data: {
          paidPriorityEnabled: true,
          adminPriorityPromoted: true,
          adminPriorityPinned: true,
          adminPriorityScore: 4500,
          adminPriorityStartsAt: startsAt,
          adminPriorityExpiresAt: expiresAt,
        },
      }),
    );

    await service.updatePriorityOverride('listing-1', {
      paid: false,
      promoted: false,
      pinned: false,
      score: null,
      startsAt: null,
      expiresAt: null,
    });

    expect(prisma.listing.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          paidPriorityEnabled: false,
          adminPriorityPromoted: false,
          adminPriorityPinned: false,
          adminPriorityScore: null,
          adminPriorityStartsAt: null,
          adminPriorityExpiresAt: null,
        },
      }),
    );
  });
});
