const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Normalizes ?page & ?pageSize query params into Prisma skip/take, and
// builds the `meta` block every paginated list response should return.
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE)
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginationMeta({ page, pageSize, totalItems }) {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}