import "server-only";

import {
  mapConversation,
  mapCategory,
  mapListing,
  mapModerationQueueItem,
  mapSavedSearch,
  mapSeller,
  mapSessionUser,
  mapLegacyListingResults,
  type ApiCategory,
  type ApiConversationDetail,
  type ApiConversationSummary,
  type ApiListing,
  type ApiListingResults,
  type ApiListingReportReason,
  type ApiSavedSearch,
  type ApiSavedSearchSort,
  type ApiListingStatus,
  type ApiModerationActionType,
  type ApiModerationQueueItem,
  type ApiUser,
  type MarketplaceModerationQueueItem,
  type MarketplaceConversation,
  mapListingResults,
} from "@/lib/marketplace";

export class MarketplaceApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "MarketplaceApiError";
  }
}

type ListingQuery = {
  search?: string;
  categorySlug?: string;
  location?: string;
  sellerId?: string;
  status?: ApiListingStatus;
  sort?: "newest" | "price_asc" | "price_desc";
  page?: number;
  take?: number;
  minPrice?: number;
  maxPrice?: number;
  attributeFilters?: Record<string, string | number | boolean>;
};

type ConversationQuery = {
  listingId?: string;
  take?: number;
};

type ModerationQueueQuery = {
  search?: string;
  listingStatus?: ApiListingStatus;
  reportStatus?: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  includeResolved?: boolean;
  take?: number;
};

type AuthResponse = {
  accessToken: string;
  user: ApiUser;
};

function getApiBaseUrl() {
  return process.env.MARKETPLACE_API_URL ?? "http://127.0.0.1:3001";
}

