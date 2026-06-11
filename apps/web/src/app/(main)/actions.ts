"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assignableUserRoles } from "@/lib/admin-permissions";
import {
  changePassword,
  boostListing,
  completeBoostPayment,
  completeListingPayment,
  completeWalletTopUp,
  creditAdminWallet,
  createSellerDocumentRequest,
  createCategory,
  createBoostPackage,
  createListing,
  deactivateCurrentUser,
  createWalletTopUp,
  createListingReport,
  createPriorityRule,
  deleteCategory,
  deleteBoostPackage,
  deleteListing,
  deleteAllListings,
  forgotPassword,
  debitAdminWallet,
  deletePriorityRule,
  deleteSellerReview,
  deleteSellerRating,
  googleLoginUser,
  upgradeMySellerPrivilege,
  loginUser,
  logoutAllSessions,
  logoutSession,
  MarketplaceApiError,
  moderateListing,
  moderateSellerReview,
  publishListingDraft,
  registerUser,
  requestPhoneOtp,
  requestVerifiedSeller,
  resendEmailVerification,
  resendEmailVerificationForEmail,
  reviewSellerDocument,
  reviewSellerProfile,
  reviewVerifiedSeller,
  resetPassword,
  revokeAuthSession,
  saveListingDraft,
  updateAdminUser,
  updateCategory,
  updateCurrentUser,
  updateMySellerProfile,
  updateListing,
  updateListingPriorityOverride,
  updateListingReport,
  updatePriorityRule,
  submitMySellerProfile,
  submitSellerDocument,
  switchToSeller,
  updateSellerFormDefinition,
  upsertSellerBadgeType,
  upsertSellerPrivilegeQuota,
  upsertSellerPrivilegeTier,
  assignSellerBadge,
  removeSellerBadge,
  applyDefaultSellerPrivilegeQuotas,
  bulkImportCategories,
  bulkImportListings,
  zeroAllSellerPrivilegeQuotas,
  upsertSellerRating,
  verifyEmailToken,
  saveListing,
  sendAdminReportEmail,
  unsaveListing,
  updateBoostPackage,
  verifyPhone,
  type AdminReportEmailType,
} from "@/lib/marketplace-api";
import {
  type ApiListingPriorityRuleTarget,
  type ApiListingStatus,
  type ApiReportStatus,
  type ApiSellerPriorityTier,
  type ApiSellerReviewStatus,
  type FormActionState,
} from "@/lib/marketplace";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  getPhoneVerificationPath,
  getPostAuthPath,
  getSafeNextPath,
} from "@/lib/redirects";
import {
  clearAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "@/lib/session";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  rememberMe: z.boolean().optional(),
});

const googleLoginSchema = z
  .object({
    idToken: z.string().trim().optional(),
    accessToken: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    displayName: z.string().trim().min(2).optional(),
    googleId: z.string().trim().optional(),
  })
  .refine((value) => value.idToken || value.email, {
    message: "Continue with Google or enter a dev-mode email.",
    path: ["idToken"],
  });

const registerSchema = z
  .object({
    accountType: z.enum(["CUSTOMER", "SELLER"]).default("CUSTOMER"),
    displayName: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters."),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || /^\+\d{6,15}$/.test(value), {
        message: "Use an international phone format like +971551234567.",
      }),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your password."),
    termsAccepted: z.literal(true, {
      error: "Accept the Terms and Privacy Policy.",
    }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

const verifyEmailSchema = z.object({
  token: z.string().trim().min(20, "Verification token is missing."),
  next: z.string().optional(),
});

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20, "Reset token is missing."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const listingSchema = z.object({
  draftListingId: z.string().trim().optional(),
  clientDraftKey: z.string().trim().optional(),
  listingId: z.string().optional(),
  categorySlug: z.string().trim().min(1, "Choose a category."),
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters."),
  price: z
    .string()
    .trim()
    .min(1, "Price is required.")
    .refine((value) => Number.isFinite(Number(value)), {
      message: "Enter a valid price.",
    })
    .transform(Number)
    .refine((value) => value >= 0, {
      message: "Price must be 0 or more.",
    }),
  currency: z.string().trim().min(3).default("AED"),
  location: z.string().trim().min(2, "Location is required."),
});

const listingDraftSchema = z.object({
  draftListingId: z.string().trim().optional(),
  clientDraftKey: z.string().trim().min(8, "Draft key is missing."),
  categorySlug: z.string().trim().optional(),
  title: z.string().trim().optional(),
  description: z.string().trim().optional(),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(3).default("AED"),
  location: z.string().trim().optional(),
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters."),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\+\d{6,15}$/.test(value), {
      message: "Use an international phone format like +971551234567.",
    }),
  avatarUrl: z.string().trim().optional(),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(120).optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().trim().optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const verifyPhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^\+\d{6,15}$/,
      "Use an international phone format like +971551234567.",
    ),
  otpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit OTP code."),
});

const requestPhoneOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^\+\d{6,15}$/,
      "Use an international phone format like +971551234567.",
    ),
});

const boostListingSchema = z.object({
  listingId: z.string().trim().min(1),
  packageId: z.string().trim().optional(),
  paymentMethod: z.enum(["GATEWAY", "WALLET"]).default("GATEWAY"),
  placement: z
    .enum([
      "TOP_LISTING",
      "HIGHLIGHTED_LISTING",
      "CATEGORY_PRIORITY",
      "HOMEPAGE_PROMOTION",
      "TIME_BASED_BOOST",
    ])
    .optional(),
  durationDays: z.coerce.number().int().min(1).max(30).optional(),
});

const completeListingPaymentSchema = z.object({
  listingId: z.string().trim().min(1),
  providerRef: z.string().trim().optional(),
  returnTo: z.string().trim().startsWith("/").optional(),
});

const walletTopUpSchema = z.object({
  amount: z.coerce.number().min(1).max(50000),
  currency: z.string().trim().length(3).default("AED"),
  returnTo: z.string().trim().startsWith("/").default("/my-listings"),
});

const adminWalletAdjustmentSchema = z.object({
  userId: z.string().trim().min(1),
  amount: z.coerce.number().min(0.01).max(50000),
  currency: z.string().trim().length(3).default("AED"),
  note: z.string().trim().max(300).optional(),
  returnTo: z.string().trim().startsWith("/").default("/admin/users"),
});

const boostPackageSchema = z.object({
  packageId: z.string().trim().optional(),
  name: z.string().trim().min(2, "Package name is required."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  placement: z.enum([
    "TOP_LISTING",
    "HIGHLIGHTED_LISTING",
    "CATEGORY_PRIORITY",
    "HOMEPAGE_PROMOTION",
    "TIME_BASED_BOOST",
  ]),
  price: z.coerce.number().min(0, "Price must be 0 or more."),
  currency: z.string().trim().length(3).default("AED"),
  durationDays: z.coerce.number().int().min(1).max(90),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
  priorityWeight: z.coerce.number().int().min(0).max(10000).default(0),
  priorityEnabled: z.boolean().optional(),
  categoryIds: z.array(z.string()).optional(),
});

const priorityRuleSchema = z
  .object({
    ruleId: z.string().trim().optional(),
    name: z.string().trim().min(2, "Rule name is required."),
    target: z.enum([
      "BOOSTED_LISTING",
      "BOOST_PACKAGE",
      "PAID_LISTING",
      "CATEGORY_PRIORITY",
      "SELLER_RATING",
      "MANUAL_ADMIN_PRIORITY",
      "AUTHORIZED_SELLER",
      "VERIFIED_SELLER",
      "VIP_SELLER",
    ]),
    boostPackageId: z.string().trim().optional(),
    categoryId: z.string().trim().optional(),
    weight: z.coerce.number().int().min(0).max(10000),
    sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.target === "BOOST_PACKAGE" && !value.boostPackageId) {
      context.addIssue({
        code: "custom",
        path: ["boostPackageId"],
        message: "Choose a boost package.",
      });
    }

    if (value.target === "CATEGORY_PRIORITY" && !value.categoryId) {
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Choose a category.",
      });
    }
  });

const adminUserSchema = z.object({
  userId: z.string().trim().min(1),
  name: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  role: z.enum(assignableUserRoles),
  isEmailVerified: z.boolean().optional(),
  isPhoneVerified: z.boolean().optional(),
  sellerPriorityTier: z.enum(["NONE", "AUTHORIZED", "VERIFIED", "VIP"]),
});

const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  parentSlug: z.string().trim().optional(),
  listingExpiryDays: z.coerce.number().int().min(1).max(365).default(30),
});

const bulkCategoryImportSchema = z.object({
  updateExisting: z.boolean().default(false),
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Category name is required."),
        slug: z.string().trim().optional(),
        description: z.string().trim().optional(),
        parentSlug: z.string().trim().optional(),
        parentName: z.string().trim().optional(),
        listingExpiryDays: z.number().int().min(1).max(365).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        useParentQuestions: z.boolean().optional(),
        schemaDefinition: z
          .object({
            fields: z
              .array(
                z.object({
                  key: z.string().trim().min(1),
                  label: z.string().trim().min(1),
                  type: z.enum(["text", "number", "select", "toggle"]),
                  options: z.array(z.string().trim().min(1)).optional(),
                  required: z.boolean().optional(),
                  placeholder: z.string().trim().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .min(1, "Add at least one category row."),
});

const bulkListingImportSchema = z.object({
  updateExisting: z.boolean().default(false),
  rows: z
    .array(
      z.object({
        listingId: z.string().uuid().optional(),
        sellerId: z.string().uuid().optional(),
        sellerEmail: z.string().trim().email().optional(),
        sellerPhone: z.string().trim().optional(),
        title: z.string().trim().min(1, "Listing title is required."),
        description: z
          .string()
          .trim()
          .min(1, "Listing description is required."),
        price: z.number().min(0, "Price must be zero or greater."),
        currency: z.string().trim().optional(),
        location: z.string().trim().min(1, "Location is required."),
        categorySlug: z.string().trim().min(1, "Category slug is required."),
        attributes: z.record(z.string(), z.unknown()).optional(),
        images: z
          .array(
            z.object({
              url: z.string().trim().url(),
              altText: z.string().trim().optional(),
              isPrimary: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    )
    .min(1, "Add at least one listing row."),
});

const adminDeleteAllListingsSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === "DELETE ALL LISTINGS", {
      message: 'Type "DELETE ALL LISTINGS" exactly to continue.',
    }),
  returnTo: z.string().trim().startsWith("/").default("/admin/listings"),
});

const listingReportSchema = z.object({
  listingId: z.string().trim().min(1),
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters.")
    .max(120),
  details: z.string().trim().max(1000).optional(),
});

const sellerRatingSchema = z.object({
  listingId: z.string().trim().min(1),
  stars: z.coerce.number().int().min(1).max(5),
  review: z
    .string()
    .trim()
    .max(1000, "Review must be 1,000 characters or less.")
    .optional(),
  returnTo: z.string().trim().startsWith("/").default("/search"),
});

const listingPriorityOverrideSchema = z.object({
  listingId: z.string().trim().min(1),
  paid: z.boolean(),
  promoted: z.boolean(),
  pinned: z.boolean(),
  score: z.number().int().min(0).max(1000000).nullable(),
  startsAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});

const updateListingReportSchema = z.object({
  reportId: z.string().trim().min(1),
  listingId: z.string().trim().optional(),
  status: z
    .enum(["OPEN", "REVIEWED", "RESOLVED", "DISMISSED", "ACTIONED"])
    .optional(),
  details: z.string().trim().max(1000).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
  listingStatus: z
    .enum([
      "PENDING",
      "ACTIVE",
      "REJECTED",
      "DELETED",
      "EXPIRED",
      "SOLD",
      "REMOVED",
      "DRAFT",
    ])
    .optional(),
});

const reportEmailDateFilterSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Enter a valid report date.",
  })
  .optional();

const adminReportEmailSchema = z.object({
  reportType: z.enum([
    "monitoring",
    "active-listings",
    "paid-listings",
    "category-income",
    "boost-revenue",
    "wallet-payments",
    "sellers",
    "top-sellers",
    "approvals",
    "seller-approvals",
  ]),
  recipient: z.string().trim().email("Enter a valid recipient email address."),
  subject: z.string().trim().max(140).optional(),
  message: z.string().trim().max(1000).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  from: reportEmailDateFilterSchema,
  to: reportEmailDateFilterSchema,
  take: z.coerce.number().int().min(1).max(200).optional(),
  topTake: z.coerce.number().int().min(1).max(20).optional(),
  returnTo: z.string().trim().startsWith("/").default("/admin/reports"),
});

const moderateSellerReviewSchema = z.object({
  ratingId: z.string().trim().min(1),
  sellerId: z.string().trim().optional(),
  listingId: z.string().trim().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]),
  note: z.string().trim().max(2000).optional(),
});

const deleteSellerReviewSchema = z.object({
  ratingId: z.string().trim().min(1),
  sellerId: z.string().trim().optional(),
  listingId: z.string().trim().optional(),
});

const toggleSavedListingSchema = z.object({
  listingId: z.string().trim().min(1),
  intent: z.enum(["save", "unsave"]),
  returnTo: z.string().trim().startsWith("/").default("/saved"),
});

function flattenFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      .map(([key, value]) => [key, value[0] ?? "Invalid value."]),
  );
}

function getActionMessage(error: unknown, fallback: string) {
  if (error instanceof MarketplaceApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function parseAttributes(formData: FormData) {
  const attributes: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("attribute:") || typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const attributeKey = key.replace("attribute:", "");

    if (trimmed === "true" || trimmed === "false") {
      attributes[attributeKey] = trimmed === "true";
    } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      attributes[attributeKey] = Number(trimmed);
    } else {
      attributes[attributeKey] = trimmed;
    }
  }

  return attributes;
}

function parseImages(formData: FormData, title: string) {
  const imageValues = formData.getAll("image");

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("photo:")) {
      imageValues.push(value);
    }
  }

  return imageValues
    .flatMap((value) => {
      if (typeof value !== "string" || !value.trim()) {
        return [];
      }

      const trimmed = value.trim();

      try {
        const photo = JSON.parse(trimmed) as { dataUrl?: unknown };

        if (typeof photo.dataUrl === "string" && photo.dataUrl.trim()) {
          return [{ url: photo.dataUrl.trim(), altText: title }];
        }
      } catch {
        return [{ url: trimmed, altText: title }];
      }

      return [{ url: trimmed, altText: title }];
    })
    .slice(0, 20)
    .map((image, index) => ({
      ...image,
      isPrimary: index === 0,
    }));
}

async function serializeBrowserFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  const mimeType = value.type || "application/octet-stream";

  return {
    name: value.name,
    size: value.size,
    type: mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
  };
}

function cleanOptional(value: string | undefined) {
  return value?.trim() ? value.trim() : undefined;
}

function cleanNullable(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseCategorySchemaDefinition(formData: FormData) {
  const rawValue = cleanOptional(
    String(formData.get("schemaDefinition") ?? ""),
  );

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      fields?: Array<{
        key?: unknown;
        label?: unknown;
        type?: unknown;
        options?: unknown;
        required?: unknown;
        placeholder?: unknown;
      }>;
    };

    const fields: Array<{
      key: string;
      label: string;
      type: "text" | "number" | "select" | "toggle";
      options?: string[];
      required?: boolean;
      placeholder?: string;
    }> = [];

    if (Array.isArray(parsed.fields)) {
      for (const field of parsed.fields) {
        const key = cleanOptional(String(field.key ?? ""));
        const label = cleanOptional(String(field.label ?? ""));
        const type = String(field.type ?? "text");
        const placeholder = cleanOptional(String(field.placeholder ?? ""));
        const options = Array.isArray(field.options)
          ? field.options
              .map((option) => cleanOptional(String(option ?? "")))
              .filter((option): option is string => Boolean(option))
          : undefined;

        if (!key || !label) {
          continue;
        }

        fields.push({
          key,
          label,
          type:
            type === "number" || type === "select" || type === "toggle"
              ? type
              : "text",
          options: type === "select" ? options : undefined,
          required: field.required === true,
          placeholder,
        });
      }
    }

    return { fields };
  } catch {
    return undefined;
  }
}

async function parseSellerFormAnswers(formData: FormData) {
  const answers: Record<string, unknown> = {};
  const files: Array<Record<string, unknown>> = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("sellerAnswer:") && typeof value === "string") {
      const fieldKey = key.replace("sellerAnswer:", "");
      const trimmed = value.trim();

      if (!trimmed) {
        continue;
      }

      answers[fieldKey] =
        trimmed === "true" || trimmed === "false"
          ? trimmed === "true"
          : trimmed;
    }

    if (key.startsWith("sellerFile:")) {
      const fieldKey = key.replace("sellerFile:", "");
      const serialized = await serializeBrowserFile(value);

      if (!serialized) {
        continue;
      }

      answers[fieldKey] = [serialized];
      files.push({
        fieldKey,
        ...serialized,
      });
    }
  }

  return { answers, files };
}

function withQueryParam(path: string, params: Record<string, string>) {
  const hashIndex = path.indexOf("#");
  const basePath = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const separator = basePath.includes("?") ? "&" : "?";

  return `${basePath}${separator}${new URLSearchParams(params).toString()}${hash}`;
}

function revalidateSellerPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/sell");
  revalidatePath("/my-listings");
  revalidatePath("/profile");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/sellers");
  revalidatePath("/admin/sellers/approvals");
  revalidatePath("/admin/sellers/verified");
  revalidatePath("/admin/sellers/badges");
  revalidatePath("/admin/sellers/form");
  revalidatePath("/admin/sellers/privileges");
}

