import "server-only";

import type { AssignableUserRole } from "@/lib/admin-permissions";
import {
  mapCategory,
  mapAuditLog,
  mapListing,
  mapListingReport,
  mapSeller,
  mapSessionUser,
  mapTransaction,
  type AdminBooking,
  type AdminBookingMessage,
  type AdminBookingParticipant,
  type AdminUser,
  type ApiActiveListingsReport,
  type ApiAuditLog,
  type ApiBoost,
  type ApiBoostPackage,
  type ApiBoostPlacement,
  type ApiBoostRevenueReport,
  type ApiCategoryIncomeReport,
  type ApiAdminMonitoringReport,
  type ApiAdminSellerReport,
  type ApiCategory,
  type ApiPaidListingsReport,
  type ApiPendingSellerApprovalsReport,
  type ApiListingPriorityRule,
  type ApiListingPriorityRuleTarget,
  type ApiSellerRating,
  type ApiSellerProfile,
  type ApiSellerProfileEnvelope,
  type ApiPublicSellerProfile,
  type ApiSellerBadgeType,
  type ApiSellerPrivilegeTier,
  type ApiSellerRatingSummary,
  type ApiSellerFormField,
  type ApiSellerReviewStatus,
  type ApiListing,
  type ApiListingPaymentMode,
  type ApiListingQuota,
  type ApiListingReport,
  type ApiListingStatus,
  type ApiReportStatus,
  type ApiSellerPriorityTier,
  type ApiTransaction,
  type ApiTransactionStatus,
  type ApiTransactionType,
  type ApiTopSellersReport,
  type ApiUser,
  type ApiWalletPaymentsReport,
  type ApiWalletAccount,
} from "@/lib/marketplace";

export class MarketplaceApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MarketplaceApiError";
  }
}

type ListingQuery = {
  search?: string;
  categorySlug?: string;
  sellerId?: string;
  status?: ApiListingStatus;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "recommended" | "newest" | "price_asc" | "price_desc";
  boostPlacement?: ApiBoostPlacement;
  take?: number;
};

type TransactionQuery = {
  status?: ApiTransactionStatus;
  type?: ApiTransactionType;
  userId?: string;
  listingId?: string;
  take?: number;
};

type AuditLogQuery = {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  from?: string;
  to?: string;
  take?: number;
};

type ListingReportQuery = {
  status?: ApiReportStatus;
  listingId?: string;
  reporterId?: string;
  take?: number;
};

type AdminMonitoringQuery = {
  days?: number;
  from?: string;
  to?: string;
  topTake?: number;
};

type AdminSellerReportQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

type TopSellersReportQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

type PendingSellerApprovalsQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

type ActiveListingsReportQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

type PaidListingsReportQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

type WalletPaymentsReportQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

type BoostRevenueReportQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

type CategoryIncomeReportQuery = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
};

export type AdminReportEmailType =
  | "monitoring"
  | "active-listings"
  | "paid-listings"
  | "category-income"
  | "boost-revenue"
  | "wallet-payments"
  | "sellers"
  | "top-sellers"
  | "approvals"
  | "seller-approvals";

export type AdminReportEmailFilters = {
  days?: number;
  from?: string;
  to?: string;
  take?: number;
  topTake?: number;
};

export type SendAdminReportEmailPayload = {
  recipients: string[];
  subject?: string;
  message?: string;
  filters?: AdminReportEmailFilters;
};

export type AdminReportEmailDelivery = {
  enabled: boolean;
  messageId?: string;
  accepted: string[];
  rejected: string[];
};

export type AdminReportEmailResult = {
  reportType: AdminReportEmailType;
  recipients: string[];
  subject: string;
  filters: AdminReportEmailFilters;
  delivery: AdminReportEmailDelivery;
};

type SellerReviewQuery = {
  status?: ApiSellerReviewStatus;
};

export const boostPlans = [
  {
    placement: "TOP_LISTING",
    label: "Top listing",
    durationDays: 7,
    priceLabel: "AED 25",
    description: "Prioritized placement at the top of customer results.",
  },
  {
    placement: "HIGHLIGHTED_LISTING",
    label: "Highlighted listing",
    durationDays: 7,
    priceLabel: "AED 25",
    description: "Highlighted badge and boosted ordering across lists.",
  },
  {
    placement: "CATEGORY_PRIORITY",
    label: "Category priority",
    durationDays: 7,
    priceLabel: "AED 25",
    description: "Priority placement inside the listing category results.",
  },
  {
    placement: "HOMEPAGE_PROMOTION",
    label: "Homepage promotion",
    durationDays: 7,
    priceLabel: "AED 25",
    description: "Promoted placement on the customer-facing homepage.",
  },
  {
    placement: "TIME_BASED_BOOST",
    label: "Time-based boost",
    durationDays: 7,
    priceLabel: "AED 25",
    description: "Short campaign boost controlled by the selected duration.",
  },
] satisfies {
  placement: ApiBoostPlacement;
  label: string;
  durationDays: number;
  priceLabel: string;
  description: string;
}[];

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
  emailVerificationPreviewUrl?: string | null;
  newDevice?: boolean;
  user: ApiUser;
};

