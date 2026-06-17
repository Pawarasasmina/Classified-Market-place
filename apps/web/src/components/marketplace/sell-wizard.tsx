"use client";

import NextImage from "next/image";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  createListingAction,
  saveListingDraftAction,
} from "@/app/(main)/actions";
import { LocationPicker } from "@/components/marketplace/location-picker";
import {
  type AttributeField,
  type FormActionState,
  type MarketplaceCategory,
} from "@/lib/marketplace";

type UploadedImage = {
  id: string;
  name: string;
  dataUrl: string;
  sizeLabel: string;
  byteSize: number;
};

type DraftState = {
  clientDraftKey: string;
  draftListingId?: string;
  categorySlug: string;
  title: string;
  description: string;
  price: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  attributes: Record<string, string | boolean>;
  images: UploadedImage[];
};

type CategoryNode = MarketplaceCategory & {
  nestedChildren: CategoryNode[];
};

type StepKey = "category" | "details" | "photos" | "price" | "review";

const initialState: FormActionState = {
  message: null,
};

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "category", label: "Category" },
  { key: "details", label: "Details" },
  { key: "photos", label: "Photos" },
  { key: "price", label: "Price" },
  { key: "review", label: "Review" },
];

const stepDescriptions: Record<StepKey, string> = {
  category: "Place your listing in the exact branch buyers are already browsing.",
  details: "Write a sharp title, a convincing description, and all required specs.",
  photos: "Use clean photos and drag the best image into the cover position.",
  price: "Set a clear price and location so buyers can assess the offer quickly.",
  review: "Check the final listing snapshot before sending it for approval.",
};

const draftStorageKey = "classified-marketplace-sell-wizard-draft";
const maxListingImages = 20;
const maxSingleImageBytes = 10 * 1024 * 1024;

function createDraftKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildCategoryTree(categories: MarketplaceCategory[]) {
  const childrenByParent = new Map<string, MarketplaceCategory[]>();
  const categorySlugs = new Set(categories.map((category) => category.slug));
  const roots: MarketplaceCategory[] = [];

  for (const category of categories) {
    if (category.parentSlug && categorySlugs.has(category.parentSlug)) {
      const children = childrenByParent.get(category.parentSlug) ?? [];
      children.push(category);
      childrenByParent.set(category.parentSlug, children);
    } else {
      roots.push(category);
    }
  }

  function attach(category: MarketplaceCategory): CategoryNode {
    return {
      ...category,
      nestedChildren: (childrenByParent.get(category.slug) ?? []).map(attach),
    };
  }

  return roots.map(attach);
}

function getCategoryPath(category: MarketplaceCategory, categories: MarketplaceCategory[]) {
  const path = [category.name];
  const bySlug = new Map(categories.map((item) => [item.slug, item]));
  let parentSlug = category.parentSlug;
  const seen = new Set([category.slug]);

  while (parentSlug && !seen.has(parentSlug)) {
    const parent = bySlug.get(parentSlug);

    if (!parent) {
      break;
    }

    path.unshift(parent.name);
    seen.add(parent.slug);
    parentSlug = parent.parentSlug;
  }

  return path.join(" / ");
}

function findCategoryNode(nodes: CategoryNode[], slug?: string): CategoryNode | undefined {
  if (!slug) {
    return undefined;
  }

  for (const node of nodes) {
    if (node.slug === slug) {
      return node;
    }

    const child = findCategoryNode(node.nestedChildren, slug);

    if (child) {
      return child;
    }
  }

  return undefined;
}

function getCategoryNodePath(nodes: CategoryNode[], slug?: string): CategoryNode[] {
  if (!slug) {
    return [];
  }

  for (const node of nodes) {
    if (node.slug === slug) {
      return [node];
    }

    const childPath = getCategoryNodePath(node.nestedChildren, slug);

    if (childPath.length) {
      return [node, ...childPath];
    }
  }

  return [];
}