export async function loginAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const nextPath = getSafeNextPath(formData.get("next"), "/");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "true",
  });

  if (!parsed.success) {
    return {
      message: "Check your sign-in details and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  let redirectPath = nextPath;

  try {
    const session = await loginUser(parsed.data);
    await setSessionTokens(session);
    redirectPath = getPostAuthPath(session.user, nextPath);
    revalidatePath("/", "layout");
  } catch (error) {
    if (
      error instanceof MarketplaceApiError &&
      error.message.toLowerCase().includes("verify your email")
    ) {
      const params = new URLSearchParams({
        next: nextPath,
        email: parsed.data.email,
      });

      redirect(`/verify-email?${params.toString()}`);
    }

    return {
      message: getActionMessage(error, "We could not sign you in."),
    };
  }

  redirect(redirectPath);
}

export async function googleLoginAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const nextPath = getSafeNextPath(formData.get("next"), "/");
  const parsed = googleLoginSchema.safeParse({
    idToken: cleanOptional(String(formData.get("idToken") ?? "")),
    accessToken: cleanOptional(String(formData.get("accessToken") ?? "")),
    email: cleanOptional(String(formData.get("email") ?? "")),
    displayName: cleanOptional(String(formData.get("displayName") ?? "")),
    googleId: cleanOptional(String(formData.get("googleId") ?? "")),
  });

  if (!parsed.success) {
    return {
      message: "Enter a Google ID token or a valid dev-mode Google profile.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  let redirectPath = nextPath;

  try {
    const session = await googleLoginUser(parsed.data);
    await setSessionTokens(session);
    redirectPath = !session.user.phoneVerified
      ? getPhoneVerificationPath(nextPath)
      : getPostAuthPath(session.user, nextPath);
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not complete Google login."),
    };
  }

  redirect(redirectPath);
}

export async function registerAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const nextPath = getSafeNextPath(formData.get("next"), "/sell");
  const parsed = registerSchema.safeParse({
    accountType: formData.get("accountType") || "CUSTOMER",
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    termsAccepted: formData.get("termsAccepted") === "true",
  });

  if (!parsed.success) {
    return {
      message: "Check the highlighted fields and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  let redirectPath = `/verify-email?next=${encodeURIComponent(nextPath)}`;
  const sellerAnswers = await parseSellerFormAnswers(formData);

  try {
    const response = await registerUser({
      accountType: parsed.data.accountType,
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      password: parsed.data.password,
      confirmPassword: parsed.data.confirmPassword,
      sellerFormAnswers:
        parsed.data.accountType === "SELLER"
          ? sellerAnswers.answers
          : undefined,
      sellerRequestMetadata:
        parsed.data.accountType === "SELLER"
          ? { signupSource: "register" }
          : undefined,
      termsAccepted: parsed.data.termsAccepted,
    });
    const params = new URLSearchParams({
      next: nextPath,
      email: response.email,
      registered: "true",
    });

    if (response.emailVerificationPreviewUrl) {
      params.set("preview", response.emailVerificationPreviewUrl);
    }

    redirectPath = `/verify-email?${params.toString()}`;
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create your account."),
    };
  }

  redirect(redirectPath);
}

export async function verifyEmailAndLoginAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = verifyEmailSchema.safeParse({
    token: formData.get("token"),
    next: String(formData.get("next") ?? ""),
  });

  if (!parsed.success) {
    return {
      message: "This verification link is missing or invalid.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const nextPath = getSafeNextPath(parsed.data.next, "/my-listings");
  let redirectPath = nextPath;

  try {
    const session = await verifyEmailToken(parsed.data.token);
    await setSessionTokens(session);
    redirectPath = getPostAuthPath(session.user, nextPath);
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not verify this email link."),
    };
  }

  redirect(redirectPath);
}

export async function forgotPasswordAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      message: "Enter a valid email address.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  try {
    const response = await forgotPassword(parsed.data);
    return {
      message: response.resetPreviewUrl
        ? `${response.message} Dev reset link: ${response.resetPreviewUrl}`
        : response.message,
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not start password reset."),
    };
  }
}

export async function resetPasswordAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      message: "Check the highlighted password fields and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  try {
    const response = await resetPassword({
      token: parsed.data.token,
      password: parsed.data.password,
    });
    return {
      message: response.message,
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not reset your password."),
    };
  }
}

export async function createListingAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = listingSchema.safeParse({
    draftListingId: formData.get("draftListingId") || undefined,
    clientDraftKey: formData.get("clientDraftKey") || undefined,
    categorySlug: formData.get("categorySlug"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    currency: formData.get("currency") || "AED",
    location: formData.get("location"),
  });

  if (!parsed.success) {
    return {
      message: "Complete the required listing details before saving.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/sell");
  let redirectPath = "/my-listings";

  try {
    const payload = {
      ...parsed.data,
      draftListingId: undefined,
      listingId: undefined,
      attributes: parseAttributes(formData),
      images: parseImages(formData, parsed.data.title),
    };

    if (parsed.data.draftListingId) {
      await publishListingDraft(
        accessToken,
        parsed.data.draftListingId,
        payload,
      );
    } else {
      const result = await createListing(accessToken, payload);

      if (result.payment) {
        const checkoutParams = new URLSearchParams({
          status: "PENDING",
        });

        if (result.payment.transactionId) {
          checkoutParams.set("transactionId", result.payment.transactionId);
        }

        if (result.payment.providerRef) {
          checkoutParams.set("providerRef", result.payment.providerRef);
        }

        redirectPath = `/listings/${result.listing.id}/checkout?${checkoutParams.toString()}`;
      }
    }

    revalidatePath("/");
    revalidatePath("/my-listings");
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create that listing."),
    };
  }

  redirect(redirectPath);
}

export async function saveListingDraftAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rawPrice = String(formData.get("price") ?? "").trim();
  const parsed = listingDraftSchema.safeParse({
    draftListingId: formData.get("draftListingId") || undefined,
    clientDraftKey: formData.get("clientDraftKey"),
    categorySlug: formData.get("categorySlug") || undefined,
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
    price: rawPrice ? rawPrice : undefined,
    currency: formData.get("currency") || "AED",
    location: formData.get("location") || undefined,
  });

  if (!parsed.success) {
    return {
      message: "Draft could not be saved yet.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/sell");

  try {
    const draft = await saveListingDraft(accessToken, {
      clientDraftKey: parsed.data.clientDraftKey,
      listingId: parsed.data.draftListingId,
      categorySlug: parsed.data.categorySlug,
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      currency: parsed.data.currency,
      location: parsed.data.location,
      attributes: parseAttributes(formData),
      images: parseImages(formData, parsed.data.title || "Listing draft"),
    });

    revalidatePath("/my-listings");
    return {
      message: "Draft saved.",
      draftListingId: draft.id,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not save this draft."),
      draftListingId: parsed.data.draftListingId,
    };
  }
}

export async function updateListingAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = listingSchema.safeParse({
    listingId: formData.get("listingId"),
    categorySlug: formData.get("categorySlug"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    currency: formData.get("currency") || "AED",
    location: formData.get("location"),
  });

  if (!parsed.success || !parsed.data.listingId) {
    return {
      message: "Complete the required listing details before saving.",
      fieldErrors: parsed.success ? {} : flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/my-listings");

  try {
    await updateListing(accessToken, parsed.data.listingId, {
      categorySlug: parsed.data.categorySlug,
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      currency: parsed.data.currency,
      location: parsed.data.location,
      attributes: parseAttributes(formData),
      images: parseImages(formData, parsed.data.title),
    });
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not update that listing."),
    };
  }

  revalidatePath("/my-listings");
  revalidatePath(`/listings/${parsed.data.listingId}`);
  redirect("/my-listings");
}

export async function deleteListingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const { accessToken } = await requireSessionContext("/my-listings");

  if (listingId) {
    await deleteListing(accessToken, listingId);
  }

  revalidatePath("/my-listings");
  redirect("/my-listings");
}

export async function updateListingStatusAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "") as ApiListingStatus;
  const allowedSellerStatuses: ApiListingStatus[] = [
    "SOLD",
    "REMOVED",
    "PAUSED",
  ];
  const { accessToken } = await requireSessionContext("/my-listings");

  if (listingId && allowedSellerStatuses.includes(status)) {
    await updateListing(accessToken, listingId, { status });
  }

  revalidatePath("/my-listings");
  revalidatePath(`/listings/${listingId}`);
  redirect("/my-listings");
}

export async function boostListingAction(formData: FormData) {
  const parsed = boostListingSchema.safeParse({
    listingId: formData.get("listingId"),
    packageId: cleanOptional(String(formData.get("packageId") ?? "")),
    paymentMethod: formData.get("paymentMethod") || "GATEWAY",
    placement: formData.get("placement"),
    durationDays: formData.get("durationDays") || undefined,
  });

  const { accessToken } = await requireSessionContext("/my-listings");

  if (parsed.success) {
    const payload = parsed.data.packageId
      ? {
          packageId: parsed.data.packageId,
          paymentMethod: parsed.data.paymentMethod,
        }
      : {
          placement: parsed.data.placement,
          durationDays: parsed.data.durationDays,
          paymentMethod: parsed.data.paymentMethod,
        };
    const boost = await boostListing(accessToken, parsed.data.listingId, {
      ...payload,
    });

    const completedBoost =
      parsed.data.paymentMethod === "WALLET"
        ? boost
        : await completeBoostPayment(
            accessToken,
            boost.id,
            parsed.data.packageId
              ? { providerRef: boost.payment?.providerRef }
              : {
                  durationDays: parsed.data.durationDays,
                  providerRef: boost.payment?.providerRef,
                },
          );
    const checkoutParams = new URLSearchParams({
      status: completedBoost.transaction?.status ?? "SUCCEEDED",
      listingId: parsed.data.listingId,
    });

    if (completedBoost.transaction?.id) {
      checkoutParams.set("transactionId", completedBoost.transaction.id);
    }

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/my-listings");
    revalidatePath("/transactions");
    revalidatePath(`/listings/${parsed.data.listingId}`);

    redirect(`/boosts/${boost.id}/checkout?${checkoutParams.toString()}`);
  }

  redirect("/my-listings");
}

