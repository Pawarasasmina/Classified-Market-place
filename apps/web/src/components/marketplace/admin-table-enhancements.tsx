"use client";

import { useEffect, useMemo, useState } from "react";

type AdminTableEnhancerProps = {
  copyLabel?: string;
  enableCopyIds?: boolean;
  enableSelection?: boolean;
  stickyActions?: boolean;
  tableId: string;
};

type Density = "compact" | "comfortable" | "spacious";
type SortDirection = "ascending" | "descending";

function getRowId(row: HTMLTableRowElement) {
  return row.dataset.rowId?.trim() ?? "";
}

function getSortText(cell: Element | undefined) {
  return cell?.getAttribute("data-sort-value") ?? cell?.textContent?.trim() ?? "";
}

function compareValues(first: string, second: string) {
  const firstNumber = Number(first.replace(/[^0-9.-]/g, ""));
  const secondNumber = Number(second.replace(/[^0-9.-]/g, ""));

  if (first && second && Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber;
  }

  const firstDate = Date.parse(first);
  const secondDate = Date.parse(second);

  if (Number.isFinite(firstDate) && Number.isFinite(secondDate)) {
    return firstDate - secondDate;
  }

  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

async function copyText(value: string) {
  if (!value) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

export function CopyIdButton({
  id,
  label = "Copy ID",
}: {
  id: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!id) {
    return null;
  }

  return (
    <button
      type="button"
      className="admin-copy-id-button"
      onClick={async () => {
        await copyText(id);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function AdminTableEnhancer({
  copyLabel = "IDs",
  enableCopyIds = true,
  enableSelection = true,
  stickyActions = false,
  tableId,
}: AdminTableEnhancerProps) {
  const [density, setDensity] = useState<Density>("comfortable");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => `${selectedIds.length} selected`,
    [selectedIds.length],
  );

  useEffect(() => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    const wrap = table?.closest(".admin-table-wrap") as HTMLElement | null;

    if (!table || !wrap) {
      return;
    }

    table.dataset.density = density;
    wrap.dataset.density = density;

    if (stickyActions) {
      table.dataset.stickyActions = "true";
      wrap.dataset.stickyActions = "true";
    }
  }, [density, stickyActions, tableId]);

  useEffect(() => {
    const table = document.getElementById(tableId) as HTMLTableElement | null;

    if (!table || table.dataset.enhanced === "true") {
      return;
    }

    table.dataset.enhanced = "true";
    const headerRow = table.tHead?.rows[0];
    const body = table.tBodies[0];

    if (!headerRow || !body) {
      return;
    }

    const resolvedHeaderRow = headerRow;

    if (enableSelection) {
      const selectHeader = document.createElement("th");
      selectHeader.className = "admin-table-select-cell";
      selectHeader.setAttribute("data-admin-select", "true");
      selectHeader.innerHTML =
        '<input type="checkbox" aria-label="Select all rows" />';
      headerRow.insertBefore(selectHeader, headerRow.firstChild);

      Array.from(body.rows).forEach((row) => {
        const selectCell = document.createElement("td");
        selectCell.className = "admin-table-select-cell";
        selectCell.setAttribute("data-label", "Select");
        selectCell.innerHTML =
          '<input type="checkbox" aria-label="Select row" />';
        row.insertBefore(selectCell, row.firstChild);
      });
    }

    if (enableCopyIds) {
      Array.from(body.rows).forEach((row) => {
        const rowId = getRowId(row);
        const targetCell = row.cells[enableSelection ? 1 : 0];

        if (!rowId || !targetCell || targetCell.querySelector(".admin-copy-id-button")) {
          return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "admin-copy-id-button";
        button.textContent = "Copy ID";
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          await copyText(rowId);
          button.textContent = "Copied";
          window.setTimeout(() => {
            button.textContent = "Copy ID";
          }, 1400);
        });
        targetCell.appendChild(button);
      });
    }

    Array.from(headerRow.cells).forEach((header, index) => {
      if (
        header.dataset.adminSelect === "true" ||
        header.dataset.sortable === "false" ||
        header.textContent?.trim().toLowerCase() === "action"
      ) {
        return;
      }

      header.dataset.sortable = "true";
      header.tabIndex = 0;
      header.setAttribute("role", "button");
      header.setAttribute("aria-sort", "none");
      header.title = "Sort column";

      const sortColumn = () => {
        const currentDirection = header.getAttribute("aria-sort");
        const nextDirection: SortDirection =
          currentDirection === "ascending" ? "descending" : "ascending";
        const rows = Array.from(body.rows);

        rows
          .sort((first, second) => {
            const result = compareValues(
              getSortText(first.cells[index]),
              getSortText(second.cells[index]),
            );

            return nextDirection === "ascending" ? result : -result;
          })
          .forEach((row) => body.appendChild(row));

        Array.from(headerRow.cells).forEach((item) => {
          item.setAttribute("aria-sort", "none");
          delete item.dataset.sortDirection;
        });
        header.setAttribute("aria-sort", nextDirection);
        header.dataset.sortDirection = nextDirection;
      };

      header.addEventListener("click", sortColumn);
      header.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          sortColumn();
        }
      });
    });

    function syncSelection() {
      const selected = Array.from(body.rows)
        .filter((row) => {
          const checkbox = row.querySelector<HTMLInputElement>(
            ".admin-table-select-cell input",
          );
          return checkbox?.checked;
        })
        .map(getRowId)
        .filter(Boolean);
      const allCheckbox = resolvedHeaderRow.querySelector<HTMLInputElement>(
        ".admin-table-select-cell input",
      );

      if (allCheckbox) {
        allCheckbox.checked = selected.length > 0 && selected.length === body.rows.length;
        allCheckbox.indeterminate =
          selected.length > 0 && selected.length < body.rows.length;
      }

      Array.from(body.rows).forEach((row) => {
        const checkbox = row.querySelector<HTMLInputElement>(
          ".admin-table-select-cell input",
        );
        row.dataset.selected = checkbox?.checked ? "true" : "false";
      });
      setSelectedIds(selected);
    }

    const handleChange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;

      if (!target?.matches(".admin-table-select-cell input")) {
        return;
      }

      if (target.closest("thead")) {
        Array.from(body.rows).forEach((row) => {
          const checkbox = row.querySelector<HTMLInputElement>(
            ".admin-table-select-cell input",
          );

          if (checkbox) {
            checkbox.checked = target.checked;
          }
        });
      }

      syncSelection();
    };

    table.addEventListener("change", handleChange);
    syncSelection();
  }, [enableCopyIds, enableSelection, tableId]);

  async function copySelectedIds() {
    await copyText(selectedIds.join("\n"));
    setCopied("selected");
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function copyAllIds() {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    const ids = Array.from(table?.tBodies[0]?.rows ?? [])
      .map(getRowId)
      .filter(Boolean);

    await copyText(ids.join("\n"));
    setCopied("all");
    window.setTimeout(() => setCopied(null), 1400);
  }

  function clearSelection() {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    const checkboxes = table?.querySelectorAll<HTMLInputElement>(
      ".admin-table-select-cell input",
    );

    checkboxes?.forEach((checkbox) => {
      checkbox.checked = false;
      checkbox.indeterminate = false;
    });
    table?.querySelectorAll("tbody tr").forEach((row) => {
      delete (row as HTMLElement).dataset.selected;
    });
    setSelectedIds([]);
  }

  return (
    <div className="admin-table-toolbar" aria-label="Table controls">
      <div className="admin-table-density" aria-label="Column density">
        {(["compact", "comfortable", "spacious"] as const).map((item) => (
          <button
            key={item}
            type="button"
            data-active={density === item}
            onClick={() => setDensity(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {enableSelection ? (
        <div className="admin-table-bulk-actions">
          <span>{selectedSummary}</span>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={copySelectedIds}
          >
            {copied === "selected" ? "Copied selected" : `Copy selected ${copyLabel}`}
          </button>
          <button type="button" onClick={copyAllIds}>
            {copied === "all" ? "Copied all" : `Copy all ${copyLabel}`}
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={clearSelection}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
