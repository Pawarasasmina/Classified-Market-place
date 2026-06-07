import {
  BoostPlacement,
  BoostStatus,
  ListingStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { BoostExpirationService } from './boost-expiration.service';
import { BoostsService } from './boosts.service';

type StoredBoost = {
  id: string;
  status: BoostStatus;
  startsAt: Date;
  endsAt: Date;
  transaction: { providerRef: string | null };
};

type StoredTransaction = {
  id: string;
  status: TransactionStatus;
  provider: string;
  providerRef: string | null;
};

type WalletUpdateArgs = {
  data: { balance: Prisma.Decimal };
};

type TransactionCreateArgs = {
  data: {
    type: TransactionType;
    status: TransactionStatus;
    provider: string;
    providerRef: string | null;
  };
};

type BoostCreateArgs = {
  data: {
    status: BoostStatus;
    startsAt: Date;
    endsAt: Date;
  };
};

type BoostUpdateManyArgs = {
  where: {
    status: { in: BoostStatus[] };
    endsAt: { lte: Date };
  };
  data: { status: BoostStatus };
};

describe('Seller boost purchase lifecycle integration', () => {
  it('activates a wallet-purchased package and expires it after its window', async () => {
    const startsAt = new Date(Date.now() + 60_000);
    const boostPackage = {
      id: 'package-1',
      name: 'Premium boost',
      placement: BoostPlacement.TOP_LISTING,
      price: new Prisma.Decimal(35),
      currency: 'AED',
      durationDays: 1,
      isActive: true,
    };
    const listing = {
      id: 'listing-1',
      title: 'Seller phone',
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
      categoryId: 'category-1',
      category: { id: 'category-1', parentId: null },
    };
    const wallet = {
      id: 'wallet-1',
      userId: 'seller-1',
      balance: new Prisma.Decimal(100),
      currency: 'AED',
    };
    let storedBoost: StoredBoost | undefined;
    let storedTransaction: StoredTransaction | undefined;
    const walletLedgerCreate = jest.fn(() => ({ id: 'ledger-1' }));
    const transactionCreate = jest.fn(({ data }: TransactionCreateArgs) => {
      storedTransaction = {
        id: 'transaction-1',
        status: data.status,
        provider: data.provider,
        providerRef: data.providerRef,
      };
      return { id: storedTransaction.id };
    });
    const boostUpdateMany = jest.fn(({ where, data }: BoostUpdateManyArgs) => {
      if (
        storedBoost &&
        where.status.in.includes(storedBoost.status) &&
        storedBoost.endsAt <= where.endsAt.lte
      ) {
        storedBoost.status = data.status;
        return { count: 1 };
      }

      return { count: 0 };
    });

    const prisma = {
      listing: {
        findUnique: jest.fn().mockResolvedValue(listing),
      },
      boostPackage: {
        findFirst: jest.fn().mockResolvedValue(boostPackage),
      },
      walletAccount: {
        upsert: jest.fn().mockResolvedValue(wallet),
        update: jest.fn().mockImplementation(({ data }: WalletUpdateArgs) => ({
          ...wallet,
          ...data,
        })),
      },
      walletLedger: {
        create: walletLedgerCreate,
      },
      transaction: {
        create: transactionCreate,
      },
      boost: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: BoostCreateArgs) => {
          storedBoost = {
            id: 'boost-1',
            status: data.status,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            transaction: {
              providerRef: storedTransaction?.providerRef ?? null,
            },
          };
          return storedBoost;
        }),
        updateMany: boostUpdateMany,
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: never) => Promise<unknown>) => callback(prisma as never),
    );
    const boostsService = new BoostsService(prisma as never, {} as never);
    const expirationService = new BoostExpirationService(prisma as never);

    const purchasedBoost = (await boostsService.createForListing(
      { id: 'seller-1', role: 'USER' },
      listing.id,
      {
        packageId: boostPackage.id,
        paymentMethod: 'WALLET',
        startsAt: startsAt.toISOString(),
      },
    )) as unknown as StoredBoost & { payment: { provider: string } };

    expect(purchasedBoost).toMatchObject({
      id: 'boost-1',
      status: BoostStatus.ACTIVE,
      payment: { provider: 'wallet' },
    });
    expect(storedTransaction).toMatchObject({
      status: TransactionStatus.SUCCEEDED,
      provider: 'wallet',
    });
    const transactionCall = transactionCreate.mock.calls[0]?.[0];
    expect(transactionCall?.data.type).toBe(TransactionType.BOOST_PURCHASE);
    expect(transactionCall?.data.status).toBe(TransactionStatus.SUCCEEDED);
    expect(walletLedgerCreate).toHaveBeenCalled();

    await expect(
      expirationService.expireEndedBoosts(
        new Date(purchasedBoost.endsAt.getTime() + 1),
      ),
    ).resolves.toEqual({ count: 1 });
    expect(storedBoost?.status).toBe(BoostStatus.EXPIRED);
  });
});
