import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, ReportStatus } from '@prisma/client';
import { AdminReportEmailType } from './dto/send-admin-report-email.dto';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let prisma: {
    $transaction: jest.Mock;
    listing: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    listingReport: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      groupBy: jest.Mock;
      update: jest.Mock;
    };
    boost: {
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    conversation: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    conversationReport: {
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    listingView: {
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    message: {
      count: jest.Mock;
    };
    messageReport: {
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    savedListing: {
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    sellerRating: {
      groupBy: jest.Mock;
    };
    transaction: {
      aggregate: jest.Mock;
      groupBy: jest.Mock;
    };
    user: {
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    walletAccount: {
      aggregate: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    walletLedger: {
      aggregate: jest.Mock;
      groupBy: jest.Mock;
    };
  };
  let mailService: {
    sendMail: jest.Mock;
  };
  let service: ReportsService;

  const listingReport = {
    id: 'report-1',
    listingId: 'listing-1',
    reporterId: 'user-1',
    reason: 'Scam listing',
    details: 'The seller asks off-site.',
    adminNotes: null,
    status: ReportStatus.OPEN,
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((operations) =>
          Promise.all(
            operations.map((operation: unknown) => Promise.resolve(operation)),
          ),
        ),
      listing: {
        count: jest.fn().mockResolvedValue(12),
        findUnique: jest.fn().mockResolvedValue({
          id: 'listing-1',
          status: ListingStatus.ACTIVE,
          sellerId: 'seller-1',
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'listing-1',
            title: 'Camera kit',
            status: ListingStatus.ACTIVE,
            sellerId: 'seller-1',
            location: 'Dubai',
            updatedAt: new Date('2026-05-26T00:00:00.000Z'),
            listingPaymentMode: 'PAID',
            paidPriorityEnabled: true,
            adminPriorityPromoted: true,
            adminPriorityPinned: false,
            adminPriorityScore: 500,
            createdAt: new Date('2026-05-25T00:00:00.000Z'),
            price: 1200,
            currency: 'AED',
            category: {
              id: 'category-1',
              name: 'Electronics',
              slug: 'electronics',
            },
            seller: {
              id: 'seller-1',
              displayName: 'Seller One',
              email: 'seller@example.com',
              phoneVerified: true,
              emailVerified: true,
              sellerPriorityTier: 'VERIFIED',
              reputationScore: 90,
            },
            boosts: [
              {
                id: 'boost-1',
                placement: 'TOP_LISTING',
                startsAt: new Date('2026-05-25T00:00:00.000Z'),
                endsAt: new Date('2026-06-05T00:00:00.000Z'),
              },
            ],
            transactions: [
              {
                id: 'transaction-1',
                status: 'SUCCEEDED',
                amount: 100,
                currency: 'AED',
                provider: 'stripe',
                providerRef: 'pi_listing_1',
                createdAt: new Date('2026-05-25T00:00:00.000Z'),
                updatedAt: new Date('2026-05-25T00:00:00.000Z'),
              },
              {
                id: 'transaction-2',
                status: 'PENDING',
                amount: 25,
                currency: 'AED',
                provider: 'stripe',
                providerRef: 'pi_listing_2',
                createdAt: new Date('2026-05-24T00:00:00.000Z'),
                updatedAt: new Date('2026-05-24T00:00:00.000Z'),
              },
            ],
            _count: {
              savedBy: 3,
              conversations: 2,
              reports: 1,
              views: 8,
            },
          },
        ]),
        groupBy: jest.fn().mockResolvedValue([
          { status: ListingStatus.ACTIVE, _count: { _all: 8 } },
          { status: ListingStatus.PENDING, _count: { _all: 4 } },
        ]),
        update: jest.fn().mockResolvedValue({ id: 'listing-1' }),
      },
      listingReport: {
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn().mockImplementation(({ data }) => ({
          ...listingReport,
          ...data,
        })),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([listingReport]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'report-1',
          listingId: 'listing-1',
        }),
        groupBy: jest
          .fn()
          .mockImplementation((args) =>
            args.by?.includes('listingId')
              ? Promise.resolve([
                  { listingId: 'listing-1', _count: { _all: 1 } },
                ])
              : Promise.resolve([
                  { status: ReportStatus.OPEN, _count: { _all: 2 } },
                ]),
          ),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...listingReport,
          ...data,
        })),
      },
      boost: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'boost-1',
            placement: 'TOP_LISTING',
            status: 'ACTIVE',
            startsAt: new Date('2026-05-25T00:00:00.000Z'),
            endsAt: new Date('2026-06-05T00:00:00.000Z'),
            createdAt: new Date('2026-05-25T00:00:00.000Z'),
            package: {
              id: 'package-1',
              slug: 'top-listing',
              name: 'Top listing',
              placement: 'TOP_LISTING',
              price: 50,
              currency: 'AED',
              durationDays: 7,
            },
            listing: {
              id: 'listing-1',
              title: 'Camera kit',
              status: ListingStatus.ACTIVE,
              sellerId: 'seller-1',
              category: {
                id: 'category-1',
                name: 'Electronics',
                slug: 'electronics',
              },
            },
            purchaser: {
              id: 'seller-1',
              displayName: 'Seller One',
              email: 'seller@example.com',
              sellerPriorityTier: 'VERIFIED',
              reputationScore: 90,
            },
            transaction: {
              id: 'transaction-boost-1',
              status: 'SUCCEEDED',
              amount: 50,
              currency: 'AED',
              provider: 'wallet',
              providerRef: 'wallet:seller-1',
              createdAt: new Date('2026-05-25T00:00:00.000Z'),
              updatedAt: new Date('2026-05-25T00:00:00.000Z'),
            },
            _count: {
              views: 11,
            },
          },
          {
            id: 'boost-2',
            placement: 'HIGHLIGHTED_LISTING',
            status: 'SCHEDULED',
            startsAt: new Date('2026-05-28T00:00:00.000Z'),
            endsAt: new Date('2026-06-04T00:00:00.000Z'),
            createdAt: new Date('2026-05-26T00:00:00.000Z'),
            package: {
              id: 'package-2',
              slug: 'highlighted',
              name: 'Highlighted listing',
              placement: 'HIGHLIGHTED_LISTING',
              price: 25,
              currency: 'AED',
              durationDays: 7,
            },
            listing: {
              id: 'listing-1',
              title: 'Camera kit',
              status: ListingStatus.ACTIVE,
              sellerId: 'seller-1',
              category: {
                id: 'category-1',
                name: 'Electronics',
                slug: 'electronics',
              },
            },
            purchaser: {
              id: 'seller-1',
              displayName: 'Seller One',
              email: 'seller@example.com',
              sellerPriorityTier: 'VERIFIED',
              reputationScore: 90,
            },
            transaction: {
              id: 'transaction-boost-2',
              status: 'PENDING',
              amount: 25,
              currency: 'AED',
              provider: 'dev',
              providerRef: 'dev-boost-2',
              createdAt: new Date('2026-05-26T00:00:00.000Z'),
              updatedAt: new Date('2026-05-26T00:00:00.000Z'),
            },
            _count: {
              views: 3,
            },
          },
        ]),
        groupBy: jest.fn().mockImplementation((args) => {
          if (args.by?.includes('listingId')) {
            return Promise.resolve([
              { listingId: 'listing-1', _count: { _all: 2 } },
            ]);
          }

          if (args.by?.includes('placement')) {
            return Promise.resolve([
              { placement: 'TOP_LISTING', _count: { _all: 1 } },
              { placement: 'HIGHLIGHTED_LISTING', _count: { _all: 1 } },
            ]);
          }

          return Promise.resolve([
            { status: 'ACTIVE', _count: { _all: 3 } },
            { status: 'SCHEDULED', _count: { _all: 1 } },
          ]);
        }),
      },
      conversation: {
        count: jest.fn().mockResolvedValue(4),
        findMany: jest.fn().mockResolvedValue([{ listingId: 'listing-1' }]),
      },
      conversationReport: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { status: ReportStatus.OPEN, _count: { _all: 1 } },
          ]),
      },
      listingView: {
        count: jest.fn().mockResolvedValue(8),
        groupBy: jest
          .fn()
          .mockResolvedValue([{ listingId: 'listing-1', _count: { _all: 8 } }]),
      },
      message: {
        count: jest.fn().mockResolvedValue(7),
      },
      messageReport: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { status: ReportStatus.OPEN, _count: { _all: 1 } },
          ]),
      },
      savedListing: {
        count: jest.fn().mockResolvedValue(5),
        groupBy: jest
          .fn()
          .mockResolvedValue([{ listingId: 'listing-1', _count: { _all: 3 } }]),
      },
      sellerRating: {
        groupBy: jest.fn().mockImplementation((args) => {
          if (args.by?.includes('sellerId') && args._avg) {
            return Promise.resolve([
              {
                sellerId: 'seller-1',
                _avg: { stars: 4.5 },
                _count: { _all: 6 },
              },
            ]);
          }

          if (args.by?.includes('sellerId')) {
            return Promise.resolve([
              {
                sellerId: 'seller-1',
                _count: { _all: 2 },
              },
            ]);
          }

          return Promise.resolve([
            {
              reviewStatus: 'PENDING',
              _count: { _all: 2 },
            },
          ]);
        }),
      },
      transaction: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 250 } })
          .mockResolvedValueOnce({ _sum: { amount: 175 } }),
        groupBy: jest.fn().mockImplementation((args) => {
          if (args.by?.includes('userId')) {
            if (args.by?.includes('type')) {
              return Promise.resolve([
                {
                  userId: 'seller-1',
                  type: 'BOOST_PURCHASE',
                  _sum: { amount: 150 },
                },
                {
                  userId: 'seller-1',
                  type: 'LISTING_FEE',
                  _sum: { amount: 100 },
                },
              ]);
            }

            return Promise.resolve([
              { userId: 'seller-1', _sum: { amount: 250 } },
            ]);
          }

          if (args.by?.includes('type')) {
            return Promise.resolve([
              { type: 'BOOST_PURCHASE', _sum: { amount: 150 } },
              { type: 'LISTING_FEE', _sum: { amount: 100 } },
            ]);
          }

          if (
            args.where?.type === 'BOOST_PURCHASE' &&
            args.by?.includes('provider')
          ) {
            return Promise.resolve([
              { provider: 'wallet', _count: { _all: 1 }, _sum: { amount: 50 } },
              { provider: 'dev', _count: { _all: 1 }, _sum: { amount: 25 } },
            ]);
          }

          if (
            args.where?.type === 'BOOST_PURCHASE' &&
            args.by?.includes('status')
          ) {
            return Promise.resolve([
              {
                status: 'SUCCEEDED',
                _count: { _all: 3 },
                _sum: { amount: 150 },
              },
              { status: 'PENDING', _count: { _all: 1 }, _sum: { amount: 25 } },
              { status: 'FAILED', _count: { _all: 1 }, _sum: { amount: 20 } },
            ]);
          }

          if (args.where?.type === 'WALLET_TOP_UP') {
            return Promise.resolve([
              {
                status: 'SUCCEEDED',
                _count: { _all: 2 },
                _sum: { amount: 300 },
              },
              { status: 'PENDING', _count: { _all: 1 }, _sum: { amount: 50 } },
            ]);
          }

          if (args.where?.provider === 'wallet') {
            return Promise.resolve([
              {
                status: 'SUCCEEDED',
                _count: { _all: 3 },
                _sum: { amount: 75 },
              },
              { status: 'FAILED', _count: { _all: 1 }, _sum: { amount: 25 } },
            ]);
          }

          return Promise.resolve([
            { status: 'SUCCEEDED', _count: { _all: 5 }, _sum: { amount: 100 } },
            { status: 'FAILED', _count: { _all: 1 }, _sum: { amount: 25 } },
          ]);
        }),
      },
      user: {
        count: jest
          .fn()
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'seller-1',
            email: 'seller@example.com',
            displayName: 'Seller One',
            phone: '+971500000000',
            emailVerified: true,
            phoneVerified: false,
            sellerPriorityTier: 'VERIFIED',
            reputationScore: 90,
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        ]),
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { sellerPriorityTier: 'VERIFIED', _count: { _all: 1 } },
          ]),
      },
      walletAccount: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { balance: 425 },
          _avg: { balance: 141.67 },
        }),
        count: jest.fn().mockImplementation((args) => {
          if (args?.where?.balance?.gt === 0) {
            return Promise.resolve(2);
          }

          if (args?.where?.balance === 0) {
            return Promise.resolve(1);
          }

          return Promise.resolve(3);
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'wallet-1',
            userId: 'seller-1',
            balance: 250,
            currency: 'AED',
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
            updatedAt: new Date('2026-05-26T00:00:00.000Z'),
            user: {
              id: 'seller-1',
              displayName: 'Seller One',
              email: 'seller@example.com',
              phoneVerified: true,
              emailVerified: true,
              sellerPriorityTier: 'VERIFIED',
              reputationScore: 90,
            },
            ledger: [
              {
                id: 'ledger-1',
                type: 'WALLET_TOP_UP',
                amount: 300,
                currency: 'AED',
                balanceAfter: 300,
                createdAt: new Date('2026-05-25T00:00:00.000Z'),
                transaction: {
                  id: 'transaction-wallet-top-up',
                  type: 'WALLET_TOP_UP',
                  status: 'SUCCEEDED',
                  provider: 'dev',
                  providerRef: 'dev-wallet-1',
                  listing: null,
                },
              },
              {
                id: 'ledger-2',
                type: 'BOOST_PURCHASE',
                amount: -50,
                currency: 'AED',
                balanceAfter: 250,
                createdAt: new Date('2026-05-26T00:00:00.000Z'),
                transaction: {
                  id: 'transaction-wallet-boost',
                  type: 'BOOST_PURCHASE',
                  status: 'SUCCEEDED',
                  provider: 'wallet',
                  providerRef: 'wallet:seller-1',
                  listing: {
                    id: 'listing-1',
                    title: 'Camera kit',
                  },
                },
              },
            ],
          },
        ]),
      },
      walletLedger: {
        aggregate: jest.fn().mockImplementation((args) => {
          if (args.where?.amount?.lt === 0) {
            return Promise.resolve({
              _count: { _all: 2 },
              _sum: { amount: -75 },
            });
          }

          return Promise.resolve({
            _count: { _all: 3 },
            _sum: { amount: 300 },
          });
        }),
        groupBy: jest.fn().mockResolvedValue([
          { type: 'WALLET_TOP_UP', _count: { _all: 2 }, _sum: { amount: 300 } },
          { type: 'ADMIN_CREDIT', _count: { _all: 1 }, _sum: { amount: 50 } },
          {
            type: 'BOOST_PURCHASE',
            _count: { _all: 2 },
            _sum: { amount: -75 },
          },
        ]),
      },
    };
    mailService = {
      sendMail: jest.fn().mockResolvedValue({
        enabled: true,
        messageId: 'message-1',
        accepted: ['admin@example.com'],
        rejected: [],
      }),
    };
    service = new ReportsService(prisma as never, mailService as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows a user to report an active listing', async () => {
    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: ' Scam listing ',
        details: ' The seller asks off-site. ',
      }),
    ).resolves.toMatchObject({
      id: 'report-1',
      listingId: 'listing-1',
      reporterId: 'user-1',
      reason: 'Scam listing',
      details: 'The seller asks off-site.',
    });

    expect(prisma.listing.findUnique).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      select: {
        id: true,
        status: true,
        sellerId: true,
      },
    });
    expect(prisma.listingReport.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 'listing-1',
        reporterId: 'user-1',
        status: ReportStatus.OPEN,
      },
      select: { id: true },
    });
    expect(prisma.listingReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          listingId: 'listing-1',
          reporterId: 'user-1',
          reason: 'Scam listing',
          details: 'The seller asks off-site.',
        },
      }),
    );
  });

  it('rejects reports for missing listings', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    await expect(
      service.createListingReport('user-1', 'missing-listing', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('rejects reports for deleted listings', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.DELETED,
      sellerId: 'seller-1',
    });

    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.listingReport.findFirst).not.toHaveBeenCalled();
    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('rejects owner reports for their own listing', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      sellerId: 'user-1',
    });

    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.listingReport.findFirst).not.toHaveBeenCalled();
    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate open reports from the same user for the same listing', async () => {
    prisma.listingReport.findFirst.mockResolvedValue({ id: 'report-open' });

    await expect(
      service.createListingReport('user-1', 'listing-1', {
        reason: 'Scam listing',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.listingReport.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 'listing-1',
        reporterId: 'user-1',
        status: ReportStatus.OPEN,
      },
      select: { id: true },
    });
    expect(prisma.listingReport.create).not.toHaveBeenCalled();
  });

  it('lists only the current user listing reports', async () => {
    await service.listMine('user-1', {
      status: ReportStatus.OPEN,
      take: 25,
    });

    expect(prisma.listingReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ReportStatus.OPEN,
          reporterId: 'user-1',
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    );
  });

  it('applies admin listing report filters', async () => {
    await service.listForAdmin({
      status: ReportStatus.REVIEWED,
      listingId: 'listing-1',
      reporterId: 'user-1',
    });

    expect(prisma.listingReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ReportStatus.REVIEWED,
          listingId: 'listing-1',
          reporterId: 'user-1',
        },
        take: 100,
      }),
    );
  });

  it('returns an admin monitoring report across marketplace signals', async () => {
    await expect(
      service.getAdminMonitoring({
        days: 14,
        topTake: 3,
      }),
    ).resolves.toMatchObject({
      overview: {
        totalUsers: 20,
        newUsers: 3,
        newUsersDelta: 2,
        totalListings: 12,
        activeListings: 8,
        openReports: 4,
        activeBoosts: 3,
      },
      commerce: {
        revenue: 250,
        revenueDelta: 75,
      },
      engagement: {
        listingViews: 8,
        savedListings: 5,
        conversations: 4,
        messages: 7,
      },
      topListings: [
        expect.objectContaining({
          id: 'listing-1',
          title: 'Camera kit',
          viewCount: 8,
        }),
      ],
    });

    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      where: {
        status: 'SUCCEEDED',
        createdAt: expect.objectContaining({
          gte: expect.any(Date),
          lte: expect.any(Date),
        }),
      },
      _sum: { amount: true },
    });
    expect(prisma.listingView.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['listingId'],
        take: 3,
      }),
    );
  });

  it('returns an active listings report with inventory and engagement signals', async () => {
    await expect(
      service.getActiveListingsReport({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        activeListings: 12,
        boostedListings: 12,
        paidListings: 12,
        manuallyPromotedListings: 12,
        pinnedListings: 12,
        categoriesRepresented: 1,
        sellersRepresented: 1,
        noRecentViews: 0,
        reportedListings: 1,
      },
      engagement: {
        views: 8,
        saves: 3,
        inquiries: 1,
        reports: 1,
        boosts: 2,
        inquiryConversionRate: 12.5,
      },
      categories: [
        expect.objectContaining({
          id: 'category-1',
          name: 'Electronics',
          activeListings: 1,
        }),
      ],
      listings: [
        expect.objectContaining({
          id: 'listing-1',
          title: 'Camera kit',
          activeBoostCount: 1,
          viewCount: 8,
          saveCount: 3,
          inquiryCount: 1,
          reportCount: 1,
          boostCount: 2,
          lifetimeViewCount: 8,
          lifetimeSaveCount: 3,
          lifetimeInquiryCount: 2,
          lifetimeReportCount: 1,
        }),
      ],
    });

    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: { status: ListingStatus.ACTIVE },
    });
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ListingStatus.ACTIVE },
      }),
    );
  });

  it('returns a paid listings report with payment and performance signals', async () => {
    await expect(
      service.getPaidListingsReport({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        paidListings: 12,
        activePaidListings: 12,
        pendingPaidListings: 12,
        paidPriorityListings: 12,
        paidFeeListings: 12,
        boostedPaidListings: 12,
        reportedPaidListings: 12,
        categoriesRepresented: 1,
        sellersRepresented: 1,
      },
      commerce: {
        revenue: 100,
        successfulPayments: 5,
        failedPayments: 1,
        paymentConversionRate: 83.3,
      },
      engagement: {
        views: 8,
        saves: 3,
        inquiries: 1,
        reports: 1,
        boosts: 2,
        inquiryConversionRate: 12.5,
      },
      paymentStatuses: {
        SUCCEEDED: 5,
        FAILED: 1,
      },
      categories: [
        expect.objectContaining({
          id: 'category-1',
          name: 'Electronics',
          paidListings: 1,
        }),
      ],
      listings: [
        expect.objectContaining({
          id: 'listing-1',
          title: 'Camera kit',
          paymentStatus: 'SUCCEEDED',
          paymentRevenue: 100,
          pendingAmount: 25,
          paymentTransactionCount: 2,
          activeBoostCount: 1,
          viewCount: 8,
          saveCount: 3,
          inquiryCount: 1,
          reportCount: 1,
          boostCount: 2,
          lifetimeViewCount: 8,
        }),
      ],
    });

    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { listingPaymentMode: 'PAID' },
          { paidPriorityEnabled: true },
        ]),
      }),
    });
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({
          type: 'LISTING_FEE',
        }),
        _sum: { amount: true },
      }),
    );
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('returns a wallet payments report with balance movement signals', async () => {
    await expect(
      service.getWalletPaymentsReport({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        totalWallets: 3,
        fundedWallets: 2,
        emptyWallets: 1,
        totalBalance: 425,
        averageBalance: 141.67,
        activeWallets: 1,
      },
      movement: {
        credits: 3,
        debits: 2,
        creditAmount: 300,
        debitAmount: 75,
        netMovement: 225,
        byType: expect.arrayContaining([
          expect.objectContaining({
            type: 'WALLET_TOP_UP',
            count: 2,
            amount: 300,
          }),
          expect.objectContaining({
            type: 'BOOST_PURCHASE',
            count: 2,
            amount: -75,
          }),
        ]),
      },
      topUps: {
        requested: 3,
        succeeded: 2,
        pending: 1,
        revenue: 300,
        pendingAmount: 50,
        conversionRate: 66.7,
      },
      walletPayments: {
        total: 4,
        succeeded: 3,
        failed: 1,
        spend: 75,
        conversionRate: 75,
      },
      wallets: [
        expect.objectContaining({
          id: 'wallet-1',
          userId: 'seller-1',
          balance: 250,
          creditTotal: 300,
          debitTotal: 50,
          netMovement: 250,
          ledgerEntryCount: 2,
          latestLedgerType: 'WALLET_TOP_UP',
        }),
      ],
    });

    expect(prisma.walletAccount.aggregate).toHaveBeenCalledWith({
      _sum: { balance: true },
      _avg: { balance: true },
    });
    expect(prisma.walletLedger.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['type'],
        _sum: { amount: true },
      }),
    );
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({
          type: 'WALLET_TOP_UP',
        }),
      }),
    );
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({
          provider: 'wallet',
        }),
      }),
    );
  });

  it('returns a boost revenue report with payment and package signals', async () => {
    await expect(
      service.getBoostRevenueReport({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        boostPurchases: 5,
        successfulPurchases: 3,
        pendingPurchases: 1,
        failedPurchases: 1,
        activeBoosts: 3,
        expiringBoosts: 3,
        packagesRepresented: 2,
        placementsRepresented: 2,
      },
      commerce: {
        revenue: 150,
        pendingRevenue: 25,
        walletRevenue: 50,
        gatewayRevenue: 100,
        averageOrderValue: 50,
        paymentConversionRate: 60,
        revenueByProvider: expect.arrayContaining([
          expect.objectContaining({
            provider: 'wallet',
            revenue: 50,
          }),
          expect.objectContaining({
            provider: 'dev',
            revenue: 25,
          }),
        ]),
      },
      boosts: {
        statuses: {
          ACTIVE: 3,
          SCHEDULED: 1,
        },
        placements: expect.arrayContaining([
          expect.objectContaining({
            placement: 'TOP_LISTING',
            boosts: 1,
            revenue: 50,
            viewCount: 11,
          }),
        ]),
      },
      packages: expect.arrayContaining([
        expect.objectContaining({
          id: 'package-1',
          name: 'Top listing',
          purchases: 1,
          revenue: 50,
          activeBoosts: 1,
          viewCount: 11,
        }),
      ]),
      topListings: [
        expect.objectContaining({
          id: 'listing-1',
          title: 'Camera kit',
          boosts: 2,
          revenue: 50,
          viewCount: 14,
        }),
      ],
      rows: [
        expect.objectContaining({
          id: 'boost-1',
          placement: 'TOP_LISTING',
          status: 'ACTIVE',
          viewCount: 11,
          transaction: expect.objectContaining({
            id: 'transaction-boost-1',
            status: 'SUCCEEDED',
            amount: 50,
            provider: 'wallet',
          }),
        }),
        expect.objectContaining({
          id: 'boost-2',
          placement: 'HIGHLIGHTED_LISTING',
          status: 'SCHEDULED',
          transaction: expect.objectContaining({
            status: 'PENDING',
            amount: 25,
          }),
        }),
      ],
    });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({
          type: 'BOOST_PURCHASE',
        }),
      }),
    );
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['provider'],
        where: expect.objectContaining({
          type: 'BOOST_PURCHASE',
          status: 'SUCCEEDED',
        }),
      }),
    );
    expect(prisma.boost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('returns a category-wise income report with payment and engagement signals', async () => {
    prisma.listing.findMany.mockResolvedValueOnce([
      {
        id: 'listing-1',
        title: 'Camera kit',
        status: ListingStatus.ACTIVE,
        sellerId: 'seller-1',
        listingPaymentMode: 'PAID',
        paidPriorityEnabled: true,
        category: {
          id: 'category-1',
          name: 'Electronics',
          slug: 'electronics',
        },
        seller: {
          id: 'seller-1',
          displayName: 'Seller One',
          email: 'seller@example.com',
          sellerPriorityTier: 'VERIFIED',
          reputationScore: 90,
        },
        transactions: [
          {
            id: 'transaction-listing-fee',
            type: 'LISTING_FEE',
            status: 'SUCCEEDED',
            amount: 100,
            currency: 'AED',
            provider: 'stripe',
            providerRef: 'pi_listing_1',
            createdAt: new Date('2026-05-25T00:00:00.000Z'),
            updatedAt: new Date('2026-05-25T00:00:00.000Z'),
          },
          {
            id: 'transaction-boost',
            type: 'BOOST_PURCHASE',
            status: 'SUCCEEDED',
            amount: 50,
            currency: 'AED',
            provider: 'wallet',
            providerRef: 'wallet:seller-1',
            createdAt: new Date('2026-05-26T00:00:00.000Z'),
            updatedAt: new Date('2026-05-26T00:00:00.000Z'),
          },
          {
            id: 'transaction-pending-boost',
            type: 'BOOST_PURCHASE',
            status: 'PENDING',
            amount: 25,
            currency: 'AED',
            provider: 'dev',
            providerRef: 'dev-boost-1',
            createdAt: new Date('2026-05-27T00:00:00.000Z'),
            updatedAt: new Date('2026-05-27T00:00:00.000Z'),
          },
          {
            id: 'transaction-refunded-listing',
            type: 'LISTING_FEE',
            status: 'REFUNDED',
            amount: 10,
            currency: 'AED',
            provider: 'stripe',
            providerRef: 'pi_refund_1',
            createdAt: new Date('2026-05-28T00:00:00.000Z'),
            updatedAt: new Date('2026-05-28T00:00:00.000Z'),
          },
        ],
        _count: {
          savedBy: 3,
          conversations: 2,
          reports: 1,
          views: 8,
        },
      },
    ]);
    prisma.transaction.groupBy.mockImplementation((args) => {
      if (args.by?.includes('status')) {
        return Promise.resolve([
          { status: 'SUCCEEDED', _count: { _all: 2 }, _sum: { amount: 150 } },
          { status: 'PENDING', _count: { _all: 1 }, _sum: { amount: 25 } },
          { status: 'REFUNDED', _count: { _all: 1 }, _sum: { amount: 10 } },
        ]);
      }

      if (args.by?.includes('type')) {
        return Promise.resolve([
          { type: 'LISTING_FEE', _count: { _all: 1 }, _sum: { amount: 100 } },
          {
            type: 'BOOST_PURCHASE',
            _count: { _all: 1 },
            _sum: { amount: 50 },
          },
        ]);
      }

      if (args.by?.includes('provider')) {
        return Promise.resolve([
          { provider: 'stripe', _count: { _all: 1 }, _sum: { amount: 100 } },
          { provider: 'wallet', _count: { _all: 1 }, _sum: { amount: 50 } },
        ]);
      }

      return Promise.resolve([]);
    });

    await expect(
      service.getCategoryIncomeReport({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        categoriesRepresented: 1,
        incomeListings: 1,
        sellersRepresented: 1,
        paidListings: 1,
        boostedListings: 1,
        totalRevenue: 150,
        listingFeeRevenue: 100,
        boostRevenue: 50,
        pendingRevenue: 25,
        refundedRevenue: 10,
        successfulPayments: 2,
        topCategory: expect.objectContaining({
          id: 'category-1',
          name: 'Electronics',
          revenue: 150,
        }),
      },
      commerce: {
        averageOrderValue: 75,
        paymentConversionRate: 50,
        revenueByType: {
          LISTING_FEE: {
            count: 1,
            revenue: 100,
          },
          BOOST_PURCHASE: {
            count: 1,
            revenue: 50,
          },
        },
        revenueByProvider: expect.arrayContaining([
          expect.objectContaining({
            provider: 'stripe',
            revenue: 100,
          }),
          expect.objectContaining({
            provider: 'wallet',
            revenue: 50,
          }),
        ]),
      },
      engagement: {
        views: 8,
        saves: 3,
        inquiries: 1,
        reports: 1,
        inquiryConversionRate: 12.5,
        averageRevenuePerInquiry: 150,
      },
      categories: [
        expect.objectContaining({
          id: 'category-1',
          listingCount: 1,
          paidListings: 1,
          boostedListings: 1,
          transactionCount: 4,
          successfulPayments: 2,
          pendingPayments: 1,
          refundedPayments: 1,
          revenueShare: 100,
          walletRevenue: 50,
          gatewayRevenue: 100,
        }),
      ],
      topListings: [
        expect.objectContaining({
          id: 'listing-1',
          revenue: 150,
          listingFeeRevenue: 100,
          boostRevenue: 50,
          pendingRevenue: 25,
          refundedRevenue: 10,
          transactionCount: 4,
        }),
      ],
    });

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({
          listingId: { not: null },
          type: {
            in: ['LISTING_FEE', 'BOOST_PURCHASE'],
          },
        }),
      }),
    );
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          transactions: {
            some: expect.objectContaining({
              listingId: { not: null },
            }),
          },
        },
      }),
    );
  });

  it('returns a total sellers report with seller performance metrics', async () => {
    prisma.user.count
      .mockReset()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(
      service.getAdminSellerReport({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        totalSellers: 1,
        activeSellers: 1,
        inactiveSellers: 0,
        newSellers: 1,
        newSellersDelta: 1,
        verifiedSellers: 1,
        tieredSellers: 1,
      },
      tiers: {
        VERIFIED: 1,
      },
      sellers: [
        expect.objectContaining({
          id: 'seller-1',
          displayName: 'Seller One',
          totalListings: 1,
          activeListings: 1,
          paidListings: 1,
          viewCount: 8,
          saveCount: 3,
          inquiryCount: 1,
          reportCount: 1,
          boostCount: 2,
          revenue: 250,
          averageRating: 4.5,
          ratingCount: 6,
          reviewCount: 2,
        }),
      ],
    });

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { listings: { some: {} } },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listings: { some: {} } },
      }),
    );
  });

  it('returns a top sellers report ranked by performance signals', async () => {
    await expect(
      service.getTopSellersReport({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        rankedSellers: 1,
        activeTopSellers: 1,
        totalRevenue: 250,
        totalViews: 8,
        totalInquiries: 1,
        averagePerformanceScore: 749,
        topSeller: expect.objectContaining({
          id: 'seller-1',
          rank: 1,
          performanceScore: 749,
        }),
      },
      leaders: {
        revenue: expect.objectContaining({
          id: 'seller-1',
          revenue: 250,
        }),
        engagement: expect.objectContaining({
          id: 'seller-1',
          viewCount: 8,
        }),
        conversion: expect.objectContaining({
          id: 'seller-1',
          inquiryConversionRate: 12.5,
        }),
        rating: expect.objectContaining({
          id: 'seller-1',
          averageRating: 4.5,
        }),
      },
      sellers: [
        expect.objectContaining({
          id: 'seller-1',
          rank: 1,
          displayName: 'Seller One',
          totalListings: 1,
          activeListings: 1,
          paidListings: 1,
          viewCount: 8,
          saveCount: 3,
          inquiryCount: 1,
          reportCount: 1,
          boostCount: 2,
          revenue: 250,
          boostRevenue: 150,
          listingFeeRevenue: 100,
          averageRating: 4.5,
          ratingCount: 6,
          reviewCount: 2,
          inquiryConversionRate: 12.5,
          performanceScore: 749,
        }),
      ],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listings: { some: {} } },
      }),
    );
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['userId', 'type'],
        where: expect.objectContaining({
          type: {
            in: ['BOOST_PURCHASE', 'LISTING_FEE'],
          },
        }),
      }),
    );
  });

  it('returns pending seller approvals with approval signals', async () => {
    prisma.user.count
      .mockReset()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'seller-1',
        email: 'seller@example.com',
        displayName: 'Seller One',
        phone: '+971500000000',
        emailVerified: true,
        phoneVerified: false,
        reputationScore: 90,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        listings: [
          {
            id: 'listing-1',
            title: 'Camera kit',
            status: ListingStatus.ACTIVE,
            createdAt: new Date('2026-05-25T00:00:00.000Z'),
            category: {
              id: 'category-1',
              name: 'Electronics',
              slug: 'electronics',
            },
          },
        ],
      },
    ]);

    await expect(
      service.getPendingSellerApprovals({
        days: 30,
        take: 25,
      }),
    ).resolves.toMatchObject({
      overview: {
        pendingApprovals: 1,
        verifiedPending: 1,
        needsContactVerification: 0,
        activePending: 1,
        highSignalApprovals: 1,
      },
      approvals: [
        expect.objectContaining({
          id: 'seller-1',
          displayName: 'Seller One',
          verifiedContact: true,
          totalListings: 1,
          activeListings: 1,
          pendingListings: 0,
          viewCount: 8,
          saveCount: 3,
          inquiryCount: 1,
          reportCount: 1,
          boostCount: 2,
          revenue: 250,
          latestListing: expect.objectContaining({
            id: 'listing-1',
            title: 'Camera kit',
          }),
        }),
      ],
    });

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        sellerPriorityTier: 'NONE',
        listings: { some: {} },
      },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sellerPriorityTier: 'NONE',
          listings: { some: {} },
        },
      }),
    );
  });

  it('emails an admin report with the current report payload attached', async () => {
    const auditLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const reportPayload = {
      range: {
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-31T00:00:00.000Z',
        days: 30,
      },
      overview: {
        activeListings: 12,
        reportedListings: 2,
      },
      listings: [
        {
          title: 'Camera kit',
          status: ListingStatus.ACTIVE,
          viewCount: 88,
          reportCount: 1,
        },
      ],
    };
    jest
      .spyOn(service, 'getActiveListingsReport')
      .mockResolvedValue(reportPayload as never);

    await expect(
      service.sendAdminReportEmail(
        'admin-1',
        AdminReportEmailType.ACTIVE_LISTINGS,
        {
          recipients: ['admin@example.com'],
          subject: 'Today active listings',
          message: 'Please review.',
          filters: {
            days: 30,
            take: 100,
          },
        },
      ),
    ).resolves.toMatchObject({
      reportType: AdminReportEmailType.ACTIVE_LISTINGS,
      recipients: ['admin@example.com'],
      subject: 'Today active listings',
      delivery: {
        messageId: 'message-1',
      },
    });

    expect(service.getActiveListingsReport).toHaveBeenCalledWith({
      days: 30,
      from: undefined,
      to: undefined,
      take: 100,
    });
    expect(mailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['admin@example.com'],
        subject: 'Today active listings',
        text: expect.stringContaining(
          'This email includes summary data and up to 10 rows',
        ),
        html: expect.stringContaining('<!doctype html>'),
        attachments: expect.arrayContaining([
          expect.objectContaining({
            filename: 'active-listings-report.pdf',
            contentType: 'application/pdf',
          }),
          expect.objectContaining({
            filename: 'active-listings-report.json',
            contentType: 'application/json',
          }),
          expect.objectContaining({
            filename: 'active-listings-listings.csv',
            contentType: 'text/csv; charset=utf-8',
          }),
        ]),
      }),
    );
    expect(mailService.sendMail.mock.calls[0][0].html).toContain(
      'Active Listings',
    );
    expect(mailService.sendMail.mock.calls[0][0].html).toContain('Camera kit');
    expect(mailService.sendMail.mock.calls[0][0].text).toContain(
      'The full report data is attached as JSON',
    );
    expect(mailService.sendMail.mock.calls[0][0].text).toContain(
      'table sections are attached as CSV files',
    );
    const csvAttachment =
      mailService.sendMail.mock.calls[0][0].attachments.find(
        (attachment: { filename: string }) =>
          attachment.filename === 'active-listings-listings.csv',
      );
    expect(csvAttachment.content).toContain(
      'Title,Status,View Count,Report Count',
    );
    expect(csvAttachment.content).toContain('Camera kit,ACTIVE,88,1');
    const pdfAttachment =
      mailService.sendMail.mock.calls[0][0].attachments.find(
        (attachment: { filename: string }) =>
          attachment.filename === 'active-listings-report.pdf',
      );
    expect(Buffer.isBuffer(pdfAttachment.content)).toBe(true);
    expect(pdfAttachment.content.toString('utf8', 0, 4)).toBe('%PDF');
    const jsonAttachment =
      mailService.sendMail.mock.calls[0][0].attachments.find(
        (attachment: { filename: string }) =>
          attachment.filename === 'active-listings-report.json',
      );
    expect(JSON.parse(jsonAttachment.content)).toMatchObject({
      reportType: AdminReportEmailType.ACTIVE_LISTINGS,
      generatedBy: 'admin-1',
      filters: {
        days: 30,
        take: 100,
      },
      report: reportPayload,
    });
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(JSON.parse(auditLog.mock.calls[0][0] as string)).toMatchObject({
      event: 'admin_report_email_sent',
      adminId: 'admin-1',
      recipients: ['admin@example.com'],
      reportType: AdminReportEmailType.ACTIVE_LISTINGS,
      subject: 'Today active listings',
      filters: {
        days: 30,
        take: 100,
      },
      delivery: {
        messageId: 'message-1',
        accepted: ['admin@example.com'],
      },
    });
  });

  it('logs failed admin report email attempts', async () => {
    const auditError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const sendError = new Error('SMTP delivery failed');

    jest.spyOn(service, 'getActiveListingsReport').mockResolvedValue({
      overview: {
        activeListings: 12,
      },
    } as never);
    mailService.sendMail.mockRejectedValueOnce(sendError);

    await expect(
      service.sendAdminReportEmail(
        'admin-1',
        AdminReportEmailType.ACTIVE_LISTINGS,
        {
          recipients: ['admin@example.com'],
          filters: {
            days: 30,
          },
        },
      ),
    ).rejects.toThrow(sendError);

    expect(auditError).toHaveBeenCalledTimes(1);
    expect(JSON.parse(auditError.mock.calls[0][0] as string)).toMatchObject({
      event: 'admin_report_email_failed',
      adminId: 'admin-1',
      recipients: ['admin@example.com'],
      reportType: AdminReportEmailType.ACTIVE_LISTINGS,
      filters: {
        days: 30,
      },
      error: {
        name: 'Error',
        message: 'SMTP delivery failed',
      },
    });
  });

  it('lets an admin review a report with status, details, and admin notes', async () => {
    await expect(
      service.updateListingReport('report-1', {
        status: ReportStatus.REVIEWED,
        details: ' Duplicate listing removed. ',
        adminNotes: ' First warning sent to seller. ',
      }),
    ).resolves.toMatchObject({
      id: 'report-1',
      status: ReportStatus.REVIEWED,
      details: 'Duplicate listing removed.',
      adminNotes: 'First warning sent to seller.',
    });

    expect(prisma.listingReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: {
          status: ReportStatus.REVIEWED,
          details: 'Duplicate listing removed.',
          adminNotes: 'First warning sent to seller.',
        },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });

  it('lets an admin action a report and moderate the listing', async () => {
    await expect(
      service.updateListingReport('report-1', {
        status: ReportStatus.ACTIONED,
        adminNotes: 'Listing removed after review.',
        listingStatus: ListingStatus.REMOVED,
      }),
    ).resolves.toMatchObject({
      id: 'report-1',
      status: ReportStatus.ACTIONED,
      adminNotes: 'Listing removed after review.',
    });

    expect(prisma.listingReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({
          status: ReportStatus.ACTIONED,
          adminNotes: 'Listing removed after review.',
        }),
      }),
    );
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: { status: ListingStatus.REMOVED },
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects empty listing report updates', async () => {
    await expect(
      service.updateListingReport('report-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.listingReport.update).not.toHaveBeenCalled();
  });

  it('returns not found for missing listing reports', async () => {
    prisma.listingReport.findUnique.mockResolvedValue(null);

    await expect(
      service.updateListingReport('missing-report', {
        status: ReportStatus.DISMISSED,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
