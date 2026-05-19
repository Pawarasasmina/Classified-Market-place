import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteBoostPaymentDto } from './dto/complete-boost-payment.dto';
import { CreateBoostDto } from './dto/create-boost.dto';
import { QueryBoostsDto } from './dto/query-boosts.dto';

type ActingUser = {
  id: string;
  role: string;
};

const defaultBoostDurationDays = 7;
const defaultBoostPrice = new Prisma.Decimal(25);
const defaultBoostCurrency = 'AED';
const mutableBoostStatuses = [BoostStatus.SCHEDULED, BoostStatus.ACTIVE];

const listingSelect = {
  id: true,
  title: true,
  status: true,
  sellerId: true,
} satisfies Prisma.ListingSelect;

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

@Injectable()
export class BoostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async createForListing(
    user: ActingUser,
    listingId: string,
    createBoostDto: CreateBoostDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: listingSelect,
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    if (!isAdminRole(user.role) && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only boost your own listings');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be boosted');
    }

    const now = new Date();
    const placement = createBoostDto.placement ?? BoostPlacement.FEATURED;
    const startsAt = parseDateInput(createBoostDto.startsAt, now);
    const durationDays =
      createBoostDto.durationDays ?? defaultBoostDurationDays;
    const endsAt = parseDateInput(
      createBoostDto.endsAt,
      addDays(startsAt, durationDays),
    );

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException(
        'Boost end time must be after the start time',
      );
    }

    if (endsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Boost end time must be in the future');
    }

    await this.refreshExpiredBoosts({ listingId });

    const overlappingBoost = await this.prisma.boost.findFirst({
      where: {
        listingId,
        placement,
        status: { in: mutableBoostStatuses },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });

    if (overlappingBoost) {
      throw new BadRequestException(
        'This listing already has an overlapping boost for that placement',
      );
    }

    const boost = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          listingId,
          type: TransactionType.BOOST_PURCHASE,
          status: TransactionStatus.PENDING,
          amount: defaultBoostPrice,
          currency: defaultBoostCurrency,
          provider: 'dev',
          metadata: {
            placement,
            requestedStartsAt: startsAt.toISOString(),
            requestedEndsAt: endsAt.toISOString(),
          },
        },
        select: { id: true },
      });

      return tx.boost.create({
        data: {
          listingId,
          purchaserId: user.id,
          transactionId: transaction.id,
          placement,
          status: BoostStatus.SCHEDULED,
          startsAt,
          endsAt,
        },
        include: boostInclude,
      });
    });

    if (!boost.transaction) {
      return boost;
    }

    const paymentIntent = await this.paymentsService.createBoostPaymentIntent({
      transactionId: boost.transaction.id,
      boostId: boost.id,
      userId: user.id,
      listingId,
      amount: new Prisma.Decimal(boost.transaction.amount),
      currency: boost.transaction.currency,
      metadata: {
        placement,
        requestedStartsAt: startsAt.toISOString(),
        requestedEndsAt: endsAt.toISOString(),
      },
    });
    const paymentMetadata = {
      placement,
      requestedStartsAt: startsAt.toISOString(),
      requestedEndsAt: endsAt.toISOString(),
      checkoutUrl: paymentIntent.checkoutUrl,
      paymentProviderMetadata: (paymentIntent.metadata ??
        {}) as Prisma.InputJsonObject,
    } satisfies Prisma.InputJsonObject;

    const updatedBoost = await this.prisma.boost.update({
      where: { id: boost.id },
      data: {
        transaction: {
          update: {
            provider: paymentIntent.provider,
            providerRef: paymentIntent.providerRef,
            metadata: paymentMetadata,
          },
        },
      },
      include: boostInclude,
    });

    return {
      ...updatedBoost,
      payment: paymentIntent,
    };
  }

  async markPaymentSucceeded(
    user: ActingUser,
    boostId: string,
    completeBoostPaymentDto: CompleteBoostPaymentDto,
  ) {
    return this.paymentsService.completeBoostPaymentForActor(
      user,
      boostId,
      completeBoostPaymentDto,
    );
  }

  async listActiveForListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    await this.refreshExpiredBoosts({ listingId });

    const now = new Date();

    return this.prisma.boost.findMany({
      where: {
        listingId,
        status: BoostStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: [{ placement: 'asc' }, { endsAt: 'asc' }],
      include: boostInclude,
    });
  }

  async listMine(userId: string, query: QueryBoostsDto) {
    await this.refreshExpiredBoosts({ purchaserId: userId });

    return this.prisma.boost.findMany({
      where: this.buildBoostWhere({ ...query, purchaserId: userId }),
      orderBy: { createdAt: 'desc' },
      include: boostInclude,
    });
  }

  async listForAdmin(query: QueryBoostsDto) {
    await this.refreshExpiredBoosts();

    return this.prisma.boost.findMany({
      where: this.buildBoostWhere(query),
      orderBy: { createdAt: 'desc' },
      include: boostInclude,
    });
  }

  private buildBoostWhere(query: QueryBoostsDto): Prisma.BoostWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.placement ? { placement: query.placement } : {}),
      ...(query.listingId ? { listingId: query.listingId } : {}),
      ...(query.purchaserId ? { purchaserId: query.purchaserId } : {}),
    };
  }

  private async refreshExpiredBoosts(where: Prisma.BoostWhereInput = {}) {
    await this.prisma.boost.updateMany({
      where: {
        ...where,
        status: { in: mutableBoostStatuses },
        endsAt: { lte: new Date() },
      },
      data: {
        status: BoostStatus.EXPIRED,
      },
    });
  }
}
