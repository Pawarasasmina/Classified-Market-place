export type AttributeFieldType = "text" | "number" | "select" | "toggle";
export type SellerFieldType =
  | "text"
  | "textarea"
  | "select"
  | "toggle"
  | "file";

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

export type ApiSellerProfileStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type ApiVerifiedSellerStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "VERIFIED"
  | "REJECTED";

export type ApiSellerFormField = {
  key: string;
  label: string;
  type: SellerFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  sortOrder?: number;
};

export type ApiSellerBadgeType = {
  id: string;
  label: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  style?: Record<string, unknown> | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  isActive: boolean;
  isHidden: boolean;
  sortOrder: number;
};

export type ApiSellerBadgeAssignment = {
  id: string;
  assignedAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  badgeType: ApiSellerBadgeType;
};

export type ApiSellerPrivilegeTier = {
  id: string;
  code: "FREE" | "PREMIUM" | "VERIFIED" | "VIP";
  name: string;
  slug: string;
  description?: string | null;
  monthlyFreeListingLimit: number;
  activeListingLimit?: number | null;
  pendingListingLimit?: number | null;
  paidListingFee: number | string;
  sellerLevelUpgradeFee: number | string;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  categoryQuotas?: Array<{
    id: string;
    categoryId: string;
    monthlyFreeListingLimit?: number | null;
    activeListingLimit?: number | null;
    pendingListingLimit?: number | null;
    paidListingFee?: number | string | null;
    category?: Pick<ApiCategory, "id" | "name" | "slug" | "parentId">;
  }>;
};

export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  schemaDefinition?: {
    fields?: ApiCategoryField[] | null;
  } | null;
  listingExpiryDays?: number;
  isActive: boolean;
  parentId?: string | null;
  parent?: ApiCategory | null;
  children?: ApiCategory[];
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    listings: number;
  };
};

export type ApiUser = {
  id: string;
  email: string;
  googleId?: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  role: string;
  sellerPriorityTier?: ApiSellerPriorityTier;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  sellerProfile?: {
    id: string;
    status: ApiSellerProfileStatus;
    verifiedSellerStatus: ApiVerifiedSellerStatus;
    privilegeTier?: ApiSellerPrivilegeTier | null;
    badgeAssignments?: ApiSellerBadgeAssignment[];
  } | null;
  averageRating?: number | null;
  ratingCount?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
  listings?: ApiListing[];
};

export type ApiSellerPriorityTier = "NONE" | "AUTHORIZED" | "VERIFIED" | "VIP";

export type ApiSellerProfile = {
  id: string;
  userId: string;
  status: ApiSellerProfileStatus;
  verifiedSellerStatus: ApiVerifiedSellerStatus;
  user: ApiUser;
  privilegeTier?: ApiSellerPrivilegeTier | null;
  formDefinition?: {
    fields?: ApiSellerFormField[];
  } | null;
  formAnswers?: Record<string, unknown> | null;
  requestMetadata?: Record<string, unknown> | null;
  reviewMetadata?: Record<string, unknown> | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  requestedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  reviewedAt?: string | null;
  missingRequiredFields?: string[];
  unresolvedRequiredDocuments?: string[];
  badges?: ApiSellerBadgeAssignment[];
  stats?: {
    totalListings: number;
    activeListings: number;
    pendingListings: number;
    soldListings: number;
    conversations: number;
    offers: number;
  };
  documentRequests?: Array<{
    id: string;
    label: string;
    slug: string;
    description?: string | null;
    isRequired: boolean;
    dueAt?: string | null;
  }>;
  documentSubmissions?: Array<{
    id: string;
    requestId?: string | null;
    status: "REQUESTED" | "SUBMITTED" | "APPROVED" | "REJECTED";
    answers?: Record<string, unknown> | null;
    files?: Array<Record<string, unknown>> | null;
    reviewNotes?: string | null;
    rejectionReason?: string | null;
    submittedAt: string;
    reviewedAt?: string | null;
  }>;
};

export type ApiSellerProfileEnvelope = {
  sellerProfile: ApiSellerProfile | null;
  formDefinition: {
    fields: ApiSellerFormField[];
  };
};

export type ApiPublicSellerProfile = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  joinedAt: string;
  sellerPriorityTier: ApiSellerPriorityTier;
  profileStatus?: ApiSellerProfileStatus | null;
  verifiedSellerStatus?: ApiVerifiedSellerStatus | null;
  badges: ApiSellerBadgeAssignment[];
  stats: {
    totalListings: number;
    activeListings: number;
    pendingListings: number;
    soldListings: number;
    conversations: number;
    offers: number;
  };
  formAnswers?: Record<string, unknown> | null;
  reviewNotes?: string | null;
};

export type ApiListingStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAUSED"
  | "REJECTED"
  | "DELETED"
  | "EXPIRED"
  | "SOLD"
  | "REMOVED"
  | "DRAFT";

export type ApiListingPaymentMode = "FREE" | "PAID";

export type ApiReportStatus =
  | "OPEN"
  | "REVIEWED"
  | "RESOLVED"
  | "DISMISSED"
  | "ACTIONED";

export type ApiBoostPlacement =
  | "TOP_LISTING"
  | "HIGHLIGHTED_LISTING"
  | "CATEGORY_PRIORITY"
  | "HOMEPAGE_PROMOTION"
  | "TIME_BASED_BOOST"
  | "FEATURED"
  | "SEARCH_TOP"
  | "CATEGORY_TOP";

export type ApiBoostStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export type ApiListingPriorityRuleTarget =
  | "BOOSTED_LISTING"
  | "BOOST_PACKAGE"
  | "PAID_LISTING"
  | "CATEGORY_PRIORITY"
  | "SELLER_RATING"
  | "MANUAL_ADMIN_PRIORITY"
  | "AUTHORIZED_SELLER"
  | "VERIFIED_SELLER"
  | "VIP_SELLER";

