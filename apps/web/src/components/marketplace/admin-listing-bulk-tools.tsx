"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { bulkImportListingsAction } from "@/app/(main)/actions";
import { AdminSubmitButton } from "@/components/marketplace/admin-form-feedback";
import { type MarketplaceListing } from "@/lib/marketplace";

type ImportFieldKey =
  | "listingId"
  | "sellerId"
  | "sellerEmail"
  | "sellerPhone"
  | "title"
  | "description"
  | "price"
  | "currency"
  | "location"
  | "categorySlug";

type ParsedSheet = {
  delimiter: string;
  headers: string[];
  rows: string[][];
};

type PreviewPayload = {
  listingId?: string;
  sellerId?: string;
  sellerEmail?: string;
  sellerPhone?: string;
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  location?: string;
  categorySlug?: string;
  attributes?: Record<string, unknown>;
  images?: Array<{
    url: string;
    altText?: string;
    isPrimary?: boolean;
  }>;
};

type PreviewRow = {
  hasAnyValue: boolean;
  missingCore: boolean;
  missingSeller: boolean;
  payload: PreviewPayload;
  rowNumber: number;
};

type ImageColumnGroup = {
  index: number;
  url?: string;
  altText?: string;
};

const importFieldOptions: Array<{
  description: string;
  key: ImportFieldKey;
  label: string;
  required?: boolean;
}> = [
  {
    key: "listingId",
    label: "Listing ID",
    description: "Optional. Used to update an existing listing export row.",
  },
  {
    key: "sellerId",
    label: "Seller ID",
    description: "Recommended for exact seller matching.",
  },
  {
    key: "sellerEmail",
    label: "Seller email",
    description: "Optional seller lookup if you do not have the seller ID.",
  },
  {
    key: "sellerPhone",
    label: "Seller phone",
    description: "Optional seller lookup by phone number.",
  },
  {
    key: "title",
    label: "Title",
    description: "Required.",
    required: true,
  },
  {
    key: "description",
    label: "Description",
    description: "Required.",
    required: true,
  },
  {
    key: "price",
    label: "Price",
    description: "Required numeric price.",
    required: true,
  },
  {
    key: "currency",
    label: "Currency",
    description: "Optional. Defaults to AED.",
  },
  {
    key: "location",
    label: "Location",
    description: "Required.",
    required: true,
  },
  {
    key: "categorySlug",
    label: "Category slug",
    description: "Required existing category slug.",
    required: true,
  },
];

const sampleCsvRows = [
  {
    seller_id: "replace-with-seller-uuid",
    title: "iPhone 15 Pro 256GB",
    description: "Factory unlocked, clean condition, box included.",
    price: 3200,
    currency: "AED",
    location: "Dubai Marina",
    category_slug: "mobile-phones",
    attr_brand: "Apple",
    attr_condition: "Used",
    image_1_url: "https://example.com/listings/iphone-front.jpg",
    image_1_alt_text: "Front view",
    image_2_url: "https://example.com/listings/iphone-back.jpg",
    image_2_alt_text: "Back view",
  },
];

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
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

function parseNumberValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function suggestMappings(headers: string[]) {
  const synonyms: Record<ImportFieldKey, string[]> = {
    listingId: ["listingid", "id"],
    sellerId: ["sellerid", "userid", "ownerid"],
    sellerEmail: ["selleremail", "email", "owneremail"],
    sellerPhone: ["sellerphone", "phone", "ownerphone"],
    title: ["title", "listingtitle", "name"],
    description: ["description", "details", "summary"],
    price: ["price", "amount"],
    currency: ["currency"],
    location: ["location", "city", "area"],
    categorySlug: ["categoryslug", "subcategoryslug", "category"],
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

function getAttributeHeaders(headers: string[]) {
  return headers.filter((header) => normalizeHeader(header).startsWith("attr"));
}

function getImageColumnGroups(headers: string[]) {
  const groups = new Map<number, ImageColumnGroup>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const match = normalized.match(/^image(\d+)(url|alttext)$/);

    if (!match) {
      continue;
    }

    const index = Number(match[1]);
    const suffix = match[2];
    const group = groups.get(index) ?? { index };

    if (suffix === "url") {
      group.url = header;
    } else if (suffix === "alttext") {
      group.altText = header;
    }

    groups.set(index, group);
  }

  return [...groups.values()].sort((left, right) => left.index - right.index);
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
  const attributeHeaders = getAttributeHeaders(parsedSheet.headers);
  const imageGroups = getImageColumnGroups(parsedSheet.headers);

  return parsedSheet.rows.map((row, index) => {
    const getValue = (field: ImportFieldKey) => {
      const header = mappings[field];
      const cellIndex = header ? headerIndexes.get(header) : undefined;
      return cellIndex == null ? "" : (row[cellIndex] ?? "").trim();
    };

    const attributes = attributeHeaders.reduce<Record<string, unknown>>(
      (acc, header) => {
        const cellIndex = headerIndexes.get(header);
        const value = cellIndex == null ? "" : (row[cellIndex] ?? "").trim();

        if (!value) {
          return acc;
        }

        const key = header
          .replace(/^attr[_\s-]*/i, "")
          .trim()
          .replace(/\s+/g, "_");

        if (key) {
          acc[key] = value;
        }

        return acc;
      },
      {},
    );
    const images = imageGroups
      .map((group) => {
        const urlIndex = group.url ? headerIndexes.get(group.url) : undefined;
        const altTextIndex = group.altText
          ? headerIndexes.get(group.altText)
          : undefined;
        const url = urlIndex == null ? "" : (row[urlIndex] ?? "").trim();
        const altText =
          altTextIndex == null ? "" : (row[altTextIndex] ?? "").trim();

        if (!url) {
          return null;
        }

        return {
          url,
          altText: altText || undefined,
          isPrimary: group.index === 1,
        };
      })
      .filter(Boolean) as NonNullable<PreviewPayload["images"]>;

    const payload: PreviewPayload = {
      listingId: getValue("listingId") || undefined,
      sellerId: getValue("sellerId") || undefined,
      sellerEmail: getValue("sellerEmail") || undefined,
      sellerPhone: getValue("sellerPhone") || undefined,
      title: getValue("title") || undefined,
      description: getValue("description") || undefined,
      price: parseNumberValue(getValue("price")),
      currency: getValue("currency") || undefined,
      location: getValue("location") || undefined,
      categorySlug: getValue("categorySlug") || undefined,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      images: images.length ? images : undefined,
    };

    const hasAnyValue = Object.values(payload).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    });
    const missingCore = Boolean(
      hasAnyValue &&
        (!payload.title ||
          !payload.description ||
          payload.price == null ||
          !payload.location ||
          !payload.categorySlug),
    );
    const missingSeller = Boolean(
      hasAnyValue &&
        !payload.listingId &&
        !payload.sellerId &&
        !payload.sellerEmail &&
        !payload.sellerPhone,
    );

    return {
      rowNumber: index + 2,
      payload,
      hasAnyValue,
      missingCore,
      missingSeller,
    };
  });
}

function flattenListingExportRows(listings: MarketplaceListing[]) {
  const maxImages = listings.reduce(
    (highest, listing) => Math.max(highest, listing.imageUrls.length),
    0,
  );

  return listings.map((listing) => {
    const row: Record<string, unknown> = {
      listing_id: listing.id,
      seller_id: listing.sellerId,
      title: listing.title,
      description: listing.description,
      price: listing.priceValue,
      currency: "",
      location: listing.location,
      category_slug: listing.categorySlug,
      category_name: listing.subcategory,
    };

    Object.entries(listing.attributes).forEach(([key, value]) => {
      row[`attr_${key}`] = value;
    });

    for (let index = 0; index < maxImages; index += 1) {
      row[`image_${index + 1}_url`] = listing.imageUrls[index] ?? "";
      row[`image_${index + 1}_alt_text`] = "";
    }

    return row;
  });
}

