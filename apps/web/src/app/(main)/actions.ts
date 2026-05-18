"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  changePassword,
  createCategory,
  createListing,
  deactivateCurrentUser,
  deleteCategory,
  deleteListing,
  forgotPassword,
  googleLoginUser,
  loginUser,
  logoutAllSessions,
  logoutSession,
  MarketplaceApiError,
  moderateListing,
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
  verifyEmailToken,
  verifyPhone,
} from "@/lib/marketplace-api";
import { type ApiListingStatus, type FormActionState } from "@/lib/marketplace";
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

const googleLoginSchema = z.object({
  idToken: z.string().trim().optional(),
  accessToken: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  displayName: z.string().trim().min(2).optional(),
  googleId: z.string().trim().optional(),
}).refine((value) => value.idToken || value.email, {
  message: "Continue with Google or enter a dev-mode email.",
  path: ["idToken"],
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
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your password."),
  termsAccepted: z.literal(true, {
    error: "Accept the Terms and Privacy Policy.",
  }),
}).refine((value) => value.password === value.confirmPassword, {
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

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, "Reset token is missing."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((value) => value.password === value.confirmPassword, {
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
  price: z.coerce.number().min(0, "Price must be 0 or more."),
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

const changePasswordSchema = z.object({
  currentPassword: z.string().trim().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

const verifyPhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{6,15}$/, "Use an international phone format like +971551234567."),
  otpCode: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP code."),
});

const requestPhoneOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+\d{6,15}$/, "Use an international phone format like +971551234567."),
});

const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required."),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  parentSlug: z.string().trim().optional(),
  listingExpiryDays: z.coerce.number().int().min(1).max(365).default(30),
});

function flattenFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      .map(([key, value]) => [key, value[0] ?? "Invalid value."])
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
  return formData
    .getAll("image")
    .flatMap((value) => {
      if (typeof value !== "string" || !value.trim()) {
        return [];
      }

      return [{ url: value.trim(), altText: title }];
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

export async function loginAction(
  _previousState: FormActionState,
  formData: FormData
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
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not sign you in."),
    };
  }

  redirect(redirectPath);
}

export async function googleLoginAction(
  _previousState: FormActionState,
  formData: FormData
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
  formData: FormData
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
  formData: FormData
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
  formData: FormData
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
  formData: FormData
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
  formData: FormData
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

  try {
    const payload = {
      ...parsed.data,
      draftListingId: undefined,
      listingId: undefined,
      attributes: parseAttributes(formData),
      images: parseImages(formData, parsed.data.title),
    };

    if (parsed.data.draftListingId) {
      await publishListingDraft(accessToken, parsed.data.draftListingId, payload);
    } else {
      await createListing(accessToken, payload);
    }
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create that listing."),
    };
  }

  revalidatePath("/");
  revalidatePath("/my-listings");
  redirect("/my-listings");
}

export async function saveListingDraftAction(
  _previousState: FormActionState,
  formData: FormData
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
  formData: FormData
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
  const allowedSellerStatuses: ApiListingStatus[] = ["SOLD", "REMOVED", "PAUSED"];
  const { accessToken } = await requireSessionContext("/my-listings");

  if (listingId && allowedSellerStatuses.includes(status)) {
    await updateListing(accessToken, listingId, { status });
  }

  revalidatePath("/my-listings");
  revalidatePath(`/listings/${listingId}`);
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

export async function createCategoryAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/categories");
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
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/categories");
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
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/categories");
  const slug = String(formData.get("slug") ?? "");
  const { accessToken } = await requireSessionContext("/admin");

  if (slug) {
    await deleteCategory(accessToken, slug);
  }

  revalidatePath("/admin");
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function updateAdminUserAction(formData: FormData) {
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/users");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  const { accessToken } = await requireSessionContext("/admin/users");

  if (userId) {
    await updateAdminUser(accessToken, userId, {
      displayName: cleanOptional(String(formData.get("displayName") ?? "")),
      phone: cleanNullable(formData.get("phone")),
      avatarUrl: cleanNullable(formData.get("avatarUrl")),
      bio: cleanNullable(formData.get("bio")),
      location: cleanNullable(formData.get("location")),
      role: role === "ADMIN" || role === "USER" ? role : undefined,
      emailVerified: formData.get("emailVerified") === "true",
      phoneVerified: formData.get("phoneVerified") === "true",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath(`/admin/users/${userId}/listings`);
  revalidatePath(`/admin/users/${userId}/bookings`);
  redirect(returnTo);
}

export async function logoutAction() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    await logoutSession(refreshToken).catch(() => null);
  }

  await clearAccessToken();
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
  _formData: FormData
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
  formData: FormData
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
  formData: FormData
): Promise<FormActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: cleanOptional(String(formData.get("currentPassword") ?? "")),
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
  formData: FormData
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
      message: getActionMessage(error, "We could not verify that phone number."),
    };
  }

  redirect(nextPath);
}

export async function requestPhoneOtpAction(
  _previousState: FormActionState,
  formData: FormData
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
