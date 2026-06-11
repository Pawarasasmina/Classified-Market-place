import Link from "next/link";
import {
  adminPageSizeOptions,
  type AdminPaginationState,
} from "@/lib/admin-pagination";

type HiddenField = {
  name: string;
  value?: string | number | boolean | null;
};

type AdminTablePaginationProps = {
  buildPageHref: (page: number, pageSize?: number) => string;
  hiddenFields?: HiddenField[];
  itemLabel: string;
  pagination: AdminPaginationState;
};

function pageWindow(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages, currentPage]);

  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);

  return Array.from(pages).sort((a, b) => a - b);
}

export function AdminTablePagination({
  buildPageHref,
  hiddenFields = [],
  itemLabel,
  pagination,
}: AdminTablePaginationProps) {
  const pages = pageWindow(pagination.currentPage, pagination.totalPages);
  const hasPrevious = pagination.currentPage > 1;
  const hasNext = pagination.currentPage < pagination.totalPages;

  return (
    <div className="admin-pagination">
      <p className="admin-pagination-summary">
        Showing{" "}
        <span>
          {pagination.startItem === pagination.endItem
            ? pagination.startItem
            : `${pagination.startItem}-${pagination.endItem}`}
        </span>{" "}
        of <span>{pagination.totalItems}</span> {itemLabel}
      </p>

      <div className="admin-pagination-controls" aria-label="Pagination">
        <Link
          aria-disabled={!hasPrevious}
          className="admin-pagination-link"
          data-disabled={!hasPrevious}
          href={buildPageHref(Math.max(1, pagination.currentPage - 1))}
        >
          Previous
        </Link>
        {pages.map((page, index) => {
          const previousPage = pages[index - 1];
          const showGap = previousPage && page - previousPage > 1;

          return (
            <span key={page} className="admin-pagination-page-set">
              {showGap ? (
                <span className="admin-pagination-gap" aria-hidden="true">
                  ...
                </span>
              ) : null}
              <Link
                aria-current={
                  page === pagination.currentPage ? "page" : undefined
                }
                className="admin-pagination-link"
                data-active={page === pagination.currentPage}
                href={buildPageHref(page)}
              >
                {page}
              </Link>
            </span>
          );
        })}
        <Link
          aria-disabled={!hasNext}
          className="admin-pagination-link"
          data-disabled={!hasNext}
          href={buildPageHref(
            Math.min(pagination.totalPages, pagination.currentPage + 1),
          )}
        >
          Next
        </Link>
      </div>

      <form className="admin-page-size-form">
        {hiddenFields
          .filter((field) => field.value !== undefined && field.value !== null)
          .map((field) => (
            <input
              key={field.name}
              name={field.name}
              type="hidden"
              value={String(field.value)}
            />
          ))}
        <input name="page" type="hidden" value="1" />
        <label>
          Rows
          <select
            className="surface-input"
            name="pageSize"
            defaultValue={pagination.pageSize}
          >
            {adminPageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button className="action-secondary px-3 py-2 text-sm font-semibold">
          Apply
        </button>
      </form>
    </div>
  );
}