export type ApiListingPriorityRule = {
  id: string;
  name: string;
  target: ApiListingPriorityRuleTarget;
  boostPackageId?: string | null;
  boostPackage?: Pick<ApiBoostPackage, "id" | "slug" | "name"> | null;
  categoryId?: string | null;
  category?: Pick<ApiCategory, "id" | "slug" | "name" | "parentId"> | null;
  weight: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiSellerRatingSummary = {
  sellerId: string;
  averageRating: number | null;
  ratingCount: number;
  reviewCount: number;
  reputationScore: number;
};

export type ApiSellerReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "HIDDEN";

export type ApiSellerRating = {
  id: string;
  sellerId: string;
  raterId: string;
  listingId: string;
  stars: number;
  review: string | null;
  reviewStatus?: ApiSellerReviewStatus;
  reviewModerationNote?: string | null;
  reviewModeratedAt?: string | null;
  reviewModeratedById?: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: {
    id: string;
    title: string;
  };
  rater?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  seller?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
};

export type ApiTransactionStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type ApiTransactionType =
  | "BOOST_PURCHASE"
  | "LISTING_FEE"
  | "WALLET_TOP_UP"
  | "ADMIN_ADJUSTMENT"
  | "ADMIN_CREDIT"
  | "ADMIN_DEBIT"
  | "LISTING_FEE_REFUND"
  | "SELLER_LEVEL_UPGRADE"
  | "REFUND";

export type ApiBoost = {
  id: string;
  listingId?: string;
  placement: ApiBoostPlacement;
  status: ApiBoostStatus;
  startsAt: string;
  endsAt: string;
  listing?: Pick<ApiListing, "id" | "title" | "status" | "sellerId"> | null;
  transaction?: {
    id: string;
    status: ApiTransactionStatus;
    amount?: number | string;
    currency?: string;
    provider?: string | null;
    providerRef?: string | null;
  } | null;
};

export type ApiBoostPackage = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  placement: ApiBoostPlacement;
  price: number | string;
  currency: string;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  categories?: Array<{
    categoryId: string;
    category: ApiCategory;
  }>;
};

export type ApiWalletAccount = {
  id: string;
  userId: string;
  balance: number | string;
  currency: string;
  user?: Pick<ApiUser, "id" | "displayName" | "email" | "role">;
  ledger?: Array<{
    id: string;
    type: string;
    amount: number | string;
    currency: string;
    balanceAfter: number | string;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
    transaction?: ApiTransaction | null;
  }>;
};

export type ApiTransaction = {
  id: string;
  userId: string;
  listingId: string | null;
  type: ApiTransactionType;
  status: ApiTransactionStatus;
  amount: number | string;
  currency: string;
  provider: string | null;
  providerRef: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<ApiUser, "id" | "displayName" | "email" | "role">;
  listing?: Pick<ApiListing, "id" | "title" | "status" | "sellerId"> | null;
  boosts?: Array<{
    id: string;
    placement: ApiBoostPlacement;
    status: ApiBoostStatus;
    startsAt: string;
    endsAt: string;
    listingId: string;
  }>;
};

export type ApiListingReport = {
  id: string;
  listingId: string;
  reporterId: string;
  reason: string;
  details: string | null;
  adminNotes?: string | null;
  status: ApiReportStatus;
  createdAt: string;
  updatedAt: string;
  listing?: Pick<ApiListing, "id" | "title" | "status" | "sellerId"> | null;
  reporter?: Pick<ApiUser, "id" | "displayName" | "email" | "role"> | null;
};

export type ApiAuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  method: string;
  path: string;
  statusCode: number | null;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  requestBody?: Record<string, unknown> | null;
  requestParams?: Record<string, unknown> | null;
  requestQuery?: Record<string, unknown> | null;
  responseSummary?: Record<string, unknown> | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  actor?: Pick<ApiUser, "id" | "displayName" | "email" | "role"> | null;
};

export type ApiAdminMonitoringReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    totalUsers: number;
    newUsers: number;
    newUsersDelta: number;
    totalListings: number;
    newListings: number;
    newListingsDelta: number;
    activeListings: number;
    totalRevenue: number;
    totalRevenueDelta: number;
    openReports: number;
    activeBoosts: number;
  };
  moderation: {
    listingStatuses: Record<ApiListingStatus, number>;
    listingReports: Record<ApiReportStatus, number>;
    conversationReports: Record<ApiReportStatus, number>;
    messageReports: Record<ApiReportStatus, number>;
    totalReports: Record<ApiReportStatus, number>;
    sellerReviews: Record<ApiSellerReviewStatus, number>;
  };
  commerce: {
    revenue: number;
    revenueDelta: number;
    transactionStatuses: Record<ApiTransactionStatus, number>;
    revenueByType: Record<ApiTransactionType, number>;
  };
  engagement: {
    listingViews: number;
    listingViewsDelta: number;
    savedListings: number;
    conversations: number;
    messages: number;
    inquiryConversionRate: number;
  };
  boosts: {
    statuses: Record<ApiBoostStatus, number>;
    active: number;
    expiringWithin24Hours: number;
  };
  alerts: Array<{
    key: string;
    severity: "none" | "low" | "medium" | "high";
    label: string;
    value: number;
    message: string;
  }>;
  recentReports: Array<{
    id: string;
    type: "LISTING" | "CONVERSATION" | "MESSAGE";
    targetId: string;
    targetTitle: string | null;
    status: ApiReportStatus;
    reason: string;
    details: string | null;
    reporter: Pick<ApiUser, "id" | "displayName" | "email" | "role"> | null;
    createdAt: string;
  }>;
  topListings: Array<{
    id: string;
    title: string;
    status: ApiListingStatus;
    sellerId: string;
    sellerName: string | null;
    categoryName: string | null;
    price: number;
    currency: string;
    viewCount: number;
    saveCount: number;
    inquiryCount: number;
    reportCount: number;
    lifetimeViewCount: number;
  }>;
};

export type ApiAdminSellerReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    totalSellers: number;
    activeSellers: number;
    inactiveSellers: number;
    newSellers: number;
    newSellersDelta: number;
    verifiedSellers: number;
    unverifiedSellers: number;
    tieredSellers: number;
  };
  tiers: Record<ApiSellerPriorityTier, number>;
  sellers: Array<{
    id: string;
    displayName: string;
    email: string;
    phone: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    sellerPriorityTier: ApiSellerPriorityTier;
    reputationScore: number;
    createdAt: string;
    totalListings: number;
    activeListings: number;
    newListings: number;
    paidListings: number;
    listingStatuses: Record<ApiListingStatus, number>;
    viewCount: number;
    saveCount: number;
    inquiryCount: number;
    reportCount: number;
    boostCount: number;
    revenue: number;
    averageRating: number | null;
    ratingCount: number;
    reviewCount: number;
    inquiryConversionRate: number;
  }>;
};

