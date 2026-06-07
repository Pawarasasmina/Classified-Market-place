"use client";

import { useMemo, useState } from "react";
import { type AttributeField } from "@/lib/marketplace";

type EditableField = AttributeField & {
  id: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function createFieldId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `field-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toEditableField(field?: Partial<AttributeField>): EditableField {
  return {
    id: createFieldId(),
    key: field?.key ?? "",
    label: field?.label ?? "",
    type: field?.type ?? "text",
    options: field?.options ?? [],
    required: field?.required ?? false,
    placeholder: field?.placeholder ?? "",
  };
}

function toDefinition(fields: EditableField[]) {
  return {
    fields: fields
      .map((field) => ({
        key: slugify(field.key || field.label),
        label: field.label.trim(),
        type: field.type,
        required: Boolean(field.required),
        placeholder:
          field.type === "toggle"
            ? undefined
            : field.placeholder?.trim() || undefined,
        options:
          field.type === "select"
            ? (field.options ?? [])
                .map((option) => option.trim())
                .filter(Boolean)
            : undefined,
      }))
      .filter((field) => field.key && field.label),
  };
}

export function CategorySchemaEditor({
  inputName = "schemaDefinition",
  initialFields,
  inheritedFields = [],
}: {
  inputName?: string;
  initialFields?: AttributeField[];
  inheritedFields?: AttributeField[];
}) {
  const [fields, setFields] = useState<EditableField[]>(() => {
    const source = initialFields?.length ? initialFields : inheritedFields;
    return source.length ? source.map((field) => toEditableField(field)) : [];
  });

  const hiddenValue = useMemo(
    () => JSON.stringify(toDefinition(fields)),
    [fields],
  );

  function updateField(
    id: string,
    patch: Partial<Omit<EditableField, "id">>,
  ) {
    setFields((current) =>
      current.map((field) =>
        field.id === id
          ? {
              ...field,
              ...patch,
            }
          : field,
      ),
    );
  }

  function removeField(id: string) {
    setFields((current) => current.filter((field) => field.id !== id));
  }

  function moveField(id: string, direction: -1 | 1) {
    setFields((current) => {
      const index = current.findIndex((field) => field.id === id);

      if (index < 0) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  return (
    <div className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4">
      <input type="hidden" name={inputName} value={hiddenValue} readOnly />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">
            Dynamic questions
          </p>
          <p className="text-xs text-[var(--muted)]">
            Text, number, dropdown, and yes/no toggle fields are stored in
            `schemaDefinition`.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFields((current) => [...current, toEditableField()])}
          className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-bold hover:border-[var(--brand)]"
        >
          Add question
        </button>
      </div>

      {fields.length ? (
        <div className="grid gap-3">
          {fields.map((field, index) => (
            <details
              key={field.id}
              open
              className="rounded-md border border-[var(--line)] bg-white"
            >
              <summary className="cursor-pointer list-none px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {field.label.trim() || `Question ${index + 1}`}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {slugify(field.key || field.label) || "key-pending"} |{" "}
                      {field.type}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        moveField(field.id, -1);
                      }}
                      className="rounded border border-[var(--line)] px-2 py-1 text-xs font-bold"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        moveField(field.id, 1);
                      }}
                      className="rounded border border-[var(--line)] px-2 py-1 text-xs font-bold"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        removeField(field.id);
                      }}
                      className="rounded border border-[#e7b6a9] px-2 py-1 text-xs font-bold text-[#9f321e]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </summary>

              <div className="grid gap-3 border-t border-[var(--line)] px-4 py-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    Label
                  </span>
                  <input
                    value={field.label}
                    onChange={(event) =>
                      updateField(field.id, { label: event.target.value })
                    }
                    className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    placeholder="Mileage"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    Normalized key
                  </span>
                  <input
                    value={field.key}
                    onChange={(event) =>
                      updateField(field.id, { key: slugify(event.target.value) })
                    }
                    className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    placeholder="auto-generated-from-label"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    Field type
                  </span>
                  <select
                    value={field.type}
                    onChange={(event) =>
                      updateField(field.id, {
                        type: event.target.value as AttributeField["type"],
                      })
                    }
                    className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown</option>
                    <option value="toggle">Yes / No toggle</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    Placeholder
                  </span>
                  <input
                    value={field.placeholder ?? ""}
                    onChange={(event) =>
                      updateField(field.id, { placeholder: event.target.value })
                    }
                    className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    placeholder="Optional helper text"
                    disabled={field.type === "toggle"}
                  />
                </label>

                <label className="flex items-center gap-3 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(field.required)}
                    onChange={(event) =>
                      updateField(field.id, { required: event.target.checked })
                    }
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    Required answer
                  </span>
                </label>

                {field.type === "select" ? (
                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      Dropdown options
                    </span>
                    <textarea
                      value={(field.options ?? []).join("\n")}
                      onChange={(event) =>
                        updateField(field.id, {
                          options: event.target.value
                            .split(/\r?\n/)
                            .map((option) => option.trim())
                            .filter(Boolean),
                        })
                      }
                      rows={4}
                      className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                      placeholder={"New\nLike new\nUsed"}
                    />
                  </label>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-[var(--line)] bg-white px-4 py-5 text-sm text-[var(--muted)]">
          No dynamic questions yet. Add a question or keep the category simple.
        </div>
      )}
    </div>
  );
}
