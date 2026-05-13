export type AttributeFieldType = "text" | "number" | "select" | "toggle";

export type AttributeField = {
  key: string;
  label: string;
  type: AttributeFieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export type ApiCategoryField = {
  key: string;
  label?: string | null;
  type?: string | null;
  options?: string[] | null;
  required?: boolean | null;
  placeholder?: string | null;
};

export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  schemaDefinition?: {
    fields?: ApiCategoryField[] | null;
  } | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    listings: number;
  };
};

export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  createdAt: string;
  updatedAt: string;
  listings?: ApiListing[];
};

export type ApiListingStatus =
  | "DRAFT"
  | "ACTIVE"
  | "EXPIRED"
  | "SOLD"
  | "REMOVED";
export type ApiSavedSearchSort = "newest" | "price_asc" | "price_desc";

export type ApiConversationRole = "BUYER" | "SELLER";
export type ApiListingReportReason =
  | "SPAM"
  | "FRAUD"
  | "OFFENSIVE"
  | "MISLEADING"
  | "PROHIBITED_ITEM"
  | "OTHER";
export type ApiListingReportStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "DISMISSED";
export type ApiModerationActionType =
  | "REPORT_CREATED"
  | "REPORT_UNDER_REVIEW"
  | "LISTING_APPROVED"
  | "LISTING_REJECTED"
  | "LISTING_REMOVED"
  | "REPORT_DISMISSED";

export type ApiListing = {
  id: string;
  title: string;
  description: string;
  price: number | string;
  currency: string;
  location: string;
  status: ApiListingStatus;
  attributes?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  sellerId: string;
  categoryId: string;
  saved?: boolean;
  media?: ApiListingMedia[];
  category?: ApiCategory;
  seller?: ApiUser;
};

export type ApiListingResults = {
  items: ApiListing[];
  pagination: {
    page: number;
    take: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ApiSavedSearch = {
  id: string;
  label: string;
  query: string;
  categorySlug: string;
  sort: ApiSavedSearchSort;
  alertsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    slug: string;
    name: string;
  } | null;
};

export type ApiListingMedia = {
  id: string;
  originalFileName: string;
  publicUrl: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type ApiConversationListing = {
  id: string;
  title: string;
  description: string;
  price: number | string;
  currency: string;
  location: string;
  status: ApiListingStatus;
  categoryId: string;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  seller: ApiUser;
};

export type ApiConversationParticipant = {
  id: string;
  role: ApiConversationRole;
  unreadCount: number;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: ApiUser;
};

export type ApiConversationMessage = {
  id: string;
  body: string;
  senderId: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  sender: ApiUser;
};

export type ApiConversationSummary = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  listing: ApiConversationListing;
  viewerParticipant: {
    role: ApiConversationRole;
    unreadCount: number;
    lastReadAt: string | null;
  };
  counterpart:
    | (ApiUser & {
        participantRole: ApiConversationRole;
      })
    | null;
  participants: ApiConversationParticipant[];
  latestMessage: ApiConversationMessage | null;
};

export type ApiConversationDetail = ApiConversationSummary & {
  messages: ApiConversationMessage[];
};

export type ApiModerationReport = {
  id: string;
  reason: ApiListingReportReason;
  details: string | null;
  status: ApiListingReportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionAction: ApiModerationActionType | null;
  resolutionNote: string | null;
  reporter: ApiUser | null;
  resolvedBy: ApiUser | null;
};

export type ApiModerationEvent = {
  id: string;
  action: ApiModerationActionType;
  notes: string | null;
  previousListingStatus: ApiListingStatus | null;
  nextListingStatus: ApiListingStatus | null;
  resultingReportStatus: ApiListingReportStatus | null;
  createdAt: string;
  actor: ApiUser | null;
  reportId: string | null;
};

export type ApiModerationQueueItem = {
  id: string;
  title: string;
  description: string;
  price: number | string;
  currency: string;
  location: string;
  status: ApiListingStatus;
  createdAt: string;
  updatedAt: string;
  sellerId: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  seller: ApiUser | null;
  reportCount: number;
  openReportCount: number;
  latestReport: ApiModerationReport | null;
  reports: ApiModerationReport[];
  latestModerationEvent: ApiModerationEvent | null;
  moderationEvents: ApiModerationEvent[];
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  createdAt: string;
};

export type MarketplaceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  accent: string;
  icon: string;
  countLabel: string;
  schema: AttributeField[];
};

