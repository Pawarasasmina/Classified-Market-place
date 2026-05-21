import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ListingStatus,
  MessageType,
  NotificationType,
  Prisma,
  TransactionStatus,
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
  listingId: string;
  listingTitle: string;
  transactionId?: string | null;
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
  provider?: string | null;
  providerRef?: string | null;
  metadata?: Prisma.InputJsonObject;
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
      body: `${input.listingTitle} is boosted until ${input.endsAt.toISOString()}.`,
      metadata: {
        deepLink: `/listings/${input.listingId}`,
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
        deepLink: input.listingId
          ? `/listings/${input.listingId}`
          : '/notifications',
        status: input.status,
        provider: input.provider,
        providerRef: input.providerRef,
        ...input.metadata,
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

  private getTransactionStatusBody(input: NotifyTransactionStatusChangedInput) {
    const amount =
      input.amount == null
        ? null
        : `${input.currency ?? 'AED'} ${Number(input.amount).toLocaleString()}`;

    switch (input.status) {
      case TransactionStatus.SUCCEEDED:
        return amount
          ? `Your payment of ${amount} was successful.`
          : 'Your payment was successful.';
      case TransactionStatus.FAILED:
        return amount
          ? `Your payment of ${amount} failed.`
          : 'Your payment failed.';
      case TransactionStatus.CANCELLED:
        return amount
          ? `Your payment of ${amount} was cancelled.`
          : 'Your payment was cancelled.';
      case TransactionStatus.REFUNDED:
        return amount
          ? `Your payment of ${amount} was refunded.`
          : 'Your payment was refunded.';
      default:
        return 'Your payment status changed.';
    }
  }
}