export type ApiTopSellersReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    rankedSellers: number;
    activeTopSellers: number;
    totalRevenue: number;
    totalViews: number;
    totalInquiries: number;
    averagePerformanceScore: number;
    topSeller: ApiTopSellerReportRow | null;
  };
  leaders: {
    revenue: ApiTopSellerReportRow | null;
    engagement: ApiTopSellerReportRow | null;
    conversion: ApiTopSellerReportRow | null;
    rating: ApiTopSellerReportRow | null;
  };
  sellers: ApiTopSellerReportRow[];
};

export type ApiTopSellerReportRow = {
  id: string;
  rank: number;
  displayName: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  sellerPriorityTier: ApiSellerPriorityTier;
  reputationScore: number;
  createdAt: string;
  totalListings: number;
  activeListings: number;
  newListings: number;
  paidListings: number;
  soldListings: number;
  listingStatuses: Record<ApiListingStatus, number>;
  viewCount: number;
  saveCount: number;
  inquiryCount: number;
  reportCount: number;
  boostCount: number;
  revenue: number;
  boostRevenue: number;
  listingFeeRevenue: number;
  averageRating: number | null;
  ratingCount: number;
  reviewCount: number;
  inquiryConversionRate: number;
  performanceScore: number;
};

export type ApiPendingSellerApprovalsReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    pendingApprovals: number;
    verifiedPending: number;
    needsContactVerification: number;
    activePending: number;
    highSignalApprovals: number;
  };
  approvals: Array<{
    id: string;
    displayName: string;
    email: string;
    phone: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    verifiedContact: boolean;
    reputationScore: number;
    createdAt: string;
    firstListingAt: string | null;
    latestListingAt: string | null;
    totalListings: number;
    activeListings: number;
    pendingListings: number;
    newListings: number;
    listingStatuses: Record<ApiListingStatus, number>;
    viewCount: number;
    saveCount: number;
    inquiryCount: number;
    reportCount: number;
    boostCount: number;
    revenue: number;
    averageRating: number | null;
    ratingCount: number;
    reviewCount: number;
    inquiryConversionRate: number;
    latestListing: {
      id: string;
      title: string;
      status: ApiListingStatus;
      createdAt: string;
      categoryName: string | null;
    } | null;
  }>;
};

export type ApiActiveListingsReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    activeListings: number;
    boostedListings: number;
    paidListings: number;
    manuallyPromotedListings: number;
    pinnedListings: number;
    categoriesRepresented: number;
    sellersRepresented: number;
    noRecentViews: number;
    reportedListings: number;
  };
  engagement: {
    views: number;
    saves: number;
    inquiries: number;
    reports: number;
    boosts: number;
    inquiryConversionRate: number;
    averageViewsPerListing: number;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    activeListings: number;
  }>;
  listings: Array<{
    id: string;
    title: string;
    price: number;
    currency: string;
    location: string;
    createdAt: string;
    updatedAt: string;
    category: Pick<ApiCategory, "id" | "name" | "slug">;
    seller: Pick<
      ApiUser,
      | "id"
      | "displayName"
      | "email"
      | "phoneVerified"
      | "emailVerified"
      | "sellerPriorityTier"
      | "reputationScore"
    >;
    sellerId: string;
    listingPaymentMode: ApiListingPaymentMode;
    paidPriorityEnabled: boolean;
    adminPriorityPromoted: boolean;
    adminPriorityPinned: boolean;
    adminPriorityScore: number | null;
    activeBoostCount: number;
    activeBoostPlacements: ApiBoostPlacement[];
    nextBoostEndsAt: string | null;
    viewCount: number;
    saveCount: number;
    inquiryCount: number;
    reportCount: number;
    boostCount: number;
    lifetimeViewCount: number;
    lifetimeSaveCount: number;
    lifetimeInquiryCount: number;
    lifetimeReportCount: number;
    inquiryConversionRate: number;
  }>;
};

export type ApiPaidListingsReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    paidListings: number;
    activePaidListings: number;
    pendingPaidListings: number;
    paidPriorityListings: number;
    paidFeeListings: number;
    boostedPaidListings: number;
    reportedPaidListings: number;
    categoriesRepresented: number;
    sellersRepresented: number;
  };
  commerce: {
    revenue: number;
    pendingRevenue: number;
    refundedRevenue: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    refundedPayments: number;
    cancelledPayments: number;
    paymentConversionRate: number;
  };
  engagement: {
    views: number;
    saves: number;
    inquiries: number;
    reports: number;
    boosts: number;
    inquiryConversionRate: number;
    averageViewsPerListing: number;
  };
  paymentStatuses: Record<ApiTransactionStatus, number>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    paidListings: number;
  }>;
  listings: Array<{
    id: string;
    title: string;
    status: ApiListingStatus;
    price: number;
    currency: string;
    location: string;
    createdAt: string;
    updatedAt: string;
    category: Pick<ApiCategory, "id" | "name" | "slug">;
    seller: Pick<
      ApiUser,
      | "id"
      | "displayName"
      | "email"
      | "phoneVerified"
      | "emailVerified"
      | "sellerPriorityTier"
      | "reputationScore"
    >;
    sellerId: string;
    listingPaymentMode: ApiListingPaymentMode;
    paidPriorityEnabled: boolean;
    adminPriorityPromoted: boolean;
    adminPriorityPinned: boolean;
    adminPriorityScore: number | null;
    paymentStatus: ApiTransactionStatus | null;
    paymentRevenue: number;
    pendingAmount: number;
    refundedAmount: number;
    latestPaymentAt: string | null;
    paymentTransactionCount: number;
    transactions: Array<{
      id: string;
      status: ApiTransactionStatus;
      amount: number;
      currency: string;
      provider: string | null;
      providerRef: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    activeBoostCount: number;
    activeBoostPlacements: ApiBoostPlacement[];
    nextBoostEndsAt: string | null;
    viewCount: number;
    saveCount: number;
    inquiryCount: number;
    reportCount: number;
    boostCount: number;
    lifetimeViewCount: number;
    lifetimeSaveCount: number;
    lifetimeInquiryCount: number;
    lifetimeReportCount: number;
    inquiryConversionRate: number;
  }>;
};

