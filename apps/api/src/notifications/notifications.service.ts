import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BoostPlacement,
  ListingStatus,
  MessageType,
  NotificationType,
  Prisma,
  SellerPriorityTier,
  SellerReviewStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  listingId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  transactionId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type NotifyMessageInput = {
  recipientIds: string[];
  actorId: string;
  conversationId: string;
  messageId: string;
  listingId?: string | null;
  messageType?: MessageType;
  notificationType?: NotificationType;
  senderName: string;
  preview: string;
  metadata?: Prisma.InputJsonObject;
};

type NotifyListingStatusChangedInput = {
  userId: string;
  actorId?: string | null;
  listingId: string;
  listingTitle: string;
  status: ListingStatus;
  body?: string | null;
  metadata?: Prisma.InputJsonObject;
};

type NotifyBoostActivatedInput = {
  userId: string;
  actorId?: string | null;
  boostId?: string | null;
  listingId: string;
  listingTitle: string;
  transactionId?: string | null;
  placement?: BoostPlacement | null;
  boostPackageId?: string | null;
  boostPackageName?: string | null;
  amount?: Prisma.Decimal | string | number | null;
  currency?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  startsAt: Date;
  endsAt: Date;
  metadata?: Prisma.InputJsonObject;
};

type NotifyTransactionStatusChangedInput = {
  userId: string;
  transactionId: string;
  status: TransactionStatus;
  amount?: Prisma.Decimal | string | number | null;
  currency?: string | null;
  listingId?: string | null;
  listingTitle?: string | null;
  boostId?: string | null;
  type?: TransactionType;
  provider?: string | null;
  providerRef?: string | null;
  metadata?: Prisma.InputJsonObject;
};

type NotifyPaymentRequestedInput = {
  userId: string;
  transactionId: string;
  listingId?: string | null;
  listingTitle?: string | null;
  boostId?: string | null;
  type?: TransactionType;
  amount: Prisma.Decimal | string | number;
  currency?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  checkoutUrl?: string | null;
  metadata?: Prisma.InputJsonObject;
};

type NotifySellerRatedInput = {
  userId: string;
  actorId: string;
  ratingId?: string | null;
  listingId: string;
  listingTitle: string;
  stars: number;
  review?: string | null;
  reviewStatus?: SellerReviewStatus | null;
  updated: boolean;
  averageRating: number | null;
  ratingCount: number;
};

type NotifySellerAccountDecisionInput = {
  userId: string;
  actorId?: string | null;
  previousTier: SellerPriorityTier;
  nextTier: SellerPriorityTier;
  metadata?: Prisma.InputJsonObject;
};

type NotifyWalletTopUpInput = {
  userId: string;
  actorId?: string | null;
  transactionId?: string | null;
  walletId: string;
  ledgerId: string;
  amount: Prisma.Decimal | string | number;
  currency?: string | null;
  balanceAfter: Prisma.Decimal | string | number;
  note?: string | null;
};