type RegisterResponse = {
  message: string;
  email: string;
  emailVerificationPreviewUrl?: string | null;
  user: ApiUser;
};

type ListingImagePayload = {
  url: string;
  altText?: string;
  isPrimary?: boolean;
};

type ListingPayload = {
  clientDraftKey?: string;
  categorySlug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  location: string;
  status?: ApiListingStatus;
  listingPaymentMode?: ApiListingPaymentMode;
  attributes: Record<string, unknown>;
  images?: ListingImagePayload[];
};

type SellerProfilePayload = {
  formAnswers?: Record<string, unknown>;
  requestMetadata?: Record<string, unknown>;
};

type ListingDraftPayload = Partial<ListingPayload> & {
  clientDraftKey: string;
  listingId?: string;
};

type ApiAdminBooking = {
  id: string;
  listingId?: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: ApiListing | null;
  participants: AdminBookingParticipant[];
  messages: AdminBookingMessage[];
};

type CreateBoostPayload = {
  packageId?: string;
  placement?: ApiBoostPlacement;
  paymentMethod?: "GATEWAY" | "WALLET";
  durationDays?: number;
  startsAt?: string;
  endsAt?: string;
};

type BoostPackagePayload = {
  name: string;
  slug?: string;
  description?: string;
  placement: ApiBoostPlacement;
  price: number;
  currency?: string;
  durationDays: number;
  isActive?: boolean;
  sortOrder?: number;
  categoryIds?: string[];
};

type PriorityRulePayload = {
  name: string;
  target: ApiListingPriorityRuleTarget;
  boostPackageId?: string;
  categoryId?: string;
  weight: number;
  isActive?: boolean;
  sortOrder?: number;
};

type ListingPriorityOverridePayload = {
  paid: boolean;
  promoted: boolean;
  pinned: boolean;
  score: number | null;
  startsAt: string | null;
  expiresAt: string | null;
};

type AdminUserPayload = {
  name?: string;
  displayName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  role?: AssignableUserRole | string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  sellerPriorityTier?: ApiSellerPriorityTier;
};

type BoostResponse = ApiBoost & {
  payment?: {
    provider: string;
    providerRef: string;
    checkoutUrl?: string;
  };
};

type ListingPaymentResponse = {
  provider: string;
  providerRef: string;
  checkoutUrl?: string;
  transactionId?: string;
};

type ListingResponse = ApiListing & {
  payment?: ListingPaymentResponse;
};

type WalletTopUpResponse = {
  payment?: {
    provider: string;
    providerRef: string;
    checkoutUrl?: string;
  };
  transaction: ApiTransaction;
  wallet: ApiWalletAccount;
};

const fallbackCategories: ApiCategory[] = [
  {
    id: "fallback-motors",
    name: "Motors",
    slug: "motors",
    description: "Cars, bikes, spare parts, and dealer inventory.",
    schemaDefinition: null,
    isActive: true,
    parentId: null,
    sortOrder: 10,
    _count: { listings: 0 },
  },
  {
    id: "fallback-property",
    name: "Property",
    slug: "property",
    description: "Apartments, villas, offices, and land.",
    schemaDefinition: null,
    isActive: true,
    parentId: null,
    sortOrder: 20,
    _count: { listings: 0 },
  },
  {
    id: "fallback-electronics",
    name: "Electronics",
    slug: "electronics",
    description: "Phones, laptops, consoles, and accessories.",
    schemaDefinition: {
      fields: [
        { key: "brand", label: "Brand", type: "text", required: true },
        { key: "model", label: "Model", type: "text" },
        {
          key: "condition",
          label: "Condition",
          type: "select",
          options: ["New", "Like new", "Used"],
        },
      ],
    },
    isActive: true,
    parentId: null,
    sortOrder: 30,
    _count: { listings: 0 },
  },
  {
    id: "fallback-jobs",
    name: "Jobs",
    slug: "jobs",
    description: "Hiring, freelance gigs, and business opportunities.",
    schemaDefinition: {
      fields: [
        {
          key: "jobType",
          label: "Job type",
          type: "select",
          options: ["Full-time", "Part-time", "Contract"],
        },
        { key: "salary", label: "Monthly salary", type: "number" },
      ],
    },
    isActive: true,
    parentId: null,
    sortOrder: 40,
    _count: { listings: 0 },
  },
  {
    id: "fallback-services",
    name: "Services",
    slug: "services",
    description: "Repair, maintenance, beauty, and local help.",
    schemaDefinition: {
      fields: [
        {
          key: "serviceType",
          label: "Service type",
          type: "text",
          required: true,
        },
        { key: "onsite", label: "On-site service", type: "toggle" },
      ],
    },
    isActive: true,
    parentId: null,
    sortOrder: 50,
    _count: { listings: 0 },
  },
];

function getApiBaseUrl() {
  return process.env.MARKETPLACE_API_URL ?? "http://127.0.0.1:3001";
}

function isTransientMarketplaceError(error: unknown) {
  return error instanceof MarketplaceApiError && error.status >= 500;
}

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(payload.message)) {
      return payload.message[0] ?? "Request failed";
    }

    return payload.message ?? payload.error ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

