"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSavedSearch,
  createConversation,
  createListing,
  deleteSavedSearch,
  moderateListing,
  loginUser,
  MarketplaceApiError,
  markConversationRead,
  reportListing,
  requestPhoneOtp,
  registerUser,
  saveListing,
  sendConversationMessage,
  unsaveListing,
  updateListingStatus,
  updateSavedSearch,
  updateCurrentUser,
  verifyPhone,
} from "@/lib/marketplace-api";
import { type FormActionState } from "@/lib/marketplace";
import {
  isAdminRole,
  requireAdminSession,
  requireClientSession,
  requireSessionContext,
} from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";
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

const adminRegisterSchema = z.object({
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
  adminInviteCode: z
    .string()
    .trim()
    .min(6, "Admin invite code must be at least 6 characters."),
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

const sendConversationMessageSchema = z
  .object({
    conversationId: z.string().trim().optional(),
    listingId: z.string().trim().optional(),
    body: z
      .string()
      .trim()
      .min(1, "Write a message before sending.")
      .max(2000, "Keep the message under 2000 characters."),
  })
  .refine((value) => value.conversationId || value.listingId, {
    message: "Select a conversation or listing before sending a message.",
    path: ["body"],
  });

const reportListingSchema = z.object({
  listingId: z.string().trim().min(1, "Listing is required."),
  reason: z.enum([
    "SPAM",
    "FRAUD",
    "OFFENSIVE",
    "MISLEADING",
    "PROHIBITED_ITEM",
    "OTHER",
  ]),
  details: z
    .string()
    .trim()
    .max(2000, "Keep the report under 2000 characters.")
    .optional(),
  currentPath: z.string().trim().optional(),
});

const savedSearchSchema = z.object({
  label: z.string().trim().max(120, "Keep the name under 120 characters.").optional(),
  query: z.string().trim().max(120, "Keep the keyword search under 120 characters.").optional(),
  categorySlug: z.string().trim().max(120).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
  alertsEnabled: z.boolean().optional(),
});

const listingStatusActionSchema = z.enum([
  "publish",
  "archive",
  "mark_sold",
  "delete",
]);

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

function parseListingMedia(formData: FormData) {
  const media: Array<{
    fileName: string;
    mimeType: string;
    base64Data: string;
    byteSize: number;
    width?: number;
    height?: number;
    isPrimary: boolean;
    sortOrder: number;
  }> = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("photo:") || typeof value !== "string" || value.trim() === "") {
      continue;
    }

    try {
      const parsed = JSON.parse(value) as {
        name?: unknown;
        dataUrl?: unknown;
        mimeType?: unknown;
        byteSize?: unknown;
        width?: unknown;
        height?: unknown;
      };

      if (
        typeof parsed.name !== "string" ||
        typeof parsed.dataUrl !== "string" ||
        typeof parsed.mimeType !== "string" ||
        typeof parsed.byteSize !== "number" ||
        !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(parsed.dataUrl)
      ) {
        continue;
      }

      const [, mimeType, base64Data] =
        parsed.dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i) ?? [];

      if (!mimeType || !base64Data) {
        continue;
      }

      media.push({
        fileName: parsed.name,
        mimeType: mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType.toLowerCase(),
        base64Data,
        byteSize: parsed.byteSize,
        width: typeof parsed.width === "number" ? parsed.width : undefined,
        height: typeof parsed.height === "number" ? parsed.height : undefined,
        isPrimary: media.length === 0,
        sortOrder: media.length,
      });
    } catch {
      continue;
    }
  }

  return media.slice(0, 3).map((item, index) => ({
    ...item,
    isPrimary: index === 0,
    sortOrder: index,
  }));
}

export async function loginAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const nextPath = getSafeNextPath(formData.get("next"), "/dashboard");
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
    const destination = isAdminRole(session.user.role)
      ? "/admin/dashboard"
      : nextPath === "/" || nextPath.startsWith("/admin")
        ? "/dashboard"
        : nextPath;

    redirect(destination);
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not sign you in."),
    };
  }
}