export type MarketplaceListing = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  subcategory: string;
  priceLabel: string;
  priceValue: number;
  location: string;
  condition: string;
  status: "Draft" | "Active" | "Expired" | "Sold" | "Removed";
  postedLabel: string;
  description: string;
  featureBullets: string[];
  sellerId: string;
  sellerDisplayName?: string;
  sellerVerified?: boolean;
  sellerJoinedLabel?: string;
  sellerTotalListings?: number;
  imageUrl?: string;
  imageUrls?: string[];
  media?: Array<{
    id: string;
    url: string;
    isPrimary: boolean;
    sortOrder: number;
    fileName: string;
  }>;
  imagePalette: string[];
  attributes: Record<string, string | number | boolean>;
  viewCount: string;
  chatCount: number;
  saved: boolean;
};

export type MarketplaceListingResults = {
  items: MarketplaceListing[];
  pagination: {
    page: number;
    take: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type MarketplaceSeller = {
  id: string;
  name: string;
  verified: boolean;
  joinedLabel: string;
  totalListings: number;
};

export type MarketplaceSavedSearch = {
  id: string;
  label: string;
  query: string;
  categorySlug: string;
  categoryName: string | null;
  sort: ApiSavedSearchSort;
  alertsEnabled: boolean;
  href: string;
  summary: string;
  createdAtLabel: string;
  updatedAtLabel: string;
};

export type MarketplaceConversationMessage = {
  id: string;
  body: string;
  mine: boolean;
  senderId: string;
  senderDisplayName: string;
  sentLabel: string;
  readLabel: string | null;
};

export type MarketplaceConversation = {
  id: string;
  listingId: string;
  listing: MarketplaceListing;
  viewerRole: "Buyer" | "Seller";
  counterpartName: string;
  counterpartVerified: boolean;
  counterpartRole: "Buyer" | "Seller" | null;
  latestMessagePreview: string;
  latestMessageSentLabel: string;
  updatedLabel: string;
  unreadCount: number;
  messages: MarketplaceConversationMessage[];
};

export type MarketplaceModerationReport = {
  id: string;
  reason: string;
  status: string;
  details: string | null;
  reportedAtLabel: string;
  resolvedAtLabel: string | null;
  reporterName: string;
  resolvedByName: string | null;
  resolutionActionLabel: string | null;
  resolutionNote: string | null;
};

export type MarketplaceModerationEvent = {
  id: string;
  actionLabel: string;
  notes: string | null;
  createdAtLabel: string;
  actorName: string;
  previousListingStatus: MarketplaceListing["status"] | null;
  nextListingStatus: MarketplaceListing["status"] | null;
  resultingReportStatus: string | null;
};

export type MarketplaceModerationQueueItem = {
  listing: MarketplaceListing;
  reportCount: number;
  openReportCount: number;
  latestReport: MarketplaceModerationReport | null;
  reports: MarketplaceModerationReport[];
  latestModerationEvent: MarketplaceModerationEvent | null;
  moderationEvents: MarketplaceModerationEvent[];
};

export type FormActionState = {
  message?: string | null;
  fieldErrors?: Record<string, string>;
};

const categoryPresets: Record<
  string,
  {
    accent: string;
    icon: string;
    countLabel: string;
    palette: [string, string, string];
    schema: AttributeField[];
  }
> = {
  motors: {
    accent: "linear-gradient(135deg, #ffe7db 0%, #ffd0be 100%)",
    icon: "M",
    countLabel: "Motors inventory",
    palette: ["#cb5f34", "#f0b994", "#6f584a"],
    schema: [
      { key: "make", label: "Make", type: "select", options: ["Toyota", "Honda", "BMW", "Nissan"], required: true },
      { key: "model", label: "Model", type: "text", required: true, placeholder: "Camry" },
      { key: "year", label: "Year", type: "number", required: true, placeholder: "2022" },
      { key: "mileage", label: "Mileage (km)", type: "number", placeholder: "45000" },
      { key: "transmission", label: "Transmission", type: "select", options: ["Automatic", "Manual"] },
    ],
  },
  property: {
    accent: "linear-gradient(135deg, #e8f8f2 0%, #c8ece0 100%)",
    icon: "P",
    countLabel: "Property inventory",
    palette: ["#23725e", "#9fd8c0", "#f2e0c7"],
    schema: [
      { key: "propertyType", label: "Property type", type: "select", options: ["Apartment", "Villa", "Office", "Land"], required: true },
      { key: "bedrooms", label: "Bedrooms", type: "number", placeholder: "2" },
      { key: "bathrooms", label: "Bathrooms", type: "number", placeholder: "2" },
      { key: "area", label: "Area (sqft)", type: "number", placeholder: "1200" },
      { key: "furnished", label: "Furnished", type: "toggle" },
    ],
  },
  electronics: {
    accent: "linear-gradient(135deg, #eef6ff 0%, #d8eafe 100%)",
    icon: "E",
    countLabel: "Electronics inventory",
    palette: ["#375785", "#acc9ea", "#dee8f4"],
    schema: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "Apple" },
      { key: "storage", label: "Storage", type: "text", placeholder: "256GB" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Like new", "Used"] },
      { key: "warranty", label: "Warranty available", type: "toggle" },
    ],
  },
  jobs: {
    accent: "linear-gradient(135deg, #fff4df 0%, #ffe3ab 100%)",
    icon: "J",
    countLabel: "Jobs inventory",
    palette: ["#f1b65d", "#ffebbf", "#6f604a"],
    schema: [
      { key: "jobType", label: "Job type", type: "select", options: ["Full-time", "Part-time", "Contract"] },
      { key: "experience", label: "Experience level", type: "select", options: ["Entry", "Mid", "Senior"] },
      { key: "salary", label: "Monthly salary", type: "number", placeholder: "3500" },
    ],
  },
  services: {
    accent: "linear-gradient(135deg, #f1f1ff 0%, #ddd6ff 100%)",
    icon: "S",
    countLabel: "Services inventory",
    palette: ["#6d53c1", "#d5ccff", "#eef0ff"],
    schema: [
      { key: "serviceType", label: "Service type", type: "text", required: true, placeholder: "AC repair" },
      { key: "onsite", label: "On-site service", type: "toggle" },
      { key: "availability", label: "Availability", type: "select", options: ["Today", "Weekdays", "Weekends"] },
    ],
  },
};

function humanizeLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizeEnumValue(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toAttributeFieldType(value: string | null | undefined): AttributeFieldType {
  if (value === "number" || value === "select" || value === "toggle") {
    return value;
  }

  return "text";
}

function normalizeAttributeValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value == null) {
    return "";
  }

  return JSON.stringify(value);
}