export type ApiWalletPaymentsReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    totalWallets: number;
    fundedWallets: number;
    emptyWallets: number;
    totalBalance: number;
    averageBalance: number;
    activeWallets: number;
  };
  movement: {
    credits: number;
    debits: number;
    creditAmount: number;
    debitAmount: number;
    netMovement: number;
    byType: Array<{
      type: string;
      count: number;
      amount: number;
    }>;
  };
  topUps: {
    requested: number;
    succeeded: number;
    pending: number;
    failed: number;
    cancelled: number;
    refunded: number;
    revenue: number;
    pendingAmount: number;
    conversionRate: number;
    statuses: Record<ApiTransactionStatus, number>;
  };
  walletPayments: {
    total: number;
    succeeded: number;
    pending: number;
    failed: number;
    cancelled: number;
    refunded: number;
    spend: number;
    conversionRate: number;
    statuses: Record<ApiTransactionStatus, number>;
  };
  wallets: Array<{
    id: string;
    userId: string;
    user: Pick<
      ApiUser,
      | "id"
      | "displayName"
      | "email"
      | "phoneVerified"
      | "emailVerified"
      | "sellerPriorityTier"
      | "reputationScore"
    >;
    balance: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
    creditTotal: number;
    debitTotal: number;
    netMovement: number;
    ledgerEntryCount: number;
    latestLedgerAt: string | null;
    latestLedgerType: string | null;
    ledger: Array<{
      id: string;
      type: string;
      amount: number;
      currency: string;
      balanceAfter: number;
      createdAt: string;
      transaction: {
        id: string;
        type: ApiTransactionType;
        status: ApiTransactionStatus;
        provider: string | null;
        providerRef: string | null;
        listing: Pick<ApiListing, "id" | "title"> | null;
      } | null;
    }>;
  }>;
};

export type ApiBoostRevenueReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    boostPurchases: number;
    successfulPurchases: number;
    pendingPurchases: number;
    failedPurchases: number;
    activeBoosts: number;
    expiringBoosts: number;
    packagesRepresented: number;
    placementsRepresented: number;
  };
  commerce: {
    revenue: number;
    pendingRevenue: number;
    refundedRevenue: number;
    walletRevenue: number;
    gatewayRevenue: number;
    averageOrderValue: number;
    paymentConversionRate: number;
    transactionStatuses: Record<ApiTransactionStatus, number>;
    revenueByProvider: Array<{
      provider: string;
      count: number;
      revenue: number;
    }>;
  };
  boosts: {
    statuses: Record<ApiBoostStatus, number>;
    placements: Array<{
      placement: ApiBoostPlacement;
      boosts: number;
      revenue: number;
      viewCount: number;
    }>;
  };
  packages: Array<{
    id: string | null;
    slug: string | null;
    name: string;
    placement: ApiBoostPlacement | null;
    durationDays: number | null;
    purchases: number;
    revenue: number;
    activeBoosts: number;
    viewCount: number;
  }>;
  topListings: Array<{
    id: string;
    title: string;
    status: ApiListingStatus;
    sellerId: string;
    categoryName: string | null;
    boosts: number;
    revenue: number;
    viewCount: number;
  }>;
  rows: Array<{
    id: string;
    placement: ApiBoostPlacement;
    status: ApiBoostStatus;
    startsAt: string;
    endsAt: string;
    createdAt: string;
    viewCount: number;
    package: {
      id: string;
      slug: string;
      name: string;
      placement: ApiBoostPlacement;
      price: number;
      currency: string;
      durationDays: number;
    } | null;
    listing: {
      id: string;
      title: string;
      status: ApiListingStatus;
      sellerId: string;
      category: Pick<ApiCategory, "id" | "name" | "slug"> | null;
    };
    purchaser: Pick<
      ApiUser,
      "id" | "displayName" | "email" | "sellerPriorityTier" | "reputationScore"
    >;
    transaction: {
      id: string;
      status: ApiTransactionStatus;
      amount: number;
      currency: string;
      provider: string | null;
      providerRef: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  }>;
};

export type ApiCategoryIncomeReport = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  overview: {
    categoriesRepresented: number;
    incomeListings: number;
    sellersRepresented: number;
    paidListings: number;
    boostedListings: number;
    totalRevenue: number;
    listingFeeRevenue: number;
    boostRevenue: number;
    pendingRevenue: number;
    refundedRevenue: number;
    successfulPayments: number;
    topCategory: ApiCategoryIncomeReportRow | null;
  };
  commerce: {
    transactionStatuses: Record<ApiTransactionStatus, number>;
    revenueByType: Partial<
      Record<
        ApiTransactionType,
        {
          count: number;
          revenue: number;
        }
      >
    >;
    revenueByProvider: Array<{
      provider: string;
      count: number;
      revenue: number;
    }>;
    averageRevenuePerCategory: number;
    averageOrderValue: number;
    paymentConversionRate: number;
  };
  engagement: {
    views: number;
    saves: number;
    inquiries: number;
    reports: number;
    inquiryConversionRate: number;
    averageRevenuePerInquiry: number;
  };
  categories: ApiCategoryIncomeReportRow[];
  topListings: Array<{
    id: string;
    title: string;
    status: ApiListingStatus;
    sellerId: string;
    seller: Pick<
      ApiUser,
      "id" | "displayName" | "email" | "sellerPriorityTier" | "reputationScore"
    >;
    category: Pick<ApiCategory, "id" | "name" | "slug">;
    listingPaymentMode: ApiListingPaymentMode;
    paidPriorityEnabled: boolean;
    revenue: number;
    listingFeeRevenue: number;
    boostRevenue: number;
    pendingRevenue: number;
    refundedRevenue: number;
    transactionCount: number;
    viewCount: number;
    saveCount: number;
    inquiryCount: number;
    reportCount: number;
    lifetimeViewCount: number;
    lifetimeSaveCount: number;
    lifetimeInquiryCount: number;
    lifetimeReportCount: number;
    inquiryConversionRate: number;
  }>;
};