export async function adminLoginAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const nextPath = getSafeNextPath(formData.get("next"), "/admin/dashboard");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      message: "Check your admin sign-in details and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  try {
    const session = await loginUser(parsed.data);
    const hasAdminAccess = isAdminRole(session.user.role);

    if (!hasAdminAccess) {
      await clearAccessToken();
      return {
        message:
          "This account does not have admin access. Use an admin or moderator account.",
      };
    }

    await setAccessToken(session.accessToken);
    const destination = isAdminRole(session.user.role)
      ? "/admin/dashboard"
      : nextPath === "/" || nextPath.startsWith("/admin")
        ? "/dashboard"
        : nextPath;

    redirect(destination);
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not sign you in to admin."),
    };
  }
}

export async function registerAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const nextPath = getSafeNextPath(formData.get("next"), "/dashboard");
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
    const destination = isAdminRole(session.user.role)
      ? "/admin/dashboard"
      : nextPath === "/" || nextPath.startsWith("/admin")
        ? "/dashboard"
        : nextPath;

    redirect(destination);
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create your account."),
    };
  }
}

export async function adminRegisterAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = adminRegisterSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    adminInviteCode: formData.get("adminInviteCode"),
  });

  if (!parsed.success) {
    return {
      message: "Check the highlighted fields and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  try {
    const session = await registerUser({
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      password: parsed.data.password,
      adminInviteCode: parsed.data.adminInviteCode,
    });
    await setAccessToken(session.accessToken);
    redirect("/admin/dashboard");
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not create the admin account."),
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

  const { accessToken } = await requireClientSession("/sell");

  try {
    const attributes = parseAttributes(formData);
    const media = parseListingMedia(formData);

    await createListing(accessToken, {
      ...parsed.data,
      currency: "AED",
      status: "ACTIVE",
      attributes,
      media,
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
  redirect("/login");
}

export async function adminLogoutAction() {
  await clearAccessToken();
  redirect("/admin/login");
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

  const { accessToken } = await requireClientSession("/profile");

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

export async function saveListingAction(listingId: string, currentPath = "/") {
  const safePath = getSafeNextPath(currentPath, "/");
  const { accessToken } = await requireClientSession(safePath);

  const response = await saveListing(accessToken, listingId);
  revalidatePath("/saved");
  revalidatePath(safePath);

  return response;
}

export async function unsaveListingAction(listingId: string, currentPath = "/") {
  const safePath = getSafeNextPath(currentPath, "/");
  const { accessToken } = await requireClientSession(safePath);

  const response = await unsaveListing(accessToken, listingId);
  revalidatePath("/saved");
  revalidatePath(safePath);

  return response;
}

export async function updateListingStatusAction(
  listingId: string,
  action: "publish" | "archive" | "mark_sold" | "delete",
  currentPath = "/my-listings"
) {
  const safePath = getSafeNextPath(currentPath, "/my-listings");
  const parsedAction = listingStatusActionSchema.parse(action);
  const { accessToken } = await requireClientSession(safePath);

  const response = await updateListingStatus(accessToken, listingId, {
    action: parsedAction,
  });

  revalidatePath("/my-listings");
  revalidatePath("/profile");
  revalidatePath(safePath);

  return response;
}

export async function createSavedSearchAction(
  payload: {
    label?: string;
    query?: string;
    categorySlug?: string;
    sort?: "newest" | "price_asc" | "price_desc";
    alertsEnabled?: boolean;
  },
  currentPath = "/search"
) {
  const safePath = getSafeNextPath(currentPath, "/search");
  const parsed = savedSearchSchema.parse(payload);
  const { accessToken } = await requireClientSession(safePath);

  const response = await createSavedSearch(accessToken, parsed);
  revalidatePath("/");
  revalidatePath("/saved");
  revalidatePath("/search");
  revalidatePath(safePath);

  return response;
}

export async function updateSavedSearchAction(
  savedSearchId: string,
  payload: {
    label?: string;
    query?: string;
    categorySlug?: string;
    sort?: "newest" | "price_asc" | "price_desc";
    alertsEnabled?: boolean;
  },
  currentPath = "/saved"
) {
  const safePath = getSafeNextPath(currentPath, "/saved");
  const parsed = savedSearchSchema.parse(payload);
  const { accessToken } = await requireClientSession(safePath);

  const response = await updateSavedSearch(accessToken, savedSearchId, parsed);
  revalidatePath("/");
  revalidatePath("/saved");
  revalidatePath("/search");
  revalidatePath(safePath);

  return response;
}

export async function deleteSavedSearchAction(
  savedSearchId: string,
  currentPath = "/saved"
) {
  const safePath = getSafeNextPath(currentPath, "/saved");
  const { accessToken } = await requireClientSession(safePath);

  const response = await deleteSavedSearch(accessToken, savedSearchId);
  revalidatePath("/");
  revalidatePath("/saved");
  revalidatePath("/search");
  revalidatePath(safePath);

  return response;
}

export async function sendConversationMessageAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = sendConversationMessageSchema.safeParse({
    conversationId: formData.get("conversationId") || undefined,
    listingId: formData.get("listingId") || undefined,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      message: "Check the conversation details and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { accessToken, user } = await requireClientSession("/messages");

  try {
    const conversation = parsed.data.conversationId
      ? await sendConversationMessage(
          accessToken,
          user.id,
          parsed.data.conversationId,
          {
            body: parsed.data.body,
          }
        )
      : await createConversation(accessToken, user.id, {
          listingId: parsed.data.listingId!,
          initialMessage: parsed.data.body,
        });

    revalidatePath("/messages");
    redirect(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not send that message."),
    };
  }
}

export async function markConversationReadAction(
  conversationId: string,
  currentPath = "/messages"
) {
  const safePath = getSafeNextPath(currentPath, "/messages");
  const { accessToken, user } = await requireClientSession(safePath);

  await markConversationRead(accessToken, user.id, conversationId);
  revalidatePath("/messages");
  revalidatePath(safePath);
}

export async function reportListingAction(
  _previousState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = reportListingSchema.safeParse({
    listingId: formData.get("listingId"),
    reason: formData.get("reason"),
    details: formData.get("details") || undefined,
    currentPath: formData.get("currentPath") || undefined,
  });

  if (!parsed.success) {
    return {
      message: "Check the report details and try again.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const safePath = getSafeNextPath(
    parsed.data.currentPath,
    `/listings/${parsed.data.listingId}`
  );
  const { accessToken } = await requireClientSession(safePath);

  try {
    await reportListing(accessToken, parsed.data.listingId, {
      reason: parsed.data.reason,
      details: parsed.data.details || undefined,
    });
    revalidatePath(safePath);

    return {
      message: "Thanks. Your report has been sent to the moderation queue.",
    };
  } catch (error) {
    return {
      message: getActionMessage(error, "We could not submit that report."),
    };
  }
}

export async function moderateListingAction(
  listingId: string,
  action:
    | "LISTING_APPROVED"
    | "LISTING_REJECTED"
    | "LISTING_REMOVED"
    | "REPORT_UNDER_REVIEW"
    | "REPORT_DISMISSED",
  reportId?: string | null,
  currentPath = "/admin/dashboard"
) {
  const safePath = getSafeNextPath(currentPath, "/admin/dashboard");
  const { accessToken } = await requireAdminSession(safePath);

  await moderateListing(accessToken, listingId, {
    action,
    reportId: reportId || undefined,
  });

  revalidatePath("/admin/dashboard");
  revalidatePath(safePath);
}