function formatCountLabel(count: number) {
  return `${count.toLocaleString()} live ${count === 1 ? "ad" : "ads"}`;
}

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatRelativeTime(value: string) {
  const createdAt = new Date(value);
  const diffMs = Date.now() - createdAt.getTime();

  if (Number.isNaN(createdAt.getTime()) || diffMs < 0) {
    return "Recently";
  }

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return createdAt.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: createdAt.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function formatJoinedLabel(value: string) {
  const createdAt = new Date(value);

  if (Number.isNaN(createdAt.getTime())) {
    return "Member recently";
  }

  return `Member since ${createdAt.getFullYear()}`;
}

function normalizeAttributes(
  attributes: Record<string, unknown> | null | undefined
): Record<string, string | number | boolean> {
  if (!attributes) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key, normalizeAttributeValue(value)])
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== "")
  );
}

function extractListingImageUrls(attributes: Record<string, unknown> | null | undefined) {
  if (!attributes) {
    return [];
  }

  const photoPayload = attributes.__photos;

  if (!Array.isArray(photoPayload)) {
    return [];
  }

  return photoPayload
    .flatMap((item) => {
      if (
        item &&
        typeof item === "object" &&
        "src" in item &&
        typeof item.src === "string" &&
        item.src.startsWith("data:image/")
      ) {
        return [item.src];
      }

      return [];
    })
    .slice(0, 3);
}