export async function completeListingPaymentAction(formData: FormData) {
  const parsed = completeListingPaymentSchema.safeParse({
    listingId: formData.get("listingId"),
    providerRef: cleanOptional(String(formData.get("providerRef") ?? "")),
    returnTo: formData.get("returnTo") || undefined,
  });
  const returnTo = getSafeNextPath(
    parsed.success ? parsed.data.returnTo : null,
    "/my-listings",
  );
  const { accessToken } = await requireSessionContext(returnTo);

  if (parsed.success) {
    const transaction = await completeListingPayment(
      accessToken,
      parsed.data.listingId,
      {
        providerRef: parsed.data.providerRef,
      },
    );

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/my-listings");
    revalidatePath("/transactions");
    revalidatePath(`/listings/${parsed.data.listingId}`);

    redirect(
      withQueryParam(returnTo, {
        status: transaction.status,
        transactionId: transaction.id,
      }),
    );
  }

  redirect(returnTo);
}

export async function walletTopUpAction(formData: FormData) {
  const requestedReturnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/my-listings",
  );
  const parsed = walletTopUpSchema.safeParse({
    amount: formData.get("amount"),
    currency: formData.get("currency") || "AED",
    returnTo: requestedReturnTo,
  });

  if (parsed.success) {
    const returnTo = getSafeNextPath(parsed.data.returnTo, "/my-listings");
    const { accessToken } = await requireSessionContext(returnTo);
    const topUp = await createWalletTopUp(accessToken, {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
    });

    await completeWalletTopUp(accessToken, topUp.transaction.id, {
      providerRef: topUp.payment?.providerRef,
    });

    revalidatePath("/my-listings");
    revalidatePath("/wallet");
    revalidatePath("/transactions");
    revalidatePath(returnTo);
    redirect(withQueryParam(returnTo, { wallet: "top-up-success" }));
  }

  redirect(withQueryParam(requestedReturnTo, { wallet: "top-up-invalid" }));
}

