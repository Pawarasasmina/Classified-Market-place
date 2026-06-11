"use client";

import { useActionState, useMemo, useState, type ChangeEvent } from "react";
import { bulkImportCategoriesAction } from "@/app/(main)/actions";
import { AdminSubmitButton } from "@/components/marketplace/admin-form-feedback";
import {
  type AttributeField,
  type FormActionState,
  type MarketplaceCategory,
} from "@/lib/marketplace";

type ImportFieldKey =
  | "name"
  | "slug"
  | "description"
  | "parentName"
  | "parentSlug"
  | "listingExpiryDays"
  | "isActive"
  | "sortOrder";

type ParsedSheet = {
  delimiter: string;
  headers: string[];
  rows: string[][];
};

type PreviewRow = {
  hasAnyValue: boolean;
  missingName: boolean;
  payload: {
    description?: string;
    dynamicQuestionCount?: number;
    isActive?: boolean;
    listingExpiryDays?: number;
    name?: string;
    parentName?: string;
    parentSlug?: string;
    schemaDefinition?: {
      fields: AttributeField[];
    };
    slug?: string;
    sortOrder?: number;
    useParentQuestions?: boolean;
  };
  rowNumber: number;
};

type QuestionColumnGroup = Partial<
  Record<
    "key" | "label" | "options" | "placeholder" | "required" | "type",
    string
  >
> & {
  index: number;
};

const initialState: FormActionState = {
  message: null,
};

const importFieldOptions: Array<{
  description: string;
  key: ImportFieldKey;
  label: string;
  required?: boolean;
}> = [
  {
    key: "name",
    label: "Category name",
    description: "Required. Each row's category or subcategory name.",
    required: true,
  },
  {
    key: "slug",
    label: "Category slug",
    description:
      "Optional. If blank, the system will generate it from the name.",
  },
  {
    key: "description",
    label: "Description",
    description: "Optional public description for the category.",
  },
  {
    key: "parentName",
    label: "Parent category name",
    description:
      "Optional. Good when your sheet uses readable main-category names.",
  },
  {
    key: "parentSlug",
    label: "Parent category slug",
    description: "Optional. Best for exact parent matching.",
  },
  {
    key: "listingExpiryDays",
    label: "Listing expiry days",
    description: "Optional numeric value such as 30 or 60.",
  },
  {
    key: "isActive",
    label: "Is active",
    description: "Optional true/false, yes/no, 1/0, or active/inactive.",
  },
  {
    key: "sortOrder",
    label: "Sort order",
    description: "Optional numeric sort position.",
  },
];

const sampleCsvRows = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Phones, gadgets, and consumer devices",
    parent_name: "",
    parent_slug: "",
    listing_expiry_days: 30,
    is_active: true,
    sort_order: 0,
    use_parent_questions: false,
    question_1_label: "Brand",
    question_1_key: "brand",
    question_1_type: "text",
    question_1_required: true,
    question_1_placeholder: "Apple",
    question_1_options: "",
    question_2_label: "Condition",
    question_2_key: "condition",
    question_2_type: "select",
    question_2_required: true,
    question_2_placeholder: "",
    question_2_options: "New|Like new|Used",
  },
  {
    name: "Mobile Phones",
    slug: "mobile-phones",
    description: "Smartphones and accessories",
    parent_name: "Electronics",
    parent_slug: "electronics",
    listing_expiry_days: 30,
    is_active: true,
    sort_order: 1,
    use_parent_questions: true,
    question_1_label: "",
    question_1_key: "",
    question_1_type: "",
    question_1_required: "",
    question_1_placeholder: "",
    question_1_options: "",
    question_2_label: "",
    question_2_key: "",
    question_2_type: "",
    question_2_required: "",
    question_2_placeholder: "",
    question_2_options: "",
  },
  {
    name: "Laptops",
    slug: "laptops",
    description: "Personal and business laptops",
    parent_name: "Electronics",
    parent_slug: "electronics",
    listing_expiry_days: 30,
    is_active: true,
    sort_order: 2,
    use_parent_questions: false,
    question_1_label: "RAM",
    question_1_key: "ram",
    question_1_type: "text",
    question_1_required: false,
    question_1_placeholder: "16GB",
    question_1_options: "",
    question_2_label: "Warranty available",
    question_2_key: "warranty",
    question_2_type: "toggle",
    question_2_required: false,
    question_2_placeholder: "",
    question_2_options: "",
  },
];

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function detectDelimiter(input: string) {
  const sampleLine =
    input.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const candidates = [",", ";", "\t", "|"];
  const scored = candidates.map((delimiter) => ({
    delimiter,
    count: sampleLine.split(delimiter).length,
  }));
  scored.sort((left, right) => right.count - left.count);

  return scored[0]?.count > 1 ? scored[0].delimiter : ",";
}