function extractListingMediaUrls(media: ApiListingMedia[] | undefined) {
  if (!media?.length) {
    return [];
  }

  return [...media]
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }

      return left.sortOrder - right.sortOrder;
    })
    .map((item) => item.publicUrl)
    .filter((value) => typeof value === "string" && value.length > 0)
    .slice(0, 3);
}

function removeReservedListingAttributes(
  attributes: Record<string, unknown> | null | undefined
) {
  if (!attributes) {
    return attributes;
  }

  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => key !== "__photos")
  );
}

function buildFeatureBullets(attributes: Record<string, string | number | boolean>) {
  return Object.entries(attributes)
    .flatMap(([key, value]) => {
      if (typeof value === "boolean") {
        return value ? [humanizeLabel(key)] : [];
      }

      return [`${humanizeLabel(key)}: ${String(value)}`];
    })
    .slice(0, 4);
}

function humanizeListingStatus(status: ApiListingStatus): MarketplaceListing["status"] {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "EXPIRED":
      return "Expired";
    case "SOLD":
      return "Sold";
    case "REMOVED":
      return "Removed";
    default:
      return "Draft";
  }
}

export function formatSavedSearchSortLabel(sort: ApiSavedSearchSort) {
  switch (sort) {
    case "price_asc":
      return "Price low to high";
    case "price_desc":
      return "Price high to low";
    default:
      return "Newest";
  }
}

export function buildSavedSearchHref(search: {
  query?: string;
  categorySlug?: string;
  sort?: ApiSavedSearchSort;
}) {
  const params = new URLSearchParams();

  if (search.query) {
    params.set("q", search.query);
  }

  if (search.categorySlug) {
    params.set("category", search.categorySlug);
  }

  if (search.sort && search.sort !== "newest") {
    params.set("sort", search.sort);
  }

  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

function buildSavedSearchSummary(search: {
  query: string;
  categoryName: string | null;
  sort: ApiSavedSearchSort;
}) {
  const parts = [
    search.query ? `Keyword: ${search.query}` : null,
    search.categoryName ? `Category: ${search.categoryName}` : null,
    `Sort: ${formatSavedSearchSortLabel(search.sort)}`,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" | ");
}

export function mapSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    reputationScore: user.reputationScore,
    createdAt: user.createdAt,
  };
}

export function mapCategory(category: ApiCategory): MarketplaceCategory {
  const preset = categoryPresets[category.slug];
  const presetFields = new Map((preset?.schema ?? []).map((field) => [field.key, field]));
  const apiFields = category.schemaDefinition?.fields ?? [];

  const schema =
    apiFields.length > 0
      ? apiFields.map((field) => {
          const fallback = presetFields.get(field.key);

          return {
            key: field.key,
            label: field.label ?? fallback?.label ?? humanizeLabel(field.key),
            type: toAttributeFieldType(field.type ?? fallback?.type),
            options: field.options ?? fallback?.options,
            required: field.required ?? fallback?.required ?? false,
            placeholder: field.placeholder ?? fallback?.placeholder,
          };
        })
      : (preset?.schema ?? []).map((field) => ({ ...field }));

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? "Browse this marketplace category.",
    accent:
      preset?.accent ??
      "linear-gradient(135deg, rgba(255,250,244,0.92) 0%, rgba(245,240,233,0.92) 100%)",
    icon: preset?.icon ?? category.name.charAt(0).toUpperCase(),
    countLabel: category._count?.listings
      ? formatCountLabel(category._count.listings)
      : preset?.countLabel ?? "Live inventory",
    schema,
  };
}

