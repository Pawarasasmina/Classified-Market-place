import { NotFoundException } from '@nestjs/common';
import {
  ListingStatus,
  MessageType,
  NotificationType,
  TransactionStatus,
} from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let prisma: {
    notification: {
      count: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'notification-1',
          readAt: null,
          createdAt: new Date('2026-05-20T00:00:00.000Z'),
          updatedAt: new Date('2026-05-20T00:00:00.000Z'),
          ...data,
        })),
        delete: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          readAt: null,
        }),
        update: jest.fn().mockImplementation(({ data }) => ({
          id: 'notification-1',
          userId: 'user-1',
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    service = new NotificationsService(prisma as never);
  });

  it('scopes notification list queries to the current user', async () => {
    await service.findMine('user-1', {
      unread: true,
      type: NotificationType.MESSAGE,
      take: 10,
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          readAt: null,
          type: NotificationType.MESSAGE,
        }),
        take: 10,
      }),
    );
  });

  it('counts only unread notifications for the current user', async () => {
    await expect(service.getUnreadCount('user-1')).resolves.toEqual({
      count: 2,
    });

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        readAt: null,
      },
    });
  });

  it('marks a current user notification as read', async () => {
    await service.markRead('user-1', 'notification-1', { read: true });

    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notification-1' },
        data: {
          readAt: expect.any(Date),
        },
      }),
    );
  });

  it('rejects marking another user notification as read', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'notification-1',
      userId: 'user-2',
      readAt: null,
    });

    await expect(
      service.markRead('user-1', 'notification-1', { read: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread notifications for the current user as read', async () => {
    await expect(service.markAllRead('user-1')).resolves.toEqual({ count: 2 });

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });
  });

  it('creates message notification rows for recipients and skips the actor', async () => {
    await service.notifyMessage({
      recipientIds: ['user-2', 'user-2', 'user-1'],
      actorId: 'user-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      listingId: 'listing-1',
      messageType: MessageType.OFFER,
      senderName: 'Buyer',
      preview: 'AED 850 offer',
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-2',
          actorId: 'user-1',
          listingId: 'listing-1',
          conversationId: 'conversation-1',
          messageId: 'message-1',
          type: NotificationType.OFFER,
          title: 'New message from Buyer',
          body: 'AED 850 offer',
          metadata: expect.objectContaining({
            deepLink: '/messages?conversation=conversation-1',
            messageType: MessageType.OFFER,
          }),
        }),
      }),
    );
  });

  it('creates listing status notifications with listing deep links', async () => {
    await service.notifyListingStatusChanged({
      userId: 'seller-1',
      actorId: 'admin-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      status: ListingStatus.ACTIVE,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          actorId: 'admin-1',
          listingId: 'listing-1',
          type: NotificationType.LISTING,
          title: 'Listing approved',
          metadata: expect.objectContaining({
            deepLink: '/listings/listing-1',
            status: ListingStatus.ACTIVE,
          }),
        }),
      }),
    );
  });

  it('creates boost activation notifications with transaction metadata', async () => {
    await service.notifyBoostActivated({
      userId: 'seller-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      transactionId: 'transaction-1',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-08T00:00:00.000Z'),
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          listingId: 'listing-1',
          transactionId: 'transaction-1',
          type: NotificationType.BOOST,
          metadata: expect.objectContaining({
            deepLink: '/listings/listing-1',
            startsAt: '2026-06-01T00:00:00.000Z',
            endsAt: '2026-06-08T00:00:00.000Z',
          }),
        }),
      }),
    );
  });

  it('creates transaction status notifications linked to transactions', async () => {
    await service.notifyTransactionStatusChanged({
      userId: 'seller-1',
      listingId: 'listing-1',
      transactionId: 'transaction-1',
      status: TransactionStatus.REFUNDED,
      amount: 25,
      currency: 'AED',
      provider: 'dev',
      providerRef: 'dev-payment-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          listingId: 'listing-1',
          transactionId: 'transaction-1',
          type: NotificationType.TRANSACTION,
          title: 'Payment refunded',
          body: 'Your payment of AED 25 was refunded.',
          metadata: expect.objectContaining({
            deepLink: '/listings/listing-1',
            status: TransactionStatus.REFUNDED,
            provider: 'dev',
            providerRef: 'dev-payment-1',
          }),
        }),
      }),
    );
  });
});
