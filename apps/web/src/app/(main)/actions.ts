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
  forgotPassword,
  deletePriorityRule,
  deleteSellerReview,
  deleteSellerRating,
  googleLoginUser,
  loginUser,
  logoutAllSessions,
  logoutSession,
  MarketplaceApiError,
  moderateListing,
  moderateSellerReview,
  publishListingDraft,
  registerUser,
  requestPhoneOtp,
  resendEmailVerification,
  resetPassword,
  revokeAuthSession,
  saveListingDraft,
  updateAdminUser,
  updateCategory,
  updateCurrentUser,
  updateListing,
  updateListingPriorityOverride,
  updateListingReport,
  updatePriorityRule,
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
  parentSlug: z.string().trim().optional(),
  listingExpiryDays: z.coerce.number().int().min(1).max(365).default(30),
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

function withQueryParam(path: string, params: Record<string, string>) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${new URLSearchParams(params).toString()}`;
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

  try {
    const response = await registerUser({
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      password: parsed.data.password,
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
  const parsed = walletTopUpSchema.safeParse({
    amount: formData.get("amount"),
    currency: formData.get("currency") || "AED",
  });
  const { accessToken } = await requireSessionContext("/my-listings");

  if (parsed.success) {
    const topUp = await createWalletTopUp(accessToken, parsed.data);

    await completeWalletTopUp(accessToken, topUp.transaction.id, {
      providerRef: topUp.payment?.providerRef,
    });

    revalidatePath("/my-listings");
    revalidatePath("/transactions");
    redirect("/my-listings?wallet=top-up-success");
  }

  redirect("/my-listings?wallet=top-up-invalid");
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
  const { accessToken } = await requireSessionContext("/admin/boost-packages");

  if (parsed.success && parsed.data.packageId) {
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
  }

  revalidatePath("/admin");
  revalidatePath("/admin/boost-packages");
  revalidatePath("/admin/priority-rules");
  revalidatePath("/search");
  revalidatePath("/my-listings");
  redirect("/admin/boost-packages");
}

export async function deleteBoostPackageAction(formData: FormData) {
  const packageId = String(formData.get("packageId") ?? "");
  const { accessToken } = await requireSessionContext("/admin/boost-packages");

  if (packageId) {
    await deleteBoostPackage(accessToken, packageId);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/boost-packages");
  revalidatePath("/my-listings");
  redirect("/admin/boost-packages");
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
  const { accessToken } = await requireSessionContext("/admin/priority-rules");

  if (parsed.success && parsed.data.ruleId) {
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
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/priority-rules");
  redirect("/admin/priority-rules");
}

export async function deletePriorityRuleAction(formData: FormData) {
  const ruleId = String(formData.get("ruleId") ?? "");
  const { accessToken } = await requireSessionContext("/admin/priority-rules");

  if (ruleId) {
    await deletePriorityRule(accessToken, ruleId);
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/priority-rules");
  redirect("/admin/priority-rules");
}

export async function updateAdminUserAction(formData: FormData) {
  const returnTo = cleanOptional(String(formData.get("returnTo") ?? ""));
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
  const { accessToken } = await requireSessionContext("/admin/users");

  if (parsed.success) {
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
  }

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/reports/seller-approvals");
  redirect(returnTo?.startsWith("/admin") ? returnTo : "/admin/users");
}

export async function moderateListingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "") as ApiListingStatus;
  const { accessToken } = await requireSessionContext("/admin");

  if (listingId && status) {
    await moderateListing(accessToken, listingId, status);
  }

  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateListingPriorityOverrideAction(formData: FormData) {
  const scoreInput = cleanOptional(String(formData.get("score") ?? ""));
  const startsAtInput = cleanOptional(String(formData.get("startsAt") ?? ""));
  const startsAtDate = startsAtInput ? new Date(startsAtInput) : null;
  const expiresAtInput = cleanOptional(String(formData.get("expiresAt") ?? ""));
  const expiresAtDate = expiresAtInput ? new Date(expiresAtInput) : null;

  if (startsAtDate && Number.isNaN(startsAtDate.getTime())) {
    redirect("/admin?priority=invalid#priority-overrides");
  }

  if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
    redirect("/admin?priority=invalid#priority-overrides");
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
    redirect("/admin?priority=invalid#priority-overrides");
  }

  const { accessToken } = await requireSessionContext("/admin");

  await updateListingPriorityOverride(accessToken, parsed.data.listingId, {
    paid: parsed.data.paid,
    promoted: parsed.data.promoted,
    pinned: parsed.data.pinned,
    score: parsed.data.score,
    startsAt: parsed.data.startsAt,
    expiresAt: parsed.data.expiresAt,
  });

  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/admin");
  redirect("/admin?priority=updated#priority-overrides");
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
      parentSlug: cleanOptional(parsed.data.parentSlug),
      listingExpiryDays: parsed.data.listingExpiryDays,
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

export async function updateCategoryAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/categories",
  );
  const slug = String(formData.get("slug") ?? "");
  const name = cleanOptional(String(formData.get("name") ?? ""));
  const description = cleanOptional(String(formData.get("description") ?? ""));
  const listingExpiryDays = Number(formData.get("listingExpiryDays") ?? 30);
  const parentSlug = formData.has("parentSlug")
    ? String(formData.get("parentSlug") ?? "")
    : undefined;
  const isActive = formData.get("isActive") === "true";
  const { accessToken } = await requireSessionContext("/admin");

  if (slug) {
    await updateCategory(accessToken, slug, {
      name,
      description,
      parentSlug,
      isActive,
      listingExpiryDays: Number.isFinite(listingExpiryDays)
        ? listingExpiryDays
        : undefined,
    });
  }

  revalidatePath("/admin");
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function deleteCategoryAction(formData: FormData) {
  const returnTo = getSafeNextPath(
    formData.get("returnTo"),
    "/admin/categories",
  );
  const slug = String(formData.get("slug") ?? "");
  const { accessToken } = await requireSessionContext("/admin");

  if (slug) {
    await deleteCategory(accessToken, slug);
  }

  revalidatePath("/admin");
  revalidatePath(returnTo);
  redirect(returnTo);
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
  _formData: FormData,
): Promise<FormActionState> {
  void _previousState;
  void _formData;

  const { accessToken } = await requireSessionContext("/verify-email");

  try {
    const response = await resendEmailVerification(accessToken);
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
