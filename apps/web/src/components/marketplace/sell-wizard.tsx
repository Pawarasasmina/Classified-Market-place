"use client";

import NextImage from "next/image";
import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { createListingAction } from "@/app/(main)/actions";
import { type FormActionState, type MarketplaceCategory } from "@/lib/marketplace";

type UploadedImage = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  sizeLabel: string;
  byteSize: number;
  width: number;
  height: number;
};

type DraftState = {
  categorySlug: string;
  title: string;
  description: string;
  price: string;
  location: string;
  attributes: Record<string, string | boolean>;
  images: UploadedImage[];
};

type StoredDraftState = Omit<DraftState, "images"> & {
  imageNames?: string[];
};

const draftKey = "phase1-sell-draft";
const maxListingImages = 3;
const maxSingleImageBytes = 1_500_000;
const maxCombinedImageBytes = 4_500_000;
const initialState: FormActionState = {
  message: null,
};

function getStoredDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = window.localStorage.getItem(draftKey);
  return existing ? (JSON.parse(existing) as StoredDraftState) : null;
}

function buildInitialDraft(categories: MarketplaceCategory[]) {
  return {
    categorySlug: categories[0]?.slug ?? "",
    title: "",
    description: "",
    price: "",
    location: "",
    attributes: {},
    images: [],
  } satisfies DraftState;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildStoredDraft(draft: DraftState): StoredDraftState {
  return {
    categorySlug: draft.categorySlug,
    title: draft.title,
    description: draft.description,
    price: draft.price,
    location: draft.location,
    attributes: draft.attributes,
    imageNames: draft.images.map((image) => image.name),
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read image."));
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = dataUrl;
  });
}

function scaleDimensions(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

async function optimizeImage(file: File) {
  const originalDataUrl = await fileToDataUrl(file);
  const source = await loadImage(originalDataUrl);
  const dimensions = scaleDimensions(source.width, source.height, 960);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");

  if (!context) {
    return {
      dataUrl: originalDataUrl,
      mimeType: file.type || "image/jpeg",
      sizeLabel: formatBytes(file.size),
      byteSize: file.size,
      width: source.width,
      height: source.height,
    };
  }

  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);

  const outputType = "image/jpeg";
  const dataUrl = canvas.toDataURL(outputType, 0.72);
  const base64 = dataUrl.split(",")[1] ?? "";
  const approxBytes = Math.floor((base64.length * 3) / 4);

  return {
    dataUrl,
    mimeType: outputType,
    sizeLabel: formatBytes(approxBytes),
    byteSize: approxBytes,
    width: dimensions.width,
    height: dimensions.height,
  };
}

async function prepareUploadedImage(file: File, index: number) {
  const optimized = await optimizeImage(file);

  return {
    id: `${file.name}-${Date.now()}-${index}`,
    name: file.name,
    dataUrl: optimized.dataUrl,
    mimeType: optimized.mimeType,
    sizeLabel: optimized.sizeLabel,
    byteSize: optimized.byteSize,
    width: optimized.width,
    height: optimized.height,
  } satisfies UploadedImage;
}