export type ApiCategoryIncomeReportRow = {
  id: string;
  name: string;
  slug: string;
  listingCount: number;
  paidListings: number;
  boostedListings: number;
  activeListings: number;
  soldListings: number;
  sellersRepresented: number;
  transactionCount: number;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedPayments: number;
  cancelledPayments: number;
  revenue: number;
  listingFeeRevenue: number;
  boostRevenue: number;
  walletRevenue: number;
  gatewayRevenue: number;
  pendingRevenue: number;
  refundedRevenue: number;
  revenueShare: number;
  viewCount: number;
  saveCount: number;
  inquiryCount: number;
  reportCount: number;
  inquiryConversionRate: number;
  averageRevenuePerListing: number;
};

export type ApiListingImage = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type ApiListingPriorityRanking = {
  score: number;
  overrideApplied: boolean;
  factors: Array<{
    key: string;
    label: string;
    score: number;
    detail?: string;
  }>;
};

export type ApiListingAnalytics = {
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

export type ApiListing = {
  id: string;
  title: string;
  description: string;
  price: number | string;
  currency: string;
  location: string;
  status: ApiListingStatus;
  listingPaymentMode?: ApiListingPaymentMode;
  attributes?: Record<string, unknown> | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  reviewedAt?: string | null;
  reviewedById?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  soldAt?: string | null;
  removedAt?: string | null;
  rejectionReason?: string | null;
  boostedUntil?: string | null;
  boostPriority?: number | null;
  createdAt: string;
  updatedAt: string;
  sellerId: string;
  categoryId: string;
  paidPriorityEnabled?: boolean;
  adminPriorityPromoted?: boolean;
  adminPriorityPinned?: boolean;
  adminPriorityScore?: number | null;
  adminPriorityStartsAt?: string | null;
  adminPriorityExpiresAt?: string | null;
  priorityRanking?: ApiListingPriorityRanking;
  category?: ApiCategory;
  seller?: ApiUser;
  images?: ApiListingImage[];
  boosts?: ApiBoost[];
  activeBoost?: ApiBoost | null;
  analytics?: ApiListingAnalytics;
};

export type ApiListingQuota = {
  freeListingAllowance: number;
  freeListingUsed: number;
  freeListingRemaining: number;
  listingFeeAmount: number | string;
  listingFeeCurrency: string;
  paidListingFallbackEnabled: boolean;
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  reputationScore: number;
  sellerPriorityTier: ApiSellerPriorityTier;
  sellerProfile?: ApiUser["sellerProfile"] | null;
  sellerProfileStatus?: ApiSellerProfileStatus | null;
  verifiedSellerStatus?: ApiVerifiedSellerStatus | null;
  sellerBadges: ApiSellerBadgeAssignment[];
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
  listingExpiryDays: number;
  parentSlug?: string | null;
  children?: MarketplaceCategory[];
  isActive: boolean;
};

export type MarketplaceListing = {
  id: string;
  categoryId: string;
  parentCategoryId?: string | null;
  slug: string;
  title: string;
  categorySlug: string;
  subcategory: string;
  priceLabel: string;
  priceValue: number;
  location: string;
  condition: string;
  status:
    | "Pending"
    | "Active"
    | "Paused"
    | "Rejected"
    | "Deleted"
    | "Expired"
    | "Sold"
    | "Removed"
    | "Draft";
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  reviewedAt?: string | null;
  reviewedById?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  soldAt?: string | null;
  removedAt?: string | null;
  rejectionReason?: string | null;
  boostedUntil?: string | null;
  boostPriority?: number | null;
  postedLabel: string;
  description: string;
  featureBullets: string[];
  sellerId: string;
  sellerDisplayName?: string;
  sellerVerified?: boolean;
  sellerVerifiedSellerStatus?: ApiVerifiedSellerStatus | null;
  sellerBadges: ApiSellerBadgeAssignment[];
  sellerPriorityTier: ApiSellerPriorityTier;
  sellerJoinedLabel?: string;
  sellerTotalListings?: number;
  sellerAverageRating?: number | null;
  sellerRatingCount?: number;
  sellerReviewCount?: number;
  imageUrl?: string;
  imageUrls: string[];
  imagePalette: string[];
  attributes: Record<string, string | number | boolean>;
  viewCount: string;
  viewCountValue: number;
  saveCount: number;
  chatCount: number;
  messageCount: number;
  buyerMessageCount: number;
  conversionRate: number;
  saved: boolean;
  boostedViewCount: number;
  boostCount: number;
  activeBoostCount: number;
  activeBoost?: ApiBoost | null;
  boostedInquiryCount: number;
  boostConversionRate: number;
  isBoosted: boolean;
  boostPlacements: ApiBoostPlacement[];
  boostLabel?: string;
  boostEndsLabel?: string;
  paidPriorityEnabled: boolean;
  listingPaymentMode: ApiListingPaymentMode;
  adminPriorityPromoted: boolean;
  adminPriorityPinned: boolean;
  adminPriorityScore?: number | null;
  adminPriorityStartsAt?: string | null;
  adminPriorityExpiresAt?: string | null;
  priorityRanking?: ApiListingPriorityRanking;
};

export type MarketplaceTransaction = {
  id: string;
  userId: string;
  listingId: string | null;
  type: ApiTransactionType;
  typeLabel: string;
  status: ApiTransactionStatus;
  statusLabel: string;
  amountValue: number;
  amountLabel: string;
  provider: string | null;
  providerRef: string | null;
  createdAt: string;
  createdLabel: string;
  listingTitle: string | null;
  listingStatus: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  boosts: ApiTransaction["boosts"];
};

export type MarketplaceListingReport = {
  id: string;
  listingId: string;
  reporterId: string;
  reason: string;
  details: string | null;
  adminNotes: string | null;
  status: ApiReportStatus;
  statusLabel: string;
  createdAt: string;
  createdLabel: string;
  updatedAt: string;
  listingTitle: string | null;
  listingStatus: MarketplaceListing["status"] | null;
  reporterDisplayName: string | null;
  reporterEmail: string | null;
};

export type MarketplaceAuditLog = {
  id: string;
  actorId: string | null;
  actorDisplayName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  actionLabel: string;
  entityType: string | null;
  entityId: string | null;
  method: string;
  path: string;
  statusCode: number | null;
  success: boolean;
  outcomeLabel: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestBody?: Record<string, unknown> | null;
  requestParams?: Record<string, unknown> | null;
  requestQuery?: Record<string, unknown> | null;
  responseSummary?: Record<string, unknown> | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  createdLabel: string;
};

export type MarketplaceSeller = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  verified: boolean;
  profileStatus?: ApiSellerProfileStatus | null;
  verifiedSellerStatus?: ApiVerifiedSellerStatus | null;
  badges: ApiSellerBadgeAssignment[];
  joinedLabel: string;
  totalListings: number;
  activeListings?: number;
  pendingListings?: number;
  soldListings?: number;
  conversations?: number;
  offers?: number;
  averageRating: number | null;
  ratingCount: number;
  reviewCount: number;
  reputationScore: number;
};

