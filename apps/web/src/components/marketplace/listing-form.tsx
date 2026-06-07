"use client";

import {
  useActionState,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { createListingAction, updateListingAction } from "@/app/(main)/actions";
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

const maxListingImages = 20;
const maxSingleImageBytes = 10 * 1024 * 1024;

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);

  if (item === undefined) {
    return items;
  }

  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ListingForm({ categories, listing }: ListingFormProps) {
  const publishingDraft = listing?.status === "Draft";
  const action = listing
    ? publishingDraft
      ? createListingAction
      : updateListingAction
    : createListingAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [categorySlug, setCategorySlug] = useState(
    listing?.categorySlug || categories[0]?.slug || "",
  );
  const [images, setImages] = useState<UploadImage[]>(
    (listing?.imageUrls ?? []).map((src, index) => ({
      id: `${src}-${index}`,
      src,
    })),
  );
  const [imageMessage, setImageMessage] = useState("");
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const category = useMemo(
    () =>
      categories.find((item) => item.slug === categorySlug) ?? categories[0],
    [categories, categorySlug],
  );

  async function addImages(files: File[]) {
    if (!files.length) {
      return;
    }

    const remaining = maxListingImages - images.length;

    if (remaining <= 0) {
      setImageMessage(
        `Each listing can have up to ${maxListingImages} images.`,
      );
      return;
    }

    const accepted = files
      .filter(
        (file) =>
          file.type.startsWith("image/") && file.size <= maxSingleImageBytes,
      )
      .slice(0, remaining);

    if (accepted.length !== files.length) {
      setImageMessage("Only image files up to 10 MB were added.");
    } else {
      setImageMessage("");
    }

    const nextImages = await Promise.all(
      accepted.map(async (file, index) => ({
        id: `${file.name}-${Date.now()}-${index}`,
        src: await readFileAsDataUrl(file),
      })),
    );

    setImages((current) => [...current, ...nextImages]);
  }

  async function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await addImages(files);
  }

  function handleFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsImageDropActive(false);
    void addImages(Array.from(event.dataTransfer.files));
  }

  function handleImageDrop(
    event: DragEvent<HTMLDivElement>,
    targetImageId: string,
  ) {
    event.preventDefault();

    if (event.dataTransfer.files.length) {
      void addImages(Array.from(event.dataTransfer.files));
      setDraggingImageId(null);
      return;
    }

    if (!draggingImageId || draggingImageId === targetImageId) {
      setDraggingImageId(null);
      return;
    }

    setImages((current) => {
      const fromIndex = current.findIndex(
        (image) => image.id === draggingImageId,
      );
      const toIndex = current.findIndex((image) => image.id === targetImageId);

      if (fromIndex < 0 || toIndex < 0) {
        return current;
      }

      return moveItem(current, fromIndex, toIndex);
    });
    setDraggingImageId(null);
  }

  function makeCover(imageId: string) {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === imageId);

      if (index <= 0) {
        return current;
      }

      return moveItem(current, index, 0);
    });
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === imageId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      return moveItem(current, index, nextIndex);
    });
  }

  return (
    <form action={formAction} className="panel grid gap-6">
      {listing ? (
        <input type="hidden" name="listingId" value={listing.id} />
      ) : null}
      {publishingDraft ? (
        <input type="hidden" name="draftListingId" value={listing.id} />
      ) : null}
      {images.map((image) => (
        <input
          key={image.id}
          type="hidden"
          name="image"
          value={image.src}
          readOnly
        />
      ))}

      <div>
        <p className="section-eyebrow">Listing details</p>
        <h2 className="mt-2 text-2xl font-black">
          {listing
            ? "Update your marketplace listing."
            : "Tell buyers what you are selling."}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          No separate seller account is needed. Use a precise title, honest
          condition details, and a few good photos.
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
            <p className="text-sm text-red-700">
              {state.fieldErrors.categorySlug}
            </p>
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
          <p className="text-sm text-red-700">
            {state.fieldErrors.description}
          </p>
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
              Add up to 20 images. Drop files to upload, then drag photos to
              reorder.
            </p>
          </div>
          <span className="text-sm font-semibold text-[var(--muted)]">
            {images.length}/{maxListingImages} images
          </span>
        </div>

        <label
          onDragEnter={(event) => {
            event.preventDefault();
            setIsImageDropActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsImageDropActive(true);
          }}
          onDragLeave={() => setIsImageDropActive(false)}
          onDrop={handleFileDrop}
          className={`mt-4 grid cursor-pointer gap-2 rounded-md border border-dashed px-5 py-6 text-center transition ${
            isImageDropActive
              ? "border-[var(--brand)] bg-[var(--brand-soft)]"
              : "border-[var(--line)] bg-white hover:border-[var(--brand)]"
          } ${images.length >= maxListingImages ? "pointer-events-none opacity-60" : ""}`}
        >
          <span className="text-base font-black">
            {isImageDropActive ? "Drop photos to add them" : "Drag photos here"}
          </span>
          <span className="text-sm text-[var(--muted)]">
            JPG, PNG, or WEBP. The first photo is the cover image.
          </span>
          <span className="mx-auto rounded-md border border-[var(--line)] px-4 py-2 text-sm font-black">
            Browse files
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={images.length >= maxListingImages}
            onChange={(event) => void handleImages(event)}
            className="hidden"
          />
        </label>

        {imageMessage ? (
          <p className="mt-3 text-sm text-[var(--accent-strong)]">
            {imageMessage}
          </p>
        ) : null}
        {images.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-5">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => setDraggingImageId(image.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleImageDrop(event, image.id)}
                onDragEnd={() => setDraggingImageId(null)}
                className={`overflow-hidden rounded-md border bg-white p-2 ${
                  draggingImageId === image.id
                    ? "border-[var(--brand)] opacity-70"
                    : "border-[var(--line)] hover:border-[var(--brand)]"
                }`}
              >
                <div className="relative overflow-hidden rounded-md">
                  <img
                    src={image.src}
                    alt=""
                    className="h-28 w-full object-cover"
                  />
                  {index === 0 ? (
                    <span className="absolute bottom-1 left-1 rounded-md bg-[var(--brand)] px-2 py-1 text-xs font-bold text-white">
                      Cover
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => makeCover(image.id)}
                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold disabled:opacity-40"
                    disabled={index === 0}
                  >
                    Cover
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setImages((current) =>
                        current.filter((item) => item.id !== image.id),
                      )
                    }
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-bold text-red-700"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(image.id, -1)}
                    disabled={index === 0}
                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(image.id, 1)}
                    disabled={index === images.length - 1}
                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold disabled:opacity-40"
                  >
                    Down
                  </button>
                </div>
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
        {pending
          ? "Saving..."
          : publishingDraft
            ? "Publish draft"
            : listing
              ? "Save listing"
              : "Create listing"}
      </button>
    </form>
  );
}
