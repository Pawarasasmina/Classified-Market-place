"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  boostListing,
  completeBoostPayment,
  createCategory,
  createListing,
  createListingReport,
  deleteCategory,
  deleteListing,
  googleLoginUser,
  loginUser,
  logoutSession,
  MarketplaceApiError,
  moderateListing,
  registerUser,
  requestPhoneOtp,
  updateCategory,
  updateCurrentUser,
  updateListing,
  updateListingReport,
  verifyPhone,
} from "@/lib/marketplace-api";
import {
  type ApiListingStatus,
  type ApiReportStatus,
  type FormActionState,
} from "@/lib/marketplace";
import { requireSessionContext } from "@/lib/auth-dal";
import { getPostAuthPath, getSafeNextPath } from "@/lib/redirects";
import {
  clearAccessToken,
  getRefreshToken,
  setSessionTokens,
} from "@/lib/session";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const googleLoginSchema = z.object({
  idToken: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  displayName: z.string().trim().min(2).optional(),
  googleId: z.string().trim().optional(),
});

const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\+\d{6,15}$/.test(value), {
      message: "Use an international phone format like +971551234567.",
    }),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const listingSchema = z.object({
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
  placement: z.enum(["FEATURED", "SEARCH_TOP", "CATEGORY_TOP"]),
  durationDays: z.coerce.number().int().min(1).max(30).default(7),
});

const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  parentSlug: z.string().trim().optional(),
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
    .slice(0, 10)
    .map((image, index) => ({
      ...image,
      isPrimary: index === 0,
    }));
}

function cleanOptional(value: string | undefined) {
  return value?.trim() ? value.trim() : undefined;
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
    redirectPath = getPostAuthPath(session.user, nextPath);
    revalidatePath("/", "layout");
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
  });

  if (!parsed.success) {
    return {
      message: "Check the highlighted fields and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  try {
    const session = await registerUser({
      ...parsed.data,
      phone: parsed.data.phone || undefined,
    });
    await setSessionTokens(session);
    revalidatePath("/", "layout");
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create your account."),
    };
  }

  redirect(nextPath);
}

export async function createListingAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = listingSchema.safeParse({
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

  try {
    await createListing(accessToken, {
      ...parsed.data,
      attributes: parseAttributes(formData),
      images: parseImages(formData, parsed.data.title),
    });
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create that listing."),
    };
  }

  revalidatePath("/");
  revalidatePath("/my-listings");
  redirect("/my-listings");
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

export async function boostListingAction(formData: FormData) {
  const parsed = boostListingSchema.safeParse({
    listingId: formData.get("listingId"),
    placement: formData.get("placement"),
    durationDays: formData.get("durationDays") || 7,
  });

  const { accessToken } = await requireSessionContext("/my-listings");

  if (parsed.success) {
    const boost = await boostListing(accessToken, parsed.data.listingId, {
      placement: parsed.data.placement,
      durationDays: parsed.data.durationDays,
    });

    const completedBoost = await completeBoostPayment(accessToken, boost.id, {
      durationDays: parsed.data.durationDays,
      providerRef: boost.payment?.providerRef,
    });
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

  const { accessToken } = await requireSessionContext("/profile");

  try {
    await updateCurrentUser(accessToken, {
      displayName: parsed.data.displayName,
      phone: parsed.data.phone || undefined,
      avatarUrl: parsed.data.avatarUrl,
      bio: parsed.data.bio,
      location: parsed.data.location,
    });
    revalidatePath("/profile");
    return {
      message: "Profile updated successfully.",
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not update your profile."),
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
