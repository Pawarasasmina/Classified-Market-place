import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
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
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellerProfilesService } from '../seller-profiles/seller-profiles.service';
import { CompleteBoostPaymentDto } from './dto/complete-boost-payment.dto';
import { CreateBoostPackageDto } from './dto/create-boost-package.dto';
import { CreateBoostDto } from './dto/create-boost.dto';
import { QueryBoostsDto } from './dto/query-boosts.dto';
import { UpdateBoostPackageDto } from './dto/update-boost-package.dto';

type ActingUser = {
  id: string;
  role: string;
};

type ResolvedBoostPackage = {
  id?: string;
  name: string;
  placement: BoostPlacement;
  price: Prisma.Decimal;
  currency: string;
  durationDays: number;
};

type BoostableListing = {
  id: string;
  title: string;
  status: ListingStatus;
  sellerId: string;
  categoryId: string;
  category: {
    id: string;
    parentId: string | null;
  };
};

const defaultBoostDurationDays = 7;
const defaultBoostPrice = new Prisma.Decimal(25);
const defaultBoostCurrency = 'AED';
const defaultBoostPlacement = BoostPlacement.HIGHLIGHTED_LISTING;
const mutableBoostStatuses = [BoostStatus.SCHEDULED, BoostStatus.ACTIVE];
const activeBoostStatuses = [BoostStatus.ACTIVE];

const defaultBoostPackages = [
  {
    slug: 'top-listing-7-days',
    name: 'Top listing',
    description: 'Prioritized placement at the top of customer results.',
    placement: BoostPlacement.TOP_LISTING,
    price: new Prisma.Decimal(35),
    currency: defaultBoostCurrency,
    durationDays: 7,
    sortOrder: 10,
  },
  {
    slug: 'highlighted-listing-7-days',
    name: 'Highlighted listing',
    description: 'Highlighted badge and boosted ordering across lists.',
    placement: BoostPlacement.HIGHLIGHTED_LISTING,
    price: defaultBoostPrice,
    currency: defaultBoostCurrency,
    durationDays: 7,
    sortOrder: 20,
  },
  {
    slug: 'category-priority-7-days',
    name: 'Category priority',
    description: 'Priority placement inside category results.',
    placement: BoostPlacement.CATEGORY_PRIORITY,
    price: new Prisma.Decimal(30),
    currency: defaultBoostCurrency,
    durationDays: 7,
    sortOrder: 30,
  },
  {
    slug: 'homepage-promotion-7-days',
    name: 'Homepage promotion',
    description: 'Promoted placement on the customer-facing homepage.',
    placement: BoostPlacement.HOMEPAGE_PROMOTION,
    price: new Prisma.Decimal(45),
    currency: defaultBoostCurrency,
    durationDays: 7,
    sortOrder: 40,
  },
  {
    slug: 'time-based-boost-3-days',
    name: 'Time-based boost',
    description: 'Short campaign boost for a fixed promotion window.',
    placement: BoostPlacement.TIME_BASED_BOOST,
    price: new Prisma.Decimal(15),
    currency: defaultBoostCurrency,
    durationDays: 3,
    sortOrder: 50,
  },
] satisfies Prisma.BoostPackageCreateInput[];

const listingSelect = {
  id: true,
  title: true,
  status: true,
  sellerId: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      parentId: true,
    },
  },
} satisfies Prisma.ListingSelect;

