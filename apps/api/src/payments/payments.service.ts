import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
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
import type { Transaction } from '@prisma/client';
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
    listingTitle?: string | null;
    type?: TransactionType;
    amount: Prisma.Decimal;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    return this.paymentProvider
      .createPaymentIntent({
        ...input,
        amount: input.amount.toFixed(2),
      })
      .then(async (paymentIntent) => {
        try {
          await this.notifications?.notifyPaymentRequested({
            userId: input.userId,
            transactionId: input.transactionId,
            listingId: input.listingId,
            listingTitle: input.listingTitle,
            boostId: input.boostId,
            type: input.type,
            amount: input.amount,
            currency: input.currency,
            provider: paymentIntent.provider,
            providerRef: paymentIntent.providerRef,
            checkoutUrl: paymentIntent.checkoutUrl,
            metadata: {
              ...((input.metadata ?? {}) as Prisma.InputJsonObject),
              paymentProviderMetadata: (paymentIntent.metadata ??
                {}) as Prisma.InputJsonObject,
            },
          });
        } catch {
          this.logger.warn(
            `Could not persist payment request notification for ${input.transactionId}`,
          );
        }

        return paymentIntent;
      });
  }

  createListingFeePaymentIntent(input: {
    transactionId: string;
    userId: string;
    listingId: string;
    listingTitle?: string | null;
    amount: Prisma.Decimal;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    return this.paymentProvider
      .createPaymentIntent({
        ...input,
        boostId: null,
        amount: input.amount.toFixed(2),
      })
      .then(async (paymentIntent) => {
        try {
          await this.notifications?.notifyPaymentRequested({
            userId: input.userId,
            transactionId: input.transactionId,
            listingId: input.listingId,
            listingTitle: input.listingTitle,
            boostId: null,
            type: TransactionType.LISTING_FEE,
            amount: input.amount,
            currency: input.currency,
            provider: paymentIntent.provider,
            providerRef: paymentIntent.providerRef,
            checkoutUrl: paymentIntent.checkoutUrl,
            metadata: {
              ...((input.metadata ?? {}) as Prisma.InputJsonObject),
              paymentProviderMetadata: (paymentIntent.metadata ??
                {}) as Prisma.InputJsonObject,
            },
          });
        } catch {
          this.logger.warn(
            `Could not persist listing fee payment request notification for ${input.transactionId}`,
          );
        }

        return paymentIntent;
      });
  }

  createWalletTopUpPaymentIntent(input: {
    transactionId: string;
    userId: string;
    amount: Prisma.Decimal;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    return this.paymentProvider
      .createPaymentIntent({
        ...input,
        boostId: null,
        listingId: null,
        amount: input.amount.toFixed(2),
      })
      .then(async (paymentIntent) => {
        try {
          await this.notifications?.notifyPaymentRequested({
            userId: input.userId,
            transactionId: input.transactionId,
            listingId: null,
            boostId: null,
            type: TransactionType.WALLET_TOP_UP,
            amount: input.amount,
            currency: input.currency,
            provider: paymentIntent.provider,
            providerRef: paymentIntent.providerRef,
            checkoutUrl: paymentIntent.checkoutUrl,
            metadata: {
              ...((input.metadata ?? {}) as Prisma.InputJsonObject),
              paymentProviderMetadata: (paymentIntent.metadata ??
                {}) as Prisma.InputJsonObject,
            },
          });
        } catch {
          this.logger.warn(
            `Could not persist wallet top-up payment request notification for ${input.transactionId}`,
          );
        }

        return paymentIntent;
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

  async completeListingFeePaymentForActor(
    user: ActingUser,
    transactionId: string,
    input: { providerRef?: string },
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        type: TransactionType.LISTING_FEE,
      },
      include: {
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

    if (!transaction || !transaction.listing) {
      throw new NotFoundException('Listing fee transaction not found');
    }

    if (
      transaction.listing.status === ListingStatus.DELETED ||
      transaction.listing.status === ListingStatus.REMOVED
    ) {
      throw new BadRequestException(
        'This listing can no longer accept listing-fee payment',
      );
    }

    if (!isAdminRole(user.role) && transaction.userId !== user.id) {
      throw new ForbiddenException(
        'You can only complete your own listing payment',
      );
    }

    return this.completeListingFeeTransaction(transaction, {
      providerRef: input.providerRef,
    });
  }

  async completeWalletTopUpPaymentForActor(
    user: ActingUser,
    transactionId: string,
    input: { providerRef?: string },
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        type: TransactionType.WALLET_TOP_UP,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Wallet top-up transaction not found');
    }

    if (!isAdminRole(user.role) && transaction.userId !== user.id) {
      throw new ForbiddenException(
        'You can only complete your own wallet top-up',
      );
    }

    return this.completeWalletTopUpTransaction(transaction, {
      providerRef: input.providerRef,
    });
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
      const payment = await this.completePaymentByProviderRef(event);

      return {
        received: true,
        status: event.status,
        payment,
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

  private async completePaymentByProviderRef(event: PaymentWebhookEvent) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        provider: event.provider,
        providerRef: event.providerRef,
      },
      include: {
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

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.type === TransactionType.LISTING_FEE) {
      return this.completeListingFeeTransaction(transaction, {
        providerRef: event.providerRef,
      });
    }

    if (transaction.type === TransactionType.WALLET_TOP_UP) {
      return this.completeWalletTopUpTransaction(transaction, {
        providerRef: event.providerRef,
      });
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
      placement: BoostPlacement;
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
        boostId: boost.id,
        listingId: boost.listing.id,
        listingTitle: boost.listing.title,
        transactionId: transaction.id,
        placement: boost.placement,
        amount: transaction.amount,
        currency: transaction.currency,
        provider: transaction.provider,
        providerRef: input.providerRef ?? transaction.providerRef,
        startsAt,
        endsAt,
      });
    } catch {
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

  private async completeListingFeeTransaction(
    transaction: Transaction & {
      listing?: {
        id: string;
        title: string;
        status: ListingStatus;
        sellerId: string;
      } | null;
    },
    input: { providerRef?: string },
  ) {
    if (transaction.status === TransactionStatus.SUCCEEDED) {
      throw new BadRequestException('Listing payment has already succeeded');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Listing payment is not pending');
    }

    const now = new Date();
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.SUCCEEDED,
        providerRef: input.providerRef ?? transaction.providerRef,
        metadata: mergeMetadata(transaction.metadata, {
          paidAt: now.toISOString(),
        }),
      },
      include: {
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

    await this.notifyTransactionStatusChanged({
      ...transaction,
      status: TransactionStatus.SUCCEEDED,
      providerRef: input.providerRef ?? transaction.providerRef,
    });

    return updatedTransaction;
  }

  private async completeWalletTopUpTransaction(
    transaction: Transaction,
    input: { providerRef?: string },
  ) {
    if (transaction.status === TransactionStatus.SUCCEEDED) {
      return this.prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Wallet top-up payment is not pending');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.SUCCEEDED,
          providerRef: input.providerRef ?? transaction.providerRef,
          metadata: mergeMetadata(transaction.metadata, {
            paidAt: now.toISOString(),
          }),
        },
      });
      const wallet = await tx.walletAccount.upsert({
        where: { userId: transaction.userId },
        update: {},
        create: {
          userId: transaction.userId,
          currency: transaction.currency,
        },
      });

      if (wallet.currency !== transaction.currency) {
        throw new BadRequestException(
          'Wallet currency does not match top-up currency',
        );
      }

      const nextBalance = new Prisma.Decimal(wallet.balance).plus(
        transaction.amount,
      );
      const updatedWallet = await tx.walletAccount.update({
        where: { id: wallet.id },
        data: { balance: nextBalance },
      });
      const ledger = await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          transactionId: transaction.id,
          type: 'SELF_TOP_UP',
          amount: transaction.amount,
          currency: transaction.currency,
          balanceAfter: nextBalance,
          metadata: {
            provider: transaction.provider,
            providerRef: input.providerRef ?? transaction.providerRef,
            paidAt: now.toISOString(),
          },
        },
      });

      return {
        ledger,
        transaction: updatedTransaction,
        wallet: updatedWallet,
      };
    });

    try {
      await this.notifications?.notifyWalletTopUp({
        userId: transaction.userId,
        transactionId: transaction.id,
        walletId: result.wallet.id,
        ledgerId: result.ledger.id,
        amount: transaction.amount,
        currency: transaction.currency,
        balanceAfter: result.wallet.balance,
        note: 'Seller wallet top-up',
      });
    } catch {
      this.logger.warn(
        `Could not persist wallet top-up notification for ${result.wallet.id}`,
      );
    }

    await this.notifyTransactionStatusChanged({
      ...transaction,
      status: TransactionStatus.SUCCEEDED,
      providerRef: input.providerRef ?? transaction.providerRef,
    });

    return result;
  }

  private async notifyTransactionStatusChanged(
    transaction: Pick<
      Transaction,
      | 'id'
      | 'userId'
      | 'listingId'
      | 'type'
      | 'status'
      | 'amount'
      | 'currency'
      | 'provider'
      | 'providerRef'
    >,
  ) {
    try {
      const context = await this.getTransactionNotificationContext(
        transaction.id,
      );

      await this.notifications?.notifyTransactionStatusChanged({
        userId: transaction.userId,
        transactionId: transaction.id,
        listingId: transaction.listingId ?? context.listingId,
        listingTitle: context.listingTitle,
        boostId: context.boostId,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        provider: transaction.provider,
        providerRef: transaction.providerRef,
      });
    } catch {
      this.logger.warn(
        `Could not persist transaction notification for ${transaction.id}`,
      );
    }
  }

  private async getTransactionNotificationContext(transactionId: string) {
    const boost = await this.prisma.boost.findFirst({
      where: { transactionId },
      select: {
        id: true,
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (boost?.listing) {
      return {
        boostId: boost.id,
        listingId: boost.listing.id,
        listingTitle: boost.listing.title,
      };
    }

    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId },
      select: {
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return {
      boostId: null,
      listingId: transaction?.listing?.id ?? null,
      listingTitle: transaction?.listing?.title ?? null,
    };
  }
}
