// Shared pagination controls keep all large tables on the same page-size behavior.
import { Button, Pagination, Stack, Typography } from "@mui/material";
import { clampPage, getPageCount, TABLE_PAGE_SIZE } from "../lib/pagination.js";

export default function TablePaginationControls({ count, page, onChange, pageSize = TABLE_PAGE_SIZE }) {
  const totalRows = Number(count) || 0;
  const pageCount = getPageCount(totalRows, pageSize);
  const isAllRowsVisible = page === "all";
  const safePage = clampPage(page, totalRows, pageSize);

  // Hide the controls when all rows already fit on one page.
  if (totalRows <= pageSize) {
    return null;
  }

  const firstVisibleRow = isAllRowsVisible ? 1 : (safePage - 1) * pageSize + 1;
  const lastVisibleRow = isAllRowsVisible ? totalRows : Math.min(safePage * pageSize, totalRows);

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
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button
          onClick={() => onChange(isAllRowsVisible ? 1 : "all")}
          size="small"
          variant={isAllRowsVisible ? "outlined" : "contained"}
        >
          {isAllRowsVisible ? `Show ${pageSize}` : "Load All"}
        </Button>
        {isAllRowsVisible ? null : (
          <Pagination
            color="primary"
            count={pageCount}
            onChange={(_, nextPage) => onChange(nextPage)}
            page={safePage}
            shape="rounded"
            size="small"
          />
        )}
      </Stack>
    </Stack>
  );
}
