// Keep every table page size consistent so large record lists render in smaller, predictable chunks.
export const TABLE_PAGE_SIZE = 20;

// Calculate the total number of pages while keeping at least one page for empty table states.
export function getPageCount(totalRows, pageSize = TABLE_PAGE_SIZE) {
  return Math.max(1, Math.ceil((Number(totalRows) || 0) / pageSize));
}

// Return a valid page number even when filters or deletes reduce the total row count.
export function clampPage(page, totalRows, pageSize = TABLE_PAGE_SIZE) {
  return Math.min(Math.max(1, Number(page) || 1), getPageCount(totalRows, pageSize));
}

// Return only the rows for the current visible page without changing the original filtered data.
export function paginateRows(rows, page, pageSize = TABLE_PAGE_SIZE) {
  const safeRows = Array.isArray(rows) ? rows : [];
  // "all" is used by the shared Load All button when the user intentionally wants every filtered row.
  if (page === "all") return safeRows;
  const safePage = clampPage(page, safeRows.length, pageSize);
  const startIndex = (safePage - 1) * pageSize;
  return safeRows.slice(startIndex, startIndex + pageSize);
}