export function mapListing(listing: ApiListing): MarketplaceListing {
  const priceValue = Number(listing.price);
  const mediaImageUrls = extractListingMediaUrls(listing.media);
  const normalizedImageUrls =
    mediaImageUrls.length > 0
      ? mediaImageUrls
      : extractListingImageUrls(listing.attributes);
  const attributes = normalizeAttributes(removeReservedListingAttributes(listing.attributes));
  const preset = categoryPresets[listing.category?.slug ?? ""];
  const featureBullets = buildFeatureBullets(attributes);

  return {
    id: listing.id,
    slug: listing.id,
    title: listing.title,
    categorySlug: listing.category?.slug ?? "",
    subcategory: listing.category?.name ?? "Marketplace listing",
    priceLabel: formatPrice(Number.isNaN(priceValue) ? 0 : priceValue, listing.currency),
    priceValue: Number.isNaN(priceValue) ? 0 : priceValue,
    location: listing.location,
    condition:
      typeof attributes.condition === "string"
        ? attributes.condition
        : humanizeListingStatus(listing.status),
    status: humanizeListingStatus(listing.status),
    postedLabel: formatRelativeTime(listing.createdAt),
    description: listing.description,
    featureBullets:
      featureBullets.length > 0
        ? featureBullets
        : [humanizeListingStatus(listing.status), listing.location],
    sellerId: listing.sellerId,
    sellerDisplayName: listing.seller?.displayName,
    sellerVerified: Boolean(listing.seller?.phoneVerified || listing.seller?.emailVerified),
    sellerJoinedLabel: listing.seller ? formatJoinedLabel(listing.seller.createdAt) : undefined,
    imageUrl: normalizedImageUrls[0],
    imageUrls: normalizedImageUrls,
    media: listing.media?.map((item) => ({
      id: item.id,
      url: item.publicUrl,
      isPrimary: item.isPrimary,
      sortOrder: item.sortOrder,
      fileName: item.originalFileName,
    })),
    imagePalette: preset?.palette ?? ["#d95d39", "#f2d3a6", "#1f6b5a"],
    attributes,
    viewCount: "Fresh listing",
    chatCount: 0,
    saved: listing.saved ?? false,
  };
}

export function mapListingResults(results: ApiListingResults): MarketplaceListingResults {
  return {
    items: results.items.map(mapListing),
    pagination: results.pagination,
  };
}

export function mapLegacyListingResults(
  listings: ApiListing[],
  fallback: {
    page: number;
    take: number;
  }
): MarketplaceListingResults {
  return {
    items: listings.map(mapListing),
    pagination: {
      page: fallback.page,
      take: fallback.take,
      totalItems: listings.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: fallback.page > 1,
    },
  };
}

function mapConversationListing(listing: ApiConversationListing): MarketplaceListing {
  return mapListing({
    ...listing,
    attributes: null,
    category: listing.category
      ? {
          id: listing.category.id,
          name: listing.category.name,
          slug: listing.category.slug,
          description: null,
          isActive: true,
        }
      : undefined,
    seller: listing.seller,
  });
}

function humanizeConversationRole(role: ApiConversationRole): "Buyer" | "Seller" {
  return role === "BUYER" ? "Buyer" : "Seller";
}

export function mapConversation(
  conversation: ApiConversationSummary | ApiConversationDetail,
  currentUserId: string
): MarketplaceConversation {
  const listing = mapConversationListing(conversation.listing);
  const counterpartRole = conversation.counterpart?.participantRole
    ? humanizeConversationRole(conversation.counterpart.participantRole)
    : null;
  const counterpartName =
    conversation.counterpart?.displayName ?? conversation.listing.seller.displayName;
  const counterpartVerified = Boolean(
    conversation.counterpart?.phoneVerified ||
      conversation.counterpart?.emailVerified ||
      conversation.listing.seller.phoneVerified ||
      conversation.listing.seller.emailVerified
  );
  const latestMessageTimestamp =
    conversation.latestMessage?.createdAt ??
    conversation.lastMessageAt ??
    conversation.updatedAt;

  return {
    id: conversation.id,
    listingId: conversation.listingId,
    listing,
    viewerRole: humanizeConversationRole(conversation.viewerParticipant.role),
    counterpartName,
    counterpartVerified,
    counterpartRole,
    latestMessagePreview:
      conversation.latestMessage?.body ?? "No messages yet. Start the conversation.",
    latestMessageSentLabel: formatRelativeTime(latestMessageTimestamp),
    updatedLabel: formatRelativeTime(
      conversation.lastMessageAt ?? conversation.updatedAt
    ),
    unreadCount: conversation.viewerParticipant.unreadCount,
    messages:
      "messages" in conversation
        ? conversation.messages.map((message) => ({
            id: message.id,
            body: message.body,
            mine: message.senderId === currentUserId,
            senderId: message.senderId,
            senderDisplayName:
              message.senderId === currentUserId
                ? "You"
                : message.sender.displayName,
            sentLabel: formatRelativeTime(message.createdAt),
            readLabel: message.readAt ? formatRelativeTime(message.readAt) : null,
          }))
        : [],
  };
}

