// Audit Trail lists user and system activity so administrators can review record movement history.
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
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
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { useMemo, useState } from "react";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { paginateRows } from "../src/lib/pagination.js";
import { formatPersonName } from "../src/lib/repairWorkflow.js";
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

const allModulesFilterValue = "__ALL_MODULES__";

const auditModuleOptions = [
  { value: allModulesFilterValue, label: "All Modules" },
  { value: "Inventory Records", label: "Repair Records" },
  { value: "Ongoing Testing", label: "Repair Tracking" },
  { value: "Device Monitoring (Spare Parts)", label: "Device Monitoring (Spare Parts)" },
  { value: "Configurations", label: "Configurations" },
  { value: "Data Migration", label: "Data Migration" },
  { value: "Testing Device", label: "Testing Device" },
  { value: "Administration", label: "Administration" },
  { value: "Archived Records", label: "Archived Records" },
];

export default function AuditTrailPage() {
  // Store typed filter values separately so the report only changes after Generate is clicked.
  const [draftFilters, setDraftFilters] = useState({
    from: "",
    module: allModulesFilterValue,
    to: "",
  });
  // Store the filter values that were actually used to generate the visible report.
  const [appliedFilters, setAppliedFilters] = useState(null);
  // Store audit rows returned from Supabase for the generated filters.
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Paginate generated audit rows so large reports do not render all rows at once.
  const [page, setPage] = useState(1);

  // Keep the browser display paginated so large audit reports stay responsive.
  const paginatedEvents = useMemo(
    () => paginateRows(events, page),
    [events, page]
  );

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
    let query = supabase
      .from("audit_trail")
      .select("id, event_time, module, action, entity_table, entity_id, record_label, actor_id, actor_email, summary, before_data, after_data, metadata")
      .gte("event_time", `${draftFilters.from}T00:00:00`)
      .lte("event_time", `${draftFilters.to}T23:59:59`)
      .order("event_time", { ascending: false });

    // Apply the selected module after the date range so users can generate focused audit reports.
    if (draftFilters.module !== allModulesFilterValue) {
      query = query.eq("module", draftFilters.module);
    }

    const { data, error: loadError } = await query;

    if (loadError) {
      setError(loadError.message);
      setEvents([]);
      setIsLoading(false);
      return;
    }

    // Enrich audit rows with app user display names while keeping the audit table as the source of movement history.
    const rowsWithDisplayNames = await enrichEventsWithActorNames(data || []);
    setEvents(rowsWithDisplayNames);
    setPage(1);
    setAppliedFilters({ ...draftFilters });
    setIsLoading(false);
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack
        className="module-page-header"
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Stack className="module-page-heading" direction="row" spacing={1.5} alignItems="center">
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
          <Box className="module-page-copy">
            <Typography className="module-page-title" variant="h5" component="h1" fontWeight={900}>
              Audit Trail
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              Review complete audit trail activity.
            </Typography>
          </Box>
        </Stack>

        <Box />
      </Stack>

      {error ? (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper
        className="audit-trail-filter-panel"
        elevation={0}
        sx={{
          border: "1px solid #dde5ef",
          borderRadius: 2,
          mt: 2,
          p: 1.5,
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <TextField
            select
            label="Module"
            value={draftFilters.module}
            onChange={(event) => setDraftFilters((current) => ({ ...current, module: event.target.value }))}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 240 }}
          >
            {auditModuleOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
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

      <Paper elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2, overflow: "hidden" }}>
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
                <TableCell sx={{ width: "14%" }}>Date / Time</TableCell>
                <TableCell sx={{ width: "14%" }}>Module</TableCell>
                <TableCell sx={{ width: "14%" }}>Action</TableCell>
                <TableCell sx={{ width: "16%" }}>Record</TableCell>
                <TableCell sx={{ width: "30%" }}>Movement Summary</TableCell>
                <TableCell sx={{ width: "12%" }}>User</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!appliedFilters ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    Select a module and movement date range, then click Generate Report.
                  </TableCell>
                </TableRow>
              ) : null}
              {appliedFilters && isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    Loading audit movement report...
                  </TableCell>
                </TableRow>
              ) : null}
              {appliedFilters && !isLoading && events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No audit movement found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : null}
              {paginatedEvents.map((event) => (
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
                  <TruncatedCell align="center">{getActorDisplayName(event)}</TruncatedCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationControls count={events.length} page={page} onChange={setPage} />
      </Paper>

      <Paper
        className="audit-trail-filter-panel"
        elevation={0}
        sx={{
          border: "1px solid #dde5ef",
          borderRadius: 2,
          mt: 2,
          p: 1.5,
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <TextField
            select
            label="Module"
            value={draftFilters.module}
            onChange={(event) => setDraftFilters((current) => ({ ...current, module: event.target.value }))}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 240 }}
          >
            {auditModuleOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
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
  const moduleLabel = getAuditModuleLabel(filters?.module);
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
          <td>${escapeHtml(getActorDisplayName(event))}</td>
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
            <tr><td class="subtitle" colspan="8">Module: ${escapeHtml(moduleLabel)}</td></tr>
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

const getAuditModuleLabel = (value) =>
  auditModuleOptions.find((option) => option.value === value)?.label || "All Modules";

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function enrichEventsWithActorNames(events) {
  // Collect actor ids and emails from the generated report so one lookup can cover the visible and exported rows.
  const actorIds = [...new Set(events.map((event) => event.actor_id).filter(Boolean))];
  const actorEmails = [...new Set(events.map((event) => event.actor_email).filter(Boolean))];
  const profilesById = new Map();
  const profilesByEmail = new Map();

  if (actorIds.length > 0) {
    // Match current audit rows by Supabase auth id whenever the audit event captured it.
    const { data, error } = await supabase
      .from("app_users")
      .select("id, email, display_name")
      .in("id", actorIds);

    if (!error) {
      data?.forEach((profile) => {
        profilesById.set(profile.id, profile);
        if (profile.email) profilesByEmail.set(profile.email.toLowerCase(), profile);
      });
    }
  }

  if (actorEmails.length > 0) {
    // Also match older audit rows by email because some existing records may not have actor_id populated.
    const { data, error } = await supabase
      .from("app_users")
      .select("id, email, display_name")
      .in("email", actorEmails);

    if (!error) {
      data?.forEach((profile) => {
        if (profile.id) profilesById.set(profile.id, profile);
        if (profile.email) profilesByEmail.set(profile.email.toLowerCase(), profile);
      });
    }
  }

  return events.map((event) => {
    // Prefer exact auth-id match, then email match, then a readable fallback generated from the email local part.
    const profile =
      profilesById.get(event.actor_id) ||
      profilesByEmail.get(String(event.actor_email || "").toLowerCase());
    const displayName = profile?.display_name || formatPersonName(event.actor_email);
    return { ...event, actor_display_name: displayName };
  });
}

function getActorDisplayName(event) {
  // Show the user-facing display name in reports, never the raw email unless no readable value exists.
  return event?.actor_display_name || formatPersonName(event?.actor_email) || "System";
}