const boostPackageInclude = {
  categories: {
    include: {
      category: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.BoostPackageInclude;

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
  package: {
    select: {
      id: true,
      slug: true,
      name: true,
      placement: true,
      price: true,
      currency: true,
      durationDays: true,
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              parentId: true,
            },
          },
        },
      },
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCurrency(value: string | undefined) {
  return (value ?? defaultBoostCurrency).trim().toUpperCase();
}

function buildBoostPackageMetadata(boostPackage: ResolvedBoostPackage) {
  return {
    ...(boostPackage.id ? { boostPackageId: boostPackage.id } : {}),
    boostPackageName: boostPackage.name,
    placement: boostPackage.placement,
    durationDays: boostPackage.durationDays,
  } satisfies Prisma.InputJsonObject;
}

function getListingCategoryScope(listing: BoostableListing) {
  return [
    listing.categoryId,
    ...(listing.category.parentId ? [listing.category.parentId] : []),
  ];
}

function buildPackageAvailabilityWhere(listing: BoostableListing) {
  const categoryIds = getListingCategoryScope(listing);

  return {
    OR: [
      { categories: { none: {} } },
      {
        categories: {
          some: {
            categoryId: { in: categoryIds },
          },
        },
      },
    ],
  } satisfies Prisma.BoostPackageWhereInput;
}

@Injectable()
export class BoostsService implements OnModuleInit {
  private readonly logger = new Logger(BoostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly notifications?: NotificationsService,
    private readonly sellerProfilesService?: SellerProfilesService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPackages();
  }

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

    if (!isAdminRole(user.role)) {
      await this.requireSellerProfilesService().assertApprovedSeller(user.id);
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Only active listings can be boosted');
    }

    const now = new Date();
    const boostPackage = await this.resolveBoostPackage(
      listing,
      createBoostDto,
    );
    const placement = boostPackage.placement;
    const startsAt = parseDateInput(createBoostDto.startsAt, now);
    const durationDays = boostPackage.durationDays;
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
        status: { in: mutableBoostStatuses },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });

    if (overlappingBoost) {
      throw new BadRequestException(
        'This listing already has an overlapping active or scheduled boost',
      );
    }

    if (createBoostDto.paymentMethod === 'WALLET') {
      return this.createWalletBoost({
        user,
        listingId,
        listingTitle: listing.title,
        boostPackage,
        startsAt,
        endsAt,
      });
    }

    const boost = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          listingId,
          type: TransactionType.BOOST_PURCHASE,
          status: TransactionStatus.PENDING,
          amount: boostPackage.price,
          currency: boostPackage.currency,
          provider: 'dev',
          metadata: {
            ...buildBoostPackageMetadata(boostPackage),
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
          packageId: boostPackage.id,
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
      listingTitle: listing.title,
      type: TransactionType.BOOST_PURCHASE,
      amount: new Prisma.Decimal(boost.transaction.amount),
      currency: boost.transaction.currency,
      metadata: {
        ...buildBoostPackageMetadata(boostPackage),
        requestedStartsAt: startsAt.toISOString(),
        requestedEndsAt: endsAt.toISOString(),
      },
    });
    const paymentMetadata = {
      ...buildBoostPackageMetadata(boostPackage),
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
    const boost = await this.paymentsService.completeBoostPaymentForActor(
      user,
      boostId,
      completeBoostPaymentDto,
    );

    if (boost?.listingId) {
      await this.syncListingBoostState([boost.listingId]);
    }

    return boost;
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

  async listActiveBoostedListings(query: QueryBoostsDto) {
    await this.refreshExpiredBoosts();

    const now = new Date();

    return this.prisma.boost.findMany({
      where: {
        ...this.buildBoostWhere(query),
        status: { in: activeBoostStatuses },
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: [{ endsAt: 'asc' }, { createdAt: 'desc' }],
      include: boostInclude,
    });
  }

  expireEndedBoosts() {
    return this.refreshExpiredBoosts();
  }

  listPackages(includeInactive = false) {
    return this.prisma.boostPackage.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
      include: boostPackageInclude,
    });
  }

  async listPackagesForListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: listingSelect,
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    return this.prisma.boostPackage.findMany({
      where: {
        isActive: true,
        ...buildPackageAvailabilityWhere(listing),
      },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }, { name: 'asc' }],
      include: boostPackageInclude,
    });
  }

  async createPackage(dto: CreateBoostPackageDto) {
    const slug = slugify(dto.slug ?? dto.name);

    if (!slug) {
      throw new BadRequestException('Boost package slug is required');
    }

    return this.prisma.boostPackage.create({
      data: {
        slug,
        name: dto.name.trim(),
        description: dto.description,
        placement: dto.placement,
        price: new Prisma.Decimal(dto.price),
        currency: normalizeCurrency(dto.currency),
        durationDays: dto.durationDays,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        categories: this.buildCategoryLinks(dto.categoryIds),
      },
      include: boostPackageInclude,
    });
  }

  async updatePackage(id: string, dto: UpdateBoostPackageDto) {
    const boostPackage = await this.prisma.boostPackage.findUnique({
      where: { id },
    });

    if (!boostPackage) {
      throw new NotFoundException('Boost package not found');
    }

    return this.prisma.boostPackage.update({
      where: { id },
      data: {
        slug: dto.slug ? slugify(dto.slug) : undefined,
        name: dto.name?.trim(),
        description: dto.description,
        placement: dto.placement,
        price:
          typeof dto.price === 'number'
            ? new Prisma.Decimal(dto.price)
            : undefined,
        currency: dto.currency ? normalizeCurrency(dto.currency) : undefined,
        durationDays: dto.durationDays,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        categories: dto.categoryIds
          ? {
              deleteMany: {},
              ...this.buildCategoryLinks(dto.categoryIds),
            }
          : undefined,
      },
      include: boostPackageInclude,
    });
  }

  async removePackage(id: string) {
    const boostPackage = await this.prisma.boostPackage.findUnique({
      where: { id },
    });

    if (!boostPackage) {
      throw new NotFoundException('Boost package not found');
    }

    return this.prisma.boostPackage.update({
      where: { id },
      data: { isActive: false },
      include: boostPackageInclude,
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
    const expiringBoosts = await this.prisma.boost.findMany({
      where: {
        ...where,
        status: { in: mutableBoostStatuses },
        endsAt: { lte: new Date() },
      },
      select: { id: true, listingId: true },
    });

    if (!expiringBoosts.length) {
      return;
    }

    await this.prisma.boost.updateMany({
      where: {
        id: { in: expiringBoosts.map((boost) => boost.id) },
      },
      data: {
        status: BoostStatus.EXPIRED,
      },
    });
    await this.syncListingBoostState(
      [...new Set(expiringBoosts.map((boost) => boost.listingId))],
      new Date(),
    );
  }

  private async createWalletBoost(input: {
    user: ActingUser;
    listingId: string;
    listingTitle: string;
    boostPackage: ResolvedBoostPackage;
    startsAt: Date;
    endsAt: Date;
  }) {
    const { user, listingId, listingTitle, boostPackage, startsAt, endsAt } =
      input;
    const now = new Date();

    const boost = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          currency: boostPackage.currency,
        },
      });

      if (wallet.currency !== boostPackage.currency) {
        throw new BadRequestException(
          'Wallet currency does not match boost package currency',
        );
      }

      if (new Prisma.Decimal(wallet.balance).lt(boostPackage.price)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const nextBalance = new Prisma.Decimal(wallet.balance).minus(
        boostPackage.price,
      );

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          listingId,
          type: TransactionType.BOOST_PURCHASE,
          status: TransactionStatus.SUCCEEDED,
          amount: boostPackage.price,
          currency: boostPackage.currency,
          provider: 'wallet',
          providerRef: `wallet:${user.id}:${now.getTime()}:${Math.random()
            .toString(36)
            .slice(2, 10)}`,
          metadata: {
            ...buildBoostPackageMetadata(boostPackage),
            paidAt: now.toISOString(),
            walletPaidAt: now.toISOString(),
            activatedStartsAt: startsAt.toISOString(),
            activatedEndsAt: endsAt.toISOString(),
          },
        },
        select: { id: true },
      });

      const createdBoost = await tx.boost.create({
        data: {
          listingId,
          purchaserId: user.id,
          transactionId: transaction.id,
          packageId: boostPackage.id,
          placement: boostPackage.placement,
          status: BoostStatus.ACTIVE,
          startsAt,
          endsAt,
        },
        include: boostInclude,
      });

      await tx.walletAccount.update({
        where: { id: wallet.id },
        data: {
          balance: nextBalance,
        },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          transactionId: transaction.id,
          type: 'BOOST_PURCHASE',
          amount: boostPackage.price.mul(-1),
          currency: boostPackage.currency,
          balanceAfter: nextBalance,
          metadata: {
            boostId: createdBoost.id,
            listingId,
            ...buildBoostPackageMetadata(boostPackage),
          },
        },
      });

      await this.syncListingBoostState([listingId], now, tx);

      return createdBoost;
    });

    try {
      await this.notifications?.notifyBoostActivated({
        userId: user.id,
        boostId: boost.id,
        listingId,
        listingTitle,
        transactionId: boost.transactionId,
        placement: boostPackage.placement,
        boostPackageId: boostPackage.id,
        boostPackageName: boostPackage.name,
        amount: boostPackage.price,
        currency: boostPackage.currency,
        provider: 'wallet',
        providerRef: boost.transaction?.providerRef,
        startsAt,
        endsAt,
        metadata: {
          paymentMethod: 'WALLET',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not persist wallet boost activation notification for ${boost.id}`,
      );
    }

    return {
      ...boost,
      payment: {
        provider: 'wallet',
        providerRef: boost.transaction?.providerRef ?? undefined,
      },
    };
  }

  private async seedDefaultPackages() {
    for (const boostPackage of defaultBoostPackages) {
      await this.prisma.boostPackage.upsert({
        where: { slug: boostPackage.slug },
        update: {},
        create: {
          ...boostPackage,
          isActive: true,
        },
      });
    }
  }

  private async resolveBoostPackage(
    listing: BoostableListing,
    createBoostDto: CreateBoostDto,
  ): Promise<ResolvedBoostPackage> {
    if (createBoostDto.packageId) {
      if (createBoostDto.durationDays || createBoostDto.endsAt) {
        throw new BadRequestException(
          'Boost package duration cannot be overridden',
        );
      }

      const boostPackage = await this.prisma.boostPackage.findFirst({
        where: {
          id: createBoostDto.packageId,
          isActive: true,
          ...buildPackageAvailabilityWhere(listing),
        },
      });

      if (!boostPackage) {
        throw new NotFoundException('Boost package not found');
      }

      return {
        id: boostPackage.id,
        name: boostPackage.name,
        placement: boostPackage.placement,
        price: new Prisma.Decimal(boostPackage.price),
        currency: boostPackage.currency,
        durationDays: boostPackage.durationDays,
      };
    }

    const placement = createBoostDto.placement ?? defaultBoostPlacement;
    const requestedDurationDays = createBoostDto.durationDays;
    const boostPackage = await this.prisma.boostPackage.findFirst({
      where: {
        placement,
        isActive: true,
        ...buildPackageAvailabilityWhere(listing),
        ...(requestedDurationDays
          ? { durationDays: requestedDurationDays }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });

    if (boostPackage) {
      return {
        id: boostPackage.id,
        name: boostPackage.name,
        placement: boostPackage.placement,
        price: new Prisma.Decimal(boostPackage.price),
        currency: boostPackage.currency,
        durationDays: boostPackage.durationDays,
      };
    }

    return {
      name: 'Legacy boost',
      placement,
      price: defaultBoostPrice,
      currency: defaultBoostCurrency,
      durationDays: requestedDurationDays ?? defaultBoostDurationDays,
    };
  }

  private buildCategoryLinks(categoryIds: string[] | undefined) {
    const uniqueCategoryIds = [...new Set(categoryIds ?? [])];

    if (!uniqueCategoryIds.length) {
      return undefined;
    }

    return {
      create: uniqueCategoryIds.map((categoryId) => ({
        category: { connect: { id: categoryId } },
      })),
    };
  }

  private async syncListingBoostState(
    listingIds: string[],
    now = new Date(),
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const uniqueListingIds = [...new Set(listingIds)].filter(Boolean);

    if (!uniqueListingIds.length) {
      return;
    }

    const activeBoosts = await tx.boost.findMany({
      where: {
        listingId: { in: uniqueListingIds },
        status: BoostStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: {
        listingId: true,
        endsAt: true,
      },
      orderBy: [{ endsAt: 'desc' }],
    });
    const boostsByListing = new Map<
      string,
      Array<{ listingId: string; endsAt: Date }>
    >();

    for (const boost of activeBoosts) {
      const listingBoosts = boostsByListing.get(boost.listingId) ?? [];
      listingBoosts.push(boost);
      boostsByListing.set(boost.listingId, listingBoosts);
    }

    await Promise.all(
      uniqueListingIds.map((listingId) => {
        const listingBoosts = boostsByListing.get(listingId) ?? [];
        const boostedUntil = listingBoosts.length
          ? new Date(
              Math.max(...listingBoosts.map((boost) => boost.endsAt.getTime())),
            )
          : null;

        return tx.listing.update({
          where: { id: listingId },
          data: {
            boostedUntil,
            boostPriority: listingBoosts.length || null,
          },
        });
      }),
    );
  }

  private requireSellerProfilesService() {
    if (!this.sellerProfilesService) {
      throw new BadRequestException('Seller profiles are not configured');
    }

    return this.sellerProfilesService;
  }
}
