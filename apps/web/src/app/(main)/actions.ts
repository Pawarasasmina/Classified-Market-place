"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createCategory,
  createListing,
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
  verifyPhone,
} from "@/lib/marketplace-api";
import { type ApiListingStatus, type FormActionState } from "@/lib/marketplace";
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
  price: z.coerce.number().min(0, "Price must be 0 or more."),
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
    .slice(0, 10)
    .map((image, index) => ({
      ...image,
      isPrimary: index === 0,
    }));
}

function cleanOptional(value: string | undefined) {
  return value?.trim() ? value.trim() : undefined;
}

export async function loginAction(
  _previousState: FormActionState,
  formData: FormData
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
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create your account."),
    };
  }

  redirect(nextPath);
}

export async function createListingAction(
  _previousState: FormActionState,
  formData: FormData
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
  const returnTo = getSafeNextPath(formData.get("returnTo"), "/admin/categories");
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

export async function logoutAction() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    await logoutSession(refreshToken).catch(() => null);
  }

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