export type AdminUserStats = {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  pausedListings: number;
  rejectedListings: number;
  deletedListings: number;
  bookingCount: number;
  offerCount: number;
};

export type AdminUser = ApiUser & {
  adminStats: AdminUserStats;
};

export type AdminBookingParticipant = {
  id: string;
  conversationId: string;
  userId: string;
  unreadCount: number;
  lastReadAt?: string | null;
  mutedAt?: string | null;
  joinedAt: string;
  user: ApiUser;
};

export type AdminBookingMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  legacyBody?: string | null;
  encryptedBody?: string | null;
  encryptedPayload?: string | null;
  listingId?: string | null;
  offerAmount?: string | number | null;
  offerCurrency?: string | null;
  offerStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  sender: ApiUser;
};

export type AdminBooking = {
  id: string;
  listingId?: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: MarketplaceListing | null;
  participants: AdminBookingParticipant[];
  messages: AdminBookingMessage[];
};

export type FormActionState = {
  message?: string | null;
  fieldErrors?: Record<string, string>;
  draftListingId?: string;
  savedAt?: string;
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
      {
        key: "make",
        label: "Make",
        type: "select",
        options: ["Toyota", "Honda", "BMW", "Nissan"],
        required: true,
      },
      {
        key: "model",
        label: "Model",
        type: "text",
        required: true,
        placeholder: "Camry",
      },
      {
        key: "year",
        label: "Year",
        type: "number",
        required: true,
        placeholder: "2022",
      },
      {
        key: "mileage",
        label: "Mileage (km)",
        type: "number",
        placeholder: "45000",
      },
      {
        key: "transmission",
        label: "Transmission",
        type: "select",
        options: ["Automatic", "Manual"],
      },
    ],
  },
  property: {
    accent: "linear-gradient(135deg, #e8f8f2 0%, #c8ece0 100%)",
    icon: "P",
    countLabel: "Property inventory",
    palette: ["#23725e", "#9fd8c0", "#f2e0c7"],
    schema: [
      {
        key: "propertyType",
        label: "Property type",
        type: "select",
        options: ["Apartment", "Villa", "Office", "Land"],
        required: true,
      },
      { key: "bedrooms", label: "Bedrooms", type: "number", placeholder: "2" },
      {
        key: "bathrooms",
        label: "Bathrooms",
        type: "number",
        placeholder: "2",
      },
      {
        key: "area",
        label: "Area (sqft)",
        type: "number",
        placeholder: "1200",
      },
      { key: "furnished", label: "Furnished", type: "toggle" },
    ],
  },
  electronics: {
    accent: "linear-gradient(135deg, #eef6ff 0%, #d8eafe 100%)",
    icon: "E",
    countLabel: "Electronics inventory",
    palette: ["#375785", "#acc9ea", "#dee8f4"],
    schema: [
      {
        key: "brand",
        label: "Brand",
        type: "text",
        required: true,
        placeholder: "Apple",
      },
      { key: "storage", label: "Storage", type: "text", placeholder: "256GB" },
      {
        key: "condition",
        label: "Condition",
        type: "select",
        options: ["New", "Like new", "Used"],
      },
      { key: "warranty", label: "Warranty available", type: "toggle" },
    ],
  },
  jobs: {
    accent: "linear-gradient(135deg, #fff4df 0%, #ffe3ab 100%)",
    icon: "J",
    countLabel: "Jobs inventory",
    palette: ["#f1b65d", "#ffebbf", "#6f604a"],
    schema: [
      {
        key: "jobType",
        label: "Job type",
        type: "select",
        options: ["Full-time", "Part-time", "Contract"],
      },
      {
        key: "experience",
        label: "Experience level",
        type: "select",
        options: ["Entry", "Mid", "Senior"],
      },
      {
        key: "salary",
        label: "Monthly salary",
        type: "number",
        placeholder: "3500",
      },
    ],
  },
  services: {
    accent: "linear-gradient(135deg, #f1f1ff 0%, #ddd6ff 100%)",
    icon: "S",
    countLabel: "Services inventory",
    palette: ["#6d53c1", "#d5ccff", "#eef0ff"],
    schema: [
      {
        key: "serviceType",
        label: "Service type",
        type: "text",
        required: true,
        placeholder: "AC repair",
      },
      { key: "onsite", label: "On-site service", type: "toggle" },
      {
        key: "availability",
        label: "Availability",
        type: "select",
        options: ["Today", "Weekdays", "Weekends"],
      },
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

function toAttributeFieldType(
  value: string | null | undefined,
): AttributeFieldType {
  if (
    value === "number" ||
    value === "select" ||
    value === "toggle"
  ) {
    return value;
  }

  if (value === "yes-no") {
    return "toggle";
  }

  return "text";
}

function normalizeAttributeValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
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

function formatMetricCount(count: number, label: string) {
  return `${count.toLocaleString()} ${label}${count === 1 ? "" : "s"}`;
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
    year:
      createdAt.getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

function formatJoinedLabel(value: string) {
  const createdAt = new Date(value);

  if (Number.isNaN(createdAt.getTime())) {
    return "Member recently";
  }

  return `Member since ${createdAt.getFullYear()}`;
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

export function humanizeBoostPlacement(placement: ApiBoostPlacement) {
  switch (placement) {
    case "TOP_LISTING":
      return "Top listing";
    case "HIGHLIGHTED_LISTING":
      return "Highlighted";
    case "CATEGORY_PRIORITY":
      return "Category priority";
    case "HOMEPAGE_PROMOTION":
      return "Homepage promotion";
    case "TIME_BASED_BOOST":
      return "Time-based boost";
    case "SEARCH_TOP":
      return "Search top";
    case "CATEGORY_TOP":
      return "Category top";
    default:
      return "Featured";
  }
}

function getActiveBoosts(boosts: ApiBoost[] | undefined) {
  const now = Date.now();

  return (boosts ?? []).filter((boost) => {
    const startsAt = new Date(boost.startsAt).getTime();
    const endsAt = new Date(boost.endsAt).getTime();

    return (
      boost.status === "ACTIVE" &&
      Number.isFinite(startsAt) &&
      Number.isFinite(endsAt) &&
      startsAt <= now &&
      endsAt > now
    );
  });
}

function normalizeAttributes(
  attributes: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean> {
  if (!attributes) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key, normalizeAttributeValue(value)])
      .filter(
        (entry): entry is [string, string | number | boolean] =>
          entry[1] !== "",
      ),
  );
}

function extractListingImageUrls(
  attributes: Record<string, unknown> | null | undefined,
) {
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

function removeReservedListingAttributes(
  attributes: Record<string, unknown> | null | undefined,
) {
  if (!attributes) {
    return attributes;
  }

  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => key !== "__photos"),
  );
}

function buildFeatureBullets(
  attributes: Record<string, string | number | boolean>,
) {
  return Object.entries(attributes)
    .flatMap(([key, value]) => {
      if (typeof value === "boolean") {
        return value ? [humanizeLabel(key)] : [];
      }

      return [`${humanizeLabel(key)}: ${String(value)}`];
    })
    .slice(0, 4);
}

function humanizeListingStatus(
  status: ApiListingStatus,
): MarketplaceListing["status"] {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "ACTIVE":
      return "Active";
    case "PAUSED":
      return "Paused";
    case "REJECTED":
      return "Rejected";
    case "DELETED":
      return "Deleted";
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

export function humanizeReportStatus(status: ApiReportStatus) {
  return humanizeLabel(status);
}

export function humanizeTransactionStatus(status: ApiTransactionStatus) {
  return humanizeLabel(status);
}

export function humanizeTransactionType(type: ApiTransactionType) {
  return humanizeLabel(type);
}

export function humanizeAuditAction(action: string) {
  return humanizeLabel(action);
}

export function mapSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    reputationScore: user.reputationScore,
    sellerPriorityTier: user.sellerPriorityTier ?? "NONE",
    sellerProfile: user.sellerProfile ?? null,
    sellerProfileStatus: user.sellerProfile?.status ?? null,
    verifiedSellerStatus: user.sellerProfile?.verifiedSellerStatus ?? null,
    sellerBadges: user.sellerProfile?.badgeAssignments ?? [],
    createdAt: user.createdAt,
  };
}

