"use client";

import { useActionState, useMemo, useState, type ChangeEvent } from "react";
import {
  createListingAction,
  updateListingAction,
} from "@/app/(main)/actions";
import {
  type FormActionState,
  type MarketplaceCategory,
  type MarketplaceListing,
} from "@/lib/marketplace";

type ListingFormProps = {
  categories: MarketplaceCategory[];
  listing?: MarketplaceListing;
};

type UploadImage = {
  id: string;
  src: string;
};

const initialState: FormActionState = {
  message: null,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ListingForm({ categories, listing }: ListingFormProps) {
  const action = listing ? updateListingAction : createListingAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [categorySlug, setCategorySlug] = useState(
    listing?.categorySlug || categories[0]?.slug || ""
  );
  const [images, setImages] = useState<UploadImage[]>(
    (listing?.imageUrls ?? []).map((src, index) => ({
      id: `${src}-${index}`,
      src,
    }))
  );
  const [imageMessage, setImageMessage] = useState("");
  const category = useMemo(
    () => categories.find((item) => item.slug === categorySlug) ?? categories[0],
    [categories, categorySlug]
  );

  async function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    const remaining = 10 - images.length;

    if (remaining <= 0) {
      setImageMessage("Each listing can have up to 10 images.");
      return;
    }

    const accepted = files
      .filter((file) => file.type.startsWith("image/") && file.size <= 1_500_000)
      .slice(0, remaining);

    if (accepted.length !== files.length) {
      setImageMessage("Only image files up to 1.5 MB were added.");
    } else {
      setImageMessage("");
    }

    const nextImages = await Promise.all(
      accepted.map(async (file, index) => ({
        id: `${file.name}-${Date.now()}-${index}`,
        src: await readFileAsDataUrl(file),
      }))
    );

    setImages((current) => [...current, ...nextImages]);
  }

  return (
    <form action={formAction} className="panel grid gap-6">
      {listing ? <input type="hidden" name="listingId" value={listing.id} /> : null}
      {images.map((image) => (
        <input key={image.id} type="hidden" name="image" value={image.src} readOnly />
      ))}

      <div>
        <p className="section-eyebrow">Listing details</p>
        <h2 className="mt-2 text-2xl font-black">
          {listing ? "Update your marketplace listing." : "Tell buyers what you are selling."}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use a precise title, honest condition details, and a few good photos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-bold">Category</span>
          <select
            name="categorySlug"
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value)}
            className="surface-input w-full text-sm"
          >
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.parentSlug ? "- " : ""}
                {item.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.categorySlug ? (
            <p className="text-sm text-red-700">{state.fieldErrors.categorySlug}</p>
          ) : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-bold">Price</span>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={listing?.priceValue ?? ""}
            className="surface-input w-full text-sm"
          />
          {state.fieldErrors?.price ? (
            <p className="text-sm text-red-700">{state.fieldErrors.price}</p>
          ) : null}
        </label>
      </div>

      <input type="hidden" name="currency" value="AED" readOnly />

      <label className="space-y-2">
        <span className="text-sm font-bold">Title</span>
        <input
          name="title"
          defaultValue={listing?.title ?? ""}
          className="surface-input w-full text-sm"
          placeholder="Clear listing title"
        />
        {state.fieldErrors?.title ? (
          <p className="text-sm text-red-700">{state.fieldErrors.title}</p>
        ) : null}
      </label>

      <label className="space-y-2">
        <span className="text-sm font-bold">Description</span>
        <textarea
          name="description"
          defaultValue={listing?.description ?? ""}
          className="surface-input min-h-32 w-full text-sm"
          placeholder="Condition, highlights, pickup details"
        />
        {state.fieldErrors?.description ? (
          <p className="text-sm text-red-700">{state.fieldErrors.description}</p>
        ) : null}
      </label>

      <label className="space-y-2">
        <span className="text-sm font-bold">Location</span>
        <input
          name="location"
          defaultValue={listing?.location ?? ""}
          className="surface-input w-full text-sm"
          placeholder="Dubai Marina"
        />
        {state.fieldErrors?.location ? (
          <p className="text-sm text-red-700">{state.fieldErrors.location}</p>
        ) : null}
      </label>

      {category?.schema.length ? (
        <div className="grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
          {category.schema.map((field) => {
            const defaultValue = listing?.attributes[field.key];

            return (
              <label key={field.key} className="space-y-2">
                <span className="text-sm font-bold">{field.label}</span>
                {field.type === "select" ? (
                  <select
                    name={`attribute:${field.key}`}
                    defaultValue={String(defaultValue ?? "")}
                    className="surface-input w-full text-sm"
                  >
                    <option value="">Select</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "toggle" ? (
                  <select
                    name={`attribute:${field.key}`}
                    defaultValue={defaultValue === true ? "true" : "false"}
                    className="surface-input w-full text-sm"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                ) : (
                  <input
                    name={`attribute:${field.key}`}
                    defaultValue={String(defaultValue ?? "")}
                    type={field.type === "number" ? "number" : "text"}
                    className="surface-input w-full text-sm"
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Photos</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Add up to 10 images. The first image becomes the cover.
            </p>
          </div>
          <label className="action-secondary cursor-pointer px-4 py-2 text-sm font-bold">
            Add photos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => void handleImages(event)}
              className="hidden"
            />
          </label>
          <span className="text-sm font-semibold text-[var(--muted)]">{images.length}/10 images</span>
        </div>
        {imageMessage ? <p className="mt-3 text-sm text-[var(--accent-strong)]">{imageMessage}</p> : null}
        {images.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-5">
            {images.map((image, index) => (
              <div key={image.id} className="relative overflow-hidden rounded-md border border-[var(--line)] bg-white">
                <img src={image.src} alt="" className="h-28 w-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    setImages((current) => current.filter((item) => item.id !== image.id))
                  }
                  className="absolute right-1 top-1 rounded-md bg-white px-2 py-1 text-xs font-bold text-[var(--foreground)]"
                >
                  Remove
                </button>
                {index === 0 ? (
                  <span className="absolute bottom-1 left-1 rounded-md bg-[var(--brand)] px-2 py-1 text-xs font-bold text-white">
                    Primary
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {state.message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="action-primary w-fit px-5 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Saving..." : listing ? "Save listing" : "Create listing"}
      </button>
    </form>
  );
}
