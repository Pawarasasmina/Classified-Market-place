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
  ListingPaymentMode,
  ListingPriorityRuleTarget,
  ListingStatus,
  Prisma,
  SellerPriorityTier,
  SellerReviewStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MAX_LISTING_IMAGES } from '../media/media.constants';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellerProfilesService } from '../seller-profiles/seller-profiles.service';
import { CompleteListingPaymentDto } from './dto/complete-listing-payment.dto';
import {
  BulkImportListingsDto,
  BulkImportListingRowDto,
} from './dto/bulk-import-listings.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { CreatePriorityRuleDto } from './dto/create-priority-rule.dto';
import { ListingImageInputDto } from './dto/listing-image-input.dto';
import { ModerateListingDto } from './dto/moderate-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { RecordListingViewDto } from './dto/record-listing-view.dto';
import { SaveListingDraftDto } from './dto/save-listing-draft.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateListingPriorityOverrideDto } from './dto/update-listing-priority-override.dto';
import { UpdatePriorityRuleDto } from './dto/update-priority-rule.dto';
import { defaultListings, demoSellers } from './listings.seed';

type BcryptModule = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
};

type ActingUser = {
  id: string;
  role: string;
};

type ListingCategory = {
  id: string;
  slug: string;
  listingExpiryDays: number;
  parentId?: string | null;
  schemaDefinition?: Prisma.JsonValue | null;
};

type CategorySchemaField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle';
  required?: boolean;
  options?: string[];
};

type ListingLifecycleData = {
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewedById?: string | null;
  rejectionReason?: string | null;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  soldAt?: Date | null;
  removedAt?: Date | null;
};

type ExistingListingImage = {
  url: string;
  mediaAssetId?: string | null;
};

type PreparedListingImage = {
  url: string;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
  mediaAssetId?: string;
};

type BulkImportSeller = {
  id: string;
  email: string;
  phone: string | null;
};

type BulkImportCategory = ListingCategory & {
  name: string;
  isActive: boolean;
};

const bcryptLib = bcrypt as BcryptModule;

const safeSellerSelect = {
  id: true,
  email: true,
  googleId: true,
  phone: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  location: true,
  emailVerified: true,
  phoneVerified: true,
  role: true,
  sellerPriorityTier: true,
  reputationScore: true,
  createdAt: true,
  updatedAt: true,
  sellerProfile: {
    include: {
      privilegeTier: true,
      badgeAssignments: {
        include: {
          badgeType: true,
        },
        orderBy: [{ assignedAt: 'desc' as const }],
      },
    },
  },
};

const listingInclude = {
  category: true,
  seller: {
    select: safeSellerSelect,
  },
  images: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
  },
  boosts: {
    where: {
      status: BoostStatus.ACTIVE,
    },
    orderBy: [{ startsAt: 'desc' as const }],
  },
};

type ListingWithIncludes = Prisma.ListingGetPayload<{
  include: typeof listingInclude;
}>;

const listingListInclude = {
  category: true,
  seller: {
    select: safeSellerSelect,
  },
  // Search and category pages only need a lightweight preview image.
  images: {
    orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
  },
  boosts: {
    where: {
      status: BoostStatus.ACTIVE,
    },
    orderBy: [{ startsAt: 'desc' as const }],
  },
};

type ListingListWithIncludes = Prisma.ListingGetPayload<{
  include: typeof listingListInclude;
}>;

const rankedListingInclude = {
  ...listingListInclude,
  transactions: {
    where: {
      type: TransactionType.LISTING_FEE,
      status: TransactionStatus.SUCCEEDED,
    },
    select: { id: true },
  },
} satisfies Prisma.ListingInclude;

type RankedListingWithIncludes = Prisma.ListingGetPayload<{
  include: typeof rankedListingInclude;
}>;

type PriorityRuleWeights = {
  general: Map<ListingPriorityRuleTarget, number>;
  boostPackages: Map<string, number>;
  categories: Map<string, number>;
};

type PriorityScoreFactor = {
  key: string;
  label: string;
  score: number;
  detail?: string;
};

type ListingPriorityBreakdown = {
  score: number;
  factors: PriorityScoreFactor[];
  overrideApplied: boolean;
};

type SellerRatingSummary = {
  averageRating: number | null;
  ratingCount: number;
  reviewCount: number;
};

type ListingWithSeller = {
  id: string;
  sellerId: string;
  seller: object | null;
};

type ListingEngagementStats = {
  viewCount: number;
  saveCount: number;
  inquiryCount: number;
  messageCount: number;
  buyerMessageCount: number;
  conversionRate: number;
  boostedViewCount: number;
  boostCount: number;
  activeBoostCount: number;
  boostedInquiryCount: number;
  boostConversionRate: number;
  savedByViewer: boolean;
};

const priorityRuleInclude = {
  boostPackage: {
    select: {
      id: true,
      slug: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      slug: true,
      name: true,
      parentId: true,
    },
  },
} satisfies Prisma.ListingPriorityRuleInclude;

const homepageBoostPlacementPriority = [
  BoostPlacement.HOMEPAGE_PROMOTION,
  BoostPlacement.TOP_LISTING,
  BoostPlacement.HIGHLIGHTED_LISTING,
  BoostPlacement.TIME_BASED_BOOST,
  BoostPlacement.CATEGORY_PRIORITY,
  BoostPlacement.SEARCH_TOP,
  BoostPlacement.CATEGORY_TOP,
  BoostPlacement.FEATURED,
];

const searchBoostPlacementPriority = [
  BoostPlacement.TOP_LISTING,
  BoostPlacement.HIGHLIGHTED_LISTING,
  BoostPlacement.TIME_BASED_BOOST,
  BoostPlacement.HOMEPAGE_PROMOTION,
  BoostPlacement.CATEGORY_PRIORITY,
  BoostPlacement.SEARCH_TOP,
  BoostPlacement.CATEGORY_TOP,
  BoostPlacement.FEATURED,
];

const categoryBoostPlacementPriority = [
  BoostPlacement.CATEGORY_PRIORITY,
  BoostPlacement.TOP_LISTING,
  BoostPlacement.HIGHLIGHTED_LISTING,
  BoostPlacement.TIME_BASED_BOOST,
  BoostPlacement.HOMEPAGE_PROMOTION,
  BoostPlacement.CATEGORY_TOP,
  BoostPlacement.SEARCH_TOP,
  BoostPlacement.FEATURED,
];

const pinnedListingPriorityScore = 1_000_000_000;
const listingQuotaSettingKey = 'seller_listing_quota';
const defaultFreeListingAllowance = 3;
const defaultListingFeeAmount = 25;
const defaultListingFeeCurrency = 'AED';
type ListingQuotaPolicy = {
  freeListingAllowance: number;
  listingFeeAmount: Prisma.Decimal;
  listingFeeCurrency: string;
  activeListingLimit?: number | null;
  pendingListingLimit?: number | null;
};

const defaultPriorityRules = [
  {
    name: 'Manual admin priority',
    target: ListingPriorityRuleTarget.MANUAL_ADMIN_PRIORITY,
    weight: 2000,
    sortOrder: 5,
  },
  {
    name: 'Boosted listings',
    target: ListingPriorityRuleTarget.BOOSTED_LISTING,
    weight: 1000,
    sortOrder: 10,
  },
  {
    name: 'Paid listings',
    target: ListingPriorityRuleTarget.PAID_LISTING,
    weight: 500,
    sortOrder: 20,
  },
  {
    name: 'Seller rating multiplier',
    target: ListingPriorityRuleTarget.SELLER_RATING,
    weight: 1,
    sortOrder: 25,
  },
  {
    name: 'VIP sellers',
    target: ListingPriorityRuleTarget.VIP_SELLER,
    weight: 300,
    sortOrder: 30,
  },
  {
    name: 'Verified sellers',
    target: ListingPriorityRuleTarget.VERIFIED_SELLER,
    weight: 200,
    sortOrder: 40,
  },
  {
    name: 'Authorized sellers',
    target: ListingPriorityRuleTarget.AUTHORIZED_SELLER,
    weight: 100,
    sortOrder: 50,
  },
] satisfies Prisma.ListingPriorityRuleCreateManyInput[];

function isAdminRole(role: string) {
  return role.toUpperCase() === 'ADMIN';
}

function toJsonValue(value: Record<string, unknown> | undefined) {
  return value as Prisma.InputJsonValue | undefined;
}

function hasModeratedListingChanges(dto: UpdateListingDto) {
  return [
    dto.title,
    dto.description,
    dto.price,
    dto.currency,
    dto.location,
    dto.categorySlug,
    dto.attributes,
    dto.images,
  ].some((value) => value !== undefined);
}

function getListingCategoryScope(listing: RankedListingWithIncludes) {
  return [
    ...(listing.categoryId ? [listing.categoryId] : []),
    ...(listing.category?.parentId ? [listing.category.parentId] : []),
  ];
}

function readPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function readPositiveDecimal(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return new Prisma.Decimal(fallback);
  }

  return new Prisma.Decimal(parsed);
}

function readCurrency(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toUpperCase()
    : fallback;
}

function readSettingObject(
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function normalizeCategorySchemaFields(
  schemaDefinition: Prisma.JsonValue | null | undefined,
) {
  if (
    !schemaDefinition ||
    typeof schemaDefinition !== 'object' ||
    Array.isArray(schemaDefinition)
  ) {
    return [] as CategorySchemaField[];
  }

  const fields = (schemaDefinition as Record<string, unknown>).fields;

  if (!Array.isArray(fields)) {
    return [] as CategorySchemaField[];
  }

  return fields.flatMap((field) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      return [];
    }

    const rawField = field as Record<string, unknown>;
    const key =
      typeof rawField.key === 'string' ? rawField.key.trim() : undefined;
    const label =
      typeof rawField.label === 'string' ? rawField.label.trim() : undefined;
    const type =
      rawField.type === 'number' ||
      rawField.type === 'select' ||
      rawField.type === 'toggle'
        ? rawField.type
        : 'text';

    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        type,
        required: rawField.required === true,
        options: Array.isArray(rawField.options)
          ? rawField.options
              .map((option) =>
                typeof option === 'string' ? option.trim() : undefined,
              )
              .filter((option): option is string => Boolean(option))
          : undefined,
      } satisfies CategorySchemaField,
    ];
  });
}

function hasMeaningfulAttributeValue(value: unknown, type: CategorySchemaField['type']) {
  if (type === 'toggle') {
    return typeof value === 'boolean';
  }

  if (type === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (type === 'select' || type === 'text') {
    return typeof value === 'string' && value.trim().length > 0;
  }

  return value != null;
}

function parseAttributeFilterPayload(value: string | undefined) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, rawValue]) => {
        const normalizedKey = key.trim();

        if (!normalizedKey) {
          return [];
        }

        if (
          typeof rawValue === 'string' ||
          typeof rawValue === 'number' ||
          typeof rawValue === 'boolean'
        ) {
          return [[normalizedKey, rawValue] as const];
        }

        return [];
      }),
    ) as Record<string, string | number | boolean>;
  } catch {
    return {};
  }
}

function normalizeAttributeComparisonValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

function listingMatchesAttributeFilters(
  listing: { attributes: Prisma.JsonValue | null },
  attributeFilters: Record<string, string | number | boolean>,
) {
  const entries = Object.entries(attributeFilters);

  if (!entries.length) {
    return true;
  }

  if (
    !listing.attributes ||
    typeof listing.attributes !== 'object' ||
    Array.isArray(listing.attributes)
  ) {
    return false;
  }

  const attributes = listing.attributes as Record<string, unknown>;

  return entries.every(([key, filterValue]) => {
    const attributeValue = normalizeAttributeComparisonValue(attributes[key]);
    const comparableFilterValue = normalizeAttributeComparisonValue(filterValue);

    if (attributeValue === undefined || comparableFilterValue === undefined) {
      return false;
    }

    return attributeValue === comparableFilterValue;
  });
}

