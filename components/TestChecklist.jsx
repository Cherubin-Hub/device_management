import {
  Box,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  TextField,
  Paper,
} from "@mui/material";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import { useMemo, useState } from "react";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { paginateRows } from "../src/lib/pagination.js";
import { tests } from "./testScripts";

export default function TestChecklist({ hideSummaryChip = false, readOnly = false, results, onResultsChange }) {
  // Keep the 41-row checklist lighter by showing 20 test scripts per page.
  const [page, setPage] = useState(1);

  const handleStatusChange = (index, status) => {
    // Stop changes when this checklist is opened from a queue page for viewing only.
    if (readOnly) return;
    // Toggle the selected status for one checklist row while keeping the other rows unchanged.
    onResultsChange((current) =>
      current.map((result, itemIndex) =>
        itemIndex === index
          ? { ...result, status: result.status === status ? "" : status }
          : result
      )
    );
  };

  const handleRemark = (index, value) => {
    // Stop remarks edits when this checklist is opened from a queue page for viewing only.
    if (readOnly) return;
    // Update only the remarks for the selected checklist row.
    onResultsChange((current) =>
      current.map((result, itemIndex) =>
        itemIndex === index ? { ...result, remarks: value } : result
      )
    );
  };

  // Count all tests marked Yes for the optional summary chip.
  const passedCount = results.filter((result) => result.status === "Yes").length;
  // Count rows with any selected status for the completion progress.
  const evaluatedCount = results.filter((result) => result.status).length;
  // Convert evaluated rows into a percentage for the progress bar.
  const progress = Math.round((evaluatedCount / tests.length) * 100);
  // Pair each test script with its original index so edits still update the correct result row.
  const testEntries = useMemo(
    () => tests.map((test, index) => ({ index, test })),
    []
  );
  // Slice only the displayed checklist rows; the full result array is still saved/exported.
  const paginatedTestEntries = useMemo(
    () => paginateRows(testEntries, page),
    [page, testEntries]
  );

  return (
    <Stack spacing={2.25}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#eaf8ef",
              borderRadius: 1.5,
              color: "#287a45",
              display: "flex",
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
          >
            <AssignmentTurnedInRoundedIcon fontSize="small" />
          </Box>
          <Box
            sx={{
              // Keep the checklist title/details aligned immediately to the right of the icon.
              minWidth: 0,
              textAlign: "left !important",
              "& .MuiTypography-root": {
                textAlign: "left !important",
              },
            }}
          >
            <Typography variant="h6" fontWeight={800}>
              Test Checklist
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Indicate all testing results and document any relevant observations or notes.
            </Typography>
          </Box>
        </Stack>

        {!hideSummaryChip ? (
          <Box
            sx={{
              border: "1px solid #cfd8e3",
              borderRadius: 999,
              px: 1.25,
              py: 0.5,
            }}
          >
            <Typography variant="body2">
              {passedCount}/{tests.length} yes
            </Typography>
          </Box>
        ) : null}
      </Stack>

      <Box>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography variant="body2" color="text.secondary">
            Completion
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {progress}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            bgcolor: "#e6edf5",
            borderRadius: 999,
            height: 8,
            "& .MuiLinearProgress-bar": {
              borderRadius: 999,
            },
          }}
        />
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: "1px solid #dde5ef",
          borderRadius: 2,
          overflowX: "auto",
        }}
      >
        <Table
          size="small"
          sx={{
            minWidth: 700,
            "& th": {
              bgcolor: "#f4f7fb",
              color: "#4b5b70",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0,
              textTransform: "uppercase",
            },
            "& td, & th": {
              borderColor: "#e7edf4",
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell width="56" align="center">#</TableCell>
              <TableCell align="center">Test Script</TableCell>
              <TableCell width="220" align="center">Status</TableCell>
              <TableCell width="260" align="center">Remarks</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedTestEntries.map(({ index, test }) => (
              <TableRow
                key={test}
                hover
                sx={(theme) => {
                  const isDarkMode = theme.palette.mode === "dark";
                  const selectedStatus = results[index].status;
                  const rowBg =
                    selectedStatus === "Yes"
                      ? isDarkMode
                        ? "rgba(34, 197, 94, 0.14)"
                        : "#fbfffc"
                      : selectedStatus === "No"
                        ? isDarkMode
                          ? "rgba(239, 68, 68, 0.14)"
                          : "#fffafa"
                        : "inherit";
                  const rowHoverBg =
                    selectedStatus === "Yes"
                      ? isDarkMode
                        ? "rgba(34, 197, 94, 0.22)"
                        : "#f0fff4"
                      : selectedStatus === "No"
                        ? isDarkMode
                          ? "rgba(239, 68, 68, 0.22)"
                          : "#fff1f2"
                        : isDarkMode
                          ? "rgba(32, 208, 196, 0.12)"
                          : "rgba(32, 208, 196, 0.08)";

                  return {
                    bgcolor: `${rowBg} !important`,
                    "&:hover": {
                      bgcolor: `${rowHoverBg} !important`,
                    },
                  };
                }}
              >
                <TableCell align="center">
                  <Typography variant="body2" color="text.secondary" fontWeight={700}>
                    {index + 1}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {test}
                  </Typography>
                </TableCell>

                <TableCell
                  align="center"
                  sx={{
                    px: 0.5,
                    verticalAlign: "middle",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={0}
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                      display: "inline-flex",
                      mx: "auto",
                      width: 192,
                      "& .MuiFormControlLabel-root": {
                        justifyContent: "center",
                        mr: 0,
                        width: 64,
                        ml: 0,
                      },
                      "& .MuiButtonBase-root": {
                        p: 0.5,
                      },
                      "& .MuiFormControlLabel-label": {
                        fontSize: 13,
                        fontWeight: 700,
                      },
                    }}
                  >
                    {["Yes", "No", "N/A"].map((status) => (
                      <FormControlLabel
                        key={status}
                        control={
                          <Checkbox
                            checked={results[index].status === status}
                            disabled={readOnly}
                            onChange={() => handleStatusChange(index, status)}
                            color={status === "Yes" ? "success" : "primary"}
                            size="small"
                            sx={
                              status === "No"
                                ? {
                                    "&.Mui-checked": {
                                      color: "#d32f2f",
                                    },
                                  }
                                : undefined
                            }
                            inputProps={{ "aria-label": `${test} ${status}` }}
                          />
                        }
                        label={status}
                      />
                    ))}
                  </Stack>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Add remarks"
                    disabled={readOnly}
                    value={results[index].remarks}
                    onChange={(e) =>
                      handleRemark(index, e.target.value)
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationControls count={tests.length} page={page} onChange={setPage} />
      </TableContainer>
    </Stack>
  );
}