export async function createBoostPackageAction(formData: FormData) {
  const parsed = boostPackageSchema.safeParse({
    name: formData.get("name"),
    slug: cleanOptional(String(formData.get("slug") ?? "")),
    description: cleanOptional(String(formData.get("description") ?? "")),
    placement: formData.get("placement"),
    price: formData.get("price"),
    currency: formData.get("currency") || "AED",
    durationDays: formData.get("durationDays"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "true",
    priorityWeight: formData.get("priorityWeight") || 0,
    priorityEnabled: formData.get("priorityEnabled") === "true",
    categoryIds: formData.getAll("categoryIds").map(String),
  });

  if (!parsed.success) {
    redirect("/admin/boost-packages?package=invalid");
  }

  const { accessToken } = await requireSessionContext("/admin/boost-packages");

  try {
    const boostPackage = await createBoostPackage(accessToken, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      placement: parsed.data.placement,
      price: parsed.data.price,
      currency: parsed.data.currency,
      durationDays: parsed.data.durationDays,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      categoryIds: parsed.data.categoryIds,
    });
    await createPriorityRule(accessToken, {
      name: `${boostPackage.name} package priority`,
      target: "BOOST_PACKAGE",
      boostPackageId: boostPackage.id,
      weight: parsed.data.priorityWeight,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.priorityEnabled,
    });
  } catch (error) {
    redirect(
      `/admin/boost-packages?package=error&message=${encodeURIComponent(
        getActionMessage(error, "We could not create that package."),
      )}`,
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/boost-packages");
  revalidatePath("/admin/priority-rules");
  revalidatePath("/search");
  revalidatePath("/my-listings");
  redirect("/admin/boost-packages?package=created");
}

export async function updateBoostPackageAction(formData: FormData) {
  const parsed = boostPackageSchema.safeParse({
    packageId: formData.get("packageId"),
    name: formData.get("name"),
    slug: cleanOptional(String(formData.get("slug") ?? "")),
    description: cleanOptional(String(formData.get("description") ?? "")),
    placement: formData.get("placement"),
    price: formData.get("price"),
    currency: formData.get("currency") || "AED",
    durationDays: formData.get("durationDays"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "true",
    priorityWeight: formData.get("priorityWeight") || 0,
    priorityEnabled: formData.get("priorityEnabled") === "true",
    categoryIds: formData.getAll("categoryIds").map(String),
  });

  if (!parsed.success || !parsed.data.packageId) {
    redirect("/admin/boost-packages?package=invalid");
  }

  const { accessToken } = await requireSessionContext("/admin/boost-packages");

  try {
    const boostPackage = await updateBoostPackage(
      accessToken,
      parsed.data.packageId,
      {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        placement: parsed.data.placement,
        price: parsed.data.price,
        currency: parsed.data.currency,
        durationDays: parsed.data.durationDays,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        categoryIds: parsed.data.categoryIds,
      },
    );
    await createPriorityRule(accessToken, {
      name: `${boostPackage.name} package priority`,
      target: "BOOST_PACKAGE",
      boostPackageId: boostPackage.id,
      weight: parsed.data.priorityWeight,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.priorityEnabled,
    });
  } catch (error) {
    redirect(
      withQueryParam("/admin/boost-packages", {
        package: "error",
        message: getActionMessage(error, "We could not update that package."),
      }),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/boost-packages");
  revalidatePath("/admin/priority-rules");
  revalidatePath("/search");
  revalidatePath("/my-listings");
  redirect("/admin/boost-packages?package=updated");
}

export async function deleteBoostPackageAction(formData: FormData) {
  const packageId = String(formData.get("packageId") ?? "");

  if (!packageId) {
    redirect("/admin/boost-packages?package=invalid");
  }

  const { accessToken } = await requireSessionContext("/admin/boost-packages");

  try {
    await deleteBoostPackage(accessToken, packageId);
  } catch (error) {
    redirect(
      withQueryParam("/admin/boost-packages", {
        package: "error",
        message: getActionMessage(error, "We could not disable that package."),
      }),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/boost-packages");
  revalidatePath("/my-listings");
  redirect("/admin/boost-packages?package=deleted");
}

export async function createPriorityRuleAction(formData: FormData) {
  const parsed = priorityRuleSchema.safeParse({
    name: formData.get("name"),
    target: formData.get("target"),
    boostPackageId: cleanOptional(String(formData.get("boostPackageId") ?? "")),
    categoryId: cleanOptional(String(formData.get("categoryId") ?? "")),
    weight: formData.get("weight"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    redirect("/admin/priority-rules?rule=invalid");
  }

  const { accessToken } = await requireSessionContext("/admin/priority-rules");

  try {
    await createPriorityRule(accessToken, {
      name: parsed.data.name,
      target: parsed.data.target as ApiListingPriorityRuleTarget,
      boostPackageId:
        parsed.data.target === "BOOST_PACKAGE"
          ? parsed.data.boostPackageId
          : undefined,
      categoryId:
        parsed.data.target === "CATEGORY_PRIORITY"
          ? parsed.data.categoryId
          : undefined,
      weight: parsed.data.weight,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    });
  } catch (error) {
    redirect(
      withQueryParam("/admin/priority-rules", {
        rule: "error",
        message: getActionMessage(error, "We could not create that rule."),
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/priority-rules");
  redirect("/admin/priority-rules?rule=created");
}

export async function updatePriorityRuleAction(formData: FormData) {
  const parsed = priorityRuleSchema.safeParse({
    ruleId: formData.get("ruleId"),
    name: formData.get("name"),
    target: formData.get("target"),
    boostPackageId: cleanOptional(String(formData.get("boostPackageId") ?? "")),
    categoryId: cleanOptional(String(formData.get("categoryId") ?? "")),
    weight: formData.get("weight"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success || !parsed.data.ruleId) {
    redirect("/admin/priority-rules?rule=invalid");
  }

  const { accessToken } = await requireSessionContext("/admin/priority-rules");

  try {
    await updatePriorityRule(accessToken, parsed.data.ruleId, {
      name: parsed.data.name,
      target: parsed.data.target as ApiListingPriorityRuleTarget,
      boostPackageId:
        parsed.data.target === "BOOST_PACKAGE"
          ? parsed.data.boostPackageId
          : undefined,
      categoryId:
        parsed.data.target === "CATEGORY_PRIORITY"
          ? parsed.data.categoryId
          : undefined,
      weight: parsed.data.weight,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    });
  } catch (error) {
    redirect(
      withQueryParam("/admin/priority-rules", {
        rule: "error",
        message: getActionMessage(error, "We could not update that rule."),
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/priority-rules");
  redirect("/admin/priority-rules?rule=updated");
}

export async function deletePriorityRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId") ?? "");

  if (!ruleId) {
    redirect("/admin/priority-rules?rule=invalid");
  }

  const { accessToken } = await requireSessionContext("/admin/priority-rules");

  try {
    await deletePriorityRule(accessToken, ruleId);
  } catch (error) {
    redirect(
      withQueryParam("/admin/priority-rules", {
        rule: "error",
        message: getActionMessage(error, "We could not deactivate that rule."),
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/priority-rules");
  redirect("/admin/priority-rules?rule=deleted");
}

export async function updateAdminUserAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/users");
  const displayName = formData.get("name") ?? formData.get("displayName") ?? "";
  const parsed = adminUserSchema.safeParse({
    userId: formData.get("userId"),
    name: displayName,
    phone: cleanOptional(String(formData.get("phone") ?? "")),
    role: formData.get("role"),
    isEmailVerified: formData.has("isEmailVerified")
      ? formData.get("isEmailVerified") === "true"
      : formData.get("emailVerified") === "true",
    isPhoneVerified: formData.has("isPhoneVerified")
      ? formData.get("isPhoneVerified") === "true"
      : formData.get("phoneVerified") === "true",
    sellerPriorityTier: formData.get("sellerPriorityTier") ?? "NONE",
  });

  if (!parsed.success) {
    redirect(withQueryParam(returnTo, { user: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await updateAdminUser(accessToken, parsed.data.userId, {
      name: parsed.data.name,
      displayName: parsed.data.name,
      phone: parsed.data.phone ?? null,
      avatarUrl: cleanNullable(formData.get("avatarUrl")),
      bio: cleanNullable(formData.get("bio")),
      location: cleanNullable(formData.get("location")),
      role: parsed.data.role,
      isEmailVerified: parsed.data.isEmailVerified,
      isPhoneVerified: parsed.data.isPhoneVerified,
      emailVerified: parsed.data.isEmailVerified,
      phoneVerified: parsed.data.isPhoneVerified,
      sellerPriorityTier: parsed.data
        .sellerPriorityTier as ApiSellerPriorityTier,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        user: "error",
        message: getActionMessage(error, "We could not update that user."),
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/reports/seller-approvals");
  revalidatePath(returnTo);
  redirect(withQueryParam(returnTo, { user: "updated" }));
}

export async function moderateListingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "") as ApiListingStatus;
  const reason = cleanOptional(String(formData.get("reason") ?? ""));
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin");

  if (!listingId || !status) {
    redirect(withQueryParam(returnTo, { moderation: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await moderateListing(accessToken, listingId, status, reason);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        moderation: "error",
        message: getActionMessage(error, "We could not update that listing."),
      }),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath(returnTo);
  redirect(withQueryParam(returnTo, { moderation: "updated" }));
}

export async function deleteAllListingsAction(formData: FormData) {
  const parsed = adminDeleteAllListingsSchema.safeParse({
    confirmation: formData.get("confirmation"),
    returnTo: formData.get("returnTo") || "/admin/listings",
  });

  const returnTo = getSafeNextPath(
    parsed.success ? parsed.data.returnTo : formData.get("returnTo"),
    "/admin/listings",
  );

  if (!parsed.success) {
    redirect(
      withQueryParam(returnTo, {
        listingsBulk: "invalid",
        message:
          parsed.error.issues[0]?.message ??
          'Type "DELETE ALL LISTINGS" exactly to continue.',
      }),
    );
  }

  const { accessToken } = await requireSessionContext(returnTo);
  let result: { deleted: number };

  try {
    result = await deleteAllListings(accessToken);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        listingsBulk: "error",
        message: getActionMessage(
          error,
          "We could not delete all listings.",
        ),
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/listings");

  redirect(
    withQueryParam(returnTo, {
      listingsBulk: "deleted",
      message: `${result.deleted} listings were permanently deleted.`,
    }),
  );
}

export async function creditAdminWalletAction(formData: FormData) {
  const parsed = adminWalletAdjustmentSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "AED",
    note: cleanOptional(String(formData.get("note") ?? "")),
    returnTo: formData.get("returnTo") || "/admin/users",
  });

  const returnTo = getSafeNextPath(
    parsed.success ? parsed.data.returnTo : formData.get("returnTo"),
    "/admin/users",
  );

  if (!parsed.success) {
    redirect(withQueryParam(returnTo, { wallet: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await creditAdminWallet(accessToken, parsed.data.userId, {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      note: parsed.data.note,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        wallet: "error",
        message: getActionMessage(error, "We could not credit that wallet."),
      }),
    );
  }

  revalidatePath(returnTo);
  revalidatePath("/admin/wallet");
  revalidatePath("/wallet");
  revalidatePath("/admin/reports/wallet-payments");
  redirect(withQueryParam(returnTo, { wallet: "credited" }));
}

export async function debitAdminWalletAction(formData: FormData) {
  const parsed = adminWalletAdjustmentSchema.safeParse({
    userId: formData.get("userId"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || "AED",
    note: cleanOptional(String(formData.get("note") ?? "")),
    returnTo: formData.get("returnTo") || "/admin/users",
  });

  const returnTo = getSafeNextPath(
    parsed.success ? parsed.data.returnTo : formData.get("returnTo"),
    "/admin/users",
  );

  if (!parsed.success) {
    redirect(withQueryParam(returnTo, { wallet: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await debitAdminWallet(accessToken, parsed.data.userId, {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      note: parsed.data.note,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        wallet: "error",
        message: getActionMessage(error, "We could not debit that wallet."),
      }),
    );
  }

  revalidatePath(returnTo);
  revalidatePath("/admin/wallet");
  revalidatePath("/wallet");
  revalidatePath("/admin/reports/wallet-payments");
  redirect(withQueryParam(returnTo, { wallet: "debited" }));
}

export async function updateListingPriorityOverrideAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin#priority-overrides",
  );
  const scoreInput = cleanOptional(String(formData.get("score") ?? ""));
  const startsAtInput = cleanOptional(String(formData.get("startsAt") ?? ""));
  const startsAtDate = startsAtInput ? new Date(startsAtInput) : null;
  const expiresAtInput = cleanOptional(String(formData.get("expiresAt") ?? ""));
  const expiresAtDate = expiresAtInput ? new Date(expiresAtInput) : null;

  if (startsAtDate && Number.isNaN(startsAtDate.getTime())) {
    redirect(withQueryParam(returnTo, { priority: "invalid" }));
  }

  if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
    redirect(withQueryParam(returnTo, { priority: "invalid" }));
  }

  const parsed = listingPriorityOverrideSchema.safeParse({
    listingId: formData.get("listingId"),
    paid: formData.get("paid") === "true",
    promoted: formData.get("promoted") === "true",
    pinned: formData.get("pinned") === "true",
    score: scoreInput ? Number(scoreInput) : null,
    startsAt: startsAtDate ? startsAtDate.toISOString() : null,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
  });

  if (!parsed.success) {
    redirect(withQueryParam(returnTo, { priority: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await updateListingPriorityOverride(accessToken, parsed.data.listingId, {
      paid: parsed.data.paid,
      promoted: parsed.data.promoted,
      pinned: parsed.data.pinned,
      score: parsed.data.score,
      startsAt: parsed.data.startsAt,
      expiresAt: parsed.data.expiresAt,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        priority: "error",
        message: getActionMessage(
          error,
          "We could not update that priority override.",
        ),
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  redirect(withQueryParam(returnTo, { priority: "updated" }));
}

export async function createListingReportAction(formData: FormData) {
  const parsed = listingReportSchema.safeParse({
    listingId: formData.get("listingId"),
    reason: formData.get("reason"),
    details: cleanOptional(String(formData.get("details") ?? "")),
  });
  const fallbackListingPath = parsed.success
    ? `/listings/${parsed.data.listingId}`
    : "/search";

  if (!parsed.success) {
    redirect(
      `${fallbackListingPath}?report=error&message=${encodeURIComponent(
        "Enter a short reason before submitting a report.",
      )}`,
    );
  }

  const { accessToken } = await requireSessionContext(fallbackListingPath);

  try {
    await createListingReport(accessToken, parsed.data.listingId, {
      reason: parsed.data.reason,
      details: parsed.data.details,
    });
  } catch (error) {
    redirect(
      `${fallbackListingPath}?report=error&message=${encodeURIComponent(
        getActionMessage(error, "We could not submit that report."),
      )}`,
    );
  }

  revalidatePath("/reports");
  redirect(`${fallbackListingPath}?report=submitted`);
}

export async function toggleSavedListingAction(formData: FormData) {
  const parsed = toggleSavedListingSchema.safeParse({
    listingId: formData.get("listingId"),
    intent: formData.get("intent"),
    returnTo: formData.get("returnTo") || "/saved",
  });
  const returnTo = getSafeNextPath(
    parsed.success ? parsed.data.returnTo : null,
    "/saved",
  );
  const { accessToken } = await requireSessionContext(returnTo);

  if (!parsed.success) {
    redirect(returnTo);
  }

  if (parsed.data.intent === "save") {
    await saveListing(accessToken, parsed.data.listingId);
  } else {
    await unsaveListing(accessToken, parsed.data.listingId);
  }

  revalidatePath("/saved");
  revalidatePath("/search");
  revalidatePath(`/listings/${parsed.data.listingId}`);
  revalidatePath("/my-listings");
  redirect(returnTo);
}

export async function rateSellerAction(formData: FormData) {
  const parsed = sellerRatingSchema.safeParse({
    listingId: formData.get("listingId"),
    stars: formData.get("stars"),
    review: String(formData.get("review") ?? ""),
    returnTo: formData.get("returnTo") || "/search",
  });

  if (!parsed.success) {
    redirect("/search?rating=invalid");
  }

  const { accessToken } = await requireSessionContext(parsed.data.returnTo);

  let sellerId: string | undefined;

  try {
    const result = await upsertSellerRating(
      accessToken,
      parsed.data.listingId,
      {
        stars: parsed.data.stars,
        review: parsed.data.review,
      },
    );
    sellerId = result.summary.sellerId;
  } catch (error) {
    const message = getActionMessage(error, "We could not save that rating.");
    const separator = parsed.data.returnTo.includes("?") ? "&" : "?";
    redirect(
      `${parsed.data.returnTo}${separator}rating=error&message=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/listings/${parsed.data.listingId}`);
  if (sellerId) {
    revalidatePath(`/sellers/${sellerId}`);
  }
  revalidatePath("/search");
  revalidatePath("/profile");
  revalidatePath("/my-listings");
  revalidatePath("/admin");
  const separator = parsed.data.returnTo.includes("?") ? "&" : "?";
  redirect(`${parsed.data.returnTo}${separator}rating=saved`);
}

export async function deleteSellerRatingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/search");

  if (!listingId || !returnTo.startsWith("/")) {
    redirect("/search?rating=invalid");
  }

  const { accessToken } = await requireSessionContext(returnTo);

  const result = await deleteSellerRating(accessToken, listingId);

  revalidatePath(`/listings/${listingId}`);
  revalidatePath(`/sellers/${result.summary.sellerId}`);
  revalidatePath("/search");
  revalidatePath("/profile");
  revalidatePath("/my-listings");
  revalidatePath("/admin");
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}rating=removed`);
}

export async function updateListingReportAction(formData: FormData) {
  const parsed = updateListingReportSchema.safeParse({
    reportId: formData.get("reportId"),
    listingId: cleanOptional(String(formData.get("listingId") ?? "")),
    status: cleanOptional(String(formData.get("status") ?? "")),
    details: cleanOptional(String(formData.get("details") ?? "")),
    adminNotes: cleanOptional(String(formData.get("adminNotes") ?? "")),
    listingStatus: cleanOptional(String(formData.get("listingStatus") ?? "")),
  });
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/listing-reports",
  );

  if (!parsed.success) {
    redirect(
      withQueryParam(returnTo, {
        updated: "error",
        message: "Check the report review fields and try again.",
      }),
    );
  }

  const { accessToken } = await requireSessionContext(returnTo);
  const payload: {
    status?: ApiReportStatus;
    details?: string;
    adminNotes?: string;
    listingStatus?: ApiListingStatus;
  } = {
    status: parsed.data.status,
    details: parsed.data.details,
    adminNotes: parsed.data.adminNotes,
    listingStatus: parsed.data.listingStatus,
  };

  try {
    await updateListingReport(accessToken, parsed.data.reportId, payload);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        updated: "error",
        message: getActionMessage(error, "We could not update that report."),
      }),
    );
  }

  if (payload.listingStatus && parsed.data.listingId) {
    revalidatePath(`/listings/${parsed.data.listingId}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/listing-reports");
  redirect(withQueryParam(returnTo, { updated: "success" }));
}

export async function sendAdminReportEmailAction(formData: FormData) {
  const parsed = adminReportEmailSchema.safeParse({
    reportType: formData.get("reportType"),
    recipient: formData.get("recipient"),
    subject: cleanOptional(String(formData.get("subject") ?? "")),
    message: cleanOptional(String(formData.get("message") ?? "")),
    days: cleanOptional(String(formData.get("days") ?? "")),
    from: cleanOptional(String(formData.get("from") ?? "")),
    to: cleanOptional(String(formData.get("to") ?? "")),
    take: cleanOptional(String(formData.get("take") ?? "")),
    topTake: cleanOptional(String(formData.get("topTake") ?? "")),
    returnTo: formData.get("returnTo") || "/admin/reports",
  });
  const returnTo = getSafeNextPath(
    parsed.success ? parsed.data.returnTo : formData.get("returnTo"),
    "/admin/reports",
  );

  if (!parsed.success) {
    const firstError =
      parsed.error.issues[0]?.message ??
      "Check the report email fields and try again.";

    redirect(
      withQueryParam(returnTo, {
        email: "error",
        message: firstError,
      }),
    );
  }

  const { accessToken } = await requireSessionContext(returnTo);
  const filters = {
    days: parsed.data.days,
    from: parsed.data.from,
    to: parsed.data.to,
    take: parsed.data.take,
    topTake: parsed.data.topTake,
  };
  let successMessage = "Report emailed.";
  let emailStatus = "success";

  try {
    const result = await sendAdminReportEmail(
      accessToken,
      parsed.data.reportType as AdminReportEmailType,
      {
        recipients: [parsed.data.recipient],
        subject: parsed.data.subject,
        message: parsed.data.message,
        filters,
      },
    );
    emailStatus = result.delivery.enabled ? "success" : "disabled";
    successMessage = result.delivery.enabled
      ? "Report emailed."
      : "Mail delivery is disabled, so the report email was not sent.";
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        email: "error",
        message: getActionMessage(
          error,
          "We could not send that report email.",
        ),
      }),
    );
  }

  redirect(
    withQueryParam(returnTo, {
      email: emailStatus,
      message: successMessage,
    }),
  );
}

export async function moderateSellerReviewAction(formData: FormData) {
  const parsed = moderateSellerReviewSchema.safeParse({
    ratingId: formData.get("ratingId"),
    sellerId: cleanOptional(String(formData.get("sellerId") ?? "")),
    listingId: cleanOptional(String(formData.get("listingId") ?? "")),
    status: formData.get("status"),
    note: cleanOptional(String(formData.get("note") ?? "")),
  });
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/reviews");

  if (!parsed.success) {
    redirect(
      withQueryParam(returnTo, {
        updated: "error",
        message: "Check the review moderation fields and try again.",
      }),
    );
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await moderateSellerReview(accessToken, parsed.data.ratingId, {
      status: parsed.data.status as ApiSellerReviewStatus,
      note: parsed.data.note,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        updated: "error",
        message: getActionMessage(
          error,
          "We could not update that seller review.",
        ),
      }),
    );
  }

  if (parsed.data.sellerId) {
    revalidatePath(`/sellers/${parsed.data.sellerId}`);
  }
  if (parsed.data.listingId) {
    revalidatePath(`/listings/${parsed.data.listingId}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/reviews");
  revalidatePath("/search");
  revalidatePath("/my-listings");
  revalidatePath("/profile");
  redirect(withQueryParam(returnTo, { updated: "success" }));
}

export async function deleteSellerReviewAction(formData: FormData) {
  const parsed = deleteSellerReviewSchema.safeParse({
    ratingId: formData.get("ratingId"),
    sellerId: cleanOptional(String(formData.get("sellerId") ?? "")),
    listingId: cleanOptional(String(formData.get("listingId") ?? "")),
  });
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/reviews");

  if (!parsed.success) {
    redirect(
      withQueryParam(returnTo, {
        updated: "error",
        message: "Choose a seller review to delete.",
      }),
    );
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await deleteSellerReview(accessToken, parsed.data.ratingId);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        updated: "error",
        message: getActionMessage(
          error,
          "We could not delete that seller review.",
        ),
      }),
    );
  }

  if (parsed.data.sellerId) {
    revalidatePath(`/sellers/${parsed.data.sellerId}`);
  }
  if (parsed.data.listingId) {
    revalidatePath(`/listings/${parsed.data.listingId}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/reviews");
  revalidatePath("/search");
  revalidatePath("/my-listings");
  revalidatePath("/profile");
  redirect(withQueryParam(returnTo, { updated: "deleted" }));
}

export async function createCategoryAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/categories",
  );
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    parentSlug: formData.get("parentSlug"),
    listingExpiryDays: formData.get("listingExpiryDays") || 30,
  });

  if (!parsed.success) {
    return {
      message: "Check the category details.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/admin");

  try {
    await createCategory(accessToken, {
      name: parsed.data.name,
      slug: cleanOptional(parsed.data.slug),
      description: cleanOptional(parsed.data.description),
      imageUrl: cleanOptional(parsed.data.imageUrl),
      parentSlug: cleanOptional(parsed.data.parentSlug),
      listingExpiryDays: parsed.data.listingExpiryDays,
      schemaDefinition: parseCategorySchemaDefinition(formData),
    });
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create that category."),
    };
  }

  revalidatePath("/admin");
  revalidatePath(returnTo);
  return { message: "Category saved." };
}

export async function bulkImportCategoriesAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/categories",
  );
  const payloadRaw = String(formData.get("payload") ?? "");

  if (!payloadRaw) {
    return {
      message: "Upload a CSV file and map at least the category name column.",
    };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return {
      message: "The bulk import payload is invalid. Please reload the file.",
    };
  }

  const parsed = bulkCategoryImportSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ?? "Check the bulk category file.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/admin");

  try {
    const result = await bulkImportCategories(accessToken, parsed.data);

    revalidatePath("/admin");
    revalidatePath("/admin/categories");
    revalidatePath("/admin/categories/main");
    revalidatePath("/admin/categories/subcategories");
    revalidatePath(returnTo);

    const summary = [
      `${result.created} created`,
      `${result.updated} updated`,
      `${result.skipped} skipped`,
    ].join(", ");
    const errorDetail = result.errors.length
      ? ` ${result.errors.slice(0, 3).join(" ")}${
          result.errors.length > 3 ? ` +${result.errors.length - 3} more.` : ""
        }`
      : "";

    return {
      message: `Bulk import finished. ${summary}. ${result.failed} failed.${errorDetail}`,
    };
  } catch (error) {
    return {
      message: getActionMessage(
        error,
        "We could not import the category spreadsheet.",
      ),
    };
  }
}

export async function bulkImportListingsAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/listings");
  const payloadRaw = String(formData.get("payload") ?? "");

  if (!payloadRaw) {
    redirect(
      withQueryParam(returnTo, {
        listingsBulk: "invalidImport",
        message:
          "Upload a CSV file and map the listing columns before importing.",
      }),
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    redirect(
      withQueryParam(returnTo, {
        listingsBulk: "invalidImport",
        message: "The bulk import payload is invalid. Please reload the file.",
      }),
    );
  }

  const parsed = bulkListingImportSchema.safeParse(payload);

  if (!parsed.success) {
    redirect(
      withQueryParam(returnTo, {
        listingsBulk: "invalidImport",
        message:
          parsed.error.issues[0]?.message ?? "Check the bulk listing file.",
      }),
    );
  }

  const { accessToken } = await requireSessionContext("/admin/listings");

  try {
    const result = await bulkImportListings(accessToken, parsed.data);

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/admin");
    revalidatePath("/admin/listings");
    revalidatePath(returnTo);

    const summary = [
      `${result.created} created`,
      `${result.updated} updated`,
      `${result.skipped} skipped`,
    ].join(", ");
    const failedReasonLines = result.errors.length
      ? result.errors.slice(0, 10).join("\n")
      : "";
    const remainingReasons =
      result.errors.length > 10
        ? `\n+${result.errors.length - 10} more failed row reasons.`
        : "";
    const detailMessage = result.failed
      ? `\nFailed reasons:\n${failedReasonLines}${remainingReasons}`
      : "";

    redirect(
      withQueryParam(returnTo, {
        listingsBulk: result.failed ? "importedPartial" : "imported",
        message: `Bulk import finished. ${summary}. ${result.failed} failed.${detailMessage}`,
      }),
    );
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        listingsBulk: "importError",
        message: getActionMessage(
          error,
          "We could not import the listing spreadsheet.",
        ),
      }),
    );
  }
}

export async function updateCategoryAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/categories",
  );
  const slug = String(formData.get("slug") ?? "");
  const name = cleanOptional(String(formData.get("name") ?? ""));
  const description = cleanOptional(String(formData.get("description") ?? ""));
  const imageUrl = cleanOptional(String(formData.get("imageUrl") ?? ""));
  const listingExpiryDays = Number(formData.get("listingExpiryDays") ?? 30);
  const parentSlug = formData.has("parentSlug")
    ? String(formData.get("parentSlug") ?? "")
    : undefined;
  const isActive = formData.get("isActive") === "true";
  const { accessToken } = await requireSessionContext("/admin");

  if (!slug) {
    redirect(withQueryParam(returnTo, { category: "invalid" }));
  }

  try {
    await updateCategory(accessToken, slug, {
      name,
      description,
      imageUrl,
      parentSlug,
      isActive,
      listingExpiryDays: Number.isFinite(listingExpiryDays)
        ? listingExpiryDays
        : undefined,
      schemaDefinition: parseCategorySchemaDefinition(formData),
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        category: "error",
        message: getActionMessage(error, "We could not update that category."),
      }),
    );
  }

  revalidatePath("/admin");
  revalidatePath(returnTo);
  redirect(withQueryParam(returnTo, { category: "updated" }));
}

export async function deleteCategoryAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/categories",
  );
  const slug = String(formData.get("slug") ?? "");
  const { accessToken } = await requireSessionContext("/admin");

  if (!slug) {
    redirect(withQueryParam(returnTo, { category: "invalid" }));
  }

  try {
    await deleteCategory(accessToken, slug);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        category: "error",
        message: getActionMessage(error, "We could not disable that category."),
      }),
    );
  }

  revalidatePath("/admin");
  revalidatePath(returnTo);
  redirect(withQueryParam(returnTo, { category: "deleted" }));
}

export async function logoutAction() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    await logoutSession(refreshToken).catch(() => null);
  }

  await clearAccessToken();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAllAction() {
  const session = await requireSessionContext("/profile/sessions");
  await logoutAllSessions(session.accessToken).catch(() => null);
  await clearAccessToken();
  redirect("/");
}

export async function revokeSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const { accessToken } = await requireSessionContext("/profile/sessions");

  if (sessionId) {
    await revokeAuthSession(accessToken, sessionId).catch(() => null);
  }

  revalidatePath("/profile/sessions");
}

export async function resendEmailVerificationAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  void _previousState;
  const email = cleanOptional(String(formData.get("email") ?? ""));

  try {
    const response = email
      ? await resendEmailVerificationForEmail(email)
      : await (async () => {
          const { accessToken } = await requireSessionContext("/verify-email");
          return resendEmailVerification(accessToken);
        })();

    return {
      message: response.emailVerificationPreviewUrl
        ? `${response.message} Dev verification link: ${response.emailVerificationPreviewUrl}`
        : response.message,
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not resend verification."),
    };
  }
}

export async function deactivateAccountAction() {
  const { accessToken } = await requireSessionContext("/profile");
  await deactivateCurrentUser(accessToken);
  await clearAccessToken();
  redirect("/");
}

export async function updateProfileAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = updateProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    avatarUrl: formData.get("avatarUrl") || undefined,
    bio: formData.get("bio") || undefined,
    location: formData.get("location") || undefined,
  });

  if (!parsed.success) {
    return {
      message: "Check the highlighted profile fields and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken, user } = await requireSessionContext("/profile");
  const nextPhone = parsed.data.phone.trim();
  const phoneChanged = Boolean(nextPhone) && nextPhone !== (user.phone ?? "");

  try {
    await updateCurrentUser(accessToken, {
      displayName: parsed.data.displayName,
      phone: nextPhone || undefined,
      avatarUrl: parsed.data.avatarUrl,
      bio: parsed.data.bio,
      location: parsed.data.location,
    });
    revalidatePath("/profile");
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not update your profile."),
    };
  }

  if (phoneChanged) {
    redirect("/verify?next=/profile");
  }

  return {
    message: "Profile updated successfully.",
  };
}

export async function switchToSellerAction() {
  const { accessToken } = await requireSessionContext("/sell");
  await switchToSeller(accessToken);
  revalidateSellerPaths();
  redirect("/sell?seller=started");
}

export async function saveSellerProfileAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/sell");
  const { accessToken } = await requireSessionContext(returnTo);
  const sellerData = await parseSellerFormAnswers(formData);

  await updateMySellerProfile(accessToken, {
    formAnswers: sellerData.answers,
    requestMetadata: {
      lastSavedAt: new Date().toISOString(),
    },
  });

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { seller: "saved" }));
}

export async function submitSellerProfileAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/sell");
  const { accessToken } = await requireSessionContext(returnTo);
  const sellerData = await parseSellerFormAnswers(formData);

  await submitMySellerProfile(accessToken, {
    formAnswers: sellerData.answers,
    requestMetadata: {
      submittedFrom: returnTo,
      submittedAt: new Date().toISOString(),
    },
  });

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { seller: "submitted" }));
}

export async function submitSellerDocumentAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/sell");
  const requestId = cleanOptional(String(formData.get("requestId") ?? ""));
  const { accessToken } = await requireSessionContext(returnTo);
  const sellerData = await parseSellerFormAnswers(formData);

  await submitSellerDocument(accessToken, {
    requestId,
    answers: sellerData.answers,
    files: sellerData.files,
  });

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { document: "submitted" }));
}

export async function requestVerifiedSellerAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/my-listings");
  const { accessToken } = await requireSessionContext(returnTo);
  const notes = cleanOptional(String(formData.get("reviewNotes") ?? ""));

  await requestVerifiedSeller(accessToken, {
    reviewNotes: notes,
    requestMetadata: {
      requestedAt: new Date().toISOString(),
    },
  });

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { verified: "requested" }));
}

export async function upgradeSellerPrivilegeAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/my-listings");
  const sellerPrivilegeTierId = String(
    formData.get("sellerPrivilegeTierId") ?? "",
  ).trim();
  const { accessToken } = await requireSessionContext(returnTo);

  if (sellerPrivilegeTierId) {
    await upgradeMySellerPrivilege(accessToken, sellerPrivilegeTierId);
  }

  revalidateSellerPaths();
  revalidatePath("/wallet");
  redirect(withQueryParam(returnTo, { tierUpgrade: "success" }));
}

export async function reviewSellerProfileAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/approvals",
  );
  const sellerProfileId = String(formData.get("sellerProfileId") ?? "");
  const status = String(formData.get("status") ?? "") as
    | "APPROVED"
    | "REJECTED"
    | "SUSPENDED";
  const reviewNotes = cleanOptional(String(formData.get("reviewNotes") ?? ""));
  const rejectionReason = cleanOptional(
    String(formData.get("rejectionReason") ?? ""),
  );
  const privilegeTierId = cleanOptional(
    String(formData.get("privilegeTierId") ?? ""),
  );
  if (!sellerProfileId || !status) {
    redirect(withQueryParam(returnTo, { reviewed: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await reviewSellerProfile(accessToken, sellerProfileId, {
      status,
      reviewNotes,
      rejectionReason,
      privilegeTierId,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        reviewed: "error",
        message: getActionMessage(
          error,
          "We could not save that seller decision.",
        ),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { reviewed: "success" }));
}

export async function createSellerDocumentRequestAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/approvals",
  );
  const sellerProfileId = String(formData.get("sellerProfileId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!sellerProfileId || !label) {
    redirect(withQueryParam(returnTo, { documentRequest: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await createSellerDocumentRequest(accessToken, sellerProfileId, {
      label,
      slug: cleanOptional(String(formData.get("slug") ?? "")),
      description: cleanOptional(String(formData.get("description") ?? "")),
      isRequired: formData.get("isRequired") === "true",
      dueAt: cleanOptional(String(formData.get("dueAt") ?? "")),
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        documentRequest: "error",
        message: getActionMessage(
          error,
          "We could not create that document request.",
        ),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { documentRequest: "created" }));
}

export async function reviewSellerDocumentAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/approvals",
  );
  const documentSubmissionId = String(
    formData.get("documentSubmissionId") ?? "",
  );
  const status = String(formData.get("status") ?? "") as
    | "APPROVED"
    | "REJECTED";
  if (!documentSubmissionId || !status) {
    redirect(withQueryParam(returnTo, { documentReview: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await reviewSellerDocument(accessToken, documentSubmissionId, {
      status,
      reviewNotes: cleanOptional(String(formData.get("reviewNotes") ?? "")),
      rejectionReason: cleanOptional(
        String(formData.get("rejectionReason") ?? ""),
      ),
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        documentReview: "error",
        message: getActionMessage(
          error,
          "We could not save that document review.",
        ),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { documentReview: "saved" }));
}

export async function reviewVerifiedSellerAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/verified",
  );
  const sellerProfileId = String(formData.get("sellerProfileId") ?? "");
  const status = String(formData.get("status") ?? "") as
    | "VERIFIED"
    | "REJECTED"
    | "NOT_REQUESTED";
  if (!sellerProfileId || !status) {
    redirect(withQueryParam(returnTo, { verifiedReview: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await reviewVerifiedSeller(accessToken, sellerProfileId, {
      status,
      reviewNotes: cleanOptional(String(formData.get("reviewNotes") ?? "")),
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        verifiedReview: "error",
        message: getActionMessage(
          error,
          "We could not save that verified seller decision.",
        ),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { verifiedReview: "saved" }));
}

export async function updateSellerFormDefinitionAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/form",
  );
  const schemaDefinition = cleanOptional(
    String(formData.get("schemaDefinition") ?? ""),
  );
  if (!schemaDefinition) {
    redirect(withQueryParam(returnTo, { form: "invalid" }));
  }

  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await updateSellerFormDefinition(accessToken, schemaDefinition);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        form: "error",
        message: getActionMessage(error, "We could not save the seller form."),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { form: "saved" }));
}

export async function upsertSellerPrivilegeTierAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/privileges",
  );
  const { accessToken } = await requireSessionContext(returnTo);
  const id = cleanOptional(String(formData.get("id") ?? ""));
  const code = String(formData.get("code") ?? "FREE") as
    | "FREE"
    | "PREMIUM"
    | "VERIFIED"
    | "VIP";

  try {
    await upsertSellerPrivilegeTier(accessToken, {
      id,
      code,
      name: String(formData.get("name") ?? "").trim(),
      slug: cleanOptional(String(formData.get("slug") ?? "")),
      description: cleanOptional(String(formData.get("description") ?? "")),
      monthlyFreeListingLimit: Number(
        formData.get("monthlyFreeListingLimit") ?? 0,
      ),
      activeListingLimit: cleanOptional(
        String(formData.get("activeListingLimit") ?? ""),
      )
        ? Number(formData.get("activeListingLimit"))
        : null,
      pendingListingLimit: cleanOptional(
        String(formData.get("pendingListingLimit") ?? ""),
      )
        ? Number(formData.get("pendingListingLimit"))
        : null,
      paidListingFee: Number(formData.get("paidListingFee") ?? 0),
      sellerLevelUpgradeFee: Number(formData.get("sellerLevelUpgradeFee") ?? 0),
      currency: cleanOptional(String(formData.get("currency") ?? "")) ?? "AED",
      isActive: formData.get("isActive") !== "false",
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        tier: "error",
        message: getActionMessage(error, "We could not save that seller tier."),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { tier: "saved" }));
}

export async function upsertSellerPrivilegeQuotaAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/privileges",
  );
  const { accessToken } = await requireSessionContext(returnTo);
  const sellerPrivilegeTierId = String(
    formData.get("sellerPrivilegeTierId") ?? "",
  );

  if (!sellerPrivilegeTierId) {
    redirect(withQueryParam(returnTo, { quota: "invalid" }));
  }

  try {
    await upsertSellerPrivilegeQuota(accessToken, sellerPrivilegeTierId, {
      categoryId: String(formData.get("categoryId") ?? ""),
      monthlyFreeListingLimit: cleanOptional(
        String(formData.get("monthlyFreeListingLimit") ?? ""),
      )
        ? Number(formData.get("monthlyFreeListingLimit"))
        : null,
      activeListingLimit: cleanOptional(
        String(formData.get("activeListingLimit") ?? ""),
      )
        ? Number(formData.get("activeListingLimit"))
        : null,
      pendingListingLimit: cleanOptional(
        String(formData.get("pendingListingLimit") ?? ""),
      )
        ? Number(formData.get("pendingListingLimit"))
        : null,
      paidListingFee: cleanOptional(
        String(formData.get("paidListingFee") ?? ""),
      )
        ? Number(formData.get("paidListingFee"))
        : null,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        quota: "error",
        message: getActionMessage(
          error,
          "We could not save that category quota.",
        ),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { quota: "saved" }));
}

export async function applyDefaultSellerPrivilegeQuotasAction(
  formData: FormData,
) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/privileges",
  );
  const sellerPrivilegeTierId = String(
    formData.get("sellerPrivilegeTierId") ?? "",
  );
  const { accessToken } = await requireSessionContext(returnTo);

  if (!sellerPrivilegeTierId) {
    redirect(withQueryParam(returnTo, { quota: "invalid" }));
  }

  try {
    await applyDefaultSellerPrivilegeQuotas(accessToken, sellerPrivilegeTierId);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        quota: "error",
        message: getActionMessage(error, "We could not apply default quotas."),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { quota: "applied" }));
}

export async function zeroAllSellerPrivilegeQuotasAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/privileges",
  );
  const sellerPrivilegeTierId = String(
    formData.get("sellerPrivilegeTierId") ?? "",
  );
  const { accessToken } = await requireSessionContext(returnTo);

  if (!sellerPrivilegeTierId) {
    redirect(withQueryParam(returnTo, { quota: "invalid" }));
  }

  try {
    await zeroAllSellerPrivilegeQuotas(accessToken, sellerPrivilegeTierId);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        quota: "error",
        message: getActionMessage(error, "We could not zero those quotas."),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { quota: "zeroed" }));
}

export async function upsertSellerBadgeTypeAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/badges",
  );
  const { accessToken } = await requireSessionContext(returnTo);

  try {
    await upsertSellerBadgeType(accessToken, {
      id: cleanOptional(String(formData.get("id") ?? "")),
      label: String(formData.get("label") ?? "").trim(),
      slug: cleanOptional(String(formData.get("slug") ?? "")),
      description: cleanOptional(String(formData.get("description") ?? "")),
      icon: cleanOptional(String(formData.get("icon") ?? "")),
      backgroundColor: cleanOptional(
        String(formData.get("backgroundColor") ?? ""),
      ),
      textColor: cleanOptional(String(formData.get("textColor") ?? "")),
      isActive: formData.has("isActive")
        ? formData.getAll("isActive").includes("true")
        : true,
      isHidden: formData.getAll("isHidden").includes("true"),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        badge: "error",
        message: getActionMessage(error, "We could not save that badge type."),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { badge: "saved" }));
}

export async function assignSellerBadgeAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/badges",
  );
  const { accessToken } = await requireSessionContext(returnTo);
  const sellerProfileId = String(formData.get("sellerProfileId") ?? "");
  const badgeTypeId = String(formData.get("badgeTypeId") ?? "");

  if (!sellerProfileId || !badgeTypeId) {
    redirect(withQueryParam(returnTo, { badgeAssign: "invalid" }));
  }

  try {
    await assignSellerBadge(accessToken, sellerProfileId, {
      badgeTypeId,
      expiresAt:
        cleanOptional(String(formData.get("expiresAt") ?? "")) ?? undefined,
    });
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        badgeAssign: "error",
        message: getActionMessage(error, "We could not assign that badge."),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { badgeAssign: "saved" }));
}

