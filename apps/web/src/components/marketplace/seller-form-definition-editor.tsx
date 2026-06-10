"use client";

import { useEffect, useState } from "react";
import type { ApiSellerFormField } from "@/lib/marketplace";

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type EditableField = ApiSellerFormField & {
  id: string;
};

function createField(index: number): EditableField {
  return {
    id: `seller-field-${index}-${Date.now()}`,
    key: "",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    helpText: "",
    options: [],
    sortOrder: (index + 1) * 10,
  };
}

export function SellerFormDefinitionEditor({
  initialFields,
}: {
  initialFields: ApiSellerFormField[];
}) {
  const [fields, setFields] = useState<EditableField[]>(
    initialFields.length
      ? initialFields.map((field, index) => ({
          ...field,
          id: `${field.key}-${index}`,
          options: field.options ?? [],
          sortOrder: field.sortOrder ?? (index + 1) * 10,
        }))
      : [createField(0)],
  );

  useEffect(() => {
    const input = document.getElementById(
      "seller-schema-definition",
    ) as HTMLInputElement | null;

    if (!input) {
      return;
    }

    input.value = JSON.stringify({
      fields: fields.map((field) => ({
        key: normalizeKey(field.key || field.label),
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
        helpText: field.helpText,
        options: field.type === "select" ? field.options ?? [] : undefined,
        sortOrder: field.sortOrder,
      })),
    });
  }, [fields]);

  return (
    <div className="grid gap-4">
      <input id="seller-schema-definition" type="hidden" name="schemaDefinition" />
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="admin-form-section"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="admin-form-section-head">
              <p className="admin-form-section-title">Field {index + 1}</p>
              <p className="admin-form-section-copy">
                {normalizeKey(field.key || field.label) || "Key will be generated from the label"}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFields((current) =>
                  current.length === 1
                    ? [createField(0)]
                    : current.filter((item) => item.id !== field.id),
                )
              }
              className="text-xs font-bold text-[#b93820]"
            >
              Remove
            </button>
          </div>
          <div className="admin-form-grid md:grid-cols-2">
            <label className="admin-field">
              <span className="admin-field-label">Label</span>
              <input
                value={field.label}
                onChange={(event) =>
                  setFields((current) =>
                    current.map((item) =>
                      item.id === field.id
                        ? {
                            ...item,
                            label: event.target.value,
                            key: item.key || normalizeKey(event.target.value),
                          }
                        : item,
                    ),
                  )
                }
                className="surface-input w-full text-sm"
              />
              <span className="admin-field-help">
                The human-readable question shown to sellers.
              </span>
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Key</span>
              <input
                value={field.key}
                onChange={(event) =>
                  setFields((current) =>
                    current.map((item) =>
                      item.id === field.id
                        ? { ...item, key: normalizeKey(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="surface-input w-full text-sm"
              />
              <span className="admin-field-help">
                Stored key used by admin review and profile data.
              </span>
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Type</span>
              <select
                value={field.type}
                onChange={(event) =>
                  setFields((current) =>
                    current.map((item) =>
                      item.id === field.id
                        ? {
                            ...item,
                            type: event.target.value as ApiSellerFormField["type"],
                          }
                        : item,
                    ),
                  )
                }
                className="surface-input w-full text-sm"
              >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="select">Dropdown</option>
                <option value="toggle">Yes/No</option>
                <option value="file">File upload</option>
              </select>
            </label>
            <label className="admin-field">
              <span className="admin-field-label">Sort order</span>
              <input
                type="number"
                value={field.sortOrder ?? 0}
                onChange={(event) =>
                  setFields((current) =>
                    current.map((item) =>
                      item.id === field.id
                        ? { ...item, sortOrder: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="surface-input w-full text-sm"
              />
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-field-label">Placeholder</span>
              <input
                value={field.placeholder ?? ""}
                onChange={(event) =>
                  setFields((current) =>
                    current.map((item) =>
                      item.id === field.id
                        ? { ...item, placeholder: event.target.value }
                        : item,
                    ),
                  )
                }
                className="surface-input w-full text-sm"
              />
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-field-label">Help text</span>
              <input
                value={field.helpText ?? ""}
                onChange={(event) =>
                  setFields((current) =>
                    current.map((item) =>
                      item.id === field.id
                        ? { ...item, helpText: event.target.value }
                        : item,
                    ),
                  )
                }
                className="surface-input w-full text-sm"
              />
            </label>
            {field.type === "select" ? (
              <label className="admin-field md:col-span-2">
                <span className="admin-field-label">Options</span>
                <textarea
                  value={(field.options ?? []).join("\n")}
                  onChange={(event) =>
                    setFields((current) =>
                      current.map((item) =>
                        item.id === field.id
                          ? {
                              ...item,
                              options: event.target.value
                                .split("\n")
                                .map((option) => option.trim())
                                .filter(Boolean),
                            }
                          : item,
                      ),
                    )
                  }
                  rows={4}
                  className="surface-input min-h-24 w-full text-sm"
                />
                <span className="admin-field-help">
                  Add one dropdown option per line.
                </span>
              </label>
            ) : null}
            <label className="admin-toggle md:col-span-2">
              <span className="admin-toggle-copy">
                <span>Required field</span>
                <span>Sellers must answer this before submitting.</span>
              </span>
              <input
                type="checkbox"
                checked={field.required ?? false}
                onChange={(event) =>
                  setFields((current) =>
                    current.map((item) =>
                      item.id === field.id
                        ? { ...item, required: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setFields((current) => [...current, createField(current.length)])
        }
        className="action-secondary px-4 py-3 text-sm font-bold"
      >
        Add seller field
      </button>
    </div>
  );
}