function mapModerationReport(report: ApiModerationReport): MarketplaceModerationReport {
  return {
    id: report.id,
    reason: humanizeEnumValue(report.reason),
    status: humanizeEnumValue(report.status),
    details: report.details,
    reportedAtLabel: formatRelativeTime(report.createdAt),
    resolvedAtLabel: report.resolvedAt ? formatRelativeTime(report.resolvedAt) : null,
    reporterName: report.reporter?.displayName ?? "Marketplace user",
    resolvedByName: report.resolvedBy?.displayName ?? null,
    resolutionActionLabel: report.resolutionAction
      ? humanizeEnumValue(report.resolutionAction)
      : null,
    resolutionNote: report.resolutionNote,
  };
}

function mapModerationEvent(event: ApiModerationEvent): MarketplaceModerationEvent {
  return {
    id: event.id,
    actionLabel: humanizeEnumValue(event.action),
    notes: event.notes,
    createdAtLabel: formatRelativeTime(event.createdAt),
    actorName: event.actor?.displayName ?? "Marketplace system",
    previousListingStatus: event.previousListingStatus
      ? humanizeListingStatus(event.previousListingStatus)
      : null,
    nextListingStatus: event.nextListingStatus
      ? humanizeListingStatus(event.nextListingStatus)
      : null,
    resultingReportStatus: event.resultingReportStatus
      ? humanizeEnumValue(event.resultingReportStatus)
      : null,
  };
}

export function mapModerationQueueItem(
  item: ApiModerationQueueItem
): MarketplaceModerationQueueItem {
  return {
    listing: mapListing({
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      currency: item.currency,
      location: item.location,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sellerId: item.sellerId,
      categoryId: item.categoryId,
      attributes: null,
      category: item.category
        ? {
            id: item.category.id,
            name: item.category.name,
            slug: item.category.slug,
            description: null,
            isActive: true,
          }
        : undefined,
      seller: item.seller ?? undefined,
    }),
    reportCount: item.reportCount,
    openReportCount: item.openReportCount,
    latestReport: item.latestReport ? mapModerationReport(item.latestReport) : null,
    reports: item.reports.map(mapModerationReport),
    latestModerationEvent: item.latestModerationEvent
      ? mapModerationEvent(item.latestModerationEvent)
      : null,
    moderationEvents: item.moderationEvents.map(mapModerationEvent),
  };
}

export function mapSeller(user: ApiUser): MarketplaceSeller {
  return {
    id: user.id,
    name: user.displayName,
    verified: user.phoneVerified || user.emailVerified,
    joinedLabel: formatJoinedLabel(user.createdAt),
    totalListings: user.listings?.length ?? 0,
  };
}

export function mapSavedSearch(search: ApiSavedSearch): MarketplaceSavedSearch {
  const categoryName = search.category?.name ?? null;

  return {
    id: search.id,
    label: search.label,
    query: search.query,
    categorySlug: search.categorySlug,
    categoryName,
    sort: search.sort,
    alertsEnabled: search.alertsEnabled,
    href: buildSavedSearchHref(search),
    summary: buildSavedSearchSummary({
      query: search.query,
      categoryName,
      sort: search.sort,
    }),
    createdAtLabel: formatRelativeTime(search.createdAt),
    updatedAtLabel: formatRelativeTime(search.updatedAt),
  };
}
