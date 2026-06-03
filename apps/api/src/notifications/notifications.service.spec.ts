import { NotFoundException } from '@nestjs/common';
import {
  BoostPlacement,
  ListingStatus,
  MessageType,
  NotificationType,
  SellerPriorityTier,
  SellerReviewStatus,
  TransactionStatus,
  TransactionType,
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
      boostId: 'boost-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      transactionId: 'transaction-1',
      placement: BoostPlacement.HIGHLIGHTED_LISTING,
      boostPackageId: 'package-1',
      boostPackageName: 'Highlighted listing',
      amount: 25,
      currency: 'AED',
      provider: 'wallet',
      providerRef: 'wallet-payment-1',
      startsAt: new Date('2026-06-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-08T00:00:00.000Z'),
      metadata: {
        paymentMethod: 'WALLET',
      },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          listingId: 'listing-1',
          transactionId: 'transaction-1',
          type: NotificationType.BOOST,
          title: 'Boost activated',
          body: 'Clean phone is boosted until Jun 8, 2026.',
          metadata: expect.objectContaining({
            deepLink: '/listings/listing-1',
            boostId: 'boost-1',
            placement: BoostPlacement.HIGHLIGHTED_LISTING,
            boostPackageId: 'package-1',
            boostPackageName: 'Highlighted listing',
            amount: '25',
            currency: 'AED',
            provider: 'wallet',
            providerRef: 'wallet-payment-1',
            paymentMethod: 'WALLET',
            startsAt: '2026-06-01T00:00:00.000Z',
            endsAt: '2026-06-08T00:00:00.000Z',
          }),
        }),
      }),
    );
  });

  it('creates payment success notifications linked to checkout', async () => {
    await service.notifyTransactionStatusChanged({
      userId: 'seller-1',
      listingId: 'listing-1',
      transactionId: 'transaction-1',
      status: TransactionStatus.SUCCEEDED,
      listingTitle: 'Clean phone',
      boostId: 'boost-1',
      type: TransactionType.BOOST_PURCHASE,
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
          title: 'Payment succeeded',
          body: 'Your AED 25 payment for Clean phone was successful.',
          metadata: expect.objectContaining({
            deepLink:
              '/boosts/boost-1/checkout?status=SUCCEEDED&listingId=listing-1&transactionId=transaction-1',
            status: TransactionStatus.SUCCEEDED,
            transactionType: TransactionType.BOOST_PURCHASE,
            boostId: 'boost-1',
            provider: 'dev',
            providerRef: 'dev-payment-1',
          }),
        }),
      }),
    );
  });

  it('creates payment failure notifications linked to checkout', async () => {
    await service.notifyTransactionStatusChanged({
      userId: 'seller-1',
      listingId: 'listing-1',
      transactionId: 'transaction-1',
      status: TransactionStatus.FAILED,
      listingTitle: 'Clean phone',
      boostId: 'boost-1',
      type: TransactionType.BOOST_PURCHASE,
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
          title: 'Payment failed',
          body: 'Your AED 25 payment for Clean phone failed.',
          metadata: expect.objectContaining({
            deepLink:
              '/boosts/boost-1/checkout?status=FAILED&listingId=listing-1&transactionId=transaction-1',
            status: TransactionStatus.FAILED,
            transactionType: TransactionType.BOOST_PURCHASE,
            boostId: 'boost-1',
            provider: 'dev',
            providerRef: 'dev-payment-1',
          }),
        }),
      }),
    );
  });

  it('creates payment request notifications linked to checkout', async () => {
    await service.notifyPaymentRequested({
      userId: 'seller-1',
      transactionId: 'transaction-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      boostId: 'boost-1',
      type: TransactionType.BOOST_PURCHASE,
      amount: 25,
      currency: 'AED',
      provider: 'dev',
      providerRef: 'dev-payment-1',
      checkoutUrl: 'https://payments.example/checkout',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          listingId: 'listing-1',
          transactionId: 'transaction-1',
          type: NotificationType.TRANSACTION,
          title: 'Payment request created',
          body: 'Complete your AED 25 payment for Clean phone.',
          metadata: expect.objectContaining({
            deepLink:
              '/boosts/boost-1/checkout?status=PENDING&listingId=listing-1&transactionId=transaction-1',
            status: TransactionStatus.PENDING,
            transactionType: TransactionType.BOOST_PURCHASE,
            provider: 'dev',
            providerRef: 'dev-payment-1',
            checkoutUrl: 'https://payments.example/checkout',
            boostId: 'boost-1',
          }),
        }),
      }),
    );
  });

  it('creates seller rating notifications linked to the listing', async () => {
    await service.notifySellerRated({
      userId: 'seller-1',
      actorId: 'buyer-1',
      ratingId: 'rating-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      stars: 5,
      reviewStatus: SellerReviewStatus.APPROVED,
      updated: false,
      averageRating: 4.5,
      ratingCount: 2,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          actorId: 'buyer-1',
          listingId: 'listing-1',
          type: NotificationType.RATING,
          title: 'New seller rating',
          body: 'Clean phone received 5 out of 5 stars.',
          metadata: expect.objectContaining({
            deepLink: '/listings/listing-1',
            ratingId: 'rating-1',
            stars: 5,
            reviewStatus: SellerReviewStatus.APPROVED,
            averageRating: 4.5,
            ratingCount: 2,
          }),
        }),
      }),
    );
  });

  it('creates written seller review notifications linked to the listing', async () => {
    await service.notifySellerRated({
      userId: 'seller-1',
      actorId: 'buyer-1',
      ratingId: 'rating-1',
      listingId: 'listing-1',
      listingTitle: 'Clean phone',
      stars: 5,
      review: 'Friendly seller and accurate listing.',
      reviewStatus: SellerReviewStatus.PENDING,
      updated: false,
      averageRating: 5,
      ratingCount: 1,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: NotificationType.RATING,
          title: 'New customer review',
          body: 'Clean phone received a 5 out of 5 star customer review. It is pending moderation before public display.',
          metadata: expect.objectContaining({
            deepLink: '/my-listings',
            ratingId: 'rating-1',
            review: 'Friendly seller and accurate listing.',
            reviewStatus: SellerReviewStatus.PENDING,
          }),
        }),
      }),
    );
  });

  it('creates seller account approval notifications for sellers', async () => {
    await service.notifySellerAccountDecision({
      userId: 'seller-1',
      actorId: 'admin-1',
      previousTier: SellerPriorityTier.NONE,
      nextTier: SellerPriorityTier.VERIFIED,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          actorId: 'admin-1',
          type: NotificationType.SYSTEM,
          title: 'Seller account approved',
          body: 'Your seller account has been approved as Verified.',
          metadata: expect.objectContaining({
            deepLink: '/profile',
            previousTier: SellerPriorityTier.NONE,
            sellerPriorityTier: SellerPriorityTier.VERIFIED,
          }),
        }),
      }),
    );
  });

  it('creates seller account rejection notifications for sellers', async () => {
    await service.notifySellerAccountDecision({
      userId: 'seller-1',
      actorId: 'admin-1',
      previousTier: SellerPriorityTier.AUTHORIZED,
      nextTier: SellerPriorityTier.NONE,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          actorId: 'admin-1',
          type: NotificationType.SYSTEM,
          title: 'Seller account rejected',
          metadata: expect.objectContaining({
            deepLink: '/profile',
            previousTier: SellerPriorityTier.AUTHORIZED,
            sellerPriorityTier: SellerPriorityTier.NONE,
          }),
        }),
      }),
    );
  });

  it('creates wallet top-up notifications for sellers', async () => {
    await service.notifyWalletTopUp({
      userId: 'seller-1',
      actorId: 'admin-1',
      walletId: 'wallet-1',
      ledgerId: 'ledger-1',
      amount: 100,
      currency: 'AED',
      balanceAfter: 250,
      note: 'Manual top-up',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'seller-1',
          actorId: 'admin-1',
          type: NotificationType.TRANSACTION,
          title: 'Wallet topped up',
          body: 'AED 100 was added to your wallet. New balance: AED 250.',
          metadata: expect.objectContaining({
            deepLink: '/my-listings',
            walletId: 'wallet-1',
            walletLedgerId: 'ledger-1',
            amount: '100',
            currency: 'AED',
            balanceAfter: '250',
            note: 'Manual top-up',
          }),
        }),
      }),
    );
  });
});