function parseDelimitedText(input: string): ParsedSheet {
  const delimiter = detectDelimiter(input);
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (!insideQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  const nonEmptyRows = rows.filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  const [headerRow = [], ...dataRows] = nonEmptyRows;

  return {
    delimiter,
    headers: headerRow.map((cell) => cell.trim()),
    rows: dataRows,
  };
}

function csvEscape(value: unknown) {
  const stringValue = value == null ? "" : String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return;
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function suggestMappings(headers: string[]) {
  const synonyms: Record<ImportFieldKey, string[]> = {
    name: [
      "name",
      "category",
      "categoryname",
      "subcategory",
      "subcategoryname",
    ],
    slug: ["slug", "categoryslug"],
    description: ["description", "details", "summary"],
    parentName: ["parent", "parentname", "maincategory", "maincategoryname"],
    parentSlug: ["parentslug", "maincategoryslug"],
    listingExpiryDays: [
      "listingexpirydays",
      "expirydays",
      "listingexpiry",
      "days",
    ],
    isActive: ["isactive", "active", "status"],
    sortOrder: ["sortorder", "order", "position"],
  };

  return importFieldOptions.reduce<Record<ImportFieldKey, string>>(
    (acc, field) => {
      const match = headers.find((header) =>
        synonyms[field.key].includes(normalizeHeader(header)),
      );
      acc[field.key] = match ?? "";
      return acc;
    },
    {} as Record<ImportFieldKey, string>,
  );
}

function parseBooleanValue(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (["true", "yes", "1", "active", "enabled"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "0", "inactive", "disabled"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parseNumberValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseQuestionType(value: string): AttributeField["type"] {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "number" ||
    normalized === "select" ||
    normalized === "toggle"
  ) {
    return normalized;
  }

  if (normalized === "yesno" || normalized === "yes/no") {
    return "toggle";
  }

  return "text";
}

function parseQuestionOptions(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const separator = trimmed.includes("|")
    ? "|"
    : trimmed.includes("\n")
      ? "\n"
      : trimmed.includes(",")
        ? ","
        : null;

  if (!separator) {
    return [trimmed];
  }

  return trimmed
    .split(separator)
    .map((option) => option.trim())
    .filter(Boolean);
}

function findOptionalHeader(headers: string[], supportedNames: string[]) {
  const supported = new Set(
    supportedNames.map((name) => normalizeHeader(name)),
  );
  return headers.find((header) => supported.has(normalizeHeader(header)));
}

function getQuestionColumnGroups(headers: string[]): QuestionColumnGroup[] {
  const groups = new Map<number, QuestionColumnGroup>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const match = normalized.match(
      /^question(\d+)(key|label|type|required|placeholder|options)$/,
    );

    if (!match) {
      continue;
    }

    const [, indexValue, suffix] = match;
    const index = Number(indexValue);
    const group = groups.get(index) ?? { index };
    group[suffix as keyof Omit<QuestionColumnGroup, "index">] = header;
    groups.set(index, group);
  }

  return [...groups.values()].sort((left, right) => left.index - right.index);
}

function extractQuestionSchema(
  row: string[],
  headerIndexes: Map<string, number>,
  questionGroups: QuestionColumnGroup[],
) {
  const fields: AttributeField[] = [];

  for (const group of questionGroups) {
    const getCell = (header?: string) => {
      const cellIndex = header ? headerIndexes.get(header) : undefined;
      return cellIndex == null ? "" : (row[cellIndex] ?? "").trim();
    };

    const label = getCell(group.label);
    const key = slugify(getCell(group.key) || label);
    const rawType = getCell(group.type);
    const type = parseQuestionType(rawType);
    const required = parseBooleanValue(getCell(group.required)) ?? false;
    const placeholder = getCell(group.placeholder) || undefined;
    const options =
      type === "select"
        ? parseQuestionOptions(getCell(group.options))
        : undefined;

    if (!label || !key) {
      continue;
    }

    fields.push({
      key,
      label,
      type,
      required,
      placeholder: type === "toggle" ? undefined : placeholder,
      options: type === "select" ? options : undefined,
    });
  }

  return fields.length ? { fields } : undefined;
}

function buildPreviewRows(
  parsedSheet: ParsedSheet | null,
  mappings: Record<ImportFieldKey, string>,
) {
  if (!parsedSheet) {
    return [] as PreviewRow[];
  }

  const headerIndexes = new Map(
    parsedSheet.headers.map((header, index) => [header, index]),
  );
  const useParentQuestionsHeader = findOptionalHeader(parsedSheet.headers, [
    "use_parent_questions",
    "use parent questions",
    "inherit_parent_questions",
    "inherit parent questions",
    "use_parent_schema",
  ]);
  const questionGroups = getQuestionColumnGroups(parsedSheet.headers);

  return parsedSheet.rows.map((row, index) => {
    const getValue = (field: ImportFieldKey) => {
      const header = mappings[field];
      const cellIndex = header ? headerIndexes.get(header) : undefined;
      return cellIndex == null ? "" : (row[cellIndex] ?? "").trim();
    };
    const useParentQuestionsValue = useParentQuestionsHeader
      ? (row[headerIndexes.get(useParentQuestionsHeader) ?? -1] ?? "").trim()
      : "";
    const schemaDefinition = extractQuestionSchema(
      row,
      headerIndexes,
      questionGroups,
    );
    const useParentQuestions = parseBooleanValue(useParentQuestionsValue);

    const payload = {
      name: getValue("name") || undefined,
      slug: getValue("slug") || undefined,
      description: getValue("description") || undefined,
      parentName: getValue("parentName") || undefined,
      parentSlug: getValue("parentSlug") || undefined,
      listingExpiryDays: parseNumberValue(getValue("listingExpiryDays")),
      isActive: parseBooleanValue(getValue("isActive")),
      sortOrder: parseNumberValue(getValue("sortOrder")),
      useParentQuestions,
      schemaDefinition,
      dynamicQuestionCount: schemaDefinition?.fields.length,
    };
    const hasAnyValue = Object.values(payload).some(
      (value) => value !== undefined && value !== "",
    );

    return {
      rowNumber: index + 2,
      payload,
      hasAnyValue,
      missingName: hasAnyValue && !payload.name,
    };
  });
}

function getCategoryPath(
  category: MarketplaceCategory,
  categories: MarketplaceCategory[],
) {
  const path = [category.name];
  let parentSlug = category.parentSlug;
  const seen = new Set<string>([category.slug]);

  while (parentSlug && !seen.has(parentSlug)) {
    const parent = categories.find((item) => item.slug === parentSlug);

    if (!parent) {
      break;
    }

    path.unshift(parent.name);
    seen.add(parent.slug);
    parentSlug = parent.parentSlug;
  }

  return path.join(" / ");
}

function flattenCategoryExportRows(categories: MarketplaceCategory[]) {
  return categories.map((category) => {
    const row: Record<string, unknown> = {
      name: category.name,
      slug: category.slug,
      parent_name:
        categories.find((item) => item.slug === category.parentSlug)?.name ??
        "",
      parent_slug: category.parentSlug ?? "",
      path: getCategoryPath(category, categories),
      description: category.description ?? "",
      listing_expiry_days: category.listingExpiryDays,
      is_active: category.isActive,
      sort_order: "",
      level: category.parentSlug ? "sub" : "main",
      use_parent_questions: false,
    };

    category.schema.forEach((field, index) => {
      const position = index + 1;
      row[`question_${position}_label`] = field.label;
      row[`question_${position}_key`] = field.key;
      row[`question_${position}_type`] = field.type;
      row[`question_${position}_required`] = Boolean(field.required);
      row[`question_${position}_placeholder`] = field.placeholder ?? "";
      row[`question_${position}_options`] = (field.options ?? []).join("|");
    });

    return row;
  });
}

export function CategoryBulkTools({
  canEdit,
  categories,
  returnTo,
}: {
  canEdit: boolean;
  categories: MarketplaceCategory[];
  returnTo: string;
}) {
  const [state, formAction] = useActionState(
    bulkImportCategoriesAction,
    initialState,
  );
  const [parsedSheet, setParsedSheet] = useState<ParsedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [mappings, setMappings] = useState<Record<ImportFieldKey, string>>(() =>
    importFieldOptions.reduce<Record<ImportFieldKey, string>>(
      (acc, field) => {
        acc[field.key] = "";
        return acc;
      },
      {} as Record<ImportFieldKey, string>,
    ),
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const nextSheet = parseDelimitedText(text);

    setParsedSheet(nextSheet);
    setFileName(file.name);
    setMappings(suggestMappings(nextSheet.headers));
  }

  const previewRows = useMemo(
    () => buildPreviewRows(parsedSheet, mappings),
    [mappings, parsedSheet],
  );
  const readyRows = useMemo(
    () =>
      previewRows
        .filter((row) => row.hasAnyValue && !row.missingName)
        .map(({ payload }) => ({
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          parentName: payload.parentName,
          parentSlug: payload.parentSlug,
          listingExpiryDays: payload.listingExpiryDays,
          isActive: payload.isActive,
          sortOrder: payload.sortOrder,
          useParentQuestions: payload.useParentQuestions,
          schemaDefinition: payload.schemaDefinition,
        })),
    [previewRows],
  );
  const skippedRows = previewRows.filter(
    (row) => row.hasAnyValue && row.missingName,
  ).length;
  const previewSlice = previewRows.filter((row) => row.hasAnyValue).slice(0, 6);
  const detectedQuestionColumns = useMemo(
    () =>
      parsedSheet ? getQuestionColumnGroups(parsedSheet.headers).length : 0,
    [parsedSheet],
  );
  const questionSupportEnabled = detectedQuestionColumns > 0;
  const payload = JSON.stringify({
    rows: readyRows,
    updateExisting,
  });

  return (
    <section className="panel grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Bulk tools</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
            Import and export categories
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Upload an Excel-friendly CSV, map columns manually, import main and
            subcategories in bulk, download a sample format, or export the full
            category tree. Optional dynamic question columns such as
            `question_1_label`, `question_1_type`, and `question_1_options` are
            supported too.
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
            Download the CSV format, fill it in Excel, save it as CSV, then
            upload it here for bulk import.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv("category-bulk-sample.csv", sampleCsvRows)
            }
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Download CSV format
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "categories-export.csv",
                flattenCategoryExportRows(categories),
              )
            }
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Export categories CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                Upload file
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Use a CSV saved from Excel. Main categories can leave parent
                columns blank. Subcategories can map either parent name or
                parent slug. Optional `use_parent_questions` and `question_1_*`,
                `question_2_*` columns can define category questions in the same
                file.
              </p>
            </div>
            <label
              className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold ${
                canEdit
                  ? "border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--brand)]"
                  : "cursor-not-allowed border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              Choose CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(event) => void handleFileChange(event)}
                disabled={!canEdit}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                File
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                {fileName || "None selected"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                Columns
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                {parsedSheet?.headers.length ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                Rows ready
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                {readyRows.length}
              </p>
            </div>
          </div>

          {parsedSheet ? (
            <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
              Detected delimiter:{" "}
              {parsedSheet.delimiter === "\t" ? "tab" : parsedSheet.delimiter}.{" "}
              {skippedRows} rows will be skipped because the mapped category
              name is blank.{" "}
              {questionSupportEnabled ? detectedQuestionColumns : "No"} question
              column group{detectedQuestionColumns === 1 ? "" : "s"} detected.
            </p>
          ) : (
            <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
              Excel tip: save your spreadsheet as `CSV UTF-8` before upload.
            </p>
          )}
        </div>

        {parsedSheet ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                  Manual column mapping
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Review the detected column mapping before importing. Only
                  `Category name` is required. Dynamic question columns are read
                  automatically when they follow the `question_1_label` style
                  format.
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {importFieldOptions.map((field) => (
                  <label key={field.key} className="grid gap-1">
                    <span className="text-sm font-bold text-[var(--foreground)]">
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    <select
                      value={mappings[field.key]}
                      onChange={(event) =>
                        setMappings((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      className="surface-input text-sm"
                    >
                      <option value="">Not mapped</option>
                      {parsedSheet.headers.map((header) => (
                        <option key={`${field.key}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {field.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <form
                action={formAction}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4"
              >
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="payload" value={payload} />

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      Import summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Choose whether matching categories should be updated or
                      skipped.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={(event) =>
                        setUpdateExisting(event.target.checked)
                      }
                    />
                    Update existing categories
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      Ready rows
                    </p>
                    <p className="mt-2 text-lg font-black text-[var(--foreground)]">
                      {readyRows.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      Skipped rows
                    </p>
                    <p className="mt-2 text-lg font-black text-[var(--foreground)]">
                      {skippedRows}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      Existing mode
                    </p>
                    <p className="mt-2 text-lg font-black text-[var(--foreground)]">
                      {updateExisting ? "Update" : "Skip"}
                    </p>
                  </div>
                </div>

                {state.message ? (
                  <div className="mt-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                    {state.message}
                  </div>
                ) : null}

                <div className="mt-4">
                  <AdminSubmitButton
                    disabled={!canEdit || readyRows.length === 0}
                    className="action-primary w-full px-4 py-3 text-sm font-bold"
                    pendingText="Importing categories..."
                  >
                    Import categories in bulk
                  </AdminSubmitButton>
                </div>
              </form>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                      Preview
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      First mapped rows before import, including optional
                      question counts.
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                    {previewSlice.length} shown
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {previewSlice.length ? (
                    previewSlice.map((row) => (
                      <div
                        key={row.rowNumber}
                        className="rounded-xl border border-[var(--line)] bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-[var(--foreground)]">
                            Row {row.rowNumber}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ${
                              row.missingName
                                ? "bg-[#fff3ef] text-[#9f321e]"
                                : "bg-[rgba(31,122,95,0.12)] text-[var(--success)]"
                            }`}
                          >
                            {row.missingName ? "Needs name" : "Ready"}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                          {Object.entries(row.payload)
                            .filter(([key]) => key !== "schemaDefinition")
                            .map(([key, value]) => (
                              <div key={key}>
                                <span className="font-black uppercase tracking-[0.14em]">
                                  {key}
                                </span>
                                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                                  {value == null || value === ""
                                    ? "-"
                                    : String(value)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
                      No mapped category rows are ready yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