export function mapCategory(category: ApiCategory): MarketplaceCategory {
  const preset = categoryPresets[category.slug];
  const presetFields = new Map(
    (preset?.schema ?? []).map((field) => [field.key, field]),
  );
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
      : (preset?.countLabel ?? "Live inventory"),
    schema,
    listingExpiryDays: category.listingExpiryDays ?? 30,
    parentSlug: category.parent?.slug ?? null,
    children: category.children?.map(mapCategory),
    isActive: category.isActive,
  };
}

export function mapListing(listing: ApiListing): MarketplaceListing {
  const priceValue = Number(listing.price);
  const imageUrls =
    listing.images?.map((image) => image.url).filter(Boolean) ??
    extractListingImageUrls(listing.attributes);
  const attributes = normalizeAttributes(
    removeReservedListingAttributes(listing.attributes),
  );
  const preset = categoryPresets[listing.category?.slug ?? ""];
  const featureBullets = buildFeatureBullets(attributes);
  const activeBoosts = getActiveBoosts(listing.boosts);
  const activeBoost = activeBoosts[0] ?? listing.activeBoost ?? null;
  const boostPlacements = [
    ...new Set(activeBoosts.map((boost) => boost.placement)),
  ];
  const soonestBoostEnd = activeBoosts
    .map((boost) => boost.endsAt)
    .sort(
      (first, second) => new Date(first).getTime() - new Date(second).getTime(),
    )[0];
  const boostEndsLabel = soonestBoostEnd
    ? formatShortDate(soonestBoostEnd)
    : undefined;
  const analytics = listing.analytics ?? {
    viewCount: 0,
    saveCount: 0,
    inquiryCount: 0,
    messageCount: 0,
    buyerMessageCount: 0,
    conversionRate: 0,
    boostedViewCount: 0,
    boostCount: 0,
    activeBoostCount: activeBoosts.length,
    boostedInquiryCount: 0,
    boostConversionRate: 0,
    savedByViewer: false,
  };

  return {
    id: listing.id,
    categoryId: listing.categoryId,
    parentCategoryId: listing.category?.parentId ?? null,
    slug: listing.id,
    title: listing.title,
    categorySlug: listing.category?.slug ?? "",
    subcategory: listing.category?.name ?? "Marketplace listing",
    priceLabel: formatPrice(
      Number.isNaN(priceValue) ? 0 : priceValue,
      listing.currency,
    ),
    priceValue: Number.isNaN(priceValue) ? 0 : priceValue,
    location: listing.location,
    condition:
      typeof attributes.condition === "string"
        ? attributes.condition
        : humanizeListingStatus(listing.status),
    status: humanizeListingStatus(listing.status),
    submittedAt: listing.submittedAt ?? null,
    approvedAt: listing.approvedAt ?? null,
    rejectedAt: listing.rejectedAt ?? null,
    reviewedAt: listing.reviewedAt ?? null,
    reviewedById: listing.reviewedById ?? null,
    publishedAt: listing.publishedAt ?? null,
    expiresAt: listing.expiresAt ?? null,
    soldAt: listing.soldAt ?? null,
    removedAt: listing.removedAt ?? null,
    rejectionReason: listing.rejectionReason ?? null,
    boostedUntil: listing.boostedUntil ?? null,
    boostPriority: listing.boostPriority ?? null,
    postedLabel: formatRelativeTime(listing.createdAt),
    description: listing.description,
    featureBullets:
      featureBullets.length > 0
        ? featureBullets
        : [humanizeListingStatus(listing.status), listing.location],
    sellerId: listing.sellerId,
    sellerDisplayName: listing.seller?.displayName,
    sellerVerified: Boolean(
      listing.seller?.sellerProfile?.verifiedSellerStatus === "VERIFIED" ||
        listing.seller?.phoneVerified ||
        listing.seller?.emailVerified,
    ),
    sellerVerifiedSellerStatus:
      listing.seller?.sellerProfile?.verifiedSellerStatus ?? null,
    sellerBadges: listing.seller?.sellerProfile?.badgeAssignments ?? [],
    sellerPriorityTier: listing.seller?.sellerPriorityTier ?? "NONE",
    sellerJoinedLabel: listing.seller
      ? formatJoinedLabel(listing.seller.createdAt)
      : undefined,
    sellerAverageRating: listing.seller?.averageRating ?? null,
    sellerRatingCount: listing.seller?.ratingCount ?? 0,
    sellerReviewCount: listing.seller?.reviewCount ?? 0,
    imageUrl: imageUrls[0],
    imageUrls,
    imagePalette: preset?.palette ?? ["#d95d39", "#f2d3a6", "#1f6b5a"],
    attributes,
    viewCount: analytics.viewCount
      ? formatMetricCount(analytics.viewCount, "view")
      : "No views yet",
    viewCountValue: analytics.viewCount,
    saveCount: analytics.saveCount,
    chatCount: analytics.inquiryCount,
    messageCount: analytics.messageCount,
    buyerMessageCount: analytics.buyerMessageCount,
    conversionRate: analytics.conversionRate,
    saved: analytics.savedByViewer,
    boostedViewCount: analytics.boostedViewCount,
    boostCount: analytics.boostCount,
    activeBoostCount: analytics.activeBoostCount,
    activeBoost,
    boostedInquiryCount: analytics.boostedInquiryCount,
    boostConversionRate: analytics.boostConversionRate,
    isBoosted: activeBoosts.length > 0,
    boostPlacements,
    boostLabel:
      boostPlacements.length > 0
        ? boostPlacements.map(humanizeBoostPlacement).join(" + ")
        : undefined,
    boostEndsLabel: boostEndsLabel ? `Ends ${boostEndsLabel}` : undefined,
    paidPriorityEnabled: listing.paidPriorityEnabled ?? false,
    listingPaymentMode: listing.listingPaymentMode ?? "FREE",
    adminPriorityPromoted: listing.adminPriorityPromoted ?? false,
    adminPriorityPinned: listing.adminPriorityPinned ?? false,
    adminPriorityScore: listing.adminPriorityScore ?? null,
    adminPriorityStartsAt: listing.adminPriorityStartsAt ?? null,
    adminPriorityExpiresAt: listing.adminPriorityExpiresAt ?? null,
    priorityRanking: listing.priorityRanking,
  };
}