function isMissingAnalyticsStorageError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

function buildActiveBoostWhere(
  now: Date,
  placement?: BoostPlacement,
): Prisma.BoostListRelationFilter {
  return {
    some: {
      status: BoostStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
      ...(placement ? { placement } : {}),
    },
  };
}

function buildPaidListingTransactionWhere(): Prisma.TransactionListRelationFilter {
  return {
    some: {
      type: TransactionType.LISTING_FEE,
      status: TransactionStatus.SUCCEEDED,
    },
  };
}

function getBoostPlacementPriority(query: QueryListingsDto) {
  if (query.boostPlacement) {
    return [query.boostPlacement];
  }

  if (query.categorySlug) {
    return categoryBoostPlacementPriority;
  }

  if (query.search) {
    return searchBoostPlacementPriority;
  }

  return homepageBoostPlacementPriority;
}

function getPlacementBonus(
  listing: ListingWithIncludes,
  placements: BoostPlacement[],
) {
  const listingPlacements = new Set(
    listing.boosts.map((boost) => boost.placement),
  );
  const index = placements.findIndex((placement) =>
    listingPlacements.has(placement),
  );

  return index === -1 ? 0 : placements.length - index;
}

function getSellerPriorityTarget(listing: ListingWithIncludes) {
  if (!listing.seller) {
    return undefined;
  }

  const tier = listing.seller.sellerPriorityTier;

  if (tier === SellerPriorityTier.VIP) {
    return ListingPriorityRuleTarget.VIP_SELLER;
  }

  if (
    tier === SellerPriorityTier.VERIFIED ||
    listing.seller.emailVerified ||
    listing.seller.phoneVerified
  ) {
    return ListingPriorityRuleTarget.VERIFIED_SELLER;
  }

  if (tier === SellerPriorityTier.AUTHORIZED) {
    return ListingPriorityRuleTarget.AUTHORIZED_SELLER;
  }

  return undefined;
}

function getSellerReputationScore(listing: ListingWithIncludes) {
  return listing.seller?.reputationScore ?? 0;
}

function getSellerPriorityLabel(target: ListingPriorityRuleTarget) {
  if (target === ListingPriorityRuleTarget.VIP_SELLER) {
    return 'VIP seller';
  }

  if (target === ListingPriorityRuleTarget.VERIFIED_SELLER) {
    return 'Verified seller';
  }

  return 'Authorized seller';
}

function getAdminPriorityOverrideScore(
  listing: ListingWithIncludes,
  now: Date,
  rules: PriorityRuleWeights,
) {
  if (
    !listing.adminPriorityPromoted &&
    !listing.adminPriorityPinned &&
    listing.adminPriorityScore == null
  ) {
    return undefined;
  }

  if (listing.adminPriorityExpiresAt && listing.adminPriorityExpiresAt <= now) {
    return undefined;
  }

  if (listing.adminPriorityStartsAt && listing.adminPriorityStartsAt > now) {
    return undefined;
  }

  if (listing.adminPriorityPinned) {
    return pinnedListingPriorityScore + (listing.adminPriorityScore ?? 0);
  }

  return (
    listing.adminPriorityScore ??
    rules.general.get(ListingPriorityRuleTarget.MANUAL_ADMIN_PRIORITY) ??
    0
  );
}