export function AdminListingBulkTools({
  listings,
  returnTo,
}: {
  listings: MarketplaceListing[];
  returnTo: string;
}) {
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
        .filter(
          (row) => row.hasAnyValue && !row.missingCore && !row.missingSeller,
        )
        .map(({ payload }) => payload),
    [previewRows],
  );
  const skippedRows = previewRows.filter(
    (row) => row.hasAnyValue && (row.missingCore || row.missingSeller),
  ).length;
  const previewSlice = previewRows.filter((row) => row.hasAnyValue).slice(0, 6);
  const attributeHeaderCount = parsedSheet
    ? getAttributeHeaders(parsedSheet.headers).length
    : 0;
  const imageGroupCount = parsedSheet
    ? getImageColumnGroups(parsedSheet.headers).length
    : 0;
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
            Import and export listings
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Upload an Excel-friendly CSV to create or update listings in bulk.
            Imported rows are saved as admin-approved active listings, so they
            are immediately manageable for blocking, deleting, or priority
            promotion later. Payment mode, priority, boosts, and related admin
            controls stay on their default or existing values and are not read
            from the CSV.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv("listing-bulk-sample.csv", sampleCsvRows)
            }
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Download CSV format
          </button>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "admin-listings-export.csv",
                flattenListingExportRows(listings),
              )
            }
            className="action-secondary px-4 py-2 text-sm font-semibold"
          >
            Export listings CSV
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
                Use seller ID, seller email, or seller phone. Attribute columns
                should use the `attr_key` format, and image columns can use
                `image_1_url`, `image_1_alt_text`, `image_2_url`, and so on.
                Only listing item details are imported from the sheet.
              </p>
            </div>
            <label className="cursor-pointer rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold text-[var(--foreground)] hover:border-[var(--brand)]">
              Choose CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(event) => void handleFileChange(event)}
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
                Rows ready
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                {readyRows.length}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                Detected extras
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                {attributeHeaderCount} attr / {imageGroupCount} image
              </p>
            </div>
          </div>

          {parsedSheet ? (
            <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
              Detected delimiter:{" "}
              {parsedSheet.delimiter === "\t" ? "tab" : parsedSheet.delimiter}.{" "}
              {skippedRows} rows will be skipped until required listing and
              seller data are mapped.
            </p>
          ) : (
            <p className="mt-4 text-xs font-semibold text-[var(--muted)]">
              Save your spreadsheet as `CSV UTF-8` before upload.
            </p>
          )}
        </div>

        {parsedSheet ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                Manual column mapping
              </p>
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
                action={bulkImportListingsAction}
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
                      Matching `listing_id` rows can be updated; all imported
                      rows are approved as active listings, while payment,
                      priority, and boost-related settings remain at their
                      default or existing values.
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
                    Update existing listings
                  </label>
                </div>

                <div className="mt-4">
                  <AdminSubmitButton
                    disabled={readyRows.length === 0}
                    className="action-primary w-full px-4 py-3 text-sm font-bold"
                    pendingText="Importing listings..."
                  >
                    Import listings in bulk
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
                      First mapped rows before import.
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
                              row.missingCore || row.missingSeller
                                ? "bg-[#fff3ef] text-[#9f321e]"
                                : "bg-[rgba(31,122,95,0.12)] text-[var(--success)]"
                            }`}
                          >
                            {row.missingCore
                              ? "Needs listing fields"
                              : row.missingSeller
                                ? "Needs seller"
                                : "Ready"}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                          <div>
                            <span className="font-black uppercase tracking-[0.14em]">
                              Title
                            </span>
                            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                              {row.payload.title ?? "-"}
                            </p>
                          </div>
                          <div>
                            <span className="font-black uppercase tracking-[0.14em]">
                              Seller
                            </span>
                            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                              {row.payload.sellerId ??
                                row.payload.sellerEmail ??
                                row.payload.sellerPhone ??
                                "-"}
                            </p>
                          </div>
                          <div>
                            <span className="font-black uppercase tracking-[0.14em]">
                              Category
                            </span>
                            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                              {row.payload.categorySlug ?? "-"}
                            </p>
                          </div>
                          <div>
                            <span className="font-black uppercase tracking-[0.14em]">
                              Price
                            </span>
                            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                              {row.payload.price ?? "-"}
                            </p>
                          </div>
                          <div>
                            <span className="font-black uppercase tracking-[0.14em]">
                              Attributes
                            </span>
                            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                              {Object.keys(row.payload.attributes ?? {}).length}
                            </p>
                          </div>
                          <div>
                            <span className="font-black uppercase tracking-[0.14em]">
                              Images
                            </span>
                            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                              {row.payload.images?.length ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
                      No mapped listing rows are ready yet.
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
