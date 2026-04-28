"use client";

import { useEffect, useState } from "react";
import { categories } from "@/lib/phase1-data";

type DraftState = {
  categorySlug: string;
  title: string;
  description: string;
  price: string;
  location: string;
  attributes: Record<string, string | boolean>;
  images: string[];
};

const draftKey = "phase1-sell-draft";

const initialDraft: DraftState = {
  categorySlug: categories[0]?.slug ?? "",
  title: "",
  description: "",
  price: "",
  location: "",
  attributes: {},
  images: ["front-view.jpg", "detail-shot.jpg"],
};

function getStoredDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = window.localStorage.getItem(draftKey);
  return existing ? (JSON.parse(existing) as DraftState) : null;
}

export function SellWizard() {
  const [step, setStep] = useState(1);
  const [savedAt, setSavedAt] = useState<string>(() =>
    getStoredDraft() ? "Recovered draft from local storage" : "Not saved yet"
  );
  const [draft, setDraft] = useState<DraftState>(() => getStoredDraft() ?? initialDraft);

  const category =
    categories.find((item) => item.slug === draft.categorySlug) ?? categories[0];

  useEffect(() => {
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setSavedAt(`Auto-saved at ${new Date().toLocaleTimeString()}`);
    }, 500);

    return () => window.clearTimeout(handle);
  }, [draft]);

  function updateAttribute(key: string, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      attributes: {
        ...current.attributes,
        [key]: value,
      },
    }));
  }

  function addImage() {
    setDraft((current) => ({
      ...current,
      images: [...current.images, `upload-${current.images.length + 1}.jpg`],
    }));
  }

  function publish() {
    setSavedAt("Listing reviewed and ready for publish handoff");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
      <div className="space-y-6 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.84)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Phase 1 listing wizard
            </p>
            <h2 className="display-font mt-2 text-2xl font-bold text-[var(--foreground)]">
              Category → details → photos → price → review
            </h2>
          </div>
          <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-[var(--muted)]">
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
                      ? "border-transparent bg-[var(--foreground)] text-[var(--surface)]"
                      : "border-[var(--line)] bg-white text-[var(--muted)]"
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
                    ? "border-transparent bg-[var(--foreground)] text-[var(--surface)]"
                    : "border-[var(--line)] bg-white"
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
                  className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Enter a clear listing title"
                />
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
                  className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Condition, highlights, and why it stands out"
                />
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
                      className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
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
                          ? "border-transparent bg-[var(--foreground)] text-[var(--surface)]"
                          : "border-[var(--line)] bg-white text-[var(--muted)]"
                      }`}
                    >
                      <span>{field.label}</span>
                      <span>{draft.attributes[field.key] === true ? "Yes" : "No"}</span>
                    </button>
                  ) : (
                    <input
                      value={String(draft.attributes[field.key] ?? "")}
                      onChange={(event) => updateAttribute(field.key, event.target.value)}
                      className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {draft.images.map((image) => (
                <div
                  key={image}
                  className="rounded-[1.75rem] border border-[var(--line)] bg-white p-4"
                >
                  <div className="h-28 rounded-2xl bg-[linear-gradient(135deg,#f5c2af,#f8efe4)]" />
                  <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                    {image}
                  </p>
                  <p className="text-xs text-[var(--muted)]">Primary image ready</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addImage}
              className="rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent)]"
            >
              Add another photo
            </button>
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
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                placeholder="AED 12,500"
              />
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
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                placeholder="Dubai Marina"
              />
            </label>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="rounded-[1.75rem] border border-[var(--line)] bg-white p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Review snapshot
            </p>
            <h3 className="display-font mt-3 text-2xl font-bold text-[var(--foreground)]">
              {draft.title || "Untitled listing"}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {category.name} • {draft.location || "Location pending"} •{" "}
              {draft.price || "Price pending"}
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {draft.description || "Add a short description to complete the review."}
            </p>

            <button
              type="button"
              onClick={publish}
              className="mt-6 rounded-full bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-3 text-sm font-semibold text-white"
            >
              Mark ready for publish
            </button>
          </div>
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
            className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--surface)]"
          >
            Next step
          </button>
        </div>
      </div>

      <aside className="space-y-4 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.84)] p-6">
        <h3 className="display-font text-xl font-bold text-[var(--foreground)]">
          Phase 1 scope notes
        </h3>
        <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
          <li>Dynamic attributes come from the selected category schema.</li>
          <li>Draft is auto-saved locally to mimic MVP draft recovery.</li>
          <li>Photo step is mocked for presigned upload and ordering support.</li>
          <li>Publishing is staged for backend listing-service integration.</li>
        </ul>
      </aside>
    </div>
  );
}
