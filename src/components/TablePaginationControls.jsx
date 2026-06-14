import { Pagination, Stack, Typography } from "@mui/material";
import { clampPage, getPageCount, TABLE_PAGE_SIZE } from "../lib/pagination.js";

export default function TablePaginationControls({ count, page, onChange, pageSize = TABLE_PAGE_SIZE }) {
  const totalRows = Number(count) || 0;
  const pageCount = getPageCount(totalRows, pageSize);
  const safePage = clampPage(page, totalRows, pageSize);

  // Hide the controls when all rows already fit on one page.
  if (totalRows <= pageSize) {
    return null;
  }

  const firstVisibleRow = (safePage - 1) * pageSize + 1;
  const lastVisibleRow = Math.min(safePage * pageSize, totalRows);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
      sx={{ borderTop: "1px solid", borderColor: "divider", px: 1.5, py: 1 }}
    >
      <Typography variant="caption" color="text.secondary">
        Showing {firstVisibleRow}-{lastVisibleRow} of {totalRows}
      </Typography>
      <Pagination
        color="primary"
        count={pageCount}
        onChange={(_, nextPage) => onChange(nextPage)}
        page={safePage}
        shape="rounded"
        size="small"
      />
    </Stack>
  );
}