export function mapTransaction(
  transaction: ApiTransaction,
): MarketplaceTransaction {
  const amountValue = Number(transaction.amount);
  const safeAmount = Number.isNaN(amountValue) ? 0 : amountValue;

  return {
    id: transaction.id,
    userId: transaction.userId,
    listingId: transaction.listingId,
    type: transaction.type,
    typeLabel: humanizeTransactionType(transaction.type),
    status: transaction.status,
    statusLabel: humanizeTransactionStatus(transaction.status),
    amountValue: safeAmount,
    amountLabel: formatPrice(safeAmount, transaction.currency),
    provider: transaction.provider,
    providerRef: transaction.providerRef,
    createdAt: transaction.createdAt,
    createdLabel: formatShortDate(transaction.createdAt) ?? "Recently",
    listingTitle: transaction.listing?.title ?? null,
    listingStatus: transaction.listing?.status
      ? humanizeListingStatus(transaction.listing.status)
      : null,
    userDisplayName: transaction.user?.displayName ?? null,
    userEmail: transaction.user?.email ?? null,
    boosts: transaction.boosts ?? [],
  };
}

export function mapListingReport(
  report: ApiListingReport,
): MarketplaceListingReport {
  return {
    id: report.id,
    listingId: report.listingId,
    reporterId: report.reporterId,
    reason: report.reason,
    details: report.details,
    adminNotes: report.adminNotes ?? null,
    status: report.status,
    statusLabel: humanizeReportStatus(report.status),
    createdAt: report.createdAt,
    createdLabel: formatShortDate(report.createdAt) ?? "Recently",
    updatedAt: report.updatedAt,
    listingTitle: report.listing?.title ?? null,
    listingStatus: report.listing?.status
      ? humanizeListingStatus(report.listing.status)
      : null,
    reporterDisplayName: report.reporter?.displayName ?? null,
    reporterEmail: report.reporter?.email ?? null,
  };
}

export function mapAuditLog(log: ApiAuditLog): MarketplaceAuditLog {
  return {
    id: log.id,
    actorId: log.actorId,
    actorDisplayName: log.actor?.displayName ?? null,
    actorEmail: log.actor?.email ?? null,
    actorRole: log.actor?.role ?? null,
    action: log.action,
    actionLabel: humanizeAuditAction(log.action),
    entityType: log.entityType,
    entityId: log.entityId,
    method: log.method,
    path: log.path,
    statusCode: log.statusCode,
    success: log.success,
    outcomeLabel: log.success ? "Succeeded" : "Failed",
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    requestBody: log.requestBody,
    requestParams: log.requestParams,
    requestQuery: log.requestQuery,
    responseSummary: log.responseSummary,
    errorMessage: log.errorMessage,
    durationMs: log.durationMs,
    createdAt: log.createdAt,
    createdLabel: formatShortDate(log.createdAt) ?? "Recently",
  };
}

export function mapSeller(
  user: ApiPublicSellerProfile,
  ratingSummary?: ApiSellerRatingSummary,
): MarketplaceSeller {
  return {
    id: user.userId,
    name: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    verified: user.verifiedSellerStatus === "VERIFIED",
    profileStatus: user.profileStatus ?? null,
    verifiedSellerStatus: user.verifiedSellerStatus ?? null,
    badges: user.badges ?? [],
    joinedLabel: formatJoinedLabel(user.joinedAt),
    totalListings: user.stats.totalListings,
    activeListings: user.stats.activeListings,
    pendingListings: user.stats.pendingListings,
    soldListings: user.stats.soldListings,
    conversations: user.stats.conversations,
    offers: user.stats.offers,
    averageRating: ratingSummary?.averageRating ?? null,
    ratingCount: ratingSummary?.ratingCount ?? 0,
    reviewCount: ratingSummary?.reviewCount ?? 0,
    reputationScore: ratingSummary?.reputationScore ?? 0,
  };
}