function isLegacyListingsQueryError(error: unknown) {
  if (!(error instanceof MarketplaceApiError)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("should not exist") &&
    (message.includes("page") ||
      message.includes("location") ||
      message.includes("minprice") ||
      message.includes("maxprice") ||
      message.includes("attributefilters"))
  );
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
    headers,
    searchParams,
    ...init
  }: RequestInit & {
    accessToken?: string;
    searchParams?: Record<string, string | number | undefined>;
  } = {}
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
      `Marketplace API is unavailable. Start the API server and confirm it is reachable at ${getApiBaseUrl()}.`,
      503
    );
  }

  if (!response.ok) {
    throw new MarketplaceApiError(await parseErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

export async function fetchCategories() {
  const categories = await apiRequest<ApiCategory[]>("/categories");
  return categories.map(mapCategory);
}

export async function fetchListings(
  query: ListingQuery = {},
  accessToken?: string
) {
  const modernSearchParams = {
    search: query.search,
    categorySlug: query.categorySlug,
    location: query.location,
    sellerId: query.sellerId,
    status: query.status,
    sort: query.sort,
    page: query.page && query.page > 1 ? query.page : undefined,
    take: query.take,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    attributeFilters: query.attributeFilters
      ? JSON.stringify(query.attributeFilters)
      : undefined,
  };

  try {
    const listings = await apiRequest<ApiListingResults | ApiListing[]>("/listings", {
      accessToken,
      searchParams: modernSearchParams,
    });

    if (Array.isArray(listings)) {
      return mapLegacyListingResults(listings, {
        page: query.page ?? 1,
        take: query.take ?? 25,
      });
    }

    return mapListingResults(listings);
  } catch (error) {
    if (!isLegacyListingsQueryError(error)) {
      throw error;
    }

    const legacyListings = await apiRequest<ApiListing[]>("/listings", {
      accessToken,
      searchParams: {
        search: query.search,
        categorySlug: query.categorySlug,
        sellerId: query.sellerId,
        status: query.status,
        sort: query.sort,
        take: query.take,
      },
    });

    return mapLegacyListingResults(legacyListings, {
      page: query.page ?? 1,
      take: query.take ?? 25,
    });
  }
}

export async function fetchListing(listingId: string, accessToken?: string) {
  try {
    const listing = await apiRequest<ApiListing>(`/listings/${listingId}`, {
      accessToken,
    });
    return mapListing(listing);
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchMyListings(accessToken: string) {
  const listings = await apiRequest<ApiListing[]>("/listings/me/items", {
    accessToken,
  });

  return listings.map(mapListing);
}

export async function fetchSavedListings(accessToken: string) {
  const listings = await apiRequest<ApiListing[]>("/listings/saved/items", {
    accessToken,
  });

  return listings.map(mapListing);
}

export async function fetchSavedSearches(accessToken: string) {
  const savedSearches = await apiRequest<ApiSavedSearch[]>("/saved-searches", {
    accessToken,
  });

  return savedSearches.map(mapSavedSearch);
}

export async function fetchSellerProfile(userId: string) {
  try {
    const profile = await apiRequest<ApiUser>(`/users/${userId}`);
    return mapSeller(profile);
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchCurrentUser(accessToken: string) {
  const user = await apiRequest<ApiUser>("/users/me", {
    accessToken,
  });

  return mapSessionUser(user);
}

export async function fetchConversations(
  accessToken: string,
  currentUserId: string,
  query: ConversationQuery = {}
) {
  const conversations = await apiRequest<ApiConversationSummary[]>("/chat/conversations", {
    accessToken,
    searchParams: {
      listingId: query.listingId,
      take: query.take,
    },
  });

  return conversations.map((conversation) =>
    mapConversation(conversation, currentUserId)
  );
}

export async function fetchConversation(
  accessToken: string,
  currentUserId: string,
  conversationId: string
) {
  try {
    const conversation = await apiRequest<ApiConversationDetail>(
      `/chat/conversations/${conversationId}`,
      {
        accessToken,
      }
    );

    return mapConversation(conversation, currentUserId);
  } catch (error) {
    if (error instanceof MarketplaceApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createConversation(
  accessToken: string,
  currentUserId: string,
  payload: {
    listingId: string;
    initialMessage?: string;
  }
) {
  const conversation = await apiRequest<ApiConversationDetail>("/chat/conversations", {
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return mapConversation(conversation, currentUserId);
}

export async function sendConversationMessage(
  accessToken: string,
  currentUserId: string,
  conversationId: string,
  payload: {
    body: string;
  }
) {
  const conversation = await apiRequest<ApiConversationDetail>(
    `/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      accessToken,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return mapConversation(conversation, currentUserId);
}

export async function markConversationRead(
  accessToken: string,
  currentUserId: string,
  conversationId: string
): Promise<MarketplaceConversation> {
  const conversation = await apiRequest<ApiConversationDetail>(
    `/chat/conversations/${conversationId}/read`,
    {
      method: "POST",
      accessToken,
    }
  );

  return mapConversation(conversation, currentUserId);
}

export async function reportListing(
  accessToken: string,
  listingId: string,
  payload: {
    reason: ApiListingReportReason;
    details?: string;
  }
) {
  return apiRequest(`/moderation/listings/${listingId}/reports`, {
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchModerationQueue(
  accessToken: string,
  query: ModerationQueueQuery = {}
): Promise<MarketplaceModerationQueueItem[]> {
  const items = await apiRequest<ApiModerationQueueItem[]>("/moderation/queue", {
    accessToken,
    searchParams: {
      search: query.search,
      listingStatus: query.listingStatus,
      reportStatus: query.reportStatus,
      includeResolved:
        typeof query.includeResolved === "boolean"
          ? String(query.includeResolved)
          : undefined,
      take: query.take,
    },
  });

  return items.map(mapModerationQueueItem);
}

export async function moderateListing(
  accessToken: string,
  listingId: string,
  payload: {
    action: ApiModerationActionType;
    reportId?: string;
    notes?: string;
  }
) {
  return apiRequest(`/moderation/listings/${listingId}/actions`, {
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateCurrentUser(
  accessToken: string,
  payload: {
    displayName?: string;
    phone?: string;
  }
) {
  const user = await apiRequest<ApiUser>("/users/me", {
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return mapSessionUser(user);
}

export async function loginUser(payload: { email: string; password: string }) {
  const response = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return {
    accessToken: response.accessToken,
    user: mapSessionUser(response.user),
  };
}

export async function registerUser(payload: {
  displayName: string;
  email: string;
  phone?: string;
  password: string;
  adminInviteCode?: string;
}) {
  const response = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return {
    accessToken: response.accessToken,
    user: mapSessionUser(response.user),
  };
}

export async function verifyPhone(
  accessToken: string,
  payload: {
    phone: string;
    otpCode: string;
  }
) {
  const response = await apiRequest<{ message: string; user: ApiUser }>(
    "/auth/verify-phone",
    {
      method: "POST",
      accessToken,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
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
  }
) {
  return apiRequest<{
    message: string;
    channel: "sms" | "dev";
    expiresAt: string;
  }>("/auth/request-phone-otp", {
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createListing(
  accessToken: string,
  payload: {
    categorySlug: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    location: string;
    status: ApiListingStatus;
    attributes: Record<string, unknown>;
    media?: Array<{
      fileName: string;
      mimeType: string;
      base64Data: string;
      byteSize: number;
      width?: number;
      height?: number;
      sortOrder: number;
      isPrimary: boolean;
    }>;
  }
) {
  const listing = await apiRequest<ApiListing>("/listings", {
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return mapListing(listing);
}

export async function updateListingStatus(
  accessToken: string,
  listingId: string,
  payload: {
    action: "publish" | "archive" | "mark_sold" | "delete";
  }
) {
  const listing = await apiRequest<ApiListing>(`/listings/${listingId}/status`, {
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return mapListing(listing);
}

export async function saveListing(accessToken: string, listingId: string) {
  return apiRequest<{ saved: boolean; message: string }>(`/listings/${listingId}/save`, {
    method: "POST",
    accessToken,
  });
}

export async function unsaveListing(accessToken: string, listingId: string) {
  return apiRequest<{ saved: boolean; message: string }>(`/listings/${listingId}/save`, {
    method: "DELETE",
    accessToken,
  });
}

export async function createSavedSearch(
  accessToken: string,
  payload: {
    label?: string;
    query?: string;
    categorySlug?: string;
    sort?: ApiSavedSearchSort;
    alertsEnabled?: boolean;
  }
) {
  const response = await apiRequest<{
    message: string;
    savedSearch: ApiSavedSearch;
  }>("/saved-searches", {
    method: "POST",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return {
    message: response.message,
    savedSearch: mapSavedSearch(response.savedSearch),
  };
}

export async function updateSavedSearch(
  accessToken: string,
  savedSearchId: string,
  payload: {
    label?: string;
    query?: string;
    categorySlug?: string;
    sort?: ApiSavedSearchSort;
    alertsEnabled?: boolean;
  }
) {
  const response = await apiRequest<{
    message: string;
    savedSearch: ApiSavedSearch;
  }>(`/saved-searches/${savedSearchId}`, {
    method: "PATCH",
    accessToken,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return {
    message: response.message,
    savedSearch: mapSavedSearch(response.savedSearch),
  };
}

export async function deleteSavedSearch(accessToken: string, savedSearchId: string) {
  return apiRequest<{ deleted: boolean; message: string }>(
    `/saved-searches/${savedSearchId}`,
    {
      method: "DELETE",
      accessToken,
    }
  );
}