function buildInitialDraft(categories: MarketplaceCategory[]): DraftState {
  const firstSelectable =
    categories.find((category) => !category.parentSlug) ?? categories[0];

  return {
    clientDraftKey: createDraftKey(),
    categorySlug: firstSelectable?.slug ?? "",
    title: "",
    description: "",
    price: "",
    location: "",
    latitude: null,
    longitude: null,
    attributes: {},
    images: [],
  };
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
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

async function prepareUploadedImage(file: File, index: number) {
  const originalDataUrl = await fileToDataUrl(file);
  const source = await loadImage(originalDataUrl);
  const dimensions = scaleDimensions(source.width, source.height, 1600);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext("2d");

  if (!context) {
    return {
      id: `${file.name}-${Date.now()}-${index}`,
      name: file.name,
      dataUrl: originalDataUrl,
      sizeLabel: formatBytes(file.size),
      byteSize: file.size,
    } satisfies UploadedImage;
  }

  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = dataUrl.split(",")[1] ?? "";
  const byteSize = Math.floor((base64.length * 3) / 4);

  return {
    id: `${file.name}-${Date.now()}-${index}`,
    name: file.name,
    dataUrl,
    sizeLabel: formatBytes(byteSize),
    byteSize,
  } satisfies UploadedImage;
}

function hasDraftContent(draft: DraftState) {
  return Boolean(
    draft.title.trim() ||
      draft.description.trim() ||
      draft.price.trim() ||
      draft.location.trim() ||
      draft.latitude != null ||
      draft.longitude != null ||
      draft.images.length ||
      Object.values(draft.attributes).some((value) => String(value).trim())
  );
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);

  if (item === undefined) {
    return items;
  }

  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function HiddenListingInputs({ draft }: { draft: DraftState }) {
  return (
    <>
      <input type="hidden" name="clientDraftKey" value={draft.clientDraftKey} />
      <input type="hidden" name="draftListingId" value={draft.draftListingId ?? ""} />
      <input type="hidden" name="categorySlug" value={draft.categorySlug} />
      <input type="hidden" name="title" value={draft.title} />
      <input type="hidden" name="description" value={draft.description} />
      <input type="hidden" name="price" value={draft.price} />
      <input type="hidden" name="currency" value="AED" />
      <input type="hidden" name="location" value={draft.location} />
      <input type="hidden" name="latitude" value={draft.latitude ?? ""} />
      <input type="hidden" name="longitude" value={draft.longitude ?? ""} />
      {Object.entries(draft.attributes).map(([key, value]) => (
        <input
          key={key}
          type="hidden"
          name={`attribute:${key}`}
          value={String(value)}
        />
      ))}
      {draft.images.map((image) => (
        <input key={image.id} type="hidden" name="image" value={image.dataUrl} />
      ))}
    </>
  );
}

function fieldValueLabel(field: AttributeField, value: string | boolean | undefined) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return value || `No ${field.label.toLowerCase()} added`;
}

function hasSelectedListingLocation(draft: DraftState) {
  return Boolean(
    draft.location.trim() ||
      (draft.latitude != null && draft.longitude != null),
  );
}