async function apiRequest<T>(
  path: string,
  {
    accessToken,
    emptyResponseValue,
    headers,
    searchParams,
    ...init
  }: RequestInit & {
    accessToken?: string;
    emptyResponseValue?: T;
    searchParams?: Record<string, string | number | undefined>;
  } = {},
) {
  const url = new URL(path, getApiBaseUrl());

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new MarketplaceApiError(
      `Marketplace API is unavailable at ${getApiBaseUrl()}.`,
      503,
    );
  }

  if (!response.ok) {
    throw new MarketplaceApiError(
      await parseErrorMessage(response),
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.text();

  if (!body) {
    if (emptyResponseValue !== undefined) {
      return emptyResponseValue;
    }

    throw new MarketplaceApiError(
      "Marketplace API returned an empty response.",
      502,
    );
  }

  return JSON.parse(body) as T;
}

function mapAuthResponse(response: AuthResponse) {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    refreshTokenExpiresAt: response.refreshTokenExpiresAt,
    emailVerificationPreviewUrl: response.emailVerificationPreviewUrl,
    newDevice: response.newDevice,
    user: mapSessionUser(response.user),
  };
}

export async function fetchCategories() {
  try {
    const categories = await apiRequest<ApiCategory[]>("/categories");
    return categories.map(mapCategory);
  } catch (error) {
    if (isTransientMarketplaceError(error)) {
      return fallbackCategories.map(mapCategory);
    }

    throw error;
  }
}

export async function fetchAdminCategories(accessToken: string) {
  const categories = await apiRequest<ApiCategory[]>("/categories/admin/all", {
    accessToken,
  });
  return categories.map(mapCategory);
}

export async function fetchAdminUsers(accessToken: string) {
  return apiRequest<AdminUser[]>("/users/admin/all", {
    accessToken,
  });
}

export async function fetchAdminUser(accessToken: string, userId: string) {
  return apiRequest<AdminUser>(`/users/admin/${userId}`, {
    accessToken,
  });
}

export async function updateAdminUser(
  accessToken: string,
  userId: string,
  payload: AdminUserPayload,
) {
  return apiRequest<AdminUser>(`/users/admin/${userId}`, {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminUserListings(
  accessToken: string,
  userId: string,
) {
  const listings = await apiRequest<ApiListing[]>(
    `/users/admin/${userId}/listings`,
    {
      accessToken,
    },
  );

  return listings.map(mapListing);
}

export async function fetchAdminUserBookings(
  accessToken: string,
  userId: string,
) {
  const bookings = await apiRequest<ApiAdminBooking[]>(
    `/users/admin/${userId}/bookings`,
    {
      accessToken,
    },
  );

  return bookings.map(
    (booking): AdminBooking => ({
      ...booking,
      listing: booking.listing ? mapListing(booking.listing) : null,
    }),
  );
}

export async function createCategory(
  accessToken: string,
  payload: {
    name: string;
    slug?: string;
    description?: string;
    parentSlug?: string;
    listingExpiryDays?: number;
    schemaDefinition?: {
      fields: Array<{
        key: string;
        label: string;
        type: "text" | "number" | "select" | "toggle";
        options?: string[];
        required?: boolean;
        placeholder?: string;
      }>;
    } | null;
  },
) {
  const category = await apiRequest<ApiCategory>("/categories/admin", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return mapCategory(category);
}

export async function updateCategory(
  accessToken: string,
  slug: string,
  payload: {
    name?: string;
    description?: string;
    parentSlug?: string;
    isActive?: boolean;
    listingExpiryDays?: number;
    schemaDefinition?: {
      fields: Array<{
        key: string;
        label: string;
        type: "text" | "number" | "select" | "toggle";
        options?: string[];
        required?: boolean;
        placeholder?: string;
      }>;
    } | null;
  },
) {
  const category = await apiRequest<ApiCategory>(`/categories/admin/${slug}`, {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return mapCategory(category);
}

export async function deleteCategory(accessToken: string, slug: string) {
  const category = await apiRequest<ApiCategory>(`/categories/admin/${slug}`, {
    method: "DELETE",
    accessToken,
  });
  return mapCategory(category);
}

export async function fetchBoostPackages() {
  return apiRequest<ApiBoostPackage[]>("/boost-packages");
}

export async function fetchListingBoostPackages(listingId: string) {
  return apiRequest<ApiBoostPackage[]>(`/listings/${listingId}/boost-packages`);
}

export async function fetchAdminBoostPackages(accessToken: string) {
  return apiRequest<ApiBoostPackage[]>("/admin/boost-packages", {
    accessToken,
  });
}

export async function fetchAdminActiveBoostedListings(accessToken: string) {
  return apiRequest<ApiBoost[]>("/admin/boosted-listings/active", {
    accessToken,
  });
}

export async function createBoostPackage(
  accessToken: string,
  payload: BoostPackagePayload,
) {
  return apiRequest<ApiBoostPackage>("/admin/boost-packages", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateBoostPackage(
  accessToken: string,
  packageId: string,
  payload: Partial<BoostPackagePayload>,
) {
  return apiRequest<ApiBoostPackage>(`/admin/boost-packages/${packageId}`, {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteBoostPackage(
  accessToken: string,
  packageId: string,
) {
  return apiRequest<ApiBoostPackage>(`/admin/boost-packages/${packageId}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function fetchAdminPriorityRules(accessToken: string) {
  return apiRequest<ApiListingPriorityRule[]>(
    "/listings/admin/priority-rules",
    {
      accessToken,
    },
  );
}

export async function createPriorityRule(
  accessToken: string,
  payload: PriorityRulePayload,
) {
  return apiRequest<ApiListingPriorityRule>("/listings/admin/priority-rules", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updatePriorityRule(
  accessToken: string,
  ruleId: string,
  payload: Partial<PriorityRulePayload>,
) {
  return apiRequest<ApiListingPriorityRule>(
    `/listings/admin/priority-rules/${ruleId}`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function deletePriorityRule(accessToken: string, ruleId: string) {
  return apiRequest<ApiListingPriorityRule>(
    `/listings/admin/priority-rules/${ruleId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );
}

export async function fetchAdminSellerRatingSummaries(accessToken: string) {
  return apiRequest<ApiSellerRatingSummary[]>(
    "/seller-ratings/admin/summaries",
    {
      accessToken,
    },
  );
}

export async function fetchAdminSellerReviews(
  accessToken: string,
  query: SellerReviewQuery = {},
) {
  return apiRequest<ApiSellerRating[]>("/seller-ratings/admin/reviews", {
    accessToken,
    searchParams: {
      status: query.status,
    },
  });
}

export async function moderateSellerReview(
  accessToken: string,
  ratingId: string,
  payload: { status: ApiSellerReviewStatus; note?: string },
) {
  return apiRequest<ApiSellerRating>(
    `/seller-ratings/admin/reviews/${ratingId}`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteSellerReview(
  accessToken: string,
  ratingId: string,
) {
  return apiRequest<ApiSellerRating>(
    `/seller-ratings/admin/reviews/${ratingId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );
}

export async function fetchListings(query: ListingQuery = {}) {
  let listings: ApiListing[];

  try {
    listings = await apiRequest<ApiListing[]>("/listings", {
      searchParams: {
        search: query.search,
        categorySlug: query.categorySlug,
        sellerId: query.sellerId,
        location: query.location,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        sort: query.sort,
        boostPlacement: query.boostPlacement,
        take: query.take,
      },
    });
  } catch (error) {
    if (isTransientMarketplaceError(error)) {
      return [];
    }

    throw error;
  }

  return listings.map(mapListing);
}

export async function fetchAdminListings(
  accessToken: string,
  query: ListingQuery = {},
) {
  const listings = await apiRequest<ApiListing[]>("/listings/admin/all", {
    accessToken,
    searchParams: {
      search: query.search,
      categorySlug: query.categorySlug,
      sellerId: query.sellerId,
      status: query.status,
      location: query.location,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sort: query.sort,
      boostPlacement: query.boostPlacement,
      take: query.take,
    },
  });

  return listings.map(mapListing);
}

export async function fetchListing(listingId: string) {
  try {
    const listing = await apiRequest<ApiListing>(`/listings/${listingId}`);
    return mapListing(listing);
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function recordListingView(listingId: string, source = "detail") {
  return apiRequest<{ recorded: boolean }>(`/listings/${listingId}/views`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
}

export async function saveListing(accessToken: string, listingId: string) {
  const listing = await apiRequest<ApiListing>(`/listings/${listingId}/save`, {
    method: "POST",
    accessToken,
  });

  return mapListing(listing);
}

export async function unsaveListing(accessToken: string, listingId: string) {
  return apiRequest<{ saved: false }>(`/listings/${listingId}/save`, {
    method: "DELETE",
    accessToken,
  });
}

export async function fetchMyListings(accessToken: string) {
  const listings = await apiRequest<ApiListing[]>("/listings/me/items", {
    accessToken,
  });

  return listings.map(mapListing);
}

export async function fetchMySavedListings(accessToken: string) {
  const listings = await apiRequest<ApiListing[]>("/listings/me/saved", {
    accessToken,
  });

  return listings.map(mapListing);
}

export async function fetchMyListingQuota(accessToken: string) {
  return apiRequest<ApiListingQuota>("/listings/me/quota", {
    accessToken,
  });
}

export async function fetchMyListing(accessToken: string, listingId: string) {
  try {
    const listing = await apiRequest<ApiListing>(
      `/listings/me/items/${listingId}`,
      {
        accessToken,
      },
    );

    return mapListing(listing);
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchMyTransactions(
  accessToken: string,
  query: TransactionQuery = {},
) {
  const transactions = await apiRequest<ApiTransaction[]>("/transactions/me", {
    accessToken,
    searchParams: {
      status: query.status,
      type: query.type,
      listingId: query.listingId,
      take: query.take,
    },
  });

  return transactions.map(mapTransaction);
}

export async function fetchTransaction(
  accessToken: string,
  transactionId: string,
) {
  const transaction = await apiRequest<ApiTransaction>(
    `/transactions/${transactionId}`,
    {
      accessToken,
    },
  );

  return mapTransaction(transaction);
}

export async function fetchAdminTransactions(
  accessToken: string,
  query: TransactionQuery = {},
) {
  const transactions = await apiRequest<ApiTransaction[]>(
    "/admin/transactions",
    {
      accessToken,
      searchParams: {
        status: query.status,
        type: query.type,
        userId: query.userId,
        listingId: query.listingId,
        take: query.take,
      },
    },
  );

  return transactions.map(mapTransaction);
}

export async function fetchAdminAuditLogs(
  accessToken: string,
  query: AuditLogQuery = {},
) {
  const logs = await apiRequest<ApiAuditLog[]>("/admin/audit-logs", {
    accessToken,
    searchParams: {
      actorId: query.actorId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      success: query.success === undefined ? undefined : String(query.success),
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });

  return logs.map(mapAuditLog);
}

export async function createListingReport(
  accessToken: string,
  listingId: string,
  payload: {
    reason: string;
    details?: string;
  },
) {
  const report = await apiRequest<ApiListingReport>(
    `/listings/${listingId}/reports`,
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  return mapListingReport(report);
}

export async function fetchMyListingReports(
  accessToken: string,
  query: ListingReportQuery = {},
) {
  const reports = await apiRequest<ApiListingReport[]>("/reports/me", {
    accessToken,
    searchParams: {
      status: query.status,
      listingId: query.listingId,
      take: query.take,
    },
  });

  return reports.map(mapListingReport);
}

export async function fetchAdminListingReports(
  accessToken: string,
  query: ListingReportQuery = {},
) {
  const reports = await apiRequest<ApiListingReport[]>(
    "/admin/listing-reports",
    {
      accessToken,
      searchParams: {
        status: query.status,
        listingId: query.listingId,
        reporterId: query.reporterId,
        take: query.take,
      },
    },
  );

  return reports.map(mapListingReport);
}

export async function fetchAdminMonitoringReport(
  accessToken: string,
  query: AdminMonitoringQuery = {},
) {
  return apiRequest<ApiAdminMonitoringReport>("/admin/reports/monitoring", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      topTake: query.topTake,
    },
  });
}

export async function fetchAdminSellerReport(
  accessToken: string,
  query: AdminSellerReportQuery = {},
) {
  return apiRequest<ApiAdminSellerReport>("/admin/reports/sellers", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });
}

export async function fetchTopSellersReport(
  accessToken: string,
  query: TopSellersReportQuery = {},
) {
  return apiRequest<ApiTopSellersReport>("/admin/reports/top-sellers", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });
}

export async function fetchPendingSellerApprovalsReport(
  accessToken: string,
  query: PendingSellerApprovalsQuery = {},
) {
  return apiRequest<ApiPendingSellerApprovalsReport>(
    "/admin/reports/seller-approvals",
    {
      accessToken,
      searchParams: {
        days: query.days,
        from: query.from,
        to: query.to,
        take: query.take,
      },
    },
  );
}

export async function fetchActiveListingsReport(
  accessToken: string,
  query: ActiveListingsReportQuery = {},
) {
  return apiRequest<ApiActiveListingsReport>("/admin/reports/active-listings", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });
}

export async function fetchPaidListingsReport(
  accessToken: string,
  query: PaidListingsReportQuery = {},
) {
  return apiRequest<ApiPaidListingsReport>("/admin/reports/paid-listings", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });
}

export async function fetchWalletPaymentsReport(
  accessToken: string,
  query: WalletPaymentsReportQuery = {},
) {
  return apiRequest<ApiWalletPaymentsReport>("/admin/reports/wallet-payments", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });
}

export async function fetchBoostRevenueReport(
  accessToken: string,
  query: BoostRevenueReportQuery = {},
) {
  return apiRequest<ApiBoostRevenueReport>("/admin/reports/boost-revenue", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });
}

export async function fetchCategoryIncomeReport(
  accessToken: string,
  query: CategoryIncomeReportQuery = {},
) {
  return apiRequest<ApiCategoryIncomeReport>("/admin/reports/category-income", {
    accessToken,
    searchParams: {
      days: query.days,
      from: query.from,
      to: query.to,
      take: query.take,
    },
  });
}

export async function sendAdminReportEmail(
  accessToken: string,
  reportType: AdminReportEmailType,
  payload: SendAdminReportEmailPayload,
) {
  return apiRequest<AdminReportEmailResult>(
    `/admin/reports/${reportType}/email`,
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function updateListingReport(
  accessToken: string,
  reportId: string,
  payload: {
    status?: ApiReportStatus;
    details?: string;
    adminNotes?: string;
    listingStatus?: ApiListingStatus;
  },
) {
  const report = await apiRequest<ApiListingReport>(
    `/admin/listing-reports/${reportId}`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  return mapListingReport(report);
}

export async function fetchSellerProfile(userId: string) {
  try {
    const [profile, ratingSummary] = await Promise.all([
      apiRequest<ApiPublicSellerProfile>(`/seller-profiles/public/${userId}`),
      fetchSellerRatingSummary(userId),
    ]);
    return mapSeller(profile, ratingSummary);
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchSellerFormDefinition() {
  return apiRequest<{ fields: ApiSellerFormField[] }>("/seller-profiles/form");
}

export async function updateSellerFormDefinition(
  accessToken: string,
  schemaDefinition: { fields: ApiSellerFormField[] } | string,
) {
  const payload =
    typeof schemaDefinition === "string"
      ? JSON.parse(schemaDefinition)
      : schemaDefinition;

  return apiRequest<{ fields: ApiSellerFormField[] }>("/seller-profiles/admin/form", {
    method: "PUT",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemaDefinition: payload }),
  });
}

export async function fetchMySellerProfile(accessToken: string) {
  return apiRequest<ApiSellerProfileEnvelope>("/seller-profiles/me", {
    accessToken,
  });
}

export async function fetchMySellerPrivileges(accessToken: string) {
  return apiRequest<ApiSellerPrivilegeTier[]>("/seller-profiles/me/privileges", {
    accessToken,
  });
}

export async function switchToSeller(accessToken: string) {
  return apiRequest<ApiSellerProfile>("/seller-profiles/me/switch", {
    method: "POST",
    accessToken,
  });
}

export async function updateMySellerProfile(
  accessToken: string,
  payload: SellerProfilePayload,
) {
  return apiRequest<ApiSellerProfile>("/seller-profiles/me", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function submitMySellerProfile(
  accessToken: string,
  payload: SellerProfilePayload,
) {
  return apiRequest<ApiSellerProfile>("/seller-profiles/me/submit", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function submitSellerDocument(
  accessToken: string,
  payload: {
    requestId?: string;
    answers?: Record<string, unknown>;
    files?: Array<Record<string, unknown>>;
  },
) {
  return apiRequest("/seller-profiles/me/documents", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function requestVerifiedSeller(
  accessToken: string,
  payload: {
    requestMetadata?: Record<string, unknown>;
    reviewNotes?: string;
  },
) {
  return apiRequest<ApiSellerProfile>("/seller-profiles/me/verified/request", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function upgradeMySellerPrivilege(
  accessToken: string,
  sellerPrivilegeTierId: string,
) {
  return apiRequest<ApiSellerProfile>("/seller-profiles/me/upgrade-tier", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sellerPrivilegeTierId }),
  });
}

export async function fetchAdminSellerOverview(accessToken: string) {
  return apiRequest<{
    stats: Record<string, number>;
    sellers: ApiSellerProfile[];
  }>("/seller-profiles/admin/overview", {
    accessToken,
  });
}

export async function fetchAdminSellerProfiles(
  accessToken: string,
  query: {
    status?: string;
    verifiedStatus?: string;
    search?: string;
    take?: number;
  } = {},
) {
  return apiRequest<ApiSellerProfile[]>("/seller-profiles/admin/all", {
    accessToken,
    searchParams: query,
  });
}

export async function fetchAdminSellerProfile(
  accessToken: string,
  sellerProfileId: string,
) {
  return apiRequest<ApiSellerProfile>(`/seller-profiles/admin/${sellerProfileId}`, {
    accessToken,
  });
}

export async function reviewSellerProfile(
  accessToken: string,
  sellerProfileId: string,
  payload: {
    status: "APPROVED" | "REJECTED" | "SUSPENDED";
    reviewNotes?: string;
    rejectionReason?: string;
    privilegeTierId?: string;
  },
) {
  return apiRequest<ApiSellerProfile>(
    `/seller-profiles/admin/${sellerProfileId}/review`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function createSellerDocumentRequest(
  accessToken: string,
  sellerProfileId: string,
  payload: {
    label: string;
    slug?: string;
    description?: string;
    isRequired?: boolean;
    dueAt?: string;
  },
) {
  return apiRequest(`/seller-profiles/admin/${sellerProfileId}/document-requests`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function reviewSellerDocument(
  accessToken: string,
  documentSubmissionId: string,
  payload: {
    status: "APPROVED" | "REJECTED";
    reviewNotes?: string;
    rejectionReason?: string;
  },
) {
  return apiRequest(`/seller-profiles/admin/documents/${documentSubmissionId}/review`, {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function reviewVerifiedSeller(
  accessToken: string,
  sellerProfileId: string,
  payload: {
    status: "VERIFIED" | "REJECTED" | "NOT_REQUESTED";
    reviewNotes?: string;
  },
) {
  return apiRequest<ApiSellerProfile>(
    `/seller-profiles/admin/${sellerProfileId}/verified`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchAdminSellerPrivileges(accessToken: string) {
  return apiRequest<ApiSellerPrivilegeTier[]>("/seller-profiles/admin/privileges", {
    accessToken,
  });
}

export async function upsertSellerPrivilegeTier(
  accessToken: string,
  payload: {
    id?: string;
    code: "FREE" | "PREMIUM" | "VERIFIED" | "VIP";
    name: string;
    slug?: string;
    description?: string;
    monthlyFreeListingLimit?: number;
    activeListingLimit?: number | null;
    pendingListingLimit?: number | null;
    paidListingFee?: number;
    sellerLevelUpgradeFee?: number;
    currency?: string;
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  const path = payload.id
    ? `/seller-profiles/admin/privileges/${payload.id}`
    : "/seller-profiles/admin/privileges";
  const method = payload.id ? "PATCH" : "POST";

  return apiRequest<ApiSellerPrivilegeTier>(path, {
    method,
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function upsertSellerPrivilegeQuota(
  accessToken: string,
  sellerPrivilegeTierId: string,
  payload: {
    categoryId: string;
    monthlyFreeListingLimit?: number | null;
    activeListingLimit?: number | null;
    pendingListingLimit?: number | null;
    paidListingFee?: number | null;
  },
) {
  return apiRequest(
    `/seller-profiles/admin/privileges/${sellerPrivilegeTierId}/quotas`,
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function applyDefaultSellerPrivilegeQuotas(
  accessToken: string,
  sellerPrivilegeTierId: string,
) {
  return apiRequest(
    `/seller-profiles/admin/privileges/${sellerPrivilegeTierId}/quotas/apply-default`,
    {
      method: "POST",
      accessToken,
    },
  );
}

export async function zeroAllSellerPrivilegeQuotas(
  accessToken: string,
  sellerPrivilegeTierId: string,
) {
  return apiRequest(
    `/seller-profiles/admin/privileges/${sellerPrivilegeTierId}/quotas/zero-all`,
    {
      method: "POST",
      accessToken,
    },
  );
}

export async function fetchAdminSellerBadges(accessToken: string) {
  return apiRequest<ApiSellerBadgeType[]>("/seller-profiles/admin/badges", {
    accessToken,
  });
}

export async function upsertSellerBadgeType(
  accessToken: string,
  payload: {
    id?: string;
    label: string;
    slug?: string;
    description?: string;
    icon?: string;
    backgroundColor?: string;
    textColor?: string;
    isActive?: boolean;
    isHidden?: boolean;
    sortOrder?: number;
  },
) {
  const path = payload.id
    ? `/seller-profiles/admin/badges/${payload.id}`
    : "/seller-profiles/admin/badges";
  const method = payload.id ? "PATCH" : "POST";

  return apiRequest<ApiSellerBadgeType>(path, {
    method,
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function assignSellerBadge(
  accessToken: string,
  sellerProfileId: string,
  payload: {
    badgeTypeId: string;
    expiresAt?: string;
  },
) {
  return apiRequest(`/seller-profiles/admin/${sellerProfileId}/badges`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function removeSellerBadge(
  accessToken: string,
  sellerProfileId: string,
  assignmentId: string,
) {
  return apiRequest(
    `/seller-profiles/admin/${sellerProfileId}/badges/${assignmentId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );
}

export async function fetchSellerRatingSummary(sellerId: string) {
  return apiRequest<ApiSellerRatingSummary>(
    `/seller-ratings/sellers/${sellerId}/summary`,
  );
}

export async function fetchSellerReviews(sellerId: string) {
  return apiRequest<ApiSellerRating[]>(
    `/seller-ratings/sellers/${sellerId}/reviews`,
  );
}

export async function fetchReceivedSellerRatings(accessToken: string) {
  return apiRequest<ApiSellerRating[]>("/seller-ratings/me/received", {
    accessToken,
  });
}

export async function fetchMySellerRating(
  accessToken: string,
  listingId: string,
) {
  return apiRequest<ApiSellerRating | null>(
    `/seller-ratings/listings/${listingId}/mine`,
    { accessToken, emptyResponseValue: null },
  );
}

export async function upsertSellerRating(
  accessToken: string,
  listingId: string,
  payload: { stars: number; review?: string },
) {
  return apiRequest<{
    rating: ApiSellerRating;
    summary: ApiSellerRatingSummary;
  }>(`/seller-ratings/listings/${listingId}`, {
    method: "PUT",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteSellerRating(
  accessToken: string,
  listingId: string,
) {
  return apiRequest<{ deleted: true; summary: ApiSellerRatingSummary }>(
    `/seller-ratings/listings/${listingId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );
}

export async function fetchCurrentUser(accessToken: string) {
  const user = await apiRequest<ApiUser>("/users/me", {
    accessToken,
  });

  return mapSessionUser(user);
}

export async function fetchMyWallet(accessToken: string) {
  return apiRequest<ApiWalletAccount>("/wallet/me", {
    accessToken,
  });
}

export async function fetchAdminWallet(accessToken: string, userId: string) {
  return apiRequest<ApiWalletAccount>(`/admin/wallets/${userId}`, {
    accessToken,
  });
}

export async function createWalletTopUp(
  accessToken: string,
  payload: { amount: number; currency?: string },
) {
  return apiRequest<WalletTopUpResponse>("/wallet/top-ups", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function completeWalletTopUp(
  accessToken: string,
  transactionId: string,
  payload: { providerRef?: string } = {},
) {
  return apiRequest<{
    transaction?: ApiTransaction;
    wallet?: ApiWalletAccount;
  }>(`/wallet/top-ups/${transactionId}/payment/succeed`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function creditAdminWallet(
  accessToken: string,
  userId: string,
  payload: { amount: number; currency?: string; note?: string },
) {
  return apiRequest<ApiWalletAccount>(`/admin/wallets/${userId}/credit`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function debitAdminWallet(
  accessToken: string,
  userId: string,
  payload: { amount: number; currency?: string; note?: string },
) {
  return apiRequest<ApiWalletAccount>(`/admin/wallets/${userId}/debit`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateCurrentUser(
  accessToken: string,
  payload: {
    displayName?: string;
    phone?: string;
    avatarUrl?: string;
    bio?: string;
    location?: string;
  },
) {
  const user = await apiRequest<ApiUser>("/users/me", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return mapSessionUser(user);
}

export async function deactivateCurrentUser(accessToken: string) {
  return apiRequest<{ message: string }>("/users/me", {
    method: "DELETE",
    accessToken,
  });
}

export async function changePassword(
  accessToken: string,
  payload: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword?: string;
  },
) {
  return apiRequest<{ message: string }>("/users/me/password", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
}) {
  return mapAuthResponse(
    await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function registerUser(payload: {
  accountType?: "CUSTOMER" | "SELLER";
  displayName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword?: string;
  sellerFormAnswers?: Record<string, unknown>;
  sellerRequestMetadata?: Record<string, unknown>;
  termsAccepted: boolean;
}) {
  const response = await apiRequest<RegisterResponse>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    message: response.message,
    email: response.email,
    emailVerificationPreviewUrl: response.emailVerificationPreviewUrl,
    user: mapSessionUser(response.user),
  };
}

export async function googleLoginUser(payload: {
  idToken?: string;
  accessToken?: string;
  email?: string;
  displayName?: string;
  googleId?: string;
}) {
  return mapAuthResponse(
    await apiRequest<AuthResponse>("/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function refreshSession(refreshToken: string) {
  return mapAuthResponse(
    await apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }),
  );
}

export async function logoutSession(refreshToken: string) {
  return apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function forgotPassword(payload: { email: string }) {
  return apiRequest<{ message: string; resetPreviewUrl?: string | null }>(
    "/auth/forgot-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function resetPassword(payload: {
  token: string;
  password: string;
}) {
  return apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function verifyEmailToken(token: string) {
  const response = await apiRequest<AuthResponse & { message: string }>(
    "/auth/verify-email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    },
  );

  return {
    ...mapAuthResponse(response),
    message: response.message,
  };
}

export async function resendEmailVerification(accessToken: string) {
  return apiRequest<{
    message: string;
    emailVerificationPreviewUrl?: string | null;
  }>("/auth/resend-email-verification", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
  });
}

export type AuthSession = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export async function fetchAuthSessions(accessToken: string) {
  return apiRequest<AuthSession[]>("/auth/sessions", {
    accessToken,
  });
}

export async function resendEmailVerificationForEmail(email: string) {
  return apiRequest<{
    message: string;
    emailVerificationPreviewUrl?: string | null;
  }>("/auth/resend-email-verification/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function revokeAuthSession(
  accessToken: string,
  sessionId: string,
) {
  return apiRequest<{ message: string }>(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function logoutAllSessions(accessToken: string) {
  return apiRequest<{ message: string }>("/auth/logout-all", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
  });
}

export async function verifyPhone(
  accessToken: string,
  payload: {
    phone: string;
    otpCode: string;
  },
) {
  const response = await apiRequest<{ message: string; user: ApiUser }>(
    "/auth/verify-phone",
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  return {
    message: response.message,
    user: mapSessionUser(response.user),
  };
}

export async function requestPhoneOtp(
  accessToken: string,
  payload: {
    phone: string;
  },
) {
  return apiRequest<{
    message: string;
    channel: "sms" | "dev";
    expiresAt: string;
  }>("/auth/request-phone-otp", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createListing(
  accessToken: string,
  payload: ListingPayload,
) {
  const listing = await apiRequest<ListingResponse>("/listings", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    listing: mapListing(listing),
    payment: listing.payment,
  };
}

export async function saveListingDraft(
  accessToken: string,
  payload: ListingDraftPayload,
) {
  const listing = await apiRequest<ApiListing>("/listings/drafts", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return mapListing(listing);
}

export async function publishListingDraft(
  accessToken: string,
  listingId: string,
  payload: ListingPayload,
) {
  const listing = await apiRequest<ApiListing>(
    `/listings/${listingId}/publish`,
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  return mapListing(listing);
}

export async function updateListing(
  accessToken: string,
  listingId: string,
  payload: Partial<ListingPayload>,
) {
  const listing = await apiRequest<ApiListing>(`/listings/${listingId}`, {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return mapListing(listing);
}

export async function deleteListing(accessToken: string, listingId: string) {
  const listing = await apiRequest<ApiListing>(`/listings/${listingId}`, {
    method: "DELETE",
    accessToken,
  });

  return mapListing(listing);
}

export async function boostListing(
  accessToken: string,
  listingId: string,
  payload: CreateBoostPayload,
) {
  return apiRequest<BoostResponse>(`/listings/${listingId}/boosts`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function completeBoostPayment(
  accessToken: string,
  boostId: string,
  payload: { durationDays?: number; providerRef?: string } = {},
) {
  return apiRequest<BoostResponse>(`/boosts/${boostId}/payment/succeed`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function completeListingPayment(
  accessToken: string,
  listingId: string,
  payload: { providerRef?: string } = {},
) {
  return apiRequest<ApiTransaction>(`/listings/${listingId}/payment/succeed`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(mapTransaction);
}

export async function moderateListing(
  accessToken: string,
  listingId: string,
  status: ApiListingStatus,
  reason?: string,
) {
  const listing = await apiRequest<ApiListing>(
    `/listings/admin/${listingId}/moderate`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    },
  );

  return mapListing(listing);
}

export async function updateListingPriorityOverride(
  accessToken: string,
  listingId: string,
  payload: ListingPriorityOverridePayload,
) {
  const listing = await apiRequest<ApiListing>(
    `/listings/admin/${listingId}/priority-override`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  return mapListing(listing);
}
