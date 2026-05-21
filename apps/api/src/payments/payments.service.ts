import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BoostStatus, ListingStatus, TransactionStatus } from '@prisma/client';
import type { Prisma, Transaction } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER } from './payment-provider';
import type {
  PaymentIntent,
  PaymentProvider,
  PaymentWebhookEvent,
} from './payment-provider';

type ActingUser = {
  id: string;
  role: string;
};

type CompleteBoostPaymentInput = {
  providerRef?: string;
  startsAt?: string;
  endsAt?: string;
  durationDays?: number;
};

const defaultBoostDurationDays = 7;

const boostInclude = {
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      sellerId: true,
      categoryId: true,
    },
  },
  purchaser: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
  transaction: {
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      provider: true,
      providerRef: true,
      createdAt: true,
    },
  },
} satisfies Prisma.BoostInclude;

function isAdminRole(role: string) {
  return role.toUpperCase() === 'ADMIN';
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDateInput(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Boost dates must be valid ISO timestamps');
  }

  return date;
}

function mergeMetadata(
  existing: Prisma.JsonValue | null,
  next: Prisma.InputJsonObject,
) {
  const existingObject =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Prisma.InputJsonObject)
      : {};

  return {
    ...existingObject,
    ...next,
  } satisfies Prisma.InputJsonObject;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
    private readonly notifications?: NotificationsService,
  ) {}

  get providerName() {
    return this.paymentProvider.name;
  }

  createBoostPaymentIntent(input: {
    transactionId: string;
    boostId: string;
    userId: string;
    listingId: string;
    amount: Prisma.Decimal;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    return this.paymentProvider.createPaymentIntent({
      ...input,
      amount: input.amount.toFixed(2),
    });
  }

  async completeBoostPaymentForActor(
    user: ActingUser,
    boostId: string,
    input: CompleteBoostPaymentInput,
  ) {
    const boost = await this.prisma.boost.findUnique({
      where: { id: boostId },
      include: {
        transaction: true,
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
            sellerId: true,
          },
        },
      },
    });

    if (!boost || boost.listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Boost not found');
    }

    if (!isAdminRole(user.role) && boost.purchaserId !== user.id) {
      throw new ForbiddenException(
        'You can only complete your own boost payment',
      );
    }

    if (!boost.transactionId || !boost.transaction) {
      throw new BadRequestException(
        'Boost does not have a pending transaction',
      );
    }

    return this.activateBoostPayment(boost, boost.transaction, input);
  }

  async handleWebhook(
    providerName: string,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (providerName !== this.paymentProvider.name) {
      throw new NotFoundException('Payment provider not configured');
    }

    const event = await this.paymentProvider.parseWebhook(payload, headers);

    if (event.status === 'succeeded') {
      const boost = await this.completeBoostPaymentByProviderRef(event);

      return {
        received: true,
        status: event.status,
        boost,
      };
    }

    const { transaction, changed } = await this.markTransactionTerminal(event);

    if (changed) {
      await this.notifyTransactionStatusChanged(transaction);
    }

    return {
      received: true,
      status: event.status,
      transaction,
    };
  }

  private async completeBoostPaymentByProviderRef(event: PaymentWebhookEvent) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        provider: event.provider,
        providerRef: event.providerRef,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const boost = await this.prisma.boost.findFirst({
      where: { transactionId: transaction.id },
      include: {
        transaction: true,
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
            sellerId: true,
          },
        },
      },
    });

    if (!boost) {
      throw new NotFoundException('Boost not found');
    }

    if (transaction.status === TransactionStatus.SUCCEEDED) {
      return this.prisma.boost.findFirst({
        where: { transactionId: transaction.id },
        include: boostInclude,
      });
    }

    return this.activateBoostPayment(boost, transaction, {
      providerRef: event.providerRef,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      durationDays: event.durationDays,
    });
  }

  private async markTransactionTerminal(event: PaymentWebhookEvent) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        provider: event.provider,
        providerRef: event.providerRef,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const status = this.getTerminalTransactionStatus(event);

    if (transaction.status === status) {
      return { transaction, changed: false };
    }

    if (!this.canApplyTerminalStatus(transaction.status, status)) {
      return { transaction, changed: false };
    }

    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status,
        metadata: mergeMetadata(transaction.metadata, {
          terminalPaymentStatus: event.status,
          terminalAt: new Date().toISOString(),
        }),
      },
    });

    return { transaction: updatedTransaction, changed: true };
  }

  private getTerminalTransactionStatus(event: PaymentWebhookEvent) {
    switch (event.status) {
      case 'failed':
        return TransactionStatus.FAILED;
      case 'cancelled':
        return TransactionStatus.CANCELLED;
      case 'refunded':
        return TransactionStatus.REFUNDED;
      default:
        return TransactionStatus.CANCELLED;
    }
  }

  private canApplyTerminalStatus(
    currentStatus: TransactionStatus,
    nextStatus: TransactionStatus,
  ) {
    if (nextStatus === TransactionStatus.REFUNDED) {
      return (
        currentStatus === TransactionStatus.PENDING ||
        currentStatus === TransactionStatus.SUCCEEDED
      );
    }

    return currentStatus === TransactionStatus.PENDING;
  }

  private async activateBoostPayment(
    boost: {
      id: string;
      status: BoostStatus;
      startsAt: Date;
      endsAt: Date;
      listing: {
        id: string;
        title: string;
        status: ListingStatus;
        sellerId: string;
      };
    },
    transaction: Transaction,
    input: CompleteBoostPaymentInput,
  ) {
    if (transaction.status === TransactionStatus.SUCCEEDED) {
      throw new BadRequestException('Boost payment has already succeeded');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Boost payment is not pending');
    }

    if (
      boost.status === BoostStatus.CANCELLED ||
      boost.status === BoostStatus.EXPIRED
    ) {
      throw new BadRequestException('This boost can no longer be activated');
    }

    if (boost.listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException(
        'Only active listings can have active boosts',
      );
    }

    const now = new Date();
    const originalDurationMs = Math.max(
      boost.endsAt.getTime() - boost.startsAt.getTime(),
      defaultBoostDurationDays * 24 * 60 * 60 * 1000,
    );
    const startsAt = parseDateInput(input.startsAt, now);
    const endsAt = parseDateInput(
      input.endsAt,
      input.durationDays
        ? addDays(startsAt, input.durationDays)
        : new Date(startsAt.getTime() + originalDurationMs),
    );

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException(
        'Boost end time must be after the start time',
      );
    }

    if (endsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Boost end time must be in the future');
    }

    const updatedBoost = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.SUCCEEDED,
          providerRef: input.providerRef ?? transaction.providerRef,
          metadata: mergeMetadata(transaction.metadata, {
            paidAt: now.toISOString(),
            activatedStartsAt: startsAt.toISOString(),
            activatedEndsAt: endsAt.toISOString(),
          }),
        },
      });

      return tx.boost.update({
        where: { id: boost.id },
        data: {
          status: BoostStatus.ACTIVE,
          startsAt,
          endsAt,
        },
        include: boostInclude,
      });
    });

    try {
      await this.notifications?.notifyBoostActivated({
        userId: transaction.userId,
        listingId: boost.listing.id,
        listingTitle: boost.listing.title,
        transactionId: transaction.id,
        startsAt,
        endsAt,
      });
    } catch (error) {
      this.logger.warn(
        `Could not persist boost activation notification for ${boost.id}`,
      );
    }

    await this.notifyTransactionStatusChanged({
      ...transaction,
      status: TransactionStatus.SUCCEEDED,
    });

    return updatedBoost;
  }

  private async notifyTransactionStatusChanged(
    transaction: Pick<
      Transaction,
      | 'id'
      | 'userId'
      | 'listingId'
      | 'status'
      | 'amount'
      | 'currency'
      | 'provider'
      | 'providerRef'
    >,
  ) {
    try {
      await this.notifications?.notifyTransactionStatusChanged({
        userId: transaction.userId,
        transactionId: transaction.id,
        listingId: transaction.listingId,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        provider: transaction.provider,
        providerRef: transaction.providerRef,
      });
    } catch (error) {
      this.logger.warn(
        `Could not persist transaction notification for ${transaction.id}`,
      );
    }
  }
}
