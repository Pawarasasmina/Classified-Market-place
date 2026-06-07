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
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    walletAccount: {
      upsert: jest.Mock;
      update: jest.Mock;
    };
    walletLedger: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let provider: {
    name: string;
    createPaymentIntent: jest.Mock;
    parseWebhook: jest.Mock;
  };
  let notifications: {
    notifyBoostActivated: jest.Mock;
    notifyPaymentRequested: jest.Mock;
    notifyTransactionStatusChanged: jest.Mock;
    notifyWalletTopUp: jest.Mock;
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
        findUnique: jest.fn().mockResolvedValue(transaction),
        findFirst: jest.fn().mockResolvedValue(transaction),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...transaction,
          ...data,
        })),
      },
      walletAccount: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          userId: 'seller-1',
          balance: new Prisma.Decimal(25),
          currency: 'AED',
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'wallet-1',
          userId: 'seller-1',
          balance: data.balance,
          currency: 'AED',
        })),
      },
      walletLedger: {
        create: jest.fn().mockResolvedValue({
          id: 'ledger-1',
          walletId: 'wallet-1',
          transactionId: 'transaction-1',
        }),
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
    notifications = {
      notifyBoostActivated: jest.fn(),
      notifyPaymentRequested: jest.fn(),
      notifyTransactionStatusChanged: jest.fn(),
      notifyWalletTopUp: jest.fn(),
    };
    service = new PaymentsService(
      prisma as never,
      provider,
      notifications as never,
    );
  });

  it('creates boost payment intents through the configured provider', async () => {
    await service.createBoostPaymentIntent({
      transactionId: 'transaction-1',
      boostId: 'boost-1',
      userId: 'seller-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      type: TransactionType.BOOST_PURCHASE,
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
    expect(notifications.notifyPaymentRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        transactionId: 'transaction-1',
        listingId: 'listing-1',
        listingTitle: 'Clean phone',
        boostId: 'boost-1',
        type: TransactionType.BOOST_PURCHASE,
        amount: expect.any(Prisma.Decimal),
        currency: 'AED',
        provider: 'dev',
        providerRef: 'dev-payment-1',
        checkoutUrl:
          'http://127.0.0.1:3001/payments/dev/checkout/dev-payment-1',
      }),
    );
  });

  it('creates wallet top-up payment intents through the configured provider', async () => {
    await service.createWalletTopUpPaymentIntent({
      transactionId: 'transaction-1',
      userId: 'seller-1',
      amount: new Prisma.Decimal(100),
      currency: 'AED',
    });

    expect(provider.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'transaction-1',
        boostId: null,
        listingId: null,
        amount: '100.00',
        currency: 'AED',
      }),
    );
    expect(notifications.notifyPaymentRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        transactionId: 'transaction-1',
        type: TransactionType.WALLET_TOP_UP,
        amount: expect.any(Prisma.Decimal),
        currency: 'AED',
        provider: 'dev',
        providerRef: 'dev-payment-1',
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
    expect(notifications.notifyBoostActivated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        listingId: 'listing-1',
        listingTitle: 'Clean phone',
        transactionId: 'transaction-1',
        startsAt: expect.any(Date),
        endsAt: expect.any(Date),
      }),
    );
    expect(notifications.notifyTransactionStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        transactionId: 'transaction-1',
        listingId: 'listing-1',
        listingTitle: 'Clean phone',
        boostId: 'boost-1',
        type: TransactionType.BOOST_PURCHASE,
        status: TransactionStatus.SUCCEEDED,
        amount: transaction.amount,
        currency: 'AED',
        provider: 'dev',
        providerRef: 'dev-payment-1',
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
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider: 'dev',
          providerRef: 'dev-payment-1',
        },
      }),
    );
    expect(prisma.boost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BoostStatus.ACTIVE }),
      }),
    );
  });

  it('credits the seller wallet from a successful top-up webhook', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      ...transaction,
      type: TransactionType.WALLET_TOP_UP,
      amount: new Prisma.Decimal(100),
      listingId: null,
    });

    await service.handleWebhook(
      'dev',
      { providerRef: 'dev-payment-1', status: 'succeeded' },
      {},
    );

    expect(prisma.walletAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wallet-1' },
        data: {
          balance: expect.any(Prisma.Decimal),
        },
      }),
    );
    expect(prisma.walletLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: 'wallet-1',
          transactionId: 'transaction-1',
          type: 'SELF_TOP_UP',
          amount: expect.any(Prisma.Decimal),
          currency: 'AED',
        }),
      }),
    );
    expect(notifications.notifyWalletTopUp).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        transactionId: 'transaction-1',
        walletId: 'wallet-1',
        ledgerId: 'ledger-1',
        amount: expect.any(Prisma.Decimal),
        currency: 'AED',
      }),
    );
  });

  it('treats repeated successful provider webhooks as idempotent', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      ...transaction,
      status: TransactionStatus.SUCCEEDED,
      metadata: {
        paidAt: '2026-05-19T00:00:00.000Z',
      },
    });
    prisma.boost.findFirst
      .mockResolvedValueOnce({
        ...boost,
        status: BoostStatus.ACTIVE,
      })
      .mockResolvedValueOnce({
        ...boost,
        status: BoostStatus.ACTIVE,
      });

    await expect(
      service.handleWebhook(
        'dev',
        { providerRef: 'dev-payment-1', status: 'succeeded' },
        {},
      ),
    ).resolves.toMatchObject({
      received: true,
      status: 'succeeded',
      payment: expect.objectContaining({
        id: 'boost-1',
        status: BoostStatus.ACTIVE,
      }),
    });

    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(prisma.boost.update).not.toHaveBeenCalled();
    expect(notifications.notifyBoostActivated).not.toHaveBeenCalled();
    expect(notifications.notifyTransactionStatusChanged).not.toHaveBeenCalled();
  });

  it('marks failed webhooks as terminal transaction failures', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      ...transaction,
      metadata: {
        checkoutUrl: 'https://payments.example/checkout',
      },
    });
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

    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'transaction-1' },
        data: expect.objectContaining({
          status: TransactionStatus.FAILED,
          metadata: expect.objectContaining({
            checkoutUrl: 'https://payments.example/checkout',
            terminalPaymentStatus: 'failed',
            terminalAt: expect.any(String),
          }),
        }),
      }),
    );
    expect(notifications.notifyTransactionStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        transactionId: 'transaction-1',
        listingId: 'listing-1',
        listingTitle: 'Clean phone',
        boostId: 'boost-1',
        type: TransactionType.BOOST_PURCHASE,
        status: TransactionStatus.FAILED,
      }),
    );
  });

  it('marks refunded webhooks as refunded and keeps metadata', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      ...transaction,
      status: TransactionStatus.SUCCEEDED,
      metadata: {
        paidAt: '2026-05-19T00:00:00.000Z',
      },
    });
    provider.parseWebhook.mockResolvedValue({
      provider: 'dev',
      providerRef: 'dev-payment-1',
      status: 'refunded',
    });

    await service.handleWebhook(
      'dev',
      { providerRef: 'dev-payment-1', status: 'refunded' },
      {},
    );

    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'transaction-1' },
        data: expect.objectContaining({
          status: TransactionStatus.REFUNDED,
          metadata: expect.objectContaining({
            paidAt: '2026-05-19T00:00:00.000Z',
            terminalPaymentStatus: 'refunded',
          }),
        }),
      }),
    );
    expect(notifications.notifyTransactionStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        transactionId: 'transaction-1',
        listingId: 'listing-1',
        listingTitle: 'Clean phone',
        boostId: 'boost-1',
        type: TransactionType.BOOST_PURCHASE,
        status: TransactionStatus.REFUNDED,
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
