import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BoostPlacement,
  BoostStatus,
  ListingStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let prisma: {
    boost: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    transaction: {
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let provider: {
    name: string;
    createPaymentIntent: jest.Mock;
    parseWebhook: jest.Mock;
  };
  let service: PaymentsService;

  const transaction = {
    id: 'transaction-1',
    userId: 'seller-1',
    listingId: 'listing-1',
    type: TransactionType.BOOST_PURCHASE,
    status: TransactionStatus.PENDING,
    amount: new Prisma.Decimal(25),
    currency: 'AED',
    provider: 'dev',
    providerRef: 'dev-payment-1',
    metadata: {},
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
  };
  const boost = {
    id: 'boost-1',
    listingId: 'listing-1',
    purchaserId: 'seller-1',
    transactionId: 'transaction-1',
    placement: BoostPlacement.FEATURED,
    status: BoostStatus.SCHEDULED,
    startsAt: new Date('2026-06-01T00:00:00.000Z'),
    endsAt: new Date('2026-06-08T00:00:00.000Z'),
    transaction,
    listing: {
      id: 'listing-1',
      title: 'Clean phone',
      status: ListingStatus.ACTIVE,
      sellerId: 'seller-1',
    },
  };

  beforeEach(() => {
    prisma = {
      boost: {
        findFirst: jest.fn().mockResolvedValue(boost),
        findUnique: jest.fn().mockResolvedValue(boost),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...boost,
          ...data,
        })),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue(transaction),
        update: jest.fn().mockResolvedValue({
          ...transaction,
          status: TransactionStatus.SUCCEEDED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    provider = {
      name: 'dev',
      createPaymentIntent: jest.fn().mockResolvedValue({
        provider: 'dev',
        providerRef: 'dev-payment-1',
        checkoutUrl:
          'http://127.0.0.1:3001/payments/dev/checkout/dev-payment-1',
      }),
      parseWebhook: jest.fn().mockResolvedValue({
        provider: 'dev',
        providerRef: 'dev-payment-1',
        status: 'succeeded',
      }),
    };
    service = new PaymentsService(prisma as never, provider as never);
  });

  it('creates boost payment intents through the configured provider', async () => {
    await service.createBoostPaymentIntent({
      transactionId: 'transaction-1',
      boostId: 'boost-1',
      userId: 'seller-1',
      listingId: 'listing-1',
      amount: new Prisma.Decimal(25),
      currency: 'AED',
    });

    expect(provider.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'transaction-1',
        boostId: 'boost-1',
        amount: '25.00',
        currency: 'AED',
      }),
    );
  });

  it('marks a pending boost transaction as succeeded for the purchaser', async () => {
    await service.completeBoostPaymentForActor(
      { id: 'seller-1', role: 'USER' },
      'boost-1',
      { providerRef: 'dev-payment-1' },
    );

    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'transaction-1' },
        data: expect.objectContaining({
          status: TransactionStatus.SUCCEEDED,
          providerRef: 'dev-payment-1',
        }),
      }),
    );
    expect(prisma.boost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'boost-1' },
        data: expect.objectContaining({
          status: BoostStatus.ACTIVE,
        }),
      }),
    );
  });

  it('blocks non-purchasers from completing boost payment', async () => {
    await expect(
      service.completeBoostPaymentForActor(
        { id: 'buyer-1', role: 'USER' },
        'boost-1',
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects activating transactions that already succeeded', async () => {
    prisma.boost.findUnique.mockResolvedValue({
      ...boost,
      transaction: {
        ...transaction,
        status: TransactionStatus.SUCCEEDED,
      },
    });

    await expect(
      service.completeBoostPaymentForActor(
        { id: 'seller-1', role: 'USER' },
        'boost-1',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activates a boost from a successful provider webhook', async () => {
    await service.handleWebhook(
      'dev',
      { providerRef: 'dev-payment-1', status: 'succeeded' },
      {},
    );

    expect(provider.parseWebhook).toHaveBeenCalled();
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: {
        provider: 'dev',
        providerRef: 'dev-payment-1',
      },
    });
    expect(prisma.boost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BoostStatus.ACTIVE }),
      }),
    );
  });

  it('marks failed webhooks as terminal transaction failures', async () => {
    provider.parseWebhook.mockResolvedValue({
      provider: 'dev',
      providerRef: 'dev-payment-1',
      status: 'failed',
    });

    await service.handleWebhook(
      'dev',
      { providerRef: 'dev-payment-1', status: 'failed' },
      {},
    );

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'dev',
          providerRef: 'dev-payment-1',
          status: TransactionStatus.PENDING,
        }),
        data: expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      }),
    );
  });

  it('rejects webhooks for unconfigured providers', async () => {
    await expect(
      service.handleWebhook(
        'stripe',
        { providerRef: 'dev-payment-1', status: 'succeeded' },
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
