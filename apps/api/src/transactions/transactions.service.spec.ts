import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let prisma: {
    transaction: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let service: TransactionsService;

  const transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    listingId: 'listing-1',
    type: TransactionType.BOOST_PURCHASE,
    status: TransactionStatus.SUCCEEDED,
    amount: '25.00',
    currency: 'AED',
    provider: 'dev',
    providerRef: 'dev-payment-1',
    metadata: {},
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([transaction]),
        findUnique: jest.fn().mockResolvedValue(transaction),
      },
    };
    service = new TransactionsService(prisma as never);
  });

  it('lists only the current user transactions for payment history', async () => {
    await service.listMine('user-1', {
      status: TransactionStatus.SUCCEEDED,
      take: 25,
    });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: TransactionStatus.SUCCEEDED,
          userId: 'user-1',
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    );
  });

  it('allows the owner to view a transaction', async () => {
    await expect(
      service.findOne({ id: 'user-1', role: 'USER' }, 'transaction-1'),
    ).resolves.toMatchObject({
      id: 'transaction-1',
      userId: 'user-1',
    });
  });

  it('allows admins to view another user transaction', async () => {
    await expect(
      service.findOne({ id: 'admin-1', role: 'ADMIN' }, 'transaction-1'),
    ).resolves.toMatchObject({
      id: 'transaction-1',
      userId: 'user-1',
    });
  });

  it('blocks non-owners from viewing a transaction', async () => {
    await expect(
      service.findOne({ id: 'user-2', role: 'USER' }, 'transaction-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for missing transactions', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.findOne({ id: 'user-1', role: 'USER' }, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('applies admin filters for status, type, user, and listing', async () => {
    await service.listForAdmin({
      status: TransactionStatus.PENDING,
      type: TransactionType.BOOST_PURCHASE,
      userId: 'user-1',
      listingId: 'listing-1',
    });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: TransactionStatus.PENDING,
          type: TransactionType.BOOST_PURCHASE,
          userId: 'user-1',
          listingId: 'listing-1',
        },
        take: 100,
      }),
    );
  });
});
