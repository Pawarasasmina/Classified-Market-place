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
  sellerId?: string;
  status?: ApiListingStatus;
  sort?: "newest" | "price_asc" | "price_desc";
  take?: number;
};

type AuthResponse = {
  accessToken: string;
  user: ApiUser;
};

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

export async function fetchListings(query: ListingQuery = {}) {
  const listings = await apiRequest<ApiListing[]>("/listings", {
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

export async function fetchMyListings(accessToken: string) {
  const listings = await apiRequest<ApiListing[]>("/listings/me/items", {
    accessToken,
  });

  return listings.map(mapListing);
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
