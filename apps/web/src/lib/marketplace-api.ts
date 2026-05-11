import "server-only";

import {
  mapCategory,
  mapListing,
  mapSeller,
  mapSessionUser,
  type ApiCategory,
  type ApiListing,
  type ApiListingStatus,
  type ApiUser,
  type MarketplaceListing,
  type MarketplaceSeller,
} from "@/lib/marketplace";
import {
  categories as phaseOneCategories,
  getListingById,
  getSellerById,
  listings as phaseOneListings,
} from "@/lib/phase1-data";

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
  sellerId?: string;
  status?: ApiListingStatus;
  sort?: "newest" | "price_asc" | "price_desc";
  take?: number;
};

type AuthResponse = {
  accessToken: string;
  user: ApiUser;
};

function isApiUnavailable(error: unknown) {
  return error instanceof MarketplaceApiError && error.status === 503;
}

function toPhaseOneMarketplaceListing(listing: (typeof phaseOneListings)[number]): MarketplaceListing {
  const seller = getSellerById(listing.sellerId);

  return {
    ...listing,
    sellerDisplayName: seller?.name,
    sellerVerified: seller?.verified,
    sellerJoinedLabel: seller?.joinedLabel,
    sellerTotalListings: seller?.totalListings,
  };
}

function filterPhaseOneListings(query: ListingQuery = {}): MarketplaceListing[] {
  const search = query.search?.trim().toLowerCase();

  return phaseOneListings
    .filter((listing) => {
      if (query.categorySlug && listing.categorySlug !== query.categorySlug) {
        return false;
      }

      if (query.sellerId && listing.sellerId !== query.sellerId) {
        return false;
      }

      if (query.status && listing.status.toUpperCase() !== query.status) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        listing.title,
        listing.description,
        listing.location,
        listing.subcategory,
        listing.categorySlug,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => {
      if (query.sort === "price_asc") {
        return a.priceValue - b.priceValue;
      }

      if (query.sort === "price_desc") {
        return b.priceValue - a.priceValue;
      }

      return 0;
    })
    .slice(0, query.take ?? phaseOneListings.length)
    .map(toPhaseOneMarketplaceListing);
}

function getApiBaseUrl() {
  return process.env.MARKETPLACE_API_URL ?? "http://127.0.0.1:3001";
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
    next,
    ...init
  }: RequestInit & {
    accessToken?: string;
    searchParams?: Record<string, string | number | undefined>;
    next?: {
      revalidate?: number;
    };
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
    const method = init.method?.toUpperCase() ?? "GET";
    const cacheMode = accessToken || method !== "GET" ? "no-store" : "force-cache";

    response = await fetch(url, {
      ...init,
      cache: cacheMode,
      ...(next && cacheMode !== "no-store" ? { next } : {}),
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
  try {
    const categories = await apiRequest<ApiCategory[]>("/categories", {
      next: { revalidate: 60 },
    });
    return categories.map(mapCategory);
  } catch (error) {
    if (isApiUnavailable(error)) {
      return phaseOneCategories;
    }

    throw error;
  }
}

export async function fetchListings(query: ListingQuery = {}) {
  try {
    const listings = await apiRequest<ApiListing[]>("/listings", {
      next: { revalidate: 20 },
      searchParams: {
        search: query.search,
        categorySlug: query.categorySlug,
        sellerId: query.sellerId,
        status: query.status,
        sort: query.sort,
        take: query.take,
      },
    });

    return listings.map(mapListing);
  } catch (error) {
    if (isApiUnavailable(error)) {
      return filterPhaseOneListings(query);
    }

    throw error;
  }
}

export async function fetchListing(listingId: string) {
  try {
    const listing = await apiRequest<ApiListing>(`/listings/${listingId}`, {
      next: { revalidate: 20 },
    });
    return mapListing(listing);
  } catch (error) {
    if (isApiUnavailable(error)) {
      const listing = getListingById(listingId);
      return listing ? toPhaseOneMarketplaceListing(listing) : null;
    }

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

export async function fetchSellerProfile(userId: string) {
  try {
    const profile = await apiRequest<ApiUser>(`/users/${userId}`, {
      next: { revalidate: 60 },
    });
    return mapSeller(profile);
  } catch (error) {
    if (isApiUnavailable(error)) {
      const seller = getSellerById(userId);

      return seller
        ? ({
            id: seller.id,
            name: seller.name,
            verified: seller.verified,
            joinedLabel: seller.joinedLabel,
            totalListings: seller.totalListings,
          } satisfies MarketplaceSeller)
        : null;
    }

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