export function SellWizard({ categories }: { categories: MarketplaceCategory[] }) {
  const [state, formAction, pending] = useActionState(
    createListingAction,
    initialState
  );
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<DraftState>(() => buildInitialDraft(categories));
  const [savedAt, setSavedAt] = useState<string>("Not saved yet");
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);

  const category =
    categories.find((item) => item.slug === draft.categorySlug) ?? categories[0];

  useEffect(() => {
    const stored = getStoredDraft();

    const handle = window.setTimeout(() => {
      if (stored) {
        setDraft({
          categorySlug: stored.categorySlug || categories[0]?.slug || "",
          title: stored.title ?? "",
          description: stored.description ?? "",
          price: stored.price ?? "",
          location: stored.location ?? "",
          attributes: stored.attributes ?? {},
          images: [],
        });

        if (stored.imageNames?.length) {
          setSavedAt("Recovered draft. Re-upload photos for this Phase 1 flow.");
          setPhotoMessage(
            `Recovered ${stored.imageNames.length} saved photo name${stored.imageNames.length === 1 ? "" : "s"}. Re-upload the actual files before publishing.`
          );
        } else {
          setSavedAt("Recovered draft from local storage");
        }
      }

      setHasRecoveredDraft(true);
    }, 0);

    return () => window.clearTimeout(handle);
  }, [categories]);

  useEffect(() => {
    if (!hasRecoveredDraft) {
      return;
    }

    const handle = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify(buildStoredDraft(draft)));
      setSavedAt(`Auto-saved at ${new Date().toLocaleTimeString()}`);
    }, 500);

    return () => window.clearTimeout(handle);
  }, [draft, hasRecoveredDraft]);

  function updateAttribute(key: string, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      attributes: {
        ...current.attributes,
        [key]: value,
      },
    }));
  }

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!selectedFiles.length) {
      return;
    }

    const remainingSlots = maxListingImages - draft.images.length;

    if (remainingSlots <= 0) {
      setPhotoMessage(`You can upload up to ${maxListingImages} photos in Phase 1.`);
      return;
    }

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));

    if (!imageFiles.length) {
      setPhotoMessage("Choose image files in JPG, PNG, or WEBP format.");
      return;
    }

    const acceptedFiles = imageFiles.slice(0, remainingSlots);

    if (acceptedFiles.length < selectedFiles.length) {
      setPhotoMessage(
        `Only ${remainingSlots} more photo slot${remainingSlots === 1 ? " is" : "s are"} available right now.`
      );
    } else {
      setPhotoMessage(null);
    }

    setIsPreparingImages(true);

    try {
      const startingIndex = draft.images.length;
      const preparedImages = await Promise.all(
        acceptedFiles.map((file, index) =>
          prepareUploadedImage(file, startingIndex + index)
        )
      );

      const oversizedImage = preparedImages.find(
        (image) => image.byteSize > maxSingleImageBytes
      );

      if (oversizedImage) {
        setPhotoMessage(
          `${oversizedImage.name} is still too large after optimization. Try a smaller photo or crop it first.`
        );
        return;
      }

      const combinedSize =
        draft.images.reduce((total, image) => total + image.byteSize, 0) +
        preparedImages.reduce((total, image) => total + image.byteSize, 0);

      if (combinedSize > maxCombinedImageBytes) {
        setPhotoMessage(
          "These photos are too large to submit together in Phase 1. Keep fewer images or use smaller files."
        );
        return;
      }

      setDraft((current) => ({
        ...current,
        images: [...current.images, ...preparedImages],
      }));
    } catch {
      setPhotoMessage("We could not prepare those images. Try another file.");
    } finally {
      setIsPreparingImages(false);
    }
  }

  function removeImage(imageId: string) {
    setDraft((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== imageId),
    }));
  }

  function makePrimary(imageId: string) {
    setDraft((current) => {
      const selectedImage = current.images.find((image) => image.id === imageId);

      if (!selectedImage) {
        return current;
      }

      return {
        ...current,
        images: [
          selectedImage,
          ...current.images.filter((image) => image.id !== imageId),
        ],
      };
    });
  }

  if (!category) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-sm text-[var(--muted)]">
        No categories are available yet. Seed the category catalog in the API and
        reload this page.
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
      <input type="hidden" name="categorySlug" value={draft.categorySlug} readOnly />
      <input type="hidden" name="title" value={draft.title} readOnly />
      <input type="hidden" name="description" value={draft.description} readOnly />
      <input type="hidden" name="price" value={draft.price} readOnly />
      <input type="hidden" name="location" value={draft.location} readOnly />
      {Object.entries(draft.attributes).map(([key, value]) => (
        <input
          key={key}
          type="hidden"
          name={`attribute:${key}`}
          value={String(value)}
          readOnly
        />
      ))}
      {draft.images.map((image, index) => (
        <input
          key={image.id}
          type="hidden"
          name={`photo:${index}`}
          value={JSON.stringify({
            name: image.name,
            dataUrl: image.dataUrl,
            mimeType: image.mimeType,
            byteSize: image.byteSize,
            width: image.width,
            height: image.height,
          })}
          readOnly
        />
      ))}

      <div className="space-y-6 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Listing wizard
            </p>
            <h2 className="display-font mt-2 text-2xl font-bold text-[var(--foreground)]">
              Category to details to photos to price to publish
            </h2>
          </div>
          <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[var(--muted)]">
            {savedAt}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          {["Category", "Attributes", "Photos", "Pricing", "Review"].map(
            (label, index) => {
              const active = step === index + 1;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index + 1)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                    active
                      ? "border-transparent bg-[var(--brand)] text-[var(--foreground)]"
                      : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]"
                  }`}
                >
                  0{index + 1} {label}
                </button>
              );
            }
          )}
        </div>

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() =>
                  setDraft((current) => ({ ...current, categorySlug: item.slug }))
                }
                className={`rounded-[1.75rem] border p-5 text-left ${
                  item.slug === draft.categorySlug
                    ? "border-transparent bg-[var(--brand)] text-[var(--foreground)]"
                    : "border-[var(--line)] bg-[var(--surface-strong)]"
                }`}
              >
                <p className="text-xs uppercase tracking-[0.2em] opacity-70">
                  {item.countLabel}
                </p>
                <h3 className="display-font mt-3 text-xl font-bold">
                  {item.name}
                </h3>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Listing title
                </span>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
                  placeholder="Enter a clear listing title"
                />
                {state.fieldErrors?.title ? (
                  <p className="text-sm text-[#b93820]">{state.fieldErrors.title}</p>
                ) : null}
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Short description
                </span>
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
                  placeholder="Condition, highlights, and why it stands out"
                />
                {state.fieldErrors?.description ? (
                  <p className="text-sm text-[#b93820]">
                    {state.fieldErrors.description}
                  </p>
                ) : null}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {category.schema.map((field) => (
                <label key={field.key} className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {field.label}
                  </span>

                  {field.type === "select" ? (
                    <select
                      value={String(draft.attributes[field.key] ?? "")}
                      onChange={(event) => updateAttribute(field.key, event.target.value)}
                      className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "toggle" ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateAttribute(field.key, !(draft.attributes[field.key] === true))
                      }
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                        draft.attributes[field.key] === true
                          ? "border-transparent bg-[var(--brand)] text-[var(--foreground)]"
                          : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]"
                      }`}
                    >
                      <span>{field.label}</span>
                      <span>{draft.attributes[field.key] === true ? "Yes" : "No"}</span>
                    </button>
                  ) : (
                    <input
                      value={String(draft.attributes[field.key] ?? "")}
                      onChange={(event) => updateAttribute(field.key, event.target.value)}
                      className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
                      placeholder={field.placeholder}
                      type={field.type === "number" ? "number" : "text"}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Upload up to {maxListingImages} photos. The first photo becomes the
                primary card image after publish.
              </p>
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {draft.images.length}/{maxListingImages} ready
              </span>
            </div>

            {draft.images.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {draft.images.map((image, index) => (
                  <div
                    key={image.id}
                    className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4"
                  >
                    <div className="relative h-32 overflow-hidden rounded-2xl bg-[var(--surface)]">
                      <NextImage
                        src={image.dataUrl}
                        alt={image.name}
                        fill
                        unoptimized
                        sizes="(max-width: 1280px) 100vw, 20vw"
                        className="object-cover"
                      />
                      {index === 0 ? (
                        <span className="absolute left-3 top-3 rounded-full bg-[rgba(18,18,18,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 truncate text-sm font-semibold text-[var(--foreground)]">
                      {image.name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Optimized for Phase 1 submit - {image.sizeLabel}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => makePrimary(image.id)}
                        className="rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
                      >
                        {index === 0 ? "Primary photo" : "Make primary"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        className="rounded-full border border-[rgba(185,56,32,0.22)] px-3 py-2 text-xs font-semibold text-[#8f2e1c]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-6 py-10 text-center">
                <p className="display-font text-xl font-bold text-[var(--foreground)]">
                  Upload listing photos
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  JPG, PNG, or WEBP files work well here. Photos preview locally
                  right away and are submitted with the listing in this Phase 1 flow.
                  Smaller photos work best here.
                </p>
              </div>
            )}

            {photoMessage ? (
              <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
                {photoMessage}
              </p>
            ) : null}

            <label className="inline-flex cursor-pointer items-center rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent)]">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleImageSelection}
                className="sr-only"
                disabled={isPreparingImages || draft.images.length >= maxListingImages}
              />
              {isPreparingImages
                ? "Preparing photos..."
                : draft.images.length
                  ? "Add another photo"
                  : "Choose photos"}
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Price
              </span>
              <input
                value={draft.price}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, price: event.target.value }))
                }
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
                placeholder="AED 12,500"
              />
              {state.fieldErrors?.price ? (
                <p className="text-sm text-[#b93820]">{state.fieldErrors.price}</p>
              ) : null}
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Location
              </span>
              <input
                value={draft.location}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, location: event.target.value }))
                }
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm outline-none"
                placeholder="Dubai Marina"
              />
              {state.fieldErrors?.location ? (
                <p className="text-sm text-[#b93820]">{state.fieldErrors.location}</p>
              ) : null}
            </label>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Review snapshot
            </p>
            <h3 className="display-font mt-3 text-2xl font-bold text-[var(--foreground)]">
              {draft.title || "Untitled listing"}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {category.name} - {draft.location || "Location pending"} -{" "}
              {draft.price || "Price pending"}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {draft.images.length
                ? `${draft.images.length} photo${draft.images.length === 1 ? "" : "s"} ready for submit`
                : "No photos selected yet"}
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {draft.description || "Add a short description to complete the review."}
            </p>

            {state.message ? (
              <p className="mt-4 rounded-2xl border border-[rgba(185,56,32,0.18)] bg-[rgba(255,243,240,0.95)] px-4 py-3 text-sm text-[#8f2e1c]">
                {state.message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending || isPreparingImages}
              className="mt-6 rounded-full bg-[linear-gradient(135deg,#6668E8,#4F57D8)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? "Publishing..." : "Publish listing"}
            </button>
          </div>
        ) : null}

        {state.fieldErrors?.categorySlug ? (
          <p className="text-sm text-[#b93820]">{state.fieldErrors.categorySlug}</p>
        ) : null}

        <div className="flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(5, current + 1))}
            className="rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Next step
          </button>
        </div>
      </div>

      <aside className="space-y-4 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
        <h3 className="display-font text-xl font-bold text-[var(--foreground)]">
          Integration notes
        </h3>
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Category fields come from the live categories endpoint.</li>
          <li>Draft is auto-saved locally to mimic MVP draft recovery.</li>
          <li>Photos preview locally and submit with the listing in Phase 1.</li>
          <li>Uploaded image binaries are not rehydrated from local storage yet.</li>
          <li>Final submit creates a real listing through the API.</li>
        </ul>
      </aside>
    </form>
  );
}
