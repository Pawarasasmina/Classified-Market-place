import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BoostPlacement,
  BoostStatus,
  ListingStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { BoostsService } from './boosts.service';

describe('BoostsService', () => {
  let service: BoostsService;
  let prisma: {
    listing: {
      findUnique: jest.Mock;
    };
    boost: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let paymentsService: {
    createBoostPaymentIntent: jest.Mock;
    completeBoostPaymentForActor: jest.Mock;
  };

  const listing = {
    id: 'listing-1',
    title: 'Clean phone',
    sellerId: 'seller-1',
    status: ListingStatus.ACTIVE,
  };

  beforeEach(() => {
    prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(listing),
      },
      boost: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'boost-1',
          ...data,
          transaction: {
            id: data.transactionId,
            status: TransactionStatus.PENDING,
            amount: '25.00',
            currency: 'AED',
            provider: 'dev',
            providerRef: null,
            createdAt: new Date('2026-05-19T00:00:00.000Z'),
          },
        })),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'boost-1',
          listingId: 'listing-1',
          purchaserId: 'seller-1',
          transactionId: 'transaction-1',
          transaction: {
            id: 'transaction-1',
            status: TransactionStatus.PENDING,
            amount: '25.00',
            currency: 'AED',
            provider: data.transaction?.update?.provider ?? 'dev',
            providerRef: data.transaction?.update?.providerRef ?? null,
            createdAt: new Date('2026-05-19T00:00:00.000Z'),
          },
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({ id: 'transaction-1' }),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    paymentsService = {
      createBoostPaymentIntent: jest.fn().mockResolvedValue({
        provider: 'dev',
        providerRef: 'dev-payment-1',
        checkoutUrl:
          'http://127.0.0.1:3001/payments/dev/checkout/dev-payment-1',
        metadata: { boostId: 'boost-1' },
      }),
      completeBoostPaymentForActor: jest
        .fn()
        .mockResolvedValue({ id: 'boost-1', status: BoostStatus.ACTIVE }),
    };
    service = new BoostsService(prisma as never, paymentsService as never);
  });

  it('creates a pending transaction and scheduled boost for the listing owner', async () => {
    await service.createForListing(
      { id: 'seller-1', role: 'USER' },
      'listing-1',
      {},
    );

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          listingId: 'listing-1',
          type: TransactionType.BOOST_PURCHASE,
          status: TransactionStatus.PENDING,
          currency: 'AED',
        }),
      }),
    );
    expect(prisma.boost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingId: 'listing-1',
          purchaserId: 'seller-1',
          transactionId: 'transaction-1',
          placement: BoostPlacement.FEATURED,
          status: BoostStatus.SCHEDULED,
        }),
      }),
    );
    expect(paymentsService.createBoostPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'transaction-1',
        boostId: 'boost-1',
        amount: expect.anything(),
        currency: 'AED',
      }),
    );
    expect(prisma.boost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'boost-1' },
        data: expect.objectContaining({
          transaction: {
            update: expect.objectContaining({
              provider: 'dev',
              providerRef: 'dev-payment-1',
            }),
          },
        }),
      }),
    );
  });

  it('blocks non-owners from boosting a listing', async () => {
    await expect(
      service.createForListing(
        { id: 'buyer-1', role: 'USER' },
        'listing-1',
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.boost.create).not.toHaveBeenCalled();
  });

  it('allows admins to boost an active listing', async () => {
    await service.createForListing(
      { id: 'admin-1', role: 'ADMIN' },
      'listing-1',
      { placement: BoostPlacement.SEARCH_TOP },
    );

    expect(prisma.boost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaserId: 'admin-1',
          transactionId: 'transaction-1',
          placement: BoostPlacement.SEARCH_TOP,
          status: BoostStatus.SCHEDULED,
        }),
      }),
    );
  });

  it('rejects boosting listings that are not active', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      status: ListingStatus.PENDING,
    });

    await expect(
      service.createForListing(
        { id: 'seller-1', role: 'USER' },
        'listing-1',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([ListingStatus.REJECTED, ListingStatus.SOLD, ListingStatus.EXPIRED])(
    'rejects boosting %s listings',
    async (status) => {
      prisma.listing.findUnique.mockResolvedValue({
        ...listing,
        status,
      });

      await expect(
        service.createForListing(
          { id: 'seller-1', role: 'USER' },
          'listing-1',
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.boost.create).not.toHaveBeenCalled();
    },
  );

  it('treats deleted listings as not found when boosting', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...listing,
      status: ListingStatus.DELETED,
    });

    await expect(
      service.createForListing(
        { id: 'seller-1', role: 'USER' },
        'listing-1',
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.boost.create).not.toHaveBeenCalled();
  });

  it('rejects overlapping boosts for the same listing placement', async () => {
    prisma.boost.findFirst.mockResolvedValue({ id: 'boost-existing' });

    await expect(
      service.createForListing({ id: 'seller-1', role: 'USER' }, 'listing-1', {
        placement: BoostPlacement.CATEGORY_TOP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects boost end dates before start dates', async () => {
    await expect(
      service.createForListing({ id: 'seller-1', role: 'USER' }, 'listing-1', {
        startsAt: '2026-06-10T00:00:00.000Z',
        endsAt: '2026-06-09T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only currently active boosts for a public listing lookup', async () => {
    await service.listActiveForListing('listing-1');

    expect(prisma.boost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          listingId: 'listing-1',
          status: BoostStatus.ACTIVE,
        }),
      }),
    );
  });

  it('rejects public listing boost lookup for missing listings', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    await expect(
      service.listActiveForListing('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates payment success to the payment service', async () => {
    await service.markPaymentSucceeded(
      { id: 'seller-1', role: 'USER' },
      'boost-1',
      { providerRef: 'pay-dev-1' },
    );

    expect(paymentsService.completeBoostPaymentForActor).toHaveBeenCalledWith(
      { id: 'seller-1', role: 'USER' },
      'boost-1',
      { providerRef: 'pay-dev-1' },
    );
  });
});
