import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteWalletTopUpDto } from './dto/complete-wallet-top-up.dto';
import { CreateWalletTopUpDto } from './dto/create-wallet-top-up.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';
import { DebitWalletDto } from './dto/debit-wallet.dto';

const defaultWalletCurrency = 'AED';

const walletAdminInclude = {
  ledger: {
    orderBy: { createdAt: 'desc' as const },
    take: 50,
    include: {
      transaction: true,
    },
  },
  user: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.WalletAccountInclude;

function normalizeCurrency(value: string | undefined) {
  return (value ?? defaultWalletCurrency).trim().toUpperCase();
}

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
    private readonly paymentsService?: PaymentsService,
  ) {}

  async getOrCreateWallet(userId: string) {
    return this.prisma.walletAccount.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currency: defaultWalletCurrency,
      },
      include: {
        ledger: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            transaction: true,
          },
        },
      },
    });
  }

  async getWalletForAdmin(userId: string) {
    const wallet = await this.prisma.walletAccount.findUnique({
      where: { userId },
      include: walletAdminInclude,
    });

    if (wallet) {
      return wallet;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.walletAccount.create({
      data: {
        userId,
        currency: defaultWalletCurrency,
      },
      include: walletAdminInclude,
    });
  }

  async creditWallet(
    userId: string,
    dto: CreditWalletDto,
    actorId?: string | null,
  ) {
    const amount = new Prisma.Decimal(dto.amount);
    const currency = normalizeCurrency(dto.currency);

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          currency,
        },
      });

      if (wallet.currency !== currency) {
        throw new BadRequestException(
          'Wallet currency does not match credit currency',
        );
      }

      const nextBalance = new Prisma.Decimal(wallet.balance).plus(amount);
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.ADMIN_CREDIT,
          status: TransactionStatus.SUCCEEDED,
          amount,
          currency,
          provider: 'wallet',
          providerRef: `admin-credit:${userId}:${Date.now()}`,
          metadata: {
            note: dto.note,
            actorId: actorId ?? null,
          },
        },
      });

      const updatedWallet = await tx.walletAccount.update({
        where: { id: wallet.id },
        data: {
          balance: nextBalance,
        },
      });

      const ledger = await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          transactionId: transaction.id,
          type: 'ADMIN_CREDIT',
          amount,
          currency,
          balanceAfter: nextBalance,
          metadata: {
            note: dto.note,
            actorId: actorId ?? null,
          },
        },
      });

      return { ledger, wallet: updatedWallet };
    });

    try {
      await this.notifications?.notifyWalletTopUp({
        userId,
        actorId,
        transactionId: result.ledger.transactionId ?? null,
        walletId: result.wallet.id,
        ledgerId: result.ledger.id,
        amount,
        currency,
        balanceAfter: result.wallet.balance,
        note: dto.note,
      });
    } catch (error) {
      this.logger.warn(
        `Could not persist wallet top-up notification for ${result.wallet.id}`,
      );
    }

    return result.wallet;
  }

  async debitWallet(
    userId: string,
    dto: DebitWalletDto,
    actorId?: string | null,
  ) {
    const amount = new Prisma.Decimal(dto.amount);
    const currency = normalizeCurrency(dto.currency);

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.currency !== currency) {
        throw new BadRequestException(
          'Wallet currency does not match debit currency',
        );
      }

      if (new Prisma.Decimal(wallet.balance).lt(amount)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const nextBalance = new Prisma.Decimal(wallet.balance).minus(amount);
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.ADMIN_DEBIT,
          status: TransactionStatus.SUCCEEDED,
          amount,
          currency,
          provider: 'wallet',
          providerRef: `admin-debit:${userId}:${Date.now()}`,
          metadata: {
            note: dto.note,
            actorId: actorId ?? null,
          },
        },
      });

      const updatedWallet = await tx.walletAccount.update({
        where: { id: wallet.id },
        data: {
          balance: nextBalance,
        },
      });

      const ledger = await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          transactionId: transaction.id,
          type: 'ADMIN_DEBIT',
          amount: amount.mul(-1),
          currency,
          balanceAfter: nextBalance,
          metadata: {
            note: dto.note,
            actorId: actorId ?? null,
          },
        },
      });

      return { ledger, wallet: updatedWallet };
    });

    return result.wallet;
  }

  async createTopUp(userId: string, dto: CreateWalletTopUpDto) {
    const amount = new Prisma.Decimal(dto.amount);
    const currency = normalizeCurrency(dto.currency);

    const wallet = await this.prisma.walletAccount.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currency,
      },
    });

    if (wallet.currency !== currency) {
      throw new BadRequestException(
        'Wallet currency does not match top-up currency',
      );
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.WALLET_TOP_UP,
        status: TransactionStatus.PENDING,
        amount,
        currency,
        provider: 'dev',
        metadata: {
          reason: 'seller_wallet_top_up',
        },
      },
    });
    const payment = await this.requirePaymentsService().createWalletTopUpPaymentIntent(
      {
        transactionId: transaction.id,
        userId,
        amount,
        currency,
        metadata: {
          reason: 'seller_wallet_top_up',
          walletId: wallet.id,
        },
      },
    );

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        provider: payment.provider,
        providerRef: payment.providerRef,
        metadata: {
          reason: 'seller_wallet_top_up',
          walletId: wallet.id,
          checkoutUrl: payment.checkoutUrl,
          paymentProviderMetadata: (payment.metadata ??
            {}) as Prisma.InputJsonObject,
        },
      },
    });

    return {
      payment,
      transaction: {
        ...transaction,
        provider: payment.provider,
        providerRef: payment.providerRef,
      },
      wallet,
    };
  }

  completeTopUpPayment(
    user: { id: string; role: string },
    transactionId: string,
    dto: CompleteWalletTopUpDto,
  ) {
    return this.requirePaymentsService().completeWalletTopUpPaymentForActor(
      user,
      transactionId,
      dto,
    );
  }

  private requirePaymentsService() {
    if (!this.paymentsService) {
      throw new BadRequestException('Wallet payments are not configured');
    }

    return this.paymentsService;
  }
}
