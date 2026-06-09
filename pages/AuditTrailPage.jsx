import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { useMemo, useState } from "react";
import { supabase } from "../src/lib/supabase.js";

const actionColors = {
  ARCHIVE: "#dc2626",
  CREATE: "#1976d2",
  DELETE: "#dc2626",
  RESTORE: "#16a34a",
  TRANSFER_TO_INVENTORY: "#0284c7",
  TRANSFER_TO_ONGOING_TESTING: "#f97316",
  UPDATE: "#7c3aed",
};

export default function AuditTrailPage() {
  // Store typed date values separately so the report only changes after Generate is clicked.
  const [draftFilters, setDraftFilters] = useState({ from: "", to: "" });
  // Store the date range that was actually used to generate the visible report.
  const [appliedFilters, setAppliedFilters] = useState(null);
  // Store audit rows returned from Supabase for the generated date range.
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const reportTitle = useMemo(() => {
    // Show the exact generated date range so exported and visible reports match.
    if (!appliedFilters) return "Select a date range, then generate the audit report.";
    return `${formatInputDate(appliedFilters.from)} to ${formatInputDate(appliedFilters.to)}`;
  }, [appliedFilters]);

  const handleGenerate = async () => {
    setError("");

    // Require bounded date filters to avoid generating an unbounded audit report as data grows.
    if (!draftFilters.from || !draftFilters.to) {
      setEvents([]);
      setAppliedFilters(null);
      setError("Please select both Movement Date From and Movement Date To before generating the audit trail.");
      return;
    }

    // Validate date order before querying Supabase so users get fast feedback.
    if (draftFilters.from > draftFilters.to) {
      setEvents([]);
      setAppliedFilters(null);
      setError("Movement Date From cannot be later than Movement Date To.");
      return;
    }

    setIsLoading(true);

    // Retrieve only movement events inside the requested date range for predictable report size.
    const query = supabase
      .from("audit_trail")
      .select("id, event_time, module, action, entity_table, entity_id, record_label, actor_email, summary, before_data, after_data, metadata")
      .gte("event_time", `${draftFilters.from}T00:00:00`)
      .lte("event_time", `${draftFilters.to}T23:59:59`)
      .order("event_time", { ascending: false });

    const { data, error: loadError } = await query;

    if (loadError) {
      setError(loadError.message);
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setEvents(data || []);
    setAppliedFilters({ ...draftFilters });
    setIsLoading(false);
  };

  const handleExport = () => {
    exportAuditExcel(events, appliedFilters);
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#e8f2ff",
              borderRadius: 1.5,
              color: "#1f5f99",
              display: "flex",
              height: 38,
              justifyContent: "center",
              width: 38,
            }}
          >
            <HistoryRoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={900}>
              Audit Trail
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Review complete device inventory movement by date range.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={handleExport}
            variant="contained"
            disabled={!appliedFilters || events.length === 0}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Export Excel
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ mb: 2, p: 1.5, border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end">
          <TextField
            label="Movement Date From"
            type="date"
            value={draftFilters.from}
            onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ minWidth: 190 }}
          />
          <TextField
            label="Movement Date To"
            type="date"
            value={draftFilters.to}
            onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ minWidth: 190 }}
          />
          <Button
            startIcon={<FilterAltRoundedIcon />}
            onClick={handleGenerate}
            variant="outlined"
            disabled={!draftFilters.from || !draftFilters.to}
            sx={{ textTransform: "none" }}
          >
            Generate Report
          </Button>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ bgcolor: "background.paper", borderBottom: "1px solid #dde5ef", px: 1.5, py: 1 }}>
          <Typography variant="subtitle2" fontWeight={900}>
            Movement Report
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {reportTitle}
          </Typography>
        </Box>
        <TableContainer sx={{ overflowX: "hidden" }}>
          <Table
            size="small"
            sx={{
              tableLayout: "fixed",
              width: "100%",
              "& th": {
                bgcolor: "#d9d9d9",
                fontSize: 11,
                fontWeight: 900,
                lineHeight: 1.2,
                px: 0.75,
                py: 0.9,
                textAlign: "center",
              },
              "& td": {
                fontSize: 11,
                lineHeight: 1.25,
                px: 0.75,
                py: 0.75,
              },
              "& td, & th": { borderColor: "#dddddd" },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "12%" }}>Date / Time</TableCell>
                <TableCell sx={{ width: "12%" }}>Module</TableCell>
                <TableCell sx={{ width: "14%" }}>Action</TableCell>
                <TableCell sx={{ width: "14%" }}>Record</TableCell>
                <TableCell sx={{ width: "28%" }}>Movement Summary</TableCell>
                <TableCell sx={{ width: "12%" }}>User</TableCell>
                <TableCell sx={{ width: "8%" }}>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!appliedFilters ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    Select both movement dates, then click Generate Report.
                  </TableCell>
                </TableRow>
              ) : null}
              {appliedFilters && isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    Loading audit movement report...
                  </TableCell>
                </TableRow>
              ) : null}
              {appliedFilters && !isLoading && events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    No audit movement found for the selected date range.
                  </TableCell>
                </TableRow>
              ) : null}
              {events.map((event) => (
                <TableRow key={event.id} hover>
                  <TableCell align="center">{formatDateTime(event.event_time)}</TableCell>
                  <TableCell align="center">{event.module || "-"}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={formatAction(event.action)}
                      size="small"
                      sx={{
                        bgcolor: `${actionColors[event.action] || "#64748b"}22`,
                        color: actionColors[event.action] || "#475569",
                        fontWeight: 900,
                        maxWidth: "100%",
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">{event.record_label || "-"}</TableCell>
                  <TruncatedCell>{event.summary || "-"}</TruncatedCell>
                  <TruncatedCell align="center">{event.actor_email || "System"}</TruncatedCell>
                  <TableCell align="center">{tableLabel(event.entity_table)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

function TruncatedCell({ align = "left", children }) {
  return (
    <TableCell align={align} sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          display: "-webkit-box",
          lineHeight: 1.25,
          maxHeight: "2.5em",
          overflow: "hidden",
          overflowWrap: "anywhere",
          textOverflow: "ellipsis",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          whiteSpace: "normal",
        }}
      >
        {children || "-"}
      </Box>
    </TableCell>
  );
}

const formatAction = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const formatInputDate = (value) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "";

const tableLabel = (value) => {
  if (value === "device_inventory_items") return "Inventory";
  if (value === "ongoing_testing_items") return "Testing";
  if (value === "archived_records") return "Archive";
  if (value === "clients") return "Clients";
  if (value === "statuses") return "Statuses";
  if (value === "device_types") return "Device Types";
  return value || "-";
};

const exportAuditExcel = (events, filters) => {
  const period = `${formatInputDate(filters?.from)} to ${formatInputDate(filters?.to)}`;
  // Export the currently generated report only, preserving the same bounded date range.
  const rows = events
    .map(
      (event, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="center">${escapeHtml(formatDateTime(event.event_time))}</td>
          <td class="center">${escapeHtml(event.module || "")}</td>
          <td class="center">${escapeHtml(formatAction(event.action))}</td>
          <td>${escapeHtml(event.record_label || "")}</td>
          <td>${escapeHtml(event.summary || "")}</td>
          <td>${escapeHtml(event.actor_email || "System")}</td>
          <td class="center">${escapeHtml(tableLabel(event.entity_table))}</td>
        </tr>`
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 7px; vertical-align: middle; white-space: normal; }
          .title { background: #1f4e79; color: #ffffff; font-size: 15pt; font-weight: 700; text-align: center; }
          .subtitle { background: #d9eaf7; color: #17365d; font-weight: 700; text-align: left; }
          .header { background: #d9d9d9; font-weight: 700; text-align: center; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            <col style="width:50px" />
            <col style="width:145px" />
            <col style="width:135px" />
            <col style="width:150px" />
            <col style="width:180px" />
            <col style="width:360px" />
            <col style="width:190px" />
            <col style="width:100px" />
          </colgroup>
          <thead>
            <tr><th class="title" colspan="8">ENDIVIO DEVICE MANAGEMENT - AUDIT TRAIL</th></tr>
            <tr><td class="subtitle" colspan="8">Report Period: ${escapeHtml(period)}</td></tr>
            <tr>
              <th class="header">No.</th>
              <th class="header">Date / Time</th>
              <th class="header">Module</th>
              <th class="header">Action</th>
              <th class="header">Record</th>
              <th class="header">Movement Summary</th>
              <th class="header">User</th>
              <th class="header">Source</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