function compareListingsByQuerySort(
  first: ListingWithIncludes,
  second: ListingWithIncludes,
  query: QueryListingsDto,
) {
  if (query.sort === 'price_asc' || query.sort === 'price_desc') {
    const firstPrice = Number(first.price);
    const secondPrice = Number(second.price);
    const result = firstPrice - secondPrice;

    return query.sort === 'price_asc' ? result : -result;
  }

  return second.createdAt.getTime() - first.createdAt.getTime();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeFingerprintValue(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getListingFingerprint(listing: {
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  price: Prisma.Decimal | number | string;
  currency: string;
  location: string;
}) {
  return [
    listing.sellerId,
    listing.categoryId,
    normalizeFingerprintValue(listing.title),
    normalizeFingerprintValue(listing.description),
    listing.price.toString(),
    normalizeFingerprintValue(listing.currency),
    normalizeFingerprintValue(listing.location),
  ].join('|');
}

function withoutListHeavyAttributes<
  T extends { attributes: Prisma.JsonValue | null },
>(listing: T) {
  if (
    !listing.attributes ||
    typeof listing.attributes !== 'object' ||
    Array.isArray(listing.attributes) ||
    !('__photos' in listing.attributes)
  ) {
    return listing;
  }

  const attributes = { ...listing.attributes } as Record<string, unknown>;
  delete attributes.__photos;

  return {
    ...listing,
    attributes,
  };
}

function withoutRankingTransactions(listing: RankedListingWithIncludes) {
  const { transactions, ...listingWithoutTransactions } = listing;
  void transactions;

  return withoutListHeavyAttributes(listingWithoutTransactions);
}

@Injectable()
export class ListingsService implements OnModuleInit {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService?: MediaService,
    private readonly notifications?: NotificationsService,
    private readonly paymentsService?: PaymentsService,
    private readonly sellerProfilesService?: SellerProfilesService,
  ) {}

  private async expireDueListings() {
    await this.prisma.listing.updateMany({
      where: {
        status: ListingStatus.ACTIVE,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: ListingStatus.EXPIRED,
      },
    });
  }

  private getLifecycleDataForStatus(
    status: ListingStatus,
    category: ListingCategory,
  ): ListingLifecycleData {
    const now = new Date();

    if (status === ListingStatus.ACTIVE) {
      return {
        approvedAt: now,
        reviewedAt: now,
        rejectedAt: null,
        rejectionReason: null,
        publishedAt: now,
        expiresAt: addDays(now, category.listingExpiryDays),
        soldAt: null,
        removedAt: null,
      };
    }

    if (status === ListingStatus.SOLD) {
      return {
        soldAt: now,
      };
    }

    if (status === ListingStatus.REMOVED || status === ListingStatus.DELETED) {
      return {
        removedAt: now,
      };
    }

    if (status === ListingStatus.REJECTED) {
      return {
        rejectedAt: now,
        reviewedAt: now,
        approvedAt: null,
        publishedAt: null,
        expiresAt: null,
        soldAt: null,
      };
    }

    if (status === ListingStatus.PENDING) {
      return {
        submittedAt: now,
        approvedAt: null,
        rejectedAt: null,
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
        publishedAt: null,
        expiresAt: null,
        soldAt: null,
        removedAt: null,
      };
    }

    if (status === ListingStatus.DRAFT) {
      return {
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
        publishedAt: null,
        expiresAt: null,
        soldAt: null,
        removedAt: null,
      };
    }

    return {};
  }

  private async resolveCategory(categorySlug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async assertCategoryAllowsDirectListings(category: ListingCategory) {
    const activeChildCount = await this.prisma.category.count({
      where: {
        parentId: category.id,
        isActive: true,
      },
    });

    if (activeChildCount > 0) {
      throw new BadRequestException(
        'Choose a subcategory before submitting this listing',
      );
    }
  }

  private validateListingAttributesForCategory(
    category: ListingCategory,
    attributes: Record<string, unknown> | undefined,
  ) {
    const schemaFields = normalizeCategorySchemaFields(category.schemaDefinition);

    if (!schemaFields.length) {
      return;
    }

    const safeAttributes = attributes ?? {};
    const errors: string[] = [];

    for (const field of schemaFields) {
      const value = safeAttributes[field.key];

      if (
        field.required &&
        !hasMeaningfulAttributeValue(value, field.type)
      ) {
        errors.push(`${field.label} is required`);
        continue;
      }

      if (value == null) {
        continue;
      }

      if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push(`${field.label} must be a valid number`);
        }
        continue;
      }

      if (field.type === 'toggle') {
        if (typeof value !== 'boolean') {
          errors.push(`${field.label} must be yes or no`);
        }
        continue;
      }

      if (typeof value !== 'string' || !value.trim()) {
        errors.push(`${field.label} must be a valid value`);
        continue;
      }

      if (
        field.type === 'select' &&
        field.options?.length &&
        !field.options.includes(value.trim())
      ) {
        errors.push(`${field.label} must match one of the allowed options`);
      }
    }

    if (errors.length) {
      throw new BadRequestException(errors[0]);
    }
  }

  private async validateListingSubmission(
    category: ListingCategory,
    attributes: Record<string, unknown> | undefined,
  ) {
    await this.assertCategoryAllowsDirectListings(category);
    this.validateListingAttributesForCategory(category, attributes);
  }

  private resolveBulkImportSeller(
    row: BulkImportListingRowDto,
    {
      existingSellerId,
      sellersByEmail,
      sellersById,
      sellersByPhone,
    }: {
      existingSellerId?: string | null;
      sellersByEmail: Map<string, BulkImportSeller>;
      sellersById: Map<string, BulkImportSeller>;
      sellersByPhone: Map<string, BulkImportSeller>;
    },
  ) {
    const sellerId = row.sellerId?.trim();

    if (sellerId) {
      const seller = sellersById.get(sellerId);

      if (!seller) {
        throw new NotFoundException(`Seller "${sellerId}" was not found`);
      }

      return seller;
    }

    const sellerEmail = row.sellerEmail?.trim().toLowerCase();

    if (sellerEmail) {
      const seller = sellersByEmail.get(sellerEmail);

      if (!seller) {
        throw new NotFoundException(
          `Seller email "${row.sellerEmail}" was not found`,
        );
      }

      return seller;
    }

    const sellerPhone = row.sellerPhone?.trim();

    if (sellerPhone) {
      const seller = sellersByPhone.get(sellerPhone);

      if (!seller) {
        throw new NotFoundException(
          `Seller phone "${row.sellerPhone}" was not found`,
        );
      }

      return seller;
    }

    if (existingSellerId) {
      return sellersById.get(existingSellerId) ?? null;
    }

    return null;
  }

  private normalizeBulkImportAttributes(
    category: BulkImportCategory,
    attributes: Record<string, unknown> | undefined,
  ) {
    if (!attributes) {
      return undefined;
    }

    const schema = normalizeCategorySchemaFields(category.schemaDefinition);

    const normalized = Object.entries(attributes).reduce<
      Record<string, unknown>
    >((acc, [key, rawValue]) => {
      if (rawValue == null || rawValue === '') {
        return acc;
      }

      const field = schema.find((item) => item.key === key);

      if (!field) {
        acc[key] = this.normalizeLooseBulkImportValue(rawValue);
        return acc;
      }

      acc[key] = this.normalizeBulkImportAttributeValue(field, rawValue);
      return acc;
    }, {});

    return Object.keys(normalized).length ? normalized : undefined;
  }

  private normalizeBulkImportAttributeValue(
    field: CategorySchemaField,
    rawValue: unknown,
  ) {
    if (field.type === 'toggle') {
      if (typeof rawValue === 'boolean') {
        return rawValue;
      }

      if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();

        if (['true', 'yes', '1', 'y'].includes(normalized)) {
          return true;
        }

        if (['false', 'no', '0', 'n'].includes(normalized)) {
          return false;
        }
      }

      return rawValue;
    }

    if (field.type === 'number') {
      if (typeof rawValue === 'number') {
        return rawValue;
      }

      if (typeof rawValue === 'string') {
        const numeric = Number(rawValue.trim());
        return Number.isFinite(numeric) ? numeric : rawValue.trim();
      }
    }

    if (typeof rawValue === 'string') {
      return rawValue.trim();
    }

    return rawValue;
  }

  private normalizeLooseBulkImportValue(rawValue: unknown) {
    if (typeof rawValue !== 'string') {
      return rawValue;
    }

    const trimmed = rawValue.trim();
    const normalized = trimmed.toLowerCase();

    if (['true', 'yes', '1'].includes(normalized)) {
      return true;
    }

    if (['false', 'no', '0'].includes(normalized)) {
      return false;
    }

    const numeric = Number(trimmed);

    if (trimmed && Number.isFinite(numeric)) {
      return numeric;
    }

    return trimmed;
  }

  private buildBulkImportImages(images: ListingImageInputDto[] | undefined) {
    if (!images?.length) {
      return [];
    }

    const primaryIndex = Math.max(
      images.findIndex((image) => image.isPrimary),
      0,
    );

    return images
      .map((image, index) => ({
        url: image.url?.trim() ?? '',
        altText: image.altText?.trim() || undefined,
        sortOrder: index,
        isPrimary: index === primaryIndex,
      }))
      .filter((image) => image.url);
  }

  private async resolveDraftCategory(categorySlug?: string) {
    if (categorySlug) {
      return this.resolveCategory(categorySlug);
    }

    const category = await this.prisma.category.findFirst({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async getCategorySlugScope(categorySlug: string) {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        parentId: true,
      },
    });
    const selected = categories.find(
      (category) => category.slug === categorySlug,
    );

    if (!selected) {
      return [categorySlug];
    }

    const childrenByParent = new Map<string, typeof categories>();

    for (const category of categories) {
      if (!category.parentId) {
        continue;
      }

      const children = childrenByParent.get(category.parentId) ?? [];
      children.push(category);
      childrenByParent.set(category.parentId, children);
    }

    const scopedSlugs = new Set<string>();
    const queue = [selected];

    while (queue.length) {
      const category = queue.shift();

      if (!category || scopedSlugs.has(category.slug)) {
        continue;
      }

      scopedSlugs.add(category.slug);
      queue.push(...(childrenByParent.get(category.id) ?? []));
    }

    return Array.from(scopedSlugs);
  }

  async onModuleInit() {
    await this.seedMarketplaceSettings();
    await this.seedDefaultPriorityRules();
    await this.seedDefaults();
  }

  async seedDefaults() {
    const listingCount = await this.prisma.listing.count();

    if (listingCount > 0) {
      return;
    }

    for (const seller of demoSellers) {
      const passwordHash = await bcryptLib.hash(seller.password, 10);

      await this.prisma.user.upsert({
        where: { email: seller.email },
        update: {
          displayName: seller.displayName,
          phone: seller.phone,
          phoneVerified: seller.phoneVerified,
          emailVerified: seller.emailVerified,
          role: seller.role,
          passwordHash,
        },
        create: {
          email: seller.email,
          displayName: seller.displayName,
          phone: seller.phone,
          phoneVerified: seller.phoneVerified,
          emailVerified: seller.emailVerified,
          role: seller.role,
          passwordHash,
        },
      });
    }

    for (const listing of defaultListings) {
      const seller = await this.prisma.user.findUnique({
        where: { email: listing.sellerEmail },
      });
      const category = await this.prisma.category.findUnique({
        where: { slug: listing.categorySlug },
      });

      if (!seller || !category) {
        continue;
      }

      await this.prisma.listing.create({
        data: {
          title: listing.title,
          description: listing.description,
          price: listing.price,
          currency: listing.currency,
          location: listing.location,
          latitude: null,
          longitude: null,
          status: listing.status,
          ...this.getLifecycleDataForStatus(listing.status, category),
          attributes: listing.attributes,
          sellerId: seller.id,
          categoryId: category.id,
          images: {
            create: listing.imageUrls.map((url: string, index: number) => ({
              url,
              altText: listing.title,
              sortOrder: index,
              isPrimary: index === 0,
            })),
          },
        },
      });
    }
  }

  async create(user: ActingUser, createListingDto: CreateListingDto) {
    const isAdmin = isAdminRole(user.role);

    if (!isAdmin) {
      await this.requireSellerProfilesService().assertApprovedSeller(user.id);
    }

    const category = await this.resolveCategory(createListingDto.categorySlug);
    await this.validateListingSubmission(category, createListingDto.attributes);
    const clientDraftKey = createListingDto.clientDraftKey?.trim() || undefined;
    const images = await this.prepareListingImages(
      user.id,
      createListingDto.images,
    );
    const quotaPolicy = isAdmin
      ? await this.getListingQuotaPolicy()
      : await this.getListingQuotaPolicy(user.id, category.id);

    if (!isAdmin) {
      await this.assertSellerListingCapacity(user.id, quotaPolicy);
    }
    const paymentMode = isAdmin
      ? (createListingDto.listingPaymentMode ?? ListingPaymentMode.FREE)
      : await this.resolveListingPaymentMode(
          user.id,
          createListingDto.listingPaymentMode,
          quotaPolicy,
        );
    const status = isAdmin
      ? (createListingDto.status ?? ListingStatus.ACTIVE)
      : ListingStatus.PENDING;
    const listingData: Prisma.ListingCreateArgs['data'] = {
      clientDraftKey,
      title: createListingDto.title,
      description: createListingDto.description,
      price: new Prisma.Decimal(createListingDto.price),
      currency: createListingDto.currency ?? 'AED',
      location: createListingDto.location,
      latitude: createListingDto.latitude ?? null,
      longitude: createListingDto.longitude ?? null,
      status,
      listingPaymentMode: paymentMode,
      ...this.getLifecycleDataForStatus(status, category),
      attributes: toJsonValue(createListingDto.attributes),
      sellerId: user.id,
      categoryId: category.id,
      images: images?.length
        ? { create: images.map((image) => this.toListingImageCreate(image)) }
        : undefined,
    };
    const keyedListing = clientDraftKey
      ? await this.prisma.listing.findUnique({
          where: {
            sellerId_clientDraftKey: {
              sellerId: user.id,
              clientDraftKey,
            },
          },
          include: listingInclude,
        })
      : null;

    if (keyedListing && keyedListing.status !== ListingStatus.DRAFT) {
      return this.attachSellerRatingSummary(
        withoutListHeavyAttributes(keyedListing),
      );
    }

    const matchingDraft =
      keyedListing ??
      (await this.prisma.listing.findFirst({
        where: {
          sellerId: user.id,
          status: ListingStatus.DRAFT,
          categoryId: category.id,
          title: createListingDto.title,
          description: createListingDto.description,
          price: new Prisma.Decimal(createListingDto.price),
          currency: createListingDto.currency ?? 'AED',
          location: createListingDto.location,
          latitude: createListingDto.latitude ?? null,
          longitude: createListingDto.longitude ?? null,
        },
        orderBy: { updatedAt: 'desc' },
        include: listingInclude,
      }));

    if (matchingDraft) {
      const updatedDraft = await this.prisma.listing.update({
        where: { id: matchingDraft.id },
        data: {
          ...listingData,
          images: {
            deleteMany: {},
            create:
              images?.map((image) => this.toListingImageCreate(image)) ?? [],
          },
        },
        include: listingInclude,
      });

      await this.attachPreparedImagesToListing(updatedDraft.id, images);

      return this.attachSellerRatingSummary(updatedDraft);
    }

    const listing =
      paymentMode === ListingPaymentMode.PAID && !isAdmin
        ? await this.createPaidListingWithFeeTransaction({
            user,
            listingData,
            policy: quotaPolicy,
          })
        : await this.prisma.listing.create({
            data: listingData,
            include: listingInclude,
          });

    await this.attachPreparedImagesToListing(listing.id, images);

    return this.attachSellerRatingSummary(listing);
  }

  async bulkImport(user: { id: string }, dto: BulkImportListingsDto) {
    const rows = dto.rows ?? [];

    if (!rows.length) {
      throw new BadRequestException('At least one listing row is required');
    }

    const [categories, sellers, existingListings] = await Promise.all([
      this.prisma.category.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          listingExpiryDays: true,
          schemaDefinition: true,
          parentId: true,
          isActive: true,
        },
      }),
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          phone: true,
        },
      }),
      this.prisma.listing.findMany({
        where: {
          id: {
            in: rows.flatMap((row) => (row.listingId ? [row.listingId] : [])),
          },
        },
        include: {
          images: true,
        },
      }),
    ]);

    const categoriesBySlug = new Map(
      categories.map((category) => [category.slug, category]),
    );
    const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
    const sellersByEmail = new Map(
      sellers.map((seller) => [seller.email.trim().toLowerCase(), seller]),
    );
    const sellersByPhone = new Map(
      sellers
        .filter((seller) => seller.phone)
        .map((seller) => [seller.phone?.trim() ?? '', seller]),
    );
    const existingListingsById = new Map(
      existingListings.map((listing) => [listing.id, listing]),
    );

    const summary = {
      created: 0,
      updated: 0,
      skipped: 0,
      processed: rows.length,
      failed: 0,
      errors: [] as string[],
    };

    for (const [index, row] of rows.entries()) {
      try {
        const existing = row.listingId
          ? (existingListingsById.get(row.listingId) ?? null)
          : null;

        if (existing && !dto.updateExisting) {
          summary.skipped += 1;
          continue;
        }

        if (row.listingId && !existing && dto.updateExisting) {
          throw new BadRequestException(
            `Listing "${row.listingId}" was not found for updating`,
          );
        }

        const category = categoriesBySlug.get(row.categorySlug.trim());

        if (!category) {
          throw new NotFoundException(
            `Category "${row.categorySlug}" was not found`,
          );
        }

        if (!category.isActive) {
          throw new BadRequestException(
            `Category "${row.categorySlug}" is inactive`,
          );
        }

        const seller =
          this.resolveBulkImportSeller(row, {
            existingSellerId: existing?.sellerId ?? null,
            sellersByEmail,
            sellersById,
            sellersByPhone,
          }) ?? null;

        if (!seller) {
          throw new BadRequestException(
            'Seller ID, seller email, or seller phone is required',
          );
        }

        const attributes = this.normalizeBulkImportAttributes(
          category,
          row.attributes,
        );

        await this.validateListingSubmission(category, attributes);

        const lifecycle = this.getLifecycleDataForStatus(
          ListingStatus.ACTIVE,
          category,
        );
        const images = this.buildBulkImportImages(row.images);
        const listingData: Prisma.ListingUncheckedCreateInput = {
          title: row.title.trim(),
          description: row.description.trim(),
          price: new Prisma.Decimal(row.price),
          currency: row.currency?.trim() || 'AED',
          location: row.location.trim(),
          status: ListingStatus.ACTIVE,
          listingPaymentMode:
            existing?.listingPaymentMode ?? ListingPaymentMode.FREE,
          attributes: toJsonValue(attributes),
          sellerId: seller.id,
          categoryId: category.id,
          paidPriorityEnabled: existing?.paidPriorityEnabled ?? false,
          adminPriorityPromoted: existing?.adminPriorityPromoted ?? false,
          adminPriorityPinned: existing?.adminPriorityPinned ?? false,
          adminPriorityScore: existing?.adminPriorityScore ?? null,
          adminPriorityStartsAt: existing?.adminPriorityStartsAt ?? null,
          adminPriorityExpiresAt: existing?.adminPriorityExpiresAt ?? null,
          reviewedById: user.id,
          ...lifecycle,
        };

        if (existing) {
          await this.prisma.listing.update({
            where: { id: existing.id },
            data: {
              ...listingData,
              images: {
                deleteMany: {},
                create: images.map((image) => ({
                  url: image.url,
                  altText: image.altText,
                  sortOrder: image.sortOrder,
                  isPrimary: image.isPrimary,
                })),
              },
            },
          });
          summary.updated += 1;
          continue;
        }

        await this.prisma.listing.create({
          data: {
            ...listingData,
            images: images.length
              ? {
                  create: images.map((image) => ({
                    url: image.url,
                    altText: image.altText,
                    sortOrder: image.sortOrder,
                    isPrimary: image.isPrimary,
                  })),
                }
              : undefined,
          },
        });
        summary.created += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push(
          `Row ${index + 2}: ${
            error instanceof Error ? error.message : 'Import failed'
          }`,
        );
      }
    }

    return summary;
  }

  async deleteAll(_user: { id: string }) {
    const result = await this.prisma.listing.deleteMany({});

    return {
      deleted: result.count,
    };
  }

  async saveDraft(user: ActingUser, draftDto: SaveListingDraftDto) {
    if (!isAdminRole(user.role)) {
      await this.requireSellerProfilesService().assertApprovedSeller(user.id);
    }

    const clientDraftKey = draftDto.clientDraftKey.trim();

    if (!clientDraftKey) {
      throw new BadRequestException('Draft key is required');
    }

    const existing = draftDto.listingId
      ? await this.prisma.listing.findUnique({
          where: { id: draftDto.listingId },
          include: { images: true },
        })
      : await this.prisma.listing.findUnique({
          where: {
            sellerId_clientDraftKey: {
              sellerId: user.id,
              clientDraftKey,
            },
          },
          include: { images: true },
        });

    if (existing && existing.sellerId !== user.id && !isAdminRole(user.role)) {
      throw new ForbiddenException('You can only update your own drafts');
    }

    if (existing && existing.status !== ListingStatus.DRAFT) {
      const publishedListing = await this.prisma.listing.findUnique({
        where: { id: existing.id },
        include: listingInclude,
      });

      if (publishedListing) {
        return withoutListHeavyAttributes(publishedListing);
      }

      throw new BadRequestException('Only draft listings can be auto-saved');
    }

    const category = draftDto.categorySlug
      ? await this.resolveCategory(draftDto.categorySlug)
      : existing
        ? await this.prisma.category.findUnique({
            where: { id: existing.categoryId },
          })
        : await this.resolveDraftCategory();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const images = await this.prepareListingImages(
      user.id,
      draftDto.images,
      existing?.images ?? [],
    );
    const baseData = {
      clientDraftKey,
      title: draftDto.title ?? existing?.title ?? 'Untitled draft',
      description: draftDto.description ?? existing?.description ?? '',
      price:
        typeof draftDto.price === 'number'
          ? new Prisma.Decimal(draftDto.price)
          : (existing?.price ?? new Prisma.Decimal(0)),
      currency: draftDto.currency ?? existing?.currency ?? 'AED',
      location: draftDto.location ?? existing?.location ?? '',
      latitude:
        draftDto.latitude !== undefined
          ? draftDto.latitude
          : (existing?.latitude ?? null),
      longitude:
        draftDto.longitude !== undefined
          ? draftDto.longitude
          : (existing?.longitude ?? null),
      status: ListingStatus.DRAFT,
      listingPaymentMode:
        existing?.listingPaymentMode ?? ListingPaymentMode.FREE,
      ...this.getLifecycleDataForStatus(ListingStatus.DRAFT, category),
      attributes:
        draftDto.attributes === undefined
          ? undefined
          : toJsonValue(draftDto.attributes),
      categoryId: category.id,
    };

    if (existing) {
      const updatedDraft = await this.prisma.listing.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          images:
            images === undefined
              ? undefined
              : {
                  deleteMany: {},
                  create: images.map((image) =>
                    this.toListingImageCreate(image),
                  ),
                },
        },
        include: listingInclude,
      });

      await this.attachPreparedImagesToListing(updatedDraft.id, images);

      return updatedDraft;
    }

    const draft = await this.prisma.listing.create({
      data: {
        ...baseData,
        sellerId: user.id,
        images: images?.length
          ? { create: images.map((image) => this.toListingImageCreate(image)) }
          : undefined,
      },
      include: listingInclude,
    });

    await this.attachPreparedImagesToListing(draft.id, images);

    return draft;
  }

  async getMyListingQuota(userId: string) {
    const policy = await this.getListingQuotaPolicy(userId);
    const used = await this.countUsedFreeListings(userId);
    const remaining = Math.max(policy.freeListingAllowance - used, 0);

    return {
      freeListingAllowance: policy.freeListingAllowance,
      freeListingUsed: used,
      freeListingRemaining: remaining,
      listingFeeAmount: policy.listingFeeAmount.toFixed(2),
      listingFeeCurrency: policy.listingFeeCurrency,
      paidListingFallbackEnabled: true,
    };
  }

  async markListingPaymentSucceeded(
    user: ActingUser,
    listingId: string,
    dto: CompleteListingPaymentDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        sellerId: true,
        status: true,
      },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    if (!isAdminRole(user.role) && listing.sellerId !== user.id) {
      throw new ForbiddenException(
        'You can only complete payment for your own listing',
      );
    }

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        listingId,
        userId: listing.sellerId,
        type: TransactionType.LISTING_FEE,
        status: TransactionStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!transaction) {
      throw new BadRequestException(
        'This listing does not have a pending listing-fee payment',
      );
    }

    return this.requirePaymentsService().completeListingFeePaymentForActor(
      user,
      transaction.id,
      dto,
    );
  }

  async publishDraft(
    user: ActingUser,
    id: string,
    createListingDto: CreateListingDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    const isAdmin = isAdminRole(user.role);

    if (!isAdmin && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only publish your own drafts');
    }

    if (!isAdmin) {
      await this.requireSellerProfilesService().assertApprovedSeller(user.id);
    }

    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be published');
    }

    const category = await this.resolveCategory(createListingDto.categorySlug);
    await this.validateListingSubmission(category, createListingDto.attributes);
    const quotaPolicy = isAdmin
      ? await this.getListingQuotaPolicy()
      : await this.getListingQuotaPolicy(user.id, category.id);
    if (!isAdmin) {
      await this.assertSellerListingCapacity(user.id, quotaPolicy, listing.id);
    }
    const images = await this.prepareListingImages(
      user.id,
      createListingDto.images,
      listing.images ?? [],
    );
    const status = isAdmin ? ListingStatus.ACTIVE : ListingStatus.PENDING;
    const paymentMode = isAdmin
      ? (createListingDto.listingPaymentMode ?? listing.listingPaymentMode)
      : await this.resolveListingPaymentMode(
          user.id,
          createListingDto.listingPaymentMode,
          quotaPolicy,
        );

    const updateData: Prisma.ListingUpdateArgs['data'] = {
      title: createListingDto.title,
      description: createListingDto.description,
      price: new Prisma.Decimal(createListingDto.price),
      currency: createListingDto.currency ?? 'AED',
      location: createListingDto.location,
      latitude: createListingDto.latitude ?? null,
      longitude: createListingDto.longitude ?? null,
      status,
      listingPaymentMode: paymentMode,
      ...this.getLifecycleDataForStatus(status, category),
      attributes: toJsonValue(createListingDto.attributes),
      categoryId: category.id,
      images: {
        deleteMany: {},
        create:
          images?.map((image) => this.toListingImageCreate(image)) ?? [],
      },
    };
    const updatedDraft =
      paymentMode === ListingPaymentMode.PAID && !isAdmin
        ? await this.prisma.$transaction(async (tx) => {
            const draft = await tx.listing.update({
              where: { id },
              data: updateData,
              include: listingInclude,
            });

            await this.ensurePaidListingFeeCollected(tx, {
              userId: user.id,
              listingId: draft.id,
              policy: quotaPolicy,
            });

            return draft;
          })
        : await this.prisma.listing.update({
            where: { id },
            data: updateData,
            include: listingInclude,
          });

    await this.attachPreparedImagesToListing(updatedDraft.id, images);

    return this.attachSellerRatingSummary(updatedDraft);
  }

  async findAll(query: QueryListingsDto, includeHidden = false) {
    await this.expireDueListings();
    const categorySlugs = query.categorySlug
      ? await this.getCategorySlugScope(query.categorySlug)
      : undefined;
    const attributeFilters = parseAttributeFilterPayload(query.attributeFilters);
    const hasAttributeFilters = Object.keys(attributeFilters).length > 0;
    const now = new Date();
    const take = query.take ?? 25;
    const where: Prisma.ListingWhereInput = {
      ...(includeHidden
        ? query.status
          ? { status: query.status }
          : {}
        : { status: ListingStatus.ACTIVE }),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(categorySlugs
        ? {
            category: {
              slug: { in: categorySlugs },
            },
          }
        : {}),
      ...(query.location
        ? {
            location: {
              contains: query.location,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.minPrice != null || query.maxPrice != null
        ? {
            price: {
              ...(query.minPrice != null
                ? { gte: new Prisma.Decimal(query.minPrice) }
                : {}),
              ...(query.maxPrice != null
                ? { lte: new Prisma.Decimal(query.maxPrice) }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                location: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ListingOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    if (includeHidden) {
      const priorityRules = await this.getActivePriorityRuleWeights();
      const placements = getBoostPlacementPriority(query);
      const listings = await this.prisma.listing.findMany({
        where,
        orderBy,
        take: hasAttributeFilters ? Math.max(take * 8, 100) : take,
        include: {
          ...rankedListingInclude,
          boosts: {
            where: buildActiveBoostWhere(now).some,
            orderBy: [{ startsAt: 'desc' as const }],
          },
        },
      });

      return this.attachSellerRatingSummaries(
        listings
          .filter((listing) =>
            listingMatchesAttributeFilters(listing, attributeFilters),
          )
          .slice(0, take)
          .map((listing) => ({
            ...withoutRankingTransactions(listing),
            priorityRanking: this.getListingPriorityBreakdown(
              listing,
              priorityRules,
              placements,
              now,
            ),
        })),
      );
    }

    const hasExplicitSearchFilters =
      Boolean(query.categorySlug) ||
      Boolean(query.search) ||
      Boolean(query.location) ||
      query.minPrice != null ||
      query.maxPrice != null ||
      hasAttributeFilters ||
      (query.sort !== undefined && query.sort !== 'recommended');

    if (hasExplicitSearchFilters) {
      const listings = await this.prisma.listing.findMany({
        where,
        orderBy,
        take,
        include: rankedListingInclude,
      });

      return this.attachSellerRatingSummaries(
        listings
          .filter((listing) =>
            listingMatchesAttributeFilters(listing, attributeFilters),
          )
          .map((listing) => withoutRankingTransactions(listing)),
      );
    }

    const candidateTake = hasAttributeFilters
      ? Math.max(take * 12, 150)
      : Math.max(take * 5, 50);
    const priorityRules = await this.getActivePriorityRuleWeights();
    const boostedListings: RankedListingWithIncludes[] = [];
    const boostedIds = new Set<string>();
    const placements = getBoostPlacementPriority(query);

    for (const placement of placements) {
      const placementBoostWhere = buildActiveBoostWhere(now, placement);
      const placementBoostedListings = await this.prisma.listing.findMany({
        where: {
          ...where,
          ...(boostedIds.size ? { id: { notIn: [...boostedIds] } } : {}),
          boosts: placementBoostWhere,
        },
        orderBy,
        take: candidateTake,
        include: {
          ...rankedListingInclude,
          boosts: {
            where: placementBoostWhere.some,
            orderBy: [{ endsAt: 'asc' as const }],
          },
        },
      });

      for (const listing of placementBoostedListings) {
        boostedIds.add(listing.id);
      }

      boostedListings.push(...placementBoostedListings);
    }

    const paidListings = await this.prisma.listing.findMany({
      where: {
        ...where,
        ...(boostedIds.size ? { id: { notIn: [...boostedIds] } } : {}),
        AND: [
          {
            OR: [
              { paidPriorityEnabled: true },
              { transactions: buildPaidListingTransactionWhere() },
            ],
          },
        ],
      },
      orderBy,
      take: candidateTake,
      include: rankedListingInclude,
    });
    const rankedIds = new Set([
      ...boostedIds,
      ...paidListings.map((listing) => listing.id),
    ]);
    const categoryListings: RankedListingWithIncludes[] = [];

    for (const categoryId of priorityRules.categories.keys()) {
      const scopedCategoryListings = await this.prisma.listing.findMany({
        where: {
          ...where,
          ...(rankedIds.size ? { id: { notIn: [...rankedIds] } } : {}),
          AND: [
            {
              OR: [{ categoryId }, { category: { parentId: categoryId } }],
            },
          ],
        },
        orderBy,
        take: candidateTake,
        include: rankedListingInclude,
      });

      for (const listing of scopedCategoryListings) {
        rankedIds.add(listing.id);
      }

      categoryListings.push(...scopedCategoryListings);
    }

    const manualPriorityListings = await this.prisma.listing.findMany({
      where: {
        ...where,
        ...(rankedIds.size ? { id: { notIn: [...rankedIds] } } : {}),
        AND: [
          {
            OR: [
              { adminPriorityPromoted: true },
              { adminPriorityPinned: true },
              { adminPriorityScore: { not: null } },
            ],
          },
          {
            OR: [
              { adminPriorityStartsAt: null },
              { adminPriorityStartsAt: { lte: now } },
            ],
          },
          {
            OR: [
              { adminPriorityExpiresAt: null },
              { adminPriorityExpiresAt: { gt: now } },
            ],
          },
        ],
      },
      orderBy: [
        { adminPriorityPromoted: 'desc' },
        { adminPriorityPinned: 'desc' },
        { adminPriorityScore: 'desc' },
        orderBy,
      ],
      take: candidateTake,
      include: rankedListingInclude,
    });

    for (const listing of manualPriorityListings) {
      rankedIds.add(listing.id);
    }

    const reputationListings = await this.prisma.listing.findMany({
      where: {
        ...where,
        ...(rankedIds.size ? { id: { notIn: [...rankedIds] } } : {}),
      },
      orderBy: [{ seller: { reputationScore: 'desc' } }, orderBy],
      take: candidateTake,
      include: rankedListingInclude,
    });

    for (const listing of reputationListings) {
      rankedIds.add(listing.id);
    }

    const normalListings = await this.prisma.listing.findMany({
      where: {
        ...where,
        id: { notIn: [...rankedIds] },
      },
      orderBy,
      take: candidateTake,
      include: rankedListingInclude,
    });

    const listings = [
      ...boostedListings,
      ...paidListings,
      ...categoryListings,
      ...manualPriorityListings,
      ...reputationListings,
      ...normalListings,
    ]
      .sort((first, second) => {
        // Recommended is rank-first; explicit customer sorts use rank only for ties.
        const scoreDiff =
          this.getListingPriorityScore(second, priorityRules, placements, now) -
          this.getListingPriorityScore(first, priorityRules, placements, now);

        if (!query.sort || query.sort === 'recommended') {
          return scoreDiff || compareListingsByQuerySort(first, second, query);
        }

        const sortDiff = compareListingsByQuerySort(first, second, query);

        return (
          sortDiff ||
          scoreDiff ||
          (query.sort.startsWith('price_')
            ? second.createdAt.getTime() - first.createdAt.getTime()
            : 0)
        );
      })
      .filter((listing) =>
        listingMatchesAttributeFilters(listing, attributeFilters),
      )
      .slice(0, take);

    return this.attachSellerRatingSummaries(
      listings.map((listing) => withoutRankingTransactions(listing)),
    );
  }

  async findOne(id: string) {
    await this.expireDueListings();

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (
      !listing ||
      listing.status !== ListingStatus.ACTIVE
    ) {
      throw new NotFoundException('Listing not found');
    }

    return this.attachSellerRatingSummary(listing);
  }

  async recordView(id: string, dto: RecordListingViewDto = {}) {
    const now = new Date();
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        boosts: {
          where: {
            status: BoostStatus.ACTIVE,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
          orderBy: [{ startsAt: 'desc' }],
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException('Listing not found');
    }

    const listingViewClient = (
      this.prisma as PrismaService & {
        listingView?: { create?: (args: unknown) => Promise<unknown> };
      }
    ).listingView;

    if (!listingViewClient?.create) {
      return { recorded: false };
    }

    try {
      await listingViewClient.create({
        data: {
          listingId: listing.id,
          boostId: listing.boosts[0]?.id,
          source: dto.source?.trim() || undefined,
        },
      });
    } catch (error) {
      if (isMissingAnalyticsStorageError(error)) {
        this.logger.warn(
          'Listing analytics tables are missing. Run Prisma migrations.',
        );
        return { recorded: false };
      }

      throw error;
    }

    return { recorded: true };
  }

  async findOneForUser(user: ActingUser, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    if (!isAdminRole(user.role) && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only view your own draft listings');
    }

    return this.attachSellerRatingSummary(listing);
  }

  async update(
    user: ActingUser,
    id: string,
    updateListingDto: UpdateListingDto,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    const isAdmin = isAdminRole(user.role);

    if (!isAdmin && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only update your own listings');
    }

    let categoryId = listing.categoryId;
    let lifecycleCategory: ListingCategory | undefined;

    if (updateListingDto.categorySlug) {
      const category = await this.resolveCategory(
        updateListingDto.categorySlug,
      );

      categoryId = category.id;
      lifecycleCategory = category;
    }

    const images = await this.prepareListingImages(
      user.id,
      updateListingDto.images,
      listing.images ?? [],
    );
    const mergedAttributes =
      updateListingDto.attributes === undefined
        ? ((listing.attributes as Record<string, unknown> | null) ?? undefined)
        : updateListingDto.attributes;
    const ownerLifecycleStatus =
      updateListingDto.status === ListingStatus.SOLD ||
      updateListingDto.status === ListingStatus.REMOVED ||
      updateListingDto.status === ListingStatus.PAUSED
        ? updateListingDto.status
        : undefined;
    const shouldResubmitForModeration =
      !isAdmin && hasModeratedListingChanges(updateListingDto);
    const nextStatus = isAdmin
      ? updateListingDto.status
      : (ownerLifecycleStatus ??
        (shouldResubmitForModeration ? ListingStatus.PENDING : undefined));
    const lifecycleTargetCategory =
      lifecycleCategory ??
      (await this.prisma.category.findUnique({
        where: { id: categoryId },
      })) ??
      (await this.resolveDraftCategory());

    if (shouldResubmitForModeration) {
      await this.validateListingSubmission(
        lifecycleTargetCategory,
        mergedAttributes,
      );
    }

    const updatedListing = await this.prisma.listing.update({
      where: { id },
      data: {
        title: updateListingDto.title,
        description: updateListingDto.description,
        price:
          typeof updateListingDto.price === 'number'
            ? new Prisma.Decimal(updateListingDto.price)
            : undefined,
        currency: updateListingDto.currency,
        location: updateListingDto.location,
        latitude: updateListingDto.latitude,
        longitude: updateListingDto.longitude,
        status: nextStatus,
        ...(nextStatus
          ? this.getLifecycleDataForStatus(
              nextStatus,
              lifecycleTargetCategory,
            )
          : {}),
        attributes: toJsonValue(mergedAttributes),
        categoryId,
        images:
          images === undefined
            ? undefined
            : {
                deleteMany: {},
                create: images.map((image) => this.toListingImageCreate(image)),
              },
      },
      include: listingInclude,
    });

    await this.attachPreparedImagesToListing(updatedListing.id, images);

    return this.attachSellerRatingSummary(updatedListing);
  }

  async findMine(userId: string) {
    await this.expireDueListings();

    const listings = await this.prisma.listing.findMany({
      where: {
        sellerId: userId,
        status: {
          not: ListingStatus.DELETED,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: listingInclude,
    });

    const publishedFingerprints = new Set(
      listings
        .filter((listing) => listing.status !== ListingStatus.DRAFT)
        .map((listing) => getListingFingerprint(listing)),
    );
    const visibleListings = listings.filter(
      (listing) =>
        listing.status !== ListingStatus.DRAFT ||
        !publishedFingerprints.has(getListingFingerprint(listing)),
    );

    return this.attachSellerRatingSummaries(
      visibleListings.map((listing) => withoutListHeavyAttributes(listing)),
    );
  }

  async findSaved(userId: string) {
    const savedListingClient = (
      this.prisma as PrismaService & {
        savedListing?: {
          findMany?: (
            args: unknown,
          ) => Promise<Array<{ listing: ListingWithIncludes }>>;
        };
      }
    ).savedListing;

    if (!savedListingClient?.findMany) {
      return [];
    }

    let savedRows: Array<{ listing: ListingWithIncludes }>;

    try {
      savedRows = await savedListingClient.findMany({
        where: {
          userId,
          listing: { status: ListingStatus.ACTIVE },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            include: listingInclude,
          },
        },
      });
    } catch (error) {
      if (isMissingAnalyticsStorageError(error)) {
        this.logger.warn(
          'Saved listing table is missing. Run Prisma migrations.',
        );
        return [];
      }

      throw error;
    }

    return this.attachSellerRatingSummaries(
      savedRows.map((row) => withoutListHeavyAttributes(row.listing)),
      userId,
    );
  }

  async saveListing(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: listingInclude,
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.sellerId === userId) {
      throw new BadRequestException('You cannot save your own listing');
    }

    const savedListingClient = (
      this.prisma as PrismaService & {
        savedListing?: { upsert?: (args: unknown) => Promise<unknown> };
      }
    ).savedListing;

    if (!savedListingClient?.upsert) {
      throw new BadRequestException('Saved listings are not configured');
    }

    try {
      await savedListingClient.upsert({
        where: {
          userId_listingId: {
            userId,
            listingId,
          },
        },
        create: {
          userId,
          listingId,
        },
        update: {},
      });
    } catch (error) {
      if (isMissingAnalyticsStorageError(error)) {
        this.logger.warn(
          'Saved listing table is missing. Run Prisma migrations.',
        );
        return this.attachSellerRatingSummary(listing, userId);
      }

      throw error;
    }

    return this.attachSellerRatingSummary(listing, userId);
  }

  async unsaveListing(userId: string, listingId: string) {
    const savedListingClient = (
      this.prisma as PrismaService & {
        savedListing?: { deleteMany?: (args: unknown) => Promise<unknown> };
      }
    ).savedListing;

    if (!savedListingClient?.deleteMany) {
      return { saved: false };
    }

    try {
      await savedListingClient.deleteMany({
        where: {
          userId,
          listingId,
        },
      });
    } catch (error) {
      if (!isMissingAnalyticsStorageError(error)) {
        throw error;
      }
    }

    return { saved: false };
  }

  async remove(user: ActingUser, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing || listing.status === ListingStatus.DELETED) {
      throw new NotFoundException('Listing not found');
    }

    if (!isAdminRole(user.role) && listing.sellerId !== user.id) {
      throw new ForbiddenException('You can only delete your own listings');
    }

    const deletedListing = await this.prisma.listing.update({
      where: { id },
      data: {
        status: isAdminRole(user.role)
          ? ListingStatus.DELETED
          : ListingStatus.REMOVED,
        removedAt: new Date(),
      },
      include: listingInclude,
    });

    return this.attachSellerRatingSummary(deletedListing);
  }

  async moderate(user: { id: string }, id: string, dto: ModerateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const updatedListing = await this.prisma.$transaction(async (tx) => {
      const nextListing = await tx.listing.update({
        where: { id },
        data: {
          status: dto.status,
          ...this.getLifecycleDataForStatus(dto.status, listing.category),
          reviewedById: user.id,
          reviewedAt: new Date(),
          approvedAt:
            dto.status === ListingStatus.ACTIVE ? new Date() : undefined,
          rejectedAt:
            dto.status === ListingStatus.REJECTED ? new Date() : undefined,
          rejectionReason:
            dto.status === ListingStatus.REJECTED ? dto.reason ?? null : null,
        },
        include: listingInclude,
      });

      if (dto.status === ListingStatus.REJECTED) {
        await this.refundListingFeeToWalletIfEligible(
          tx,
          nextListing.id,
          nextListing.sellerId,
        );
      }

      return nextListing;
    });

    if (listing.status !== updatedListing.status) {
      try {
        await this.notifications?.notifyListingStatusChanged({
          userId: updatedListing.sellerId,
          actorId: user.id,
          listingId: updatedListing.id,
          listingTitle: updatedListing.title,
          status: updatedListing.status,
        });
      } catch {
        this.logger.warn(
          `Could not persist listing moderation notification for ${id}`,
        );
      }
    }

    return this.attachSellerRatingSummary(updatedListing);
  }

  async updatePriorityOverride(
    id: string,
    dto: UpdateListingPriorityOverrideDto,
  ) {
    if (
      dto.startsAt &&
      dto.expiresAt &&
      dto.startsAt.getTime() >= dto.expiresAt.getTime()
    ) {
      throw new BadRequestException(
        'Priority end time must be after the start time',
      );
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const updatedListing = await this.prisma.listing.update({
      where: { id },
      data: {
        paidPriorityEnabled: dto.paid ?? false,
        adminPriorityPromoted: dto.promoted ?? false,
        adminPriorityPinned: dto.pinned ?? false,
        adminPriorityScore: dto.score ?? null,
        adminPriorityStartsAt: dto.startsAt ?? null,
        adminPriorityExpiresAt: dto.expiresAt ?? null,
      },
      include: listingInclude,
    });

    return this.attachSellerRatingSummary(updatedListing);
  }

  async listPriorityRules() {
    return this.prisma.listingPriorityRule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: priorityRuleInclude,
    });
  }

  async createPriorityRule(dto: CreatePriorityRuleDto) {
    const scope = await this.resolvePriorityRuleScope(
      dto.target,
      dto.boostPackageId,
      dto.categoryId,
    );
    const existingRule = await this.prisma.listingPriorityRule.findFirst({
      where: { target: dto.target, ...scope },
      select: { id: true },
    });

    if (existingRule) {
      return this.prisma.listingPriorityRule.update({
        where: { id: existingRule.id },
        data: {
          name: dto.name,
          weight: dto.weight,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
        include: priorityRuleInclude,
      });
    }

    return this.prisma.listingPriorityRule.create({
      data: {
        name: dto.name,
        target: dto.target,
        ...scope,
        weight: dto.weight,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: priorityRuleInclude,
    });
  }

  async updatePriorityRule(id: string, dto: UpdatePriorityRuleDto) {
    const rule = await this.prisma.listingPriorityRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Priority rule not found');
    }

    const target = dto.target ?? rule.target;
    const scope = await this.resolvePriorityRuleScope(
      target,
      dto.boostPackageId ??
        (target === ListingPriorityRuleTarget.BOOST_PACKAGE
          ? (rule.boostPackageId ?? undefined)
          : undefined),
      dto.categoryId ??
        (target === ListingPriorityRuleTarget.CATEGORY_PRIORITY
          ? (rule.categoryId ?? undefined)
          : undefined),
    );
    const duplicateRule = await this.prisma.listingPriorityRule.findFirst({
      where: {
        target,
        ...scope,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicateRule) {
      throw new BadRequestException(
        'A priority rule already exists for that target and scope',
      );
    }

    return this.prisma.listingPriorityRule.update({
      where: { id },
      data: {
        ...dto,
        target,
        ...scope,
      },
      include: priorityRuleInclude,
    });
  }

  async deletePriorityRule(id: string) {
    const rule = await this.prisma.listingPriorityRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Priority rule not found');
    }

    return this.prisma.listingPriorityRule.update({
      where: { id },
      data: { isActive: false },
      include: priorityRuleInclude,
    });
  }

  private async createPaidListingWithFeeTransaction({
    user,
    listingData,
    policy,
  }: {
    user: ActingUser;
    listingData: Prisma.ListingCreateArgs['data'];
    policy: ListingQuotaPolicy;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const createdListing = await tx.listing.create({
        data: listingData,
        include: listingInclude,
      });

      await this.collectListingFeeFromWallet(tx, {
        userId: user.id,
        listingId: createdListing.id,
        policy,
      });

      return createdListing;
    });
  }

  private async ensurePaidListingFeeCollected(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      listingId: string;
      policy: ListingQuotaPolicy;
    },
  ) {
    const existingPaidFee = await tx.transaction.findFirst({
      where: {
        listingId: input.listingId,
        userId: input.userId,
        type: TransactionType.LISTING_FEE,
        status: {
          in: [TransactionStatus.SUCCEEDED, TransactionStatus.REFUNDED],
        },
      },
      select: { id: true },
    });

    if (existingPaidFee) {
      return existingPaidFee;
    }

    return this.collectListingFeeFromWallet(tx, input);
  }

  private async collectListingFeeFromWallet(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      listingId: string;
      policy: ListingQuotaPolicy;
    },
  ) {
    const { userId, listingId, policy } = input;
    const wallet = await tx.walletAccount.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currency: policy.listingFeeCurrency,
      },
    });

    if (wallet.currency !== policy.listingFeeCurrency) {
      throw new BadRequestException(
        'Wallet currency does not match listing fee currency',
      );
    }

    if (new Prisma.Decimal(wallet.balance).lt(policy.listingFeeAmount)) {
      throw new BadRequestException(
        'Insufficient wallet balance for the listing fee',
      );
    }

    const nextBalance = new Prisma.Decimal(wallet.balance).minus(
      policy.listingFeeAmount,
    );
    const paidAt = new Date();
    const transaction = await tx.transaction.create({
      data: {
        userId,
        listingId,
        type: TransactionType.LISTING_FEE,
        status: TransactionStatus.SUCCEEDED,
        amount: policy.listingFeeAmount,
        currency: policy.listingFeeCurrency,
        provider: 'wallet',
        providerRef: `wallet:${userId}:${listingId}:${paidAt.getTime()}`,
        metadata: {
          reason: 'free_listing_quota_exhausted',
          freeListingAllowance: policy.freeListingAllowance,
          paidAt: paidAt.toISOString(),
          walletPaidAt: paidAt.toISOString(),
        },
      },
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
        type: 'LISTING_FEE',
        amount: policy.listingFeeAmount.mul(-1),
        currency: policy.listingFeeCurrency,
        balanceAfter: nextBalance,
        metadata: {
          listingId,
          reason: 'free_listing_quota_exhausted',
          freeListingAllowance: policy.freeListingAllowance,
        },
      },
    });

    return transaction;
  }

  private async refundListingFeeToWalletIfEligible(
    tx: Prisma.TransactionClient,
    listingId: string,
    userId: string,
  ) {
    const feeTransaction = await tx.transaction.findFirst({
      where: {
        listingId,
        userId,
        type: TransactionType.LISTING_FEE,
        status: TransactionStatus.SUCCEEDED,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!feeTransaction) {
      return null;
    }

    const metadata = readSettingObject(feeTransaction.metadata);

    if (metadata.refundedAt || metadata.refundTransactionId) {
      return null;
    }

    const wallet = await tx.walletAccount.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currency: feeTransaction.currency,
      },
    });

    if (wallet.currency !== feeTransaction.currency) {
      throw new BadRequestException(
        'Wallet currency does not match listing refund currency',
      );
    }

    const nextBalance = new Prisma.Decimal(wallet.balance).plus(
      feeTransaction.amount,
    );
    const refundedAt = new Date();
    const refundTransaction = await tx.transaction.create({
      data: {
        userId,
        listingId,
        type: TransactionType.LISTING_FEE_REFUND,
        status: TransactionStatus.SUCCEEDED,
        amount: feeTransaction.amount,
        currency: feeTransaction.currency,
        provider: 'wallet',
        providerRef: `wallet-refund:${userId}:${listingId}:${refundedAt.getTime()}`,
        metadata: {
          sourceTransactionId: feeTransaction.id,
          refundedAt: refundedAt.toISOString(),
        },
      },
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
        transactionId: refundTransaction.id,
        type: 'LISTING_FEE_REFUND',
        amount: feeTransaction.amount,
        currency: feeTransaction.currency,
        balanceAfter: nextBalance,
        metadata: {
          listingId,
          sourceTransactionId: feeTransaction.id,
        },
      },
    });
    await tx.transaction.update({
      where: { id: feeTransaction.id },
      data: {
        status: TransactionStatus.REFUNDED,
        metadata: {
          ...metadata,
          refundedAt: refundedAt.toISOString(),
          refundTransactionId: refundTransaction.id,
        },
      },
    });

    return refundTransaction;
  }

  private async resolveListingPaymentMode(
    sellerId: string,
    requestedMode: ListingPaymentMode | undefined,
    policy: ListingQuotaPolicy,
  ) {
    if (requestedMode === ListingPaymentMode.PAID) {
      return ListingPaymentMode.PAID;
    }

    const usedFreeListings = await this.countUsedFreeListings(sellerId);

    return usedFreeListings < policy.freeListingAllowance
      ? ListingPaymentMode.FREE
      : ListingPaymentMode.PAID;
  }

  private async countUsedFreeListings(sellerId: string) {
    return this.prisma.listing.count({
      where: {
        sellerId,
        listingPaymentMode: ListingPaymentMode.FREE,
        createdAt: { gte: getCurrentMonthStart() },
        status: {
          notIn: [
            ListingStatus.DRAFT,
            ListingStatus.DELETED,
            ListingStatus.REMOVED,
          ],
        },
      },
    });
  }

  private async getListingQuotaPolicy(
    sellerId?: string,
    categoryId?: string,
  ): Promise<ListingQuotaPolicy> {
    if (sellerId && this.sellerProfilesService) {
      const sellerPolicy = await this.sellerProfilesService.getSellerListingPolicy(
        sellerId,
        categoryId,
      );

      return {
        freeListingAllowance: sellerPolicy.monthlyFreeListingLimit,
        listingFeeAmount: new Prisma.Decimal(sellerPolicy.paidListingFee),
        listingFeeCurrency: sellerPolicy.currency,
        activeListingLimit: sellerPolicy.activeListingLimit,
        pendingListingLimit: sellerPolicy.pendingListingLimit,
      };
    }

    const envAllowance = readPositiveInteger(
      process.env.FREE_LISTING_ALLOWANCE,
      defaultFreeListingAllowance,
    );
    const envFeeAmount = readPositiveDecimal(
      process.env.LISTING_FEE_AMOUNT,
      defaultListingFeeAmount,
    );
    const envFeeCurrency = readCurrency(
      process.env.LISTING_FEE_CURRENCY,
      defaultListingFeeCurrency,
    );

    try {
      const setting = await this.prisma.marketplaceSetting.findUnique({
        where: { key: listingQuotaSettingKey },
      });
      const value = readSettingObject(setting?.value);

      return {
        freeListingAllowance: readPositiveInteger(
          value.freeListingAllowance,
          envAllowance,
        ),
        listingFeeAmount:
          value.listingFeeAmount == null
            ? envFeeAmount
            : readPositiveDecimal(value.listingFeeAmount, Number(envFeeAmount)),
        listingFeeCurrency: readCurrency(
          value.listingFeeCurrency,
          envFeeCurrency,
        ),
        activeListingLimit: null,
        pendingListingLimit: null,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        this.logger.warn(
          'Marketplace settings table is missing. Run Prisma migrations.',
        );

        return {
          freeListingAllowance: envAllowance,
          listingFeeAmount: envFeeAmount,
          listingFeeCurrency: envFeeCurrency,
          activeListingLimit: null,
          pendingListingLimit: null,
        };
      }

      throw error;
    }
  }

  private async seedMarketplaceSettings() {
    try {
      await this.prisma.marketplaceSetting.upsert({
        where: { key: listingQuotaSettingKey },
        update: {},
        create: {
          key: listingQuotaSettingKey,
          value: {
            freeListingAllowance: readPositiveInteger(
              process.env.FREE_LISTING_ALLOWANCE,
              defaultFreeListingAllowance,
            ),
            listingFeeAmount: Number(
              readPositiveDecimal(
                process.env.LISTING_FEE_AMOUNT,
                defaultListingFeeAmount,
              ),
            ),
            listingFeeCurrency: readCurrency(
              process.env.LISTING_FEE_CURRENCY,
              defaultListingFeeCurrency,
            ),
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        this.logger.warn(
          'Marketplace settings table is missing. Run Prisma migrations.',
        );
        return;
      }

      throw error;
    }
  }

  private requirePaymentsService() {
    if (!this.paymentsService) {
      throw new BadRequestException('Listing payments are not configured');
    }

    return this.paymentsService;
  }

  private requireSellerProfilesService() {
    if (!this.sellerProfilesService) {
      throw new BadRequestException('Seller profiles are not configured');
    }

    return this.sellerProfilesService;
  }

  private async assertSellerListingCapacity(
    sellerId: string,
    policy: ListingQuotaPolicy & {
      activeListingLimit?: number | null;
      pendingListingLimit?: number | null;
    },
    ignoreListingId?: string,
  ) {
    const [activeCount, pendingCount] = await Promise.all([
      this.prisma.listing.count({
        where: {
          sellerId,
          status: ListingStatus.ACTIVE,
          ...(ignoreListingId ? { id: { not: ignoreListingId } } : {}),
        },
      }),
      this.prisma.listing.count({
        where: {
          sellerId,
          status: ListingStatus.PENDING,
          ...(ignoreListingId ? { id: { not: ignoreListingId } } : {}),
        },
      }),
    ]);

    if (
      typeof policy.activeListingLimit === 'number' &&
      activeCount >= policy.activeListingLimit
    ) {
      throw new ForbiddenException(
        'Your seller tier has reached its active listing limit',
      );
    }

    if (
      typeof policy.pendingListingLimit === 'number' &&
      pendingCount >= policy.pendingListingLimit
    ) {
      throw new ForbiddenException(
        'Your seller tier has reached its pending listing limit',
      );
    }
  }

  private async attachSellerRatingSummary<T extends ListingWithSeller>(
    listing: T,
    viewerId?: string,
  ) {
    const [listingWithSummary] = await this.attachSellerRatingSummaries(
      [listing],
      viewerId,
    );

    return listingWithSummary;
  }

  private async attachSellerRatingSummaries<T extends ListingWithSeller>(
    listings: T[],
    viewerId?: string,
  ) {
    if (!listings.length) {
      return listings;
    }

    const [summaries, engagementStats] = await Promise.all([
      this.getSellerRatingSummaryMap(
        listings.map((listing) => listing.sellerId),
      ),
      this.getListingEngagementStatsMap(listings, viewerId),
    ]);

    return listings.map((listing) => {
      const summary = summaries.get(listing.sellerId) ?? {
        averageRating: null,
        ratingCount: 0,
        reviewCount: 0,
      };
      const analytics =
        engagementStats.get(listing.id) ??
        this.getEmptyListingEngagementStats(false);

      return {
        ...listing,
        analytics,
        seller: listing.seller
          ? {
              ...listing.seller,
              ...summary,
            }
          : listing.seller,
      };
    });
  }

  private getEmptyListingEngagementStats(
    savedByViewer: boolean,
  ): ListingEngagementStats {
    return {
      viewCount: 0,
      saveCount: 0,
      inquiryCount: 0,
      messageCount: 0,
      buyerMessageCount: 0,
      conversionRate: 0,
      boostedViewCount: 0,
      boostCount: 0,
      activeBoostCount: 0,
      boostedInquiryCount: 0,
      boostConversionRate: 0,
      savedByViewer,
    };
  }

  private async getListingEngagementStatsMap<T extends ListingWithSeller>(
    listings: T[],
    viewerId?: string,
  ) {
    const listingIds = [...new Set(listings.map((listing) => listing.id))];
    const stats = new Map<string, ListingEngagementStats>();
    const sellerByListing = new Map(
      listings.map((listing) => [listing.id, listing.sellerId]),
    );

    for (const listingId of listingIds) {
      stats.set(listingId, this.getEmptyListingEngagementStats(false));
    }

    if (!listingIds.length) {
      return stats;
    }

    const prismaWithAnalytics = this.prisma as PrismaService & {
      listingView?: {
        groupBy?: (
          args: unknown,
        ) => Promise<Array<{ listingId: string; _count: { _all: number } }>>;
      };
      savedListing?: {
        groupBy?: (
          args: unknown,
        ) => Promise<Array<{ listingId: string; _count: { _all: number } }>>;
        findMany?: (args: unknown) => Promise<Array<{ listingId: string }>>;
      };
      conversation?: {
        findMany?: (args: unknown) => Promise<
          Array<{
            listingId: string | null;
            createdAt: Date;
            messages: Array<{ senderId: string }>;
          }>
        >;
      };
      boost?: {
        findMany?: (args: unknown) => Promise<
          Array<{
            id: string;
            listingId: string;
            status: BoostStatus;
            startsAt: Date;
            endsAt: Date;
          }>
        >;
      };
    };

    let viewRows: Array<{ listingId: string; _count: { _all: number } }>;
    let boostedViewRows: Array<{
      listingId: string;
      _count: { _all: number };
    }>;
    let saveRows: Array<{ listingId: string; _count: { _all: number } }>;
    let viewerSavedRows: Array<{ listingId: string }>;
    let conversations: Array<{
      listingId: string | null;
      createdAt: Date;
      messages: Array<{ senderId: string }>;
    }>;
    let boosts: Array<{
      id: string;
      listingId: string;
      status: BoostStatus;
      startsAt: Date;
      endsAt: Date;
    }>;

    try {
      [
        viewRows,
        boostedViewRows,
        saveRows,
        viewerSavedRows,
        conversations,
        boosts,
      ] = await Promise.all([
        prismaWithAnalytics.listingView?.groupBy
          ? prismaWithAnalytics.listingView.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds } },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        prismaWithAnalytics.listingView?.groupBy
          ? prismaWithAnalytics.listingView.groupBy({
              by: ['listingId'],
              where: {
                listingId: { in: listingIds },
                boostId: { not: null },
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        prismaWithAnalytics.savedListing?.groupBy
          ? prismaWithAnalytics.savedListing.groupBy({
              by: ['listingId'],
              where: { listingId: { in: listingIds } },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        viewerId && prismaWithAnalytics.savedListing?.findMany
          ? prismaWithAnalytics.savedListing.findMany({
              where: {
                userId: viewerId,
                listingId: { in: listingIds },
              },
              select: { listingId: true },
            })
          : Promise.resolve([]),
        prismaWithAnalytics.conversation?.findMany
          ? prismaWithAnalytics.conversation.findMany({
              where: { listingId: { in: listingIds } },
              select: {
                listingId: true,
                createdAt: true,
                messages: {
                  where: { deletedAt: null },
                  select: { senderId: true },
                },
              },
            })
          : Promise.resolve([]),
        prismaWithAnalytics.boost?.findMany
          ? prismaWithAnalytics.boost.findMany({
              where: { listingId: { in: listingIds } },
              select: {
                id: true,
                listingId: true,
                status: true,
                startsAt: true,
                endsAt: true,
              },
            })
          : Promise.resolve([]),
      ]);
    } catch (error) {
      if (isMissingAnalyticsStorageError(error)) {
        this.logger.warn(
          'Listing analytics tables are missing. Returning zero analytics.',
        );
        return stats;
      }

      throw error;
    }

    for (const row of viewRows) {
      const listingStats = stats.get(row.listingId);
      if (listingStats) {
        listingStats.viewCount = row._count._all;
      }
    }

    for (const row of boostedViewRows) {
      const listingStats = stats.get(row.listingId);
      if (listingStats) {
        listingStats.boostedViewCount = row._count._all;
      }
    }

    for (const row of saveRows) {
      const listingStats = stats.get(row.listingId);
      if (listingStats) {
        listingStats.saveCount = row._count._all;
      }
    }

    for (const row of viewerSavedRows) {
      const listingStats = stats.get(row.listingId);
      if (listingStats) {
        listingStats.savedByViewer = true;
      }
    }

    const boostsByListing = new Map<string, typeof boosts>();

    for (const boost of boosts) {
      const listingBoosts = boostsByListing.get(boost.listingId) ?? [];
      listingBoosts.push(boost);
      boostsByListing.set(boost.listingId, listingBoosts);

      const listingStats = stats.get(boost.listingId);
      if (listingStats) {
        listingStats.boostCount += 1;
        if (boost.status === BoostStatus.ACTIVE) {
          listingStats.activeBoostCount += 1;
        }
      }
    }

    for (const conversation of conversations) {
      if (!conversation.listingId) {
        continue;
      }

      const listingStats = stats.get(conversation.listingId);
      if (!listingStats) {
        continue;
      }

      const sellerId = sellerByListing.get(conversation.listingId);
      const listingBoosts = boostsByListing.get(conversation.listingId) ?? [];
      const startedDuringBoost = listingBoosts.some(
        (boost) =>
          boost.startsAt <= conversation.createdAt &&
          boost.endsAt >= conversation.createdAt,
      );

      listingStats.inquiryCount += 1;
      listingStats.messageCount += conversation.messages.length;
      listingStats.buyerMessageCount += conversation.messages.filter(
        (message) => message.senderId !== sellerId,
      ).length;

      if (startedDuringBoost) {
        listingStats.boostedInquiryCount += 1;
      }
    }

    for (const listingStats of stats.values()) {
      listingStats.conversionRate = this.toPercent(
        listingStats.inquiryCount,
        listingStats.viewCount,
      );
      listingStats.boostConversionRate = this.toPercent(
        listingStats.boostedInquiryCount,
        listingStats.boostedViewCount,
      );
    }

    return stats;
  }

  private toPercent(numerator: number, denominator: number) {
    if (!denominator) {
      return 0;
    }

    return Number(((numerator / denominator) * 100).toFixed(1));
  }

  private async getSellerRatingSummaryMap(sellerIds: string[]) {
    const uniqueSellerIds = [...new Set(sellerIds)].filter(Boolean);
    const summaries = new Map<string, SellerRatingSummary>();

    if (!uniqueSellerIds.length || !this.prisma.sellerRating?.groupBy) {
      return summaries;
    }

    const [aggregateRows, reviewRows] = await Promise.all([
      this.prisma.sellerRating.groupBy({
        by: ['sellerId'],
        where: { sellerId: { in: uniqueSellerIds } },
        _avg: { stars: true },
        _count: { _all: true },
      }),
      this.prisma.sellerRating.groupBy({
        by: ['sellerId'],
        where: {
          sellerId: { in: uniqueSellerIds },
          review: { not: null },
          reviewStatus: SellerReviewStatus.APPROVED,
        },
        _count: { _all: true },
      }),
    ]);
    const approvedReviewCounts = new Map(
      reviewRows.map((row) => [row.sellerId, row._count._all]),
    );

    for (const row of aggregateRows) {
      summaries.set(row.sellerId, {
        averageRating: this.roundRating(row._avg.stars),
        ratingCount: row._count._all,
        reviewCount: approvedReviewCounts.get(row.sellerId) ?? 0,
      });
    }

    return summaries;
  }

  private roundRating(average: number | null) {
    return average == null ? null : Number(average.toFixed(1));
  }

  private async prepareListingImages(
    userId: string,
    images: ListingImageInputDto[] | undefined,
    existingImages: ExistingListingImage[] = [],
  ) {
    if (images === undefined) {
      return undefined;
    }

    if (images.length > MAX_LISTING_IMAGES) {
      throw new BadRequestException(
        `A listing can have up to ${MAX_LISTING_IMAGES} images`,
      );
    }

    if (!images.length) {
      return [];
    }

    const primaryIndex = Math.max(
      images.findIndex((image) => image.isPrimary),
      0,
    );

    return Promise.all(
      images.map(async (image, index) => {
        const resolvedImage = await this.resolveListingImage(
          userId,
          image,
          existingImages,
        );

        return {
          ...resolvedImage,
          altText: image.altText?.trim() || undefined,
          sortOrder: index,
          isPrimary: index === primaryIndex,
        } satisfies PreparedListingImage;
      }),
    );
  }

  private async resolveListingImage(
    userId: string,
    image: ListingImageInputDto,
    existingImages: ExistingListingImage[],
  ) {
    if (image.assetId) {
      const asset = await this.requireMediaService().getOwnedListingImageAsset(
        userId,
        image.assetId,
      );

      return { url: asset.url, mediaAssetId: asset.id };
    }

    const url = image.url?.trim();

    if (!url) {
      throw new BadRequestException('Listing image is missing an upload');
    }

    if (url.startsWith('data:image/')) {
      const asset =
        await this.requireMediaService().createListingImageAssetFromDataUrl(
          userId,
          url,
        );

      return { url: asset.url, mediaAssetId: asset.id };
    }

    const existingImage = existingImages.find((item) => item.url === url);

    if (existingImage) {
      return {
        url: existingImage.url,
        mediaAssetId: existingImage.mediaAssetId ?? undefined,
      };
    }

    throw new BadRequestException(
      'Upload listing images before attaching them',
    );
  }

  private toListingImageCreate(image: PreparedListingImage) {
    return {
      url: image.url,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      mediaAsset: image.mediaAssetId
        ? { connect: { id: image.mediaAssetId } }
        : undefined,
    };
  }

  private async attachPreparedImagesToListing(
    listingId: string,
    images: PreparedListingImage[] | undefined,
  ) {
    if (images === undefined) {
      return;
    }

    const assetIds =
      images?.flatMap((image) =>
        image.mediaAssetId ? [image.mediaAssetId] : [],
      ) ?? [];

    await this.mediaService?.attachImagesToListing(listingId, assetIds);
  }

  private requireMediaService() {
    if (!this.mediaService) {
      throw new BadRequestException('Image uploads are not configured');
    }

    return this.mediaService;
  }

  private async seedDefaultPriorityRules() {
    if (!this.prisma.listingPriorityRule) {
      return;
    }

    try {
      for (const rule of defaultPriorityRules) {
        const existingRule = await this.prisma.listingPriorityRule.findFirst({
          where: {
            target: rule.target,
            boostPackageId: null,
            categoryId: null,
          },
        });

        if (!existingRule) {
          await this.prisma.listingPriorityRule.create({ data: rule });
        }
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        this.logger.warn(
          'Listing priority rules table is missing. Run Prisma migrations.',
        );
        return;
      }

      throw error;
    }
  }

  private async getActivePriorityRuleWeights(): Promise<PriorityRuleWeights> {
    if (!this.prisma.listingPriorityRule) {
      return {
        general: new Map(
          defaultPriorityRules.map((rule) => [rule.target, rule.weight]),
        ),
        boostPackages: new Map<string, number>(),
        categories: new Map<string, number>(),
      };
    }

    try {
      const rules = await this.prisma.listingPriorityRule.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }],
      });

      return {
        general: new Map(
          rules
            .filter(
              (rule) =>
                rule.target !== ListingPriorityRuleTarget.BOOST_PACKAGE &&
                rule.target !== ListingPriorityRuleTarget.CATEGORY_PRIORITY,
            )
            .map((rule) => [rule.target, rule.weight]),
        ),
        boostPackages: new Map(
          rules.flatMap((rule) =>
            rule.target === ListingPriorityRuleTarget.BOOST_PACKAGE &&
            rule.boostPackageId
              ? ([[rule.boostPackageId, rule.weight]] as const)
              : [],
          ),
        ),
        categories: new Map(
          rules.flatMap((rule) =>
            rule.target === ListingPriorityRuleTarget.CATEGORY_PRIORITY &&
            rule.categoryId
              ? ([[rule.categoryId, rule.weight]] as const)
              : [],
          ),
        ),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        return {
          general: new Map(
            defaultPriorityRules.map((rule) => [rule.target, rule.weight]),
          ),
          boostPackages: new Map<string, number>(),
          categories: new Map<string, number>(),
        };
      }

      throw error;
    }
  }

  private getListingPriorityScore(
    listing: RankedListingWithIncludes,
    rules: PriorityRuleWeights,
    placements: BoostPlacement[],
    now: Date,
  ) {
    return this.getListingPriorityBreakdown(listing, rules, placements, now)
      .score;
  }

  private getListingPriorityBreakdown(
    listing: RankedListingWithIncludes,
    rules: PriorityRuleWeights,
    placements: BoostPlacement[],
    now: Date,
  ): ListingPriorityBreakdown {
    const adminOverrideScore = getAdminPriorityOverrideScore(
      listing,
      now,
      rules,
    );

    if (adminOverrideScore !== undefined) {
      const factor = listing.adminPriorityPinned
        ? {
            key: 'admin_pin',
            label: 'Pinned admin override',
            score: adminOverrideScore,
            detail: 'Absolute priority override',
          }
        : listing.adminPriorityScore != null
          ? {
              key: 'admin_score',
              label: 'Admin custom score',
              score: adminOverrideScore,
            }
          : {
              key: 'manual_admin_priority',
              label: 'Manual admin priority',
              score: adminOverrideScore,
            };

      return {
        score: adminOverrideScore,
        factors: [factor],
        overrideApplied: true,
      };
    }

    const factors: PriorityScoreFactor[] = [];
    const packageWeights = listing.boosts.flatMap((boost) => {
      if (!boost.packageId) {
        return [];
      }

      const weight = rules.boostPackages.get(boost.packageId);
      return weight === undefined ? [] : [weight];
    });
    const activeBoostWeight = listing.boosts.length
      ? (rules.general.get(ListingPriorityRuleTarget.BOOSTED_LISTING) ?? 0)
      : 0;
    if (activeBoostWeight) {
      factors.push({
        key: 'boosted_listing',
        label: 'Boosted listing',
        score: activeBoostWeight,
      });
    }
    const packageWeight = packageWeights.length
      ? Math.max(...packageWeights)
      : 0;
    if (packageWeight) {
      factors.push({
        key: 'boost_package',
        label: 'Boost package rule',
        score: packageWeight,
      });
    }
    const sellerTarget = getSellerPriorityTarget(listing);
    const sellerWeight = sellerTarget
      ? (rules.general.get(sellerTarget) ?? 0)
      : 0;
    if (sellerTarget && sellerWeight) {
      factors.push({
        key: 'seller_tier',
        label: getSellerPriorityLabel(sellerTarget),
        score: sellerWeight,
      });
    }
    const paidListingWeight =
      listing.paidPriorityEnabled || listing.transactions.length
        ? (rules.general.get(ListingPriorityRuleTarget.PAID_LISTING) ?? 0)
        : 0;
    if (paidListingWeight) {
      factors.push({
        key: 'paid_listing',
        label: 'Paid listing',
        score: paidListingWeight,
      });
    }
    const categoryWeight = Math.max(
      0,
      ...getListingCategoryScope(listing).map(
        (categoryId) => rules.categories.get(categoryId) ?? 0,
      ),
    );
    if (categoryWeight) {
      factors.push({
        key: 'category',
        label: 'Category rule',
        score: categoryWeight,
        detail: listing.category?.name,
      });
    }
    const reputationScore = getSellerReputationScore(listing);
    const sellerRatingMultiplier =
      rules.general.get(ListingPriorityRuleTarget.SELLER_RATING) ?? 1;
    const sellerRatingScore = reputationScore * sellerRatingMultiplier;
    if (sellerRatingScore) {
      factors.push({
        key: 'seller_rating',
        label: 'Seller rating',
        score: sellerRatingScore,
        detail: `${reputationScore} x ${sellerRatingMultiplier}`,
      });
    }
    const placementBonus = getPlacementBonus(listing, placements);
    if (placementBonus) {
      factors.push({
        key: 'boost_placement',
        label: 'Boost placement',
        score: placementBonus,
      });
    }

    const score =
      activeBoostWeight +
      packageWeight +
      paidListingWeight +
      sellerWeight +
      categoryWeight +
      sellerRatingScore +
      placementBonus;

    return {
      score,
      factors:
        factors.length > 0
          ? factors
          : [{ key: 'none', label: 'No active priority factors', score: 0 }],
      overrideApplied: false,
    };
  }

  private async resolvePriorityRuleScope(
    target: ListingPriorityRuleTarget,
    boostPackageId: string | undefined,
    categoryId: string | undefined,
  ) {
    const normalizedPackageId = boostPackageId?.trim() || null;
    const normalizedCategoryId = categoryId?.trim() || null;

    if (target === ListingPriorityRuleTarget.BOOST_PACKAGE) {
      if (normalizedCategoryId) {
        throw new BadRequestException(
          'Boost package rules cannot select a category',
        );
      }

      if (!normalizedPackageId) {
        throw new BadRequestException(
          'Boost package rules must select a boost package',
        );
      }

      const boostPackage = await this.prisma.boostPackage.findUnique({
        where: { id: normalizedPackageId },
        select: { id: true },
      });

      if (!boostPackage) {
        throw new NotFoundException('Boost package not found');
      }

      return { boostPackageId: normalizedPackageId, categoryId: null };
    }

    if (target === ListingPriorityRuleTarget.CATEGORY_PRIORITY) {
      if (normalizedPackageId) {
        throw new BadRequestException(
          'Category priority rules cannot select a boost package',
        );
      }

      if (!normalizedCategoryId) {
        throw new BadRequestException(
          'Category priority rules must select a category',
        );
      }

      const category = await this.prisma.category.findUnique({
        where: { id: normalizedCategoryId },
        select: { id: true },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return { boostPackageId: null, categoryId: normalizedCategoryId };
    }

    if (normalizedPackageId || normalizedCategoryId) {
      throw new BadRequestException(
        'Only scoped priority rules may select a package or category',
      );
    }

    return { boostPackageId: null, categoryId: null };
  }
}