export function SellWizard({ categories }: { categories: MarketplaceCategory[] }) {
  const [publishState, publishAction, publishPending] = useActionState(
    createListingAction,
    initialState
  );
  const [draftState, draftAction, draftPending] = useActionState(
    saveListingDraftAction,
    initialState
  );
  const draftFormRef = useRef<HTMLFormElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<DraftState>(() => buildInitialDraft(categories));
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [isPhotoDropActive, setIsPhotoDropActive] = useState(false);
  const [categoryBrowsePath, setCategoryBrowsePath] = useState<string[]>([]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const category =
    categories.find((item) => item.slug === draft.categorySlug) ?? categories[0];
  const selectedCategoryNode = useMemo(
    () => findCategoryNode(categoryTree, category?.slug),
    [categoryTree, category?.slug]
  );
  const browsingParentSlug =
    categoryBrowsePath.length > 0
      ? categoryBrowsePath[categoryBrowsePath.length - 1]
      : undefined;
  const browsingParentNode = useMemo(
    () => findCategoryNode(categoryTree, browsingParentSlug),
    [categoryTree, browsingParentSlug]
  );
  const browsingPathNodes = useMemo(
    () => getCategoryNodePath(categoryTree, browsingParentSlug),
    [categoryTree, browsingParentSlug]
  );
  const visibleCategoryNodes = browsingParentNode
    ? browsingParentNode.nestedChildren
    : categoryTree;
  const selectedCategoryPath = category
    ? getCategoryPath(category, categories)
    : "No category selected";
  const selectedCategoryChildCount =
    selectedCategoryNode?.nestedChildren.length ?? category?.children?.length ?? 0;
  const categoryCanList = Boolean(category && selectedCategoryChildCount === 0);
  const step = steps[stepIndex];
  const currentStepNumber = stepIndex + 1;
  const completedChecks = [
    Boolean(categoryCanList),
    Boolean(draft.title.trim() && draft.description.trim().length >= 10),
    draft.images.length > 0,
    Boolean(draft.price.trim() && hasSelectedListingLocation(draft)),
  ];
  const completedStepCount = completedChecks.filter(Boolean).length;
  const progressPercent = Math.round((completedStepCount / completedChecks.length) * 100);
  const effectiveDraft = useMemo(
    () =>
      draftState.draftListingId &&
      draftState.draftListingId !== draft.draftListingId
        ? { ...draft, draftListingId: draftState.draftListingId }
        : draft,
    [draft, draftState.draftListingId]
  );

  useEffect(() => {
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore browser storage cleanup issues and keep the wizard usable.
    }
  }, []);

  useEffect(() => {
    const handle = window.setInterval(() => {
      if (hasDraftContent(draft)) {
        draftFormRef.current?.requestSubmit();
      }
    }, 30000);

    return () => window.clearInterval(handle);
  }, [draft]);

  function updateDraft(patch: Partial<DraftState>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateAttribute(key: string, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      attributes: {
        ...current.attributes,
        [key]: value,
      },
    }));
  }

  function handleCategoryChoice(node: CategoryNode) {
    updateDraft({ categorySlug: node.slug, attributes: {} });
    setStepMessage(null);

    if (node.nestedChildren.length) {
      setCategoryBrowsePath((current) => [...current, node.slug]);
    }
  }

  function goToCategoryPath(index: number) {
    setCategoryBrowsePath(browsingPathNodes.slice(0, index + 1).map((node) => node.slug));
  }

  function renderAttributeFieldInput(field: AttributeField) {
    if (field.type === "select") {
      return (
        <select
          value={String(draft.attributes[field.key] ?? "")}
          onChange={(event) => updateAttribute(field.key, event.target.value)}
          className="surface-input sell-wizard-form-control w-full text-sm"
        >
          <option value="">Select {field.label}</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "toggle") {
      return (
        <button
          type="button"
          onClick={() =>
            updateAttribute(field.key, !(draft.attributes[field.key] === true))
          }
          className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm font-bold ${
            draft.attributes[field.key] === true
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
              : "border-[var(--line)] text-[var(--muted)]"
          }`}
        >
          <span>{field.label}</span>
          <span>{draft.attributes[field.key] === true ? "Yes" : "No"}</span>
        </button>
      );
    }

    return (
      <input
        value={String(draft.attributes[field.key] ?? "")}
        onChange={(event) => updateAttribute(field.key, event.target.value)}
        className="surface-input sell-wizard-form-control w-full text-sm"
        type={field.type === "number" ? "number" : "text"}
      />
    );
  }

  function validateStep(targetStep = stepIndex) {
    if (targetStep === 0 && !categoryCanList) {
      return "Choose a final category or a category with listing fields.";
    }

    if (targetStep === 1) {
      if (draft.title.trim().length < 3) {
        return "Add a clear title before moving ahead.";
      }

      if (draft.description.trim().length < 10) {
        return "Add a short but useful description.";
      }

      const missingRequiredField = category?.schema.find(
        (field) => field.required && !String(draft.attributes[field.key] ?? "").trim()
      );

      if (missingRequiredField) {
        return `${missingRequiredField.label} is required for this category.`;
      }
    }

    if (targetStep === 3) {
      if (!draft.price.trim()) {
        return "Add the listing price.";
      }

      if (!hasSelectedListingLocation(draft)) {
        return "Add the listing location.";
      }
    }

    return null;
  }

  function goToStep(nextStepIndex: number) {
    if (nextStepIndex <= stepIndex) {
      setStepIndex(nextStepIndex);
      setStepMessage(null);
      return;
    }

    for (let index = stepIndex; index < nextStepIndex; index += 1) {
      const message = validateStep(index);

      if (message) {
        setStepMessage(message);
        return;
      }
    }

    setStepMessage(null);
    setStepIndex(nextStepIndex);
  }

  async function addImageFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) {
      return;
    }

    const remainingSlots = maxListingImages - draft.images.length;

    if (remainingSlots <= 0) {
      setPhotoMessage(`You can upload up to ${maxListingImages} photos.`);
      return;
    }

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
    const oversizedOriginal = imageFiles.find((file) => file.size > maxSingleImageBytes);

    if (oversizedOriginal) {
      setPhotoMessage(`${oversizedOriginal.name} is larger than 10MB.`);
      return;
    }

    const acceptedFiles = imageFiles.slice(0, remainingSlots);

    if (!acceptedFiles.length) {
      setPhotoMessage("Choose image files in JPG, PNG, or WEBP format.");
      return;
    }

    if (acceptedFiles.length < selectedFiles.length) {
      setPhotoMessage(
        `Only ${remainingSlots} more photo slot${remainingSlots === 1 ? " is" : "s are"} available.`
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
      const oversizedPrepared = preparedImages.find(
        (image) => image.byteSize > maxSingleImageBytes
      );

      if (oversizedPrepared) {
        setPhotoMessage(
          `${oversizedPrepared.name} is still larger than 10MB after preparation.`
        );
        return;
      }

      setDraft((current) => ({
        ...current,
        images: [...current.images, ...preparedImages],
      }));
    } catch {
      setPhotoMessage("We could not prepare those photos. Try different files.");
    } finally {
      setIsPreparingImages(false);
    }
  }

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    await addImageFiles(selectedFiles);
  }

  function removeImage(imageId: string) {
    setDraft((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== imageId),
    }));
  }

  function makeCover(imageId: string) {
    setDraft((current) => {
      const index = current.images.findIndex((image) => image.id === imageId);

      if (index <= 0) {
        return current;
      }

      return {
        ...current,
        images: moveItem(current.images, index, 0),
      };
    });
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setDraft((current) => {
      const index = current.images.findIndex((image) => image.id === imageId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.images.length) {
        return current;
      }

      return {
        ...current,
        images: moveItem(current.images, index, nextIndex),
      };
    });
  }

  function handlePhotoFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsPhotoDropActive(false);

    if (isPreparingImages) {
      return;
    }

    void addImageFiles(Array.from(event.dataTransfer.files));
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>, targetImageId: string) {
    event.preventDefault();

    if (event.dataTransfer.files.length) {
      void addImageFiles(Array.from(event.dataTransfer.files));
      setDraggingImageId(null);
      return;
    }

    if (!draggingImageId || draggingImageId === targetImageId) {
      setDraggingImageId(null);
      return;
    }

    setDraft((current) => {
      const fromIndex = current.images.findIndex((image) => image.id === draggingImageId);
      const toIndex = current.images.findIndex((image) => image.id === targetImageId);

      if (fromIndex < 0 || toIndex < 0) {
        return current;
      }

      return {
        ...current,
        images: moveItem(current.images, fromIndex, toIndex),
      };
    });
    setDraggingImageId(null);
  }

  if (!category) {
    return (
      <div className="panel">
        No active categories are available yet. Add categories in the admin area first.
      </div>
    );
  }

  return (
    <>
      <form
        id="listing-draft-form"
        ref={draftFormRef}
        action={draftAction}
        className="hidden"
      >
        <HiddenListingInputs draft={effectiveDraft} />
      </form>

      <form
        action={publishAction}
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_22rem]"
      >
        <HiddenListingInputs draft={effectiveDraft} />

        <section className="panel sell-wizard-shell grid h-fit gap-4 self-start">
          {stepMessage ? (
            <p className="rounded-md border border-[#e7b6a9] bg-[#fff3ef] px-4 py-3 text-sm font-semibold text-[#9f321e]">
              {stepMessage}
            </p>
          ) : null}

          {step.key === "category" ? (
            <div className="sell-wizard-taxonomy-stage">
              <div className="sell-wizard-taxonomy-head">
                <p className="section-eyebrow">Choose category</p>
                <h3>Select a category</h3>
                <p>Pick the closest branch, then continue filling the form from the right panel.</p>
              </div>

              <div className="sell-wizard-taxonomy-panel">
                <div className="sell-wizard-taxonomy-trail">
                  <button
                    type="button"
                    onClick={() => setCategoryBrowsePath([])}
                    className="sell-wizard-taxonomy-root"
                  >
                    All categories
                  </button>
                  <span aria-hidden="true">/</span>
                  {browsingPathNodes.length ? (
                    browsingPathNodes.map((node, index) => (
                      <button
                        key={node.slug}
                        type="button"
                        onClick={() => goToCategoryPath(index)}
                        className="sell-wizard-taxonomy-crumb"
                      >
                        {node.name}
                      </button>
                    ))
                  ) : (
                    <span className="sell-wizard-taxonomy-current">
                      {category.name}
                    </span>
                  )}
                </div>

                <div className="sell-wizard-taxonomy-status">
                  <div>
                    <span className="sell-wizard-taxonomy-status-label">
                      Current selection
                    </span>
                    <strong>{selectedCategoryPath}</strong>
                  </div>
                  <span
                    className={`sell-wizard-taxonomy-badge ${
                      categoryCanList
                        ? "sell-wizard-taxonomy-badge-ready"
                        : "sell-wizard-taxonomy-badge-pending"
                    }`}
                  >
                    {categoryCanList ? "Ready to list" : "Choose a subcategory"}
                  </span>
                </div>

                {categoryBrowsePath.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryBrowsePath((current) => current.slice(0, -1))
                    }
                    className="sell-wizard-taxonomy-back"
                  >
                    Back to previous level
                  </button>
                ) : null}

                <div className="sell-wizard-taxonomy-list" role="list">
                {visibleCategoryNodes.map((node) => {
                  const selected = node.slug === draft.categorySlug;
                  const hasChildren = node.nestedChildren.length > 0;

                  return (
                    <button
                      key={node.slug}
                      type="button"
                      onClick={() => handleCategoryChoice(node)}
                      className={`sell-wizard-taxonomy-row ${
                        selected
                          ? "sell-wizard-taxonomy-row-selected"
                          : ""
                      }`}
                      role="listitem"
                    >
                      <span className="sell-wizard-taxonomy-row-copy">
                        <strong>{node.name}</strong>
                        <span>
                          {hasChildren
                            ? `${node.nestedChildren.length} subcategories`
                            : `${node.schema.length} listing fields`}
                        </span>
                      </span>
                      <span className="sell-wizard-taxonomy-row-arrow" aria-hidden="true">
                        {hasChildren ? ">" : "+"}
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>

              {!visibleCategoryNodes.length ? (
                <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                  No subcategories are available here. Go back and choose another
                  category.
                </p>
              ) : null}

              {!categoryCanList ? (
                <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                  This is a parent category. Choose a child category for the real
                  listing fields.
                </p>
              ) : null}
            </div>
          ) : null}

          {step.key === "details" ? (
            <div className="grid gap-5">
              <div className="sell-wizard-highlight-card text-sm font-semibold text-[var(--muted)]">
                {getCategoryPath(category, categories)} uses {category.schema.length} dynamic field{category.schema.length === 1 ? "" : "s"}.
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Listing title</span>
                  <input
                    value={draft.title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    className="surface-input sell-wizard-form-control w-full text-sm"
                  />
                  {publishState.fieldErrors?.title ? (
                    <p className="text-sm text-red-700">{publishState.fieldErrors.title}</p>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold">Description</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => updateDraft({ description: event.target.value })}
                    className="surface-input sell-wizard-form-control sell-wizard-form-textarea w-full text-sm"
                  />
                  {publishState.fieldErrors?.description ? (
                    <p className="text-sm text-red-700">{publishState.fieldErrors.description}</p>
                  ) : null}
                </label>
              </div>

              {category.schema.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {category.schema.map((field) => (
                    <label key={field.key} className="grid gap-2">
                      <span className="text-sm font-bold">
                        {field.label}
                        {field.required ? " *" : ""}
                      </span>
                      {renderAttributeFieldInput(field)}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {step.key === "photos" ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">Photos</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Add up to 20 images. Each original file can be up to 10MB.
                    Drag photos to reorder them; the first photo is the cover.
                  </p>
                </div>
                <span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-bold text-[var(--muted)]">
                  {draft.images.length}/{maxListingImages}
                </span>
              </div>

              <label
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsPhotoDropActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsPhotoDropActive(true);
                }}
                onDragLeave={() => setIsPhotoDropActive(false)}
                onDrop={handlePhotoFileDrop}
                className={`sell-wizard-photo-dropzone ${
                  isPhotoDropActive
                    ? "sell-wizard-photo-dropzone-active"
                    : "sell-wizard-photo-dropzone-idle"
                } ${
                  isPreparingImages || draft.images.length >= maxListingImages
                    ? "pointer-events-none opacity-60"
                    : ""
                }`}
              >
                <span className="sell-wizard-photo-dropzone-title">
                  {isPreparingImages
                    ? "Preparing photos..."
                    : isPhotoDropActive
                      ? "Drop photos to add them"
                      : "Drag photos here"}
                </span>
                <span className="text-sm text-[var(--muted)]">
                  JPG, PNG, or WEBP. Up to 20 photos, 10MB each.
                </span>
                <span className="sell-wizard-photo-dropzone-button">Browse files</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  disabled={isPreparingImages || draft.images.length >= maxListingImages}
                  onChange={handleImageSelection}
                  className="hidden"
                />
              </label>

              {draft.images.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {draft.images.map((image, index) => (
                    <div
                      key={image.id}
                      draggable
                      onDragStart={() => setDraggingImageId(image.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleImageDrop(event, image.id)}
                      onDragEnd={() => setDraggingImageId(null)}
                    className={`sell-wizard-photo-card group ${
                        draggingImageId === image.id
                          ? "sell-wizard-photo-card-dragging"
                          : "sell-wizard-photo-card-idle"
                      }`}
                    >
                      <div className="relative h-36 overflow-hidden rounded-md bg-[var(--surface-strong)]">
                        <NextImage
                          src={image.dataUrl}
                          alt={image.name}
                          fill
                          unoptimized
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                        />
                        {index === 0 ? (
                          <span className="absolute left-2 top-2 rounded-md bg-[var(--brand)] px-2 py-1 text-xs font-black text-white">
                            Cover
                          </span>
                        ) : null}
                        <span className="absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-1 text-xs font-black text-[var(--foreground)] opacity-0 transition group-hover:opacity-100">
                          Drag to reorder
                        </span>
                      </div>
                      <p className="mt-3 truncate text-sm font-bold">
                        {image.name}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{image.sizeLabel}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => makeCover(image.id)}
                          className="rounded-md border border-[var(--line)] px-2 py-2 text-xs font-bold"
                        >
                          Cover
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="rounded-md border border-red-200 px-2 py-2 text-xs font-bold text-red-700"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(image.id, -1)}
                          disabled={index === 0}
                          className="rounded-md border border-[var(--line)] px-2 py-2 text-xs font-bold disabled:opacity-40"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(image.id, 1)}
                          disabled={index === draft.images.length - 1}
                          className="rounded-md border border-[var(--line)] px-2 py-2 text-xs font-bold disabled:opacity-40"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sell-wizard-preview-empty">
                  <strong>No photos added yet</strong>
                  <p>Add your first images here. The first photo will become the cover.</p>
                </div>
              )}

              {photoMessage ? (
                <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                  {photoMessage}
                </p>
              ) : null}

            </div>
          ) : null}

          {step.key === "price" ? (
            <div className="grid gap-4">
              <div className="sell-wizard-highlight-card sell-wizard-price-banner">
                <div>
                  <p className="section-eyebrow">Pricing</p>
                  <h3 className="mt-2 text-xl font-black">Set a clear asking price</h3>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  Buyers respond faster when the amount and pickup area are obvious at a glance.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Price</span>
                  <input
                    value={draft.price}
                    onChange={(event) => updateDraft({ price: event.target.value })}
                    type="number"
                    min="0"
                    step="0.01"
                    className="surface-input sell-wizard-form-control w-full text-sm"
                  />
                  {publishState.fieldErrors?.price ? (
                    <p className="text-sm text-red-700">{publishState.fieldErrors.price}</p>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold">Location</span>
                  <LocationPicker
                    location={draft.location}
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    onChange={(value) =>
                      updateDraft({
                        location: value.location,
                        latitude: value.latitude,
                        longitude: value.longitude,
                      })
                    }
                    rootClassName="grid gap-2"
                    triggerClassName="inline-flex w-fit items-center gap-2 rounded-[1.1rem] border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
                  />
                  {publishState.fieldErrors?.location ? (
                    <p className="text-sm text-red-700">{publishState.fieldErrors.location}</p>
                  ) : null}
                </label>
              </div>
            </div>
          ) : null}

          {step.key === "review" ? (
            <div className="grid gap-5">
              <div className="sell-wizard-review-hero">
                <p className="section-eyebrow">Review listing</p>
                <h3 className="mt-2 text-2xl font-black">
                  {draft.title || "Untitled listing"}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {getCategoryPath(category, categories)} / {draft.location || "Location missing"} / AED {draft.price || "0"}
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  {draft.description || "Description missing."}
                </p>
              </div>

              {draft.images.length ? (
                <div className="grid gap-3 sm:grid-cols-4">
                  {draft.images.slice(0, 8).map((image, index) => (
                    <div
                      key={image.id}
                      className="relative h-28 overflow-hidden rounded-md bg-[var(--surface-strong)]"
                    >
                      <NextImage
                        src={image.dataUrl}
                        alt={image.name}
                        fill
                        unoptimized
                        sizes="25vw"
                        className="object-cover"
                      />
                      {index === 0 ? (
                        <span className="absolute left-2 top-2 rounded-md bg-[var(--brand)] px-2 py-1 text-xs font-black text-white">
                          Cover
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {category.schema.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {category.schema.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
                    >
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                        {field.label}
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {fieldValueLabel(field, draft.attributes[field.key])}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

            </div>
          ) : null}

          <div className="sell-wizard-footer-actions">
            <button
              type="button"
              onClick={() => goToStep(Math.max(0, stepIndex - 1))}
              disabled={stepIndex === 0}
              className="sell-wizard-footer-button sell-wizard-footer-button-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <div className="sell-wizard-footer-button-group">
              {stepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToStep(Math.min(steps.length - 1, stepIndex + 1))}
                  className="sell-wizard-footer-button sell-wizard-footer-button-primary"
                >
                  Next step
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="sell-wizard-sidebar grid h-fit gap-4 xl:sticky xl:top-24">
          <div className="panel sell-wizard-sidebar-card sell-wizard-sidebar-workspace">
            <p className="section-eyebrow">Step workspace</p>
            <div className="sell-wizard-sidebar-progress">
              <div className="sell-wizard-progress-bar" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <strong>{progressPercent}% ready to publish</strong>
            </div>
            <div className="sell-wizard-sidebar-step-meta">
              <strong>{step.label}</strong>
              <span>{stepDescriptions[step.key]}</span>
            </div>
            <div className="sell-wizard-sidebar-steps">
              {steps.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`sell-wizard-sidebar-step-item ${
                    index === stepIndex
                      ? "sell-wizard-sidebar-step-item-active"
                      : index < stepIndex
                        ? "sell-wizard-sidebar-step-item-complete"
                        : ""
                  }`}
                >
                  <span>0{index + 1}</span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            <div className="sell-wizard-sidebar-meta-grid">
              <div className="sell-wizard-sidebar-meta">
                <span>Category</span>
                <strong>{getCategoryPath(category, categories)}</strong>
              </div>
              <div className="sell-wizard-sidebar-meta">
                <span>Draft sync</span>
                <strong>
                  {draftState.savedAt
                    ? `Saved at ${new Date(draftState.savedAt).toLocaleTimeString()}`
                    : effectiveDraft.draftListingId
                      ? "Backend draft connected"
                      : "Backend draft will sync automatically"}
                </strong>
              </div>
            </div>
            {draftState.message ? (
              <p className="text-sm font-semibold text-[var(--brand-strong)]">
                {draftState.message}
              </p>
            ) : null}
            {step.key === "review" ? (
              <div className="grid gap-4">
                <div className="sell-wizard-sidebar-note">
                  Everything looks ready here. Review the full listing on the left, then publish when you are happy.
                </div>
                {publishState.message ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {publishState.message}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={publishPending || isPreparingImages}
                  className="action-primary w-full px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishPending ? "Publishing..." : "Publish listing"}
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </form>
    </>
  );
}
