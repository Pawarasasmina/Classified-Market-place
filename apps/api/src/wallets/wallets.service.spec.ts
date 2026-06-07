import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let tx: {
    walletAccount: {
      upsert: jest.Mock;
      update: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
    };
    walletLedger: {
      create: jest.Mock;
    };
  };
  let prisma: {
    walletAccount: {
      upsert: jest.Mock;
      findUnique?: jest.Mock;
      create?: jest.Mock;
    };
    transaction: {
      create: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notifications: {
    notifyWalletTopUp: jest.Mock;
  };
  let paymentsService: {
    completeWalletTopUpPaymentForActor: jest.Mock;
    createWalletTopUpPaymentIntent: jest.Mock;
  };
  let service: WalletsService;

  beforeEach(() => {
    tx = {
      walletAccount: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          userId: 'seller-1',
          balance: new Prisma.Decimal(25),
          currency: 'AED',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          userId: 'seller-1',
          balance: new Prisma.Decimal(125),
          currency: 'AED',
        }),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({
          id: 'transaction-2',
          userId: 'seller-1',
          type: TransactionType.ADMIN_CREDIT,
          status: TransactionStatus.SUCCEEDED,
          amount: new Prisma.Decimal(100),
          currency: 'AED',
          provider: 'wallet',
          providerRef: 'admin-credit:seller-1:1',
          metadata: null,
        }),
      },
      walletLedger: {
        create: jest.fn().mockResolvedValue({
          id: 'ledger-1',
          walletId: 'wallet-1',
          transactionId: 'transaction-2',
          type: 'ADMIN_CREDIT',
          amount: new Prisma.Decimal(100),
          currency: 'AED',
          balanceAfter: new Prisma.Decimal(125),
        }),
      },
    };
    prisma = {
      walletAccount: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          userId: 'seller-1',
          balance: new Prisma.Decimal(25),
          currency: 'AED',
        }),
      },
      user: {
        findUnique: jest.fn(),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({
          id: 'transaction-1',
          userId: 'seller-1',
          type: TransactionType.WALLET_TOP_UP,
          status: TransactionStatus.PENDING,
          amount: new Prisma.Decimal(100),
          currency: 'AED',
          provider: 'dev',
          providerRef: null,
          metadata: null,
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'transaction-1',
          userId: 'seller-1',
          type: TransactionType.WALLET_TOP_UP,
          status: TransactionStatus.PENDING,
          amount: new Prisma.Decimal(100),
          currency: 'AED',
          ...data,
        })),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    notifications = {
      notifyWalletTopUp: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };
    paymentsService = {
      completeWalletTopUpPaymentForActor: jest.fn(),
      createWalletTopUpPaymentIntent: jest.fn().mockResolvedValue({
        provider: 'dev',
        providerRef: 'dev-wallet-payment-1',
        checkoutUrl:
          'http://127.0.0.1:3001/payments/dev/checkout/dev-wallet-payment-1',
      }),
    };
    service = new WalletsService(
      prisma as never,
      notifications as never,
      paymentsService as never,
    );
  });

  it('credits a wallet, writes a ledger entry, and notifies the seller', async () => {
    const wallet = await service.creditWallet(
      'seller-1',
      {
        amount: 100,
        note: 'Manual seller top-up',
      },
      'admin-1',
    );

    expect(wallet).toEqual(
      expect.objectContaining({
        id: 'wallet-1',
        userId: 'seller-1',
        currency: 'AED',
      }),
    );
    const walletUpdate = tx.walletAccount.update.mock.calls[0][0];
    expect(walletUpdate.where).toEqual({ id: 'wallet-1' });
    expect(walletUpdate.data.balance.toString()).toBe('125');
    expect(tx.walletLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: 'wallet-1',
          type: 'ADMIN_CREDIT',
          currency: 'AED',
          metadata: expect.objectContaining({
            note: 'Manual seller top-up',
          }),
        }),
      }),
    );
    expect(notifications.notifyWalletTopUp).toHaveBeenCalledWith({
      userId: 'seller-1',
      actorId: 'admin-1',
      transactionId: 'transaction-2',
      walletId: 'wallet-1',
      ledgerId: 'ledger-1',
      amount: expect.any(Prisma.Decimal),
      currency: 'AED',
      balanceAfter: expect.any(Prisma.Decimal),
      note: 'Manual seller top-up',
    });
  });

  it('does not fail the top-up when seller notification persistence fails', async () => {
    notifications.notifyWalletTopUp.mockRejectedValueOnce(
      new Error('notification write failed'),
    );

    await expect(
      service.creditWallet('seller-1', { amount: 100 }, 'admin-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'wallet-1',
        balance: new Prisma.Decimal(125),
      }),
    );
  });

  it('creates a seller self top-up transaction and payment intent', async () => {
    const topUp = await service.createTopUp('seller-1', {
      amount: 100,
      currency: 'AED',
    });

    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          type: TransactionType.WALLET_TOP_UP,
          status: TransactionStatus.PENDING,
          amount: expect.any(Prisma.Decimal),
          currency: 'AED',
          provider: 'dev',
        }),
      }),
    );
    expect(paymentsService.createWalletTopUpPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'transaction-1',
        userId: 'seller-1',
        amount: expect.any(Prisma.Decimal),
        currency: 'AED',
      }),
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'transaction-1' },
        data: expect.objectContaining({
          provider: 'dev',
          providerRef: 'dev-wallet-payment-1',
        }),
      }),
    );
    expect(topUp.payment).toEqual(
      expect.objectContaining({
        provider: 'dev',
        providerRef: 'dev-wallet-payment-1',
      }),
    );
  });

  it('delegates seller top-up completion to payments', async () => {
    await service.completeTopUpPayment(
      { id: 'seller-1', role: 'USER' },
      'transaction-1',
      { providerRef: 'dev-wallet-payment-1' },
    );

    expect(paymentsService.completeWalletTopUpPaymentForActor).toHaveBeenCalledWith(
      { id: 'seller-1', role: 'USER' },
      'transaction-1',
      { providerRef: 'dev-wallet-payment-1' },
    );
  });
});