const notificationInclude = {
  actor: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
  conversation: {
    select: {
      id: true,
      listingId: true,
    },
  },
  message: {
    select: {
      id: true,
      type: true,
      conversationId: true,
      listingId: true,
      createdAt: true,
    },
  },
  transaction: {
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
    },
  },
} satisfies Prisma.NotificationInclude;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? undefined,
        listingId: input.listingId ?? undefined,
        conversationId: input.conversationId ?? undefined,
        messageId: input.messageId ?? undefined,
        transactionId: input.transactionId ?? undefined,
        type: input.type,
        title: input.title,
        body: input.body ?? undefined,
        metadata: input.metadata,
      },
      include: notificationInclude,
    });
  }

  async create(input: CreateNotificationInput) {
    return this.createNotification(input);
  }

  async notifyMessage(input: NotifyMessageInput) {
    const recipientIds = [
      ...new Set(input.recipientIds.filter((id) => id !== input.actorId)),
    ];

    if (!recipientIds.length) {
      return [];
    }

    return Promise.all(
      recipientIds.map((recipientId) =>
        this.createNotification({
          userId: recipientId,
          actorId: input.actorId,
          listingId: input.listingId,
          conversationId: input.conversationId,
          messageId: input.messageId,
          type:
            input.notificationType ??
            (input.messageType === MessageType.OFFER
              ? NotificationType.OFFER
              : NotificationType.MESSAGE),
          title: `New message from ${input.senderName}`,
          body: input.preview,
          metadata: {
            deepLink: `/messages?conversation=${input.conversationId}`,
            messageType: input.messageType,
            ...input.metadata,
          },
        }),
      ),
    );
  }

  async notifyListingStatusChanged(input: NotifyListingStatusChangedInput) {
    return this.createNotification({
      userId: input.userId,
      actorId: input.actorId,
      listingId: input.listingId,
      type: NotificationType.LISTING,
      title: this.getListingStatusTitle(input.status),
      body:
        input.body ??
        `${input.listingTitle} is now ${input.status.toLowerCase()}.`,
      metadata: {
        deepLink: `/listings/${input.listingId}`,
        status: input.status,
        ...input.metadata,
      },
    });
  }

  async notifyBoostActivated(input: NotifyBoostActivatedInput) {
    return this.createNotification({
      userId: input.userId,
      actorId: input.actorId,
      listingId: input.listingId,
      transactionId: input.transactionId,
      type: NotificationType.BOOST,
      title: 'Boost activated',
      body: `${input.listingTitle} is boosted until ${this.formatNotificationDate(
        input.endsAt,
      )}.`,
      metadata: {
        deepLink: `/listings/${input.listingId}`,
        boostId: input.boostId,
        placement: input.placement,
        boostPackageId: input.boostPackageId,
        boostPackageName: input.boostPackageName,
        amount: input.amount == null ? null : String(input.amount),
        currency: input.currency,
        provider: input.provider,
        providerRef: input.providerRef,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        ...input.metadata,
      },
    });
  }

  async notifyTransactionStatusChanged(
    input: NotifyTransactionStatusChangedInput,
  ) {
    return this.createNotification({
      userId: input.userId,
      listingId: input.listingId,
      transactionId: input.transactionId,
      type: NotificationType.TRANSACTION,
      title: this.getTransactionStatusTitle(input.status),
      body: this.getTransactionStatusBody(input),
      metadata: {
        deepLink: this.getTransactionStatusDeepLink(input),
        status: input.status,
        transactionType: input.type,
        boostId: input.boostId,
        provider: input.provider,
        providerRef: input.providerRef,
        ...input.metadata,
      },
    });
  }

  async notifyPaymentRequested(input: NotifyPaymentRequestedInput) {
    return this.createNotification({
      userId: input.userId,
      listingId: input.listingId,
      transactionId: input.transactionId,
      type: NotificationType.TRANSACTION,
      title: 'Payment request created',
      body: this.getPaymentRequestBody(input),
      metadata: {
        deepLink: this.getPaymentRequestDeepLink(input),
        status: TransactionStatus.PENDING,
        transactionType: input.type,
        provider: input.provider,
        providerRef: input.providerRef,
        checkoutUrl: input.checkoutUrl,
        boostId: input.boostId,
        ...input.metadata,
      },
    });
  }

  async notifySellerRated(input: NotifySellerRatedInput) {
    const hasReview = Boolean(input.review);

    return this.createNotification({
      userId: input.userId,
      actorId: input.actorId,
      listingId: input.listingId,
      type: NotificationType.RATING,
      title: hasReview
        ? input.updated
          ? 'Customer review updated'
          : 'New customer review'
        : input.updated
          ? 'Seller rating updated'
          : 'New seller rating',
      body: hasReview
        ? this.getSellerReviewNotificationBody(input)
        : `${input.listingTitle} received ${input.stars} out of 5 stars.`,
      metadata: {
        deepLink: hasReview ? '/my-listings' : `/listings/${input.listingId}`,
        ratingId: input.ratingId,
        stars: input.stars,
        review: input.review ?? null,
        reviewStatus: input.reviewStatus ?? null,
        averageRating: input.averageRating,
        ratingCount: input.ratingCount,
      },
    });
  }

  async notifySellerAccountDecision(input: NotifySellerAccountDecisionInput) {
    if (input.previousTier === input.nextTier) {
      return null;
    }

    const approved =
      input.previousTier === SellerPriorityTier.NONE &&
      input.nextTier !== SellerPriorityTier.NONE;
    const rejected =
      input.previousTier !== SellerPriorityTier.NONE &&
      input.nextTier === SellerPriorityTier.NONE;

    return this.createNotification({
      userId: input.userId,
      actorId: input.actorId,
      type: NotificationType.SYSTEM,
      title: approved
        ? 'Seller account approved'
        : rejected
          ? 'Seller account rejected'
          : 'Seller account status updated',
      body: this.getSellerAccountDecisionBody(input.nextTier, {
        approved,
        rejected,
      }),
      metadata: {
        deepLink: '/profile',
        previousTier: input.previousTier,
        sellerPriorityTier: input.nextTier,
        ...input.metadata,
      },
    });
  }

  async notifyWalletTopUp(input: NotifyWalletTopUpInput) {
    const amount = this.formatPaymentAmount(input.amount, input.currency);
    const balanceAfter = this.formatPaymentAmount(
      input.balanceAfter,
      input.currency,
    );

    return this.createNotification({
      userId: input.userId,
      actorId: input.actorId,
      transactionId: input.transactionId,
      type: NotificationType.TRANSACTION,
      title: 'Wallet topped up',
      body: `${amount} was added to your wallet. New balance: ${balanceAfter}.`,
      metadata: {
        deepLink: '/my-listings',
        walletId: input.walletId,
        walletLedgerId: input.ledgerId,
        amount: String(input.amount),
        currency: input.currency ?? 'AED',
        balanceAfter: String(input.balanceAfter),
        note: input.note ?? null,
      },
    });
  }

  async findMine(userId: string, query: QueryNotificationsDto) {
    const take = query.take ?? 25;

    return this.prisma.notification.findMany({
      where: this.buildUserNotificationWhere(userId, query),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      include: notificationInclude,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });

    return { count };
  }

  async markRead(
    userId: string,
    notificationId: string,
    dto: MarkNotificationReadDto,
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
        readAt: true,
      },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    const read = dto.read ?? true;

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: read ? (notification.readAt ?? new Date()) : null,
      },
      include: notificationInclude,
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  async remove(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { deleted: true };
  }

  private buildUserNotificationWhere(
    userId: string,
    query: QueryNotificationsDto,
  ): Prisma.NotificationWhereInput {
    return {
      userId,
      ...(query.unread === undefined
        ? {}
        : query.unread
          ? { readAt: null }
          : { readAt: { not: null } }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.listingId ? { listingId: query.listingId } : {}),
      ...(query.conversationId ? { conversationId: query.conversationId } : {}),
      ...(query.messageId ? { messageId: query.messageId } : {}),
      ...(query.transactionId ? { transactionId: query.transactionId } : {}),
    };
  }

  private getListingStatusTitle(status: ListingStatus) {
    switch (status) {
      case ListingStatus.ACTIVE:
        return 'Listing approved';
      case ListingStatus.REJECTED:
        return 'Listing rejected';
      case ListingStatus.PENDING:
        return 'Listing submitted for review';
      case ListingStatus.DELETED:
        return 'Listing removed';
      case ListingStatus.DRAFT:
        return 'Listing saved as draft';
      default:
        return 'Listing status changed';
    }
  }

  private getTransactionStatusTitle(status: TransactionStatus) {
    switch (status) {
      case TransactionStatus.SUCCEEDED:
        return 'Payment succeeded';
      case TransactionStatus.FAILED:
        return 'Payment failed';
      case TransactionStatus.CANCELLED:
        return 'Payment cancelled';
      case TransactionStatus.REFUNDED:
        return 'Payment refunded';
      default:
        return 'Payment update';
    }
  }

  private getSellerReviewNotificationBody(input: NotifySellerRatedInput) {
    const moderationNote =
      input.reviewStatus === SellerReviewStatus.PENDING
        ? ' It is pending moderation before public display.'
        : '';

    return `${input.listingTitle} received a ${input.stars} out of 5 star customer review.${moderationNote}`;
  }

  private getTransactionStatusBody(input: NotifyTransactionStatusChangedInput) {
    const amount =
      input.amount == null
        ? null
        : this.formatPaymentAmount(input.amount, input.currency);
    const target = input.listingTitle
      ? ` for ${input.listingTitle}`
      : input.listingId
        ? ' for your listing'
        : '';

    switch (input.status) {
      case TransactionStatus.SUCCEEDED:
        return amount
          ? `Your ${amount} payment${target} was successful.`
          : `Your payment${target} was successful.`;
      case TransactionStatus.FAILED:
        return amount
          ? `Your ${amount} payment${target} failed.`
          : `Your payment${target} failed.`;
      case TransactionStatus.CANCELLED:
        return amount
          ? `Your ${amount} payment${target} was cancelled.`
          : `Your payment${target} was cancelled.`;
      case TransactionStatus.REFUNDED:
        return amount
          ? `Your ${amount} payment${target} was refunded.`
          : `Your payment${target} was refunded.`;
      default:
        return `Your payment${target} status changed.`;
    }
  }

  private getTransactionStatusDeepLink(
    input: NotifyTransactionStatusChangedInput,
  ) {
    if (input.boostId) {
      const params = new URLSearchParams({
        status: input.status,
      });

      if (input.listingId) {
        params.set('listingId', input.listingId);
      }

      params.set('transactionId', input.transactionId);

      return `/boosts/${input.boostId}/checkout?${params.toString()}`;
    }

    if (input.type === TransactionType.LISTING_FEE && input.listingId) {
      const params = new URLSearchParams({
        status: input.status,
        transactionId: input.transactionId,
      });

      return `/listings/${input.listingId}/checkout?${params.toString()}`;
    }

    return input.listingId ? `/listings/${input.listingId}` : '/transactions';
  }

  private getPaymentRequestBody(input: NotifyPaymentRequestedInput) {
    const amount = this.formatPaymentAmount(input.amount, input.currency);
    const target = input.listingTitle
      ? ` for ${input.listingTitle}`
      : input.listingId
        ? ' for your listing'
        : '';

    return `Complete your ${amount} payment${target}.`;
  }

  private getPaymentRequestDeepLink(input: NotifyPaymentRequestedInput) {
    if (input.boostId) {
      const params = new URLSearchParams({
        status: TransactionStatus.PENDING,
      });

      if (input.listingId) {
        params.set('listingId', input.listingId);
      }

      params.set('transactionId', input.transactionId);

      return `/boosts/${input.boostId}/checkout?${params.toString()}`;
    }

    if (input.type === TransactionType.LISTING_FEE && input.listingId) {
      const params = new URLSearchParams({
        status: TransactionStatus.PENDING,
        transactionId: input.transactionId,
      });

      if (input.providerRef) {
        params.set('providerRef', input.providerRef);
      }

      return `/listings/${input.listingId}/checkout?${params.toString()}`;
    }

    return input.listingId ? `/listings/${input.listingId}` : '/transactions';
  }

  private formatPaymentAmount(
    amount: Prisma.Decimal | string | number,
    currency?: string | null,
  ) {
    return `${currency ?? 'AED'} ${Number(amount).toLocaleString()}`;
  }

  private formatNotificationDate(value: Date) {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(value);
  }

  private getSellerAccountDecisionBody(
    tier: SellerPriorityTier,
    decision: { approved: boolean; rejected: boolean },
  ) {
    if (decision.approved) {
      return `Your seller account has been approved as ${this.formatSellerTier(tier)}.`;
    }

    if (decision.rejected) {
      return 'Your seller account approval was rejected or removed. Contact support if you need more details.';
    }

    return `Your seller account status changed to ${this.formatSellerTier(tier)}.`;
  }

  private formatSellerTier(tier: SellerPriorityTier) {
    return tier
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