export async function removeSellerBadgeAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/sellers/badges",
  );
  const { accessToken } = await requireSessionContext(returnTo);
  const sellerProfileId = String(formData.get("sellerProfileId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");

  if (!sellerProfileId || !assignmentId) {
    redirect(withQueryParam(returnTo, { badgeAssign: "invalid" }));
  }

  try {
    await removeSellerBadge(accessToken, sellerProfileId, assignmentId);
  } catch (error) {
    redirect(
      withQueryParam(returnTo, {
        badgeAssign: "error",
        message: getActionMessage(error, "We could not remove that badge."),
      }),
    );
  }

  revalidateSellerPaths();
  redirect(withQueryParam(returnTo, { badgeAssign: "removed" }));
}

export async function changePasswordAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: cleanOptional(
      String(formData.get("currentPassword") ?? ""),
    ),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      message: "Check the highlighted password fields and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/profile");

  try {
    const response = await changePassword(accessToken, {
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      confirmPassword: parsed.data.confirmPassword,
    });

    return {
      message: response.message,
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not update your password."),
    };
  }
}

export async function verifyPhoneAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const nextPath = getSafeNextPath(formData.get("next"), "/sell");
  const parsed = verifyPhoneSchema.safeParse({
    phone: formData.get("phone"),
    otpCode: formData.get("otpCode"),
  });

  if (!parsed.success) {
    return {
      message: "Check the phone number and OTP code.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/verify");

  try {
    await verifyPhone(accessToken, parsed.data);
  } catch (error) {
    return {
      message: getActionMessage(
        error,
        "We could not verify that phone number.",
      ),
    };
  }

  redirect(nextPath);
}

export async function requestPhoneOtpAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = requestPhoneOtpSchema.safeParse({
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      message: "Enter a valid phone number before requesting an OTP.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken } = await requireSessionContext("/verify");

  try {
    const response = await requestPhoneOtp(accessToken, parsed.data);
    return {
      message: response.message,
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not send an OTP right now."),
    };
  }
}
