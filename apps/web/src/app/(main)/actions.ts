"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createListing,
  loginUser,
  MarketplaceApiError,
  requestPhoneOtp,
  registerUser,
  updateCurrentUser,
  verifyPhone,
} from "@/lib/marketplace-api";
import { type FormActionState } from "@/lib/marketplace";
import { requireSessionContext } from "@/lib/auth-dal";
import { appendNextParam, getSafeNextPath } from "@/lib/redirects";
import { clearAccessToken, setAccessToken } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
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

const createListingSchema = z.object({
  categorySlug: z.string().trim().min(1, "Choose a category."),
  title: z.string().trim().min(3, "Title must be at least 3 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters."),
  price: z.coerce.number().min(0, "Price must be 0 or more."),
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
    if (!key.startsWith("attribute:") || typeof value !== "string" || value.trim() === "") {
      continue;
    }

    const attributeKey = key.replace("attribute:", "");
    const trimmed = value.trim();

    if (trimmed === "true") {
      attributes[attributeKey] = true;
      continue;
    }

    if (trimmed === "false") {
      attributes[attributeKey] = false;
      continue;
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      attributes[attributeKey] = Number(trimmed);
      continue;
    }

    attributes[attributeKey] = trimmed;
  }

  return attributes;
}

function parseListingPhotos(formData: FormData) {
  const photos: { name: string; src: string; isPrimary: boolean }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("photo:") || typeof value !== "string" || value.trim() === "") {
      continue;
    }

    try {
      const parsed = JSON.parse(value) as {
        name?: unknown;
        dataUrl?: unknown;
      };

      if (
        typeof parsed.name !== "string" ||
        typeof parsed.dataUrl !== "string" ||
        !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(parsed.dataUrl)
      ) {
        continue;
      }

      photos.push({
        name: parsed.name,
        src: parsed.dataUrl,
        isPrimary: photos.length === 0,
      });
    } catch {
      continue;
    }
  }

  return photos.slice(0, 3);
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

  try {
    const session = await loginUser(parsed.data);
    await setAccessToken(session.accessToken);

    redirect(
      session.user.phoneVerified
        ? nextPath
        : appendNextParam("/verify", nextPath)
    );
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not sign you in."),
    };
  }
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
    await setAccessToken(session.accessToken);

    redirect(
      session.user.phoneVerified
        ? nextPath
        : appendNextParam("/verify", nextPath)
    );
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create your account."),
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
    redirect(nextPath);
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not verify that phone number."),
    };
  }
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

export async function createListingAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createListingSchema.safeParse({
    categorySlug: formData.get("categorySlug"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    location: formData.get("location"),
  });

  if (!parsed.success) {
    return {
      message: "Complete the required listing details before publishing.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken, user } = await requireSessionContext("/sell");

  if (!user.phoneVerified) {
    redirect(appendNextParam("/verify", "/sell"));
  }

  try {
    const attributes = parseAttributes(formData);
    const photos = parseListingPhotos(formData);

    if (photos.length) {
      attributes.__photos = photos;
    }

    await createListing(accessToken, {
      ...parsed.data,
      currency: "AED",
      status: "ACTIVE",
      attributes,
    });

    redirect("/my-listings");
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not publish that listing."),
    };
  }
}

export async function logoutAction() {
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
    });
    return {
      message: "Profile updated successfully.",
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not update your profile."),
    };
  }
}
