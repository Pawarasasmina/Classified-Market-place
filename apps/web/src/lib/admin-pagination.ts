export const adminPageSizeOptions = [10, 25, 50, 100] as const;

type AdminPaginationSearchParams = {
  page?: string;
  pageSize?: string;
};

export type AdminPaginationState = {
  currentPage: number;
  endItem: number;
  pageSize: number;
  startItem: number;
  totalItems: number;
  totalPages: number;
};

type SearchParamRecord = Record<
  string,
  string | number | boolean | null | undefined
>;

function parsePositiveInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function getAdminPaginationState(
  searchParams: AdminPaginationSearchParams,
  totalItems: number,
  defaultPageSize = 10,
): AdminPaginationState {
  const requestedPageSize = parsePositiveInteger(searchParams.pageSize);
  const pageSize =
    requestedPageSize &&
    (adminPageSizeOptions as readonly number[]).includes(requestedPageSize)
      ? requestedPageSize
      : defaultPageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(
    totalPages,
    parsePositiveInteger(searchParams.page) ?? 1,
  );
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return {
    currentPage,
    endItem,
    pageSize,
    startItem,
    totalItems,
    totalPages,
  };
}

export function paginateAdminItems<T>(
  items: T[],
  pagination: AdminPaginationState,
) {
  const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
  return items.slice(startIndex, startIndex + pagination.pageSize);
}

export function buildAdminPaginationHref(
  pathname: string,
  searchParams: SearchParamRecord,
  updates: SearchParamRecord,
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getAdminPaginationHiddenFields(
  searchParams: SearchParamRecord,
) {
  return Object.entries(searchParams)
    .filter(
      ([key, value]) =>
        key !== "page" &&
        key !== "pageSize" &&
        value !== undefined &&
        value !== null &&
        value !== "",
    )
    .map(([name, value]) => ({ name, value }));
}
