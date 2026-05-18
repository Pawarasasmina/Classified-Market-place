import "server-only";

import {
  mapCategory,
  mapListing,
  mapSeller,
  mapSessionUser,
  type AdminBooking,
  type AdminBookingMessage,
  type AdminBookingParticipant,
  type AdminUser,
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
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  take?: number;
};

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
  attributes: Record<string, unknown>;
  images?: ListingImagePayload[];
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
      `Marketplace API is unavailable at ${getApiBaseUrl()}.`,
      503
    );
  }

  if (!response.ok) {
    throw new MarketplaceApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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
  const categories = await apiRequest<ApiCategory[]>("/categories");
  return categories.map(mapCategory);
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
  payload: {
    displayName?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    location?: string | null;
    role?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
  }
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
  userId: string
) {
  const listings = await apiRequest<ApiListing[]>(
    `/users/admin/${userId}/listings`,
    {
      accessToken,
    }
  );

  return listings.map(mapListing);
}

export async function fetchAdminUserBookings(
  accessToken: string,
  userId: string
) {
  const bookings = await apiRequest<ApiAdminBooking[]>(
    `/users/admin/${userId}/bookings`,
    {
      accessToken,
    }
  );

  return bookings.map(
    (booking): AdminBooking => ({
      ...booking,
      listing: booking.listing ? mapListing(booking.listing) : null,
    })
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
  }
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
  }
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

export async function fetchListings(query: ListingQuery = {}) {
  const listings = await apiRequest<ApiListing[]>("/listings", {
    searchParams: {
      search: query.search,
      categorySlug: query.categorySlug,
      sellerId: query.sellerId,
      location: query.location,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sort: query.sort,
      take: query.take,
    },
  });

  return listings.map(mapListing);
}

export async function fetchAdminListings(
  accessToken: string,
  query: ListingQuery = {}
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
    avatarUrl?: string;
    bio?: string;
    location?: string;
  }
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
  }
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
    })
  );
}

export async function registerUser(payload: {
  displayName: string;
  email: string;
  phone?: string;
  password: string;
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
    })
  );
}

export async function refreshSession(refreshToken: string) {
  return mapAuthResponse(
    await apiRequest<AuthResponse>("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
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
    }
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
    }
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
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
};

export async function fetchAuthSessions(accessToken: string) {
  return apiRequest<AuthSession[]>("/auth/sessions", {
    accessToken,
  });
}

export async function revokeAuthSession(accessToken: string, sessionId: string) {
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
  }
) {
  const response = await apiRequest<{ message: string; user: ApiUser }>(
    "/auth/verify-phone",
    {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createListing(accessToken: string, payload: ListingPayload) {
  const listing = await apiRequest<ApiListing>("/listings", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return mapListing(listing);
}

export async function saveListingDraft(
  accessToken: string,
  payload: ListingDraftPayload
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
  payload: ListingPayload
) {
  const listing = await apiRequest<ApiListing>(`/listings/${listingId}/publish`, {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return mapListing(listing);
}

export async function updateListing(
  accessToken: string,
  listingId: string,
  payload: Partial<ListingPayload>
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

export async function moderateListing(
  accessToken: string,
  listingId: string,
  status: ApiListingStatus
) {
  const listing = await apiRequest<ApiListing>(
    `/listings/admin/${listingId}/moderate`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );

  return mapListing(listing);
}
