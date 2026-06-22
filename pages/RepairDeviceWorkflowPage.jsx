// Repair Device Workflow renders role-based repair/testing queues from the generated repair device records.
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AssignmentIndRoundedIcon from "@mui/icons-material/AssignmentIndRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import { PackageChip, WorkflowStatusChip } from "../components/RepairWorkflowChips.jsx";
import { tests } from "../components/testScripts.js";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { paginateRows } from "../src/lib/pagination.js";
import { formatPersonName, getRecordLabel, getUserDisplayName } from "../src/lib/repairWorkflow.js";
import { supabase } from "../src/lib/supabase.js";

const listColumns = [
  "Company",
  "Client Code",
  "Date Received",
  "Package Style",
  "CST Number",
  "Ticket Number",
  "SN Number",
  "Device Type",
  "With Adapter",
  "Status",
];

const pageCopy = {
  new: {
    icon: <PlaylistAddCheckRoundedIcon fontSize="small" />,
    title: "New Repair Device",
    subtitle: "Available repair and checking tasks waiting to be assigned.",
  },
  my: {
    icon: <AssignmentIndRoundedIcon fontSize="small" />,
    title: "My Repair Device",
    subtitle: "Repair tasks currently assigned to you.",
  },
  all: {
    icon: <AssignmentIndRoundedIcon fontSize="small" />,
    title: "All Repair Device",
    subtitle: "All active repair tasks claimed by any user, shown for viewing only.",
  },
  support: {
    icon: <AssignmentIndRoundedIcon fontSize="small" />,
    title: "Ongoing Support Testing",
    subtitle: "Records finished by repair and waiting for support testing.",
  },
  senior: {
    icon: <AssignmentIndRoundedIcon fontSize="small" />,
    title: "Ongoing Senior Testing",
    subtitle: "Records finished by support testing and waiting for senior testing.",
  },
  done: {
    icon: <CheckCircleRoundedIcon fontSize="small" />,
    title: "Done Repair Device",
    subtitle: "Completed repair workflow records.",
  },
};

export default function RepairDeviceWorkflowPage({ mode, onOpenRecord, userDisplayName, userEmail }) {
  // Store repair workflow rows in the same table shape used by all three repair modules.
  const [records, setRecords] = useState([]);
  // Store loading state while Supabase is reading the repair workflow table.
  const [isLoading, setIsLoading] = useState(true);
  // Store readable errors so missing SQL setup or permission issues are visible to the user.
  const [error, setError] = useState("");
  // Store the selected row id so the table can highlight the user's current focus.
  const [selectedId, setSelectedId] = useState(null);
  // Keep repair workflow queues limited to 20 visible records per page.
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    async function loadRepairRecords() {
      // Start every load with a clean error so old messages do not stay on the page.
      setError("");
      // Show the loading indicator until Supabase returns the rows.
      setIsLoading(true);

      // Build the base query used by all repair workflow lists.
      let query = supabase
        .from("repair_device_records")
        .select("*")
        .order("date_received", { ascending: false });

      // New Repair Device shows unassigned Repair By tasks that need someone to get the repair/checking work.
      if (mode === "new") {
        query = query.is("assigned_to", null).in("workflow_status", ["Repair By", "For Testing"]);
      }

      // My Repair Device shows any active workflow row assigned to the signed-in user.
      if (mode === "my") {
        query = query.eq("assigned_to_email", userEmail).neq("workflow_status", "Done Repair Device");
      }

      // All Repair Device shows every active assigned task so all users can monitor repair movement.
      if (mode === "all") {
        query = query.not("assigned_to_email", "is", null).neq("workflow_status", "Done Repair Device");
      }

      // Ongoing Support Testing is a queue of unassigned records that already passed Repair By.
      if (mode === "support") {
        query = query.is("assigned_to", null).in("workflow_status", ["Tested By", "Test By", "Checked By (Senior)"]);
      }

      // Ongoing Senior Testing is a queue of unassigned records that already passed support testing.
      if (mode === "senior") {
        query = query.is("assigned_to", null).in("workflow_status", ["Senior Tested By", "Senior Test By", "Checked By (Supervisor)"]);
      }

      // Done Repair Device shows completed workflow records.
      if (mode === "done") {
        query = query.eq("workflow_status", "Done Repair Device");
      }

      const { data, error: loadError } = await query;

      if (ignore) return;

      if (loadError) {
        setError(loadError.message);
        setIsLoading(false);
        return;
      }

      const nextRecords = data || [];
      setRecords(nextRecords);
      // Do not auto-select the first row; users must choose a row before queue actions run.
      setSelectedId((current) => (nextRecords.some((record) => record.id === current) ? current : null));
      setIsLoading(false);
    }

    loadRepairRecords();

    return () => {
      ignore = true;
    };
  }, [mode, userEmail]);

  const copy = pageCopy[mode] || pageCopy.new;
  // Queue pages, My Repair Device, and Done Repair Device need a command column.
  const hasActionColumn = mode === "new" || mode === "support" || mode === "senior" || mode === "my" || mode === "done";
  // Queue pages allow the user to claim work before editing it in My Repair Device.
  const isClaimQueue = mode === "new" || mode === "support" || mode === "senior";
  // Render only the current page while keeping the full queue available in state.
  const paginatedRecords = useMemo(
    () => paginateRows(records, page),
    [records, page]
  );

  const handleGetRepair = async (record) => {
    // Read the signed-in Supabase user so assignment records both id and email.
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    const assignedEmail = user?.email || userEmail || "";
    const repairByName = userDisplayName || getUserDisplayName(user, assignedEmail);

    // Update assignment fields so this row moves from the queue to My Repair Device.
    const { data, error: updateError } = await supabase
      .from("repair_device_records")
      .update({
        assigned_at: new Date().toISOString(),
        assigned_to: user?.id || null,
        assigned_to_email: assignedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Mirror personnel fields into Ongoing Testing so generated testing rows stay aligned.
    await syncOngoingTestingPeople(data);

    await logAuditEvent({
      action: mode === "new" ? "GET_REPAIR" : "GET_TESTING_STAGE",
      afterData: data,
      beforeData: record,
      entityId: record.id,
      entityTable: "repair_device_records",
      module: "Testing Device",
      recordLabel: getRecordLabel(record),
      summary: `${repairByName || "User"} got ${pageCopy[mode]?.title || "repair task"} ${getRecordLabel(record)}.`,
    });

    // Remove the row from the queue after it is assigned.
    setRecords((current) => current.filter((item) => item.id !== record.id));
  };

  const handleReturnStatus = async (record) => {
    // Return completed records to supervisor checking only, as requested.
    const nextStatus = "Senior Tested By";
    // Keep the task assigned to the last user when possible so it appears again in My Repair Device.
    const assignedEmail = record.assigned_to_email || userEmail || null;
    // Return completed records to the user's active repair queue by clearing only completion data.
    const { data, error: updateError } = await supabase
      .from("repair_device_records")
      .update({
        assigned_at: record.assigned_at || new Date().toISOString(),
        assigned_to: record.assigned_to || null,
        assigned_to_email: assignedEmail,
        completed_at: null,
        updated_at: new Date().toISOString(),
        workflow_status: nextStatus,
      })
      .eq("id", record.id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await logAuditEvent({
      action: "RETURN_REPAIR_STATUS",
      afterData: data,
      beforeData: record,
      entityId: record.id,
      entityTable: "repair_device_records",
      module: "Testing Device",
      recordLabel: getRecordLabel(record),
      summary: `${getRecordLabel(record)} returned to ${nextStatus}.`,
    });

    // Remove the row from Done Repair Device because it is no longer completed.
    setRecords((current) => current.filter((item) => item.id !== record.id));
  };

  const handleReturnPreviousStage = async (record) => {
    // Resolve the previous queue stage so incorrect work can be corrected by the previous process owner.
    const previousStatus = getPreviousWorkflowStatus(record.workflow_status);

    // Stop when the current record is already in the first stage because there is no earlier queue.
    if (!previousStatus) return;

    // Clear only the sign-off fields that must be re-done after the return.
    const returnPayload = getReturnPayload(previousStatus);

    // Release the record back to the previous queue by clearing the current assignment.
    const { data, error: updateError } = await supabase
      .from("repair_device_records")
      .update({
        ...returnPayload,
        assigned_at: null,
        assigned_to: null,
        assigned_to_email: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
        workflow_status: previousStatus,
      })
      .eq("id", record.id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Keep Ongoing Testing personnel display aligned after a correction return.
    await syncOngoingTestingPeople(data);

    await logAuditEvent({
      action: "RETURN_PREVIOUS_REPAIR_STAGE",
      afterData: data,
      beforeData: record,
      entityId: record.id,
      entityTable: "repair_device_records",
      module: "Testing Device",
      recordLabel: getRecordLabel(record),
      summary: `${getRecordLabel(record)} returned to ${previousStatus}.`,
    });

    // Remove from My Repair Device because returned records go back to the previous queue.
    setRecords((current) => current.filter((item) => item.id !== record.id));
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack className="module-page-header" direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", lg: "center" }} spacing={1.5} sx={{ mb: 2 }}>
        <Stack className="module-page-heading" direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ alignItems: "center", bgcolor: "#e8f2ff", borderRadius: 1.5, color: "#1f5f99", display: "flex", height: 38, justifyContent: "center", width: 38 }}>
            {copy.icon}
          </Box>
          <Box className="module-page-copy">
            <Typography className="module-page-title" variant="h5" component="h1" fontWeight={900}>
              {copy.title}
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              {copy.subtitle}
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2, overflowX: "auto" }}>
        <Table
          size="small"
          sx={{
            minWidth: mode === "new" ? 1180 : 1040,
            "& th": { bgcolor: "#d9d9d9", fontSize: 11, fontWeight: 900, lineHeight: 1.2, px: 0.75, py: 0.9, textAlign: "center" },
            "& td": { fontSize: 11, lineHeight: 1.25, px: 0.75, py: 0.75 },
            "& td, & th": { borderColor: "#dddddd" },
          }}
        >
          <TableHead>
            <TableRow>
              {listColumns.map((column) => (
                <TableCell key={column} align="center">
                  {column}
                </TableCell>
              ))}
              {hasActionColumn ? <TableCell align="center" width={mode === "done" ? 160 : 130}>Action</TableCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={hasActionColumn ? 11 : 10} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={22} />
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasActionColumn ? 11 : 10} align="center" sx={{ py: 4 }}>
                  No repair device records found.
                </TableCell>
              </TableRow>
            ) : null}
            {paginatedRecords.map((record) => (
              <TableRow
                key={record.id}
                hover
                selected={selectedId === record.id}
                onClick={() => setSelectedId(record.id)}
                onDoubleClick={() => {
                  // All Repair Device is a monitoring page only, so double-click opens the form as read-only.
                  onOpenRecord(record.id, mode !== "my");
                }}
                sx={{ cursor: "pointer" }}
              >
                <TableCell align="center">{record.company || "-"}</TableCell>
                <TableCell align="center">{record.client_code || "-"}</TableCell>
                <TableCell align="center">{formatDate(record.date_received)}</TableCell>
                <TableCell align="center"><PackageChip value={record.package_style} /></TableCell>
                <TableCell align="center">{record.cst_number || "-"}</TableCell>
                <TableCell align="center">{record.ticket_number || "-"}</TableCell>
                <TableCell align="center">{record.sn_number || "-"}</TableCell>
                <TableCell align="center">{record.device_type || "-"}</TableCell>
                <TableCell align="center">{record.with_adapter || "-"}</TableCell>
                <TableCell align="center"><WorkflowStatusChip value={record.workflow_status} /></TableCell>
                {isClaimQueue ? (
                  <TableCell align="center" sx={{ px: 0.5, py: 0.45 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleGetRepair(record)}
                      sx={{
                        fontSize: 11,
                        height: 28,
                        minWidth: 62,
                        px: 1,
                        textTransform: "none",
                      }}
                    >
                      Get
                    </Button>
                  </TableCell>
                ) : null}
                {mode === "my" ? (
                  <TableCell align="center" sx={{ px: 0.5, py: 0.45 }}>
                    <Button
                      disabled={!getPreviousWorkflowStatus(record.workflow_status)}
                      size="small"
                      variant="outlined"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleReturnPreviousStage(record);
                      }}
                      sx={{
                        fontSize: 11,
                        height: 28,
                        minWidth: 62,
                        px: 1,
                        textTransform: "none",
                      }}
                    >
                      Return
                    </Button>
                  </TableCell>
                ) : null}
                {mode === "done" ? (
                  <TableCell align="center" sx={{ px: 0.5, py: 0.45 }}>
                    <Stack direction="row" spacing={0.75} justifyContent="center" alignItems="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleReturnStatus(record);
                        }}
                        sx={{
                          fontSize: 11,
                          height: 28,
                          minWidth: 62,
                          px: 1,
                          textTransform: "none",
                        }}
                      >
                        Return
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadRoundedIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          downloadDoneRepairPdf(record);
                        }}
                        sx={{
                          "& .MuiButton-startIcon": { mr: 0.35 },
                          fontSize: 11,
                          height: 28,
                          minWidth: 62,
                          px: 1,
                          textTransform: "none",
                        }}
                      >
                        PDF
                      </Button>
                    </Stack>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationControls count={records.length} page={page} onChange={setPage} />
      </TableContainer>
    </Box>
  );
}

async function syncOngoingTestingPeople(record) {
  // Skip sync when this repair record is not linked to an inventory-generated ongoing testing row.
  if (!record?.source_inventory_id) return;
  // Update Ongoing Testing personnel columns from the repair workflow personnel fields.
  await supabase
    .from("ongoing_testing_items")
    .update({
      repair_by: formatPersonName(record.repair_by) || null,
      senior_test_by: formatPersonName(record.senior_test_by) || null,
      test_by: formatPersonName(record.test_by) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("source_inventory_id", record.source_inventory_id);
}

function formatDate(value) {
  // Render date-only values without timezone shifts.
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";
}

function downloadDoneRepairPdf(record) {
  // Build a one-page landscape PDF so device details and checklist results fit in one corporate report.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString();
  const serialNumber = valueOrBlank(record.sn_number);
  const fileName = `${sanitizeFileName(record.sn_number) || "repair-device-report"}.pdf`;
  const checklistResults = normalizePdfChecklist(record.test_results);

  doc.setProperties({
    subject: "Done repair device report",
    title: `Done Repair Device - ${serialNumber}`,
  });

  // Header band gives the exported PDF a clean corporate report identity.
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ENDIVIO DEVICE MANAGEMENT", 8, 7.5);
  doc.setFontSize(9);
  doc.text("Done Repair Device Report", 8, 13.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Generated: ${generatedAt}`, pageWidth - 8, 7.5, { align: "right" });
  doc.text(`SN Number: ${serialNumber}`, pageWidth - 8, 13.5, { align: "right" });

  autoTable(doc, {
    body: [
      ["Company", valueOrBlank(record.company), "Client Code", valueOrBlank(record.client_code), "Date Received", formatDate(record.date_received)],
      ["Package Style", valueOrBlank(record.package_style), "CST Number", valueOrBlank(record.cst_number), "Ticket Number", valueOrBlank(record.ticket_number)],
      ["SN Number", serialNumber, "Device Type", valueOrBlank(record.device_type), "With Adapter", valueOrBlank(record.with_adapter)],
      ["Status", valueOrBlank(record.workflow_status), "Completed At", formatDateTime(record.completed_at), "Assigned Email", valueOrBlank(record.assigned_to_email)],
    ],
    margin: { left: 8, right: 8 },
    startY: 22,
    styles: {
      cellPadding: 1.1,
      font: "helvetica",
      fontSize: 6.6,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "ellipsize",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fillColor: [226, 232, 240], fontStyle: "bold", textColor: [15, 23, 42] },
      2: { fillColor: [226, 232, 240], fontStyle: "bold", textColor: [15, 23, 42] },
      4: { fillColor: [226, 232, 240], fontStyle: "bold", textColor: [15, 23, 42] },
    },
    theme: "grid",
  });

  autoTable(doc, {
    body: [
      ["Device Algorithm", valueOrBlank(record.device_algorithm), "Device Pinwidth", valueOrBlank(record.device_pinwidth), "Previous Pinwidth", valueOrBlank(record.previous_pinwidth)],
      ["Repair By", formatPersonName(record.repair_by), "Tested By", formatPersonName(record.test_by), "Senior Tested By", formatPersonName(record.senior_test_by)],
      ["Checking Remarks", truncatePdfText(record.checking_remarks, 110), "Additional Comments", truncatePdfText(record.additional_comments, 110), "Record Remarks", truncatePdfText(record.remarks, 110)],
    ],
    margin: { left: 8, right: 8 },
    startY: doc.lastAutoTable.finalY + 2,
    styles: {
      cellPadding: 1,
      font: "helvetica",
      fontSize: 6.2,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      overflow: "ellipsize",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fillColor: [240, 253, 250], fontStyle: "bold", textColor: [15, 118, 110] },
      2: { fillColor: [240, 253, 250], fontStyle: "bold", textColor: [15, 118, 110] },
      4: { fillColor: [240, 253, 250], fontStyle: "bold", textColor: [15, 118, 110] },
    },
    theme: "grid",
  });

  // The checklist table uses very compact text so all 41 scripts stay on the same PDF page.
  autoTable(doc, {
    body: tests.map((test, index) => [
      index + 1,
      test,
      valueOrBlank(checklistResults[index]?.status),
      truncatePdfText(checklistResults[index]?.remarks, 85),
    ]),
    head: [["#", "Test Script", "Status", "Remarks"]],
    margin: { left: 8, right: 8 },
    startY: doc.lastAutoTable.finalY + 3,
    styles: {
      cellPadding: 0.45,
      font: "helvetica",
      fontSize: 4.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.12,
      minCellHeight: 2.85,
      overflow: "ellipsize",
      valign: "middle",
    },
    headStyles: {
      fillColor: [32, 208, 196],
      fontSize: 5.4,
      halign: "center",
      textColor: [6, 20, 19],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 128 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 127 },
    },
    theme: "grid",
  });

  // Footer stays on page one because this report is intentionally compact.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text("This report was generated from the completed repair workflow record.", 8, 204);
  doc.text("Page 1 of 1", pageWidth - 8, 204, { align: "right" });

  doc.save(fileName);
}

function normalizePdfChecklist(value) {
  // Use saved checklist rows when available; otherwise keep a blank row for every configured test script.
  if (Array.isArray(value)) {
    return tests.map((_, index) => value[index] || { remarks: "", status: "" });
  }
  return tests.map(() => ({ remarks: "", status: "" }));
}

function formatDateTime(value) {
  // Render timestamps in the user's browser locale for readable exported reports.
  return value
    ? new Date(value).toLocaleString(undefined, {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";
}

function valueOrBlank(value) {
  // Export tables use a dash so empty database fields remain visible in the PDF.
  const text = String(value || "").trim();
  return text || "-";
}

function truncatePdfText(value, limit) {
  // Keep long remarks inside a one-page PDF by clipping overly long text with an ellipsis.
  const text = valueOrBlank(value);
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function sanitizeFileName(value) {
  // Remove characters that Windows and browsers do not allow in downloaded filenames.
  return String(value || "")
    .trim()
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function getPreviousWorkflowStatus(currentStatus) {
  // Senior testing returns to support testing so the support tester can correct the record.
  if (currentStatus === "Senior Tested By" || currentStatus === "Senior Test By" || currentStatus === "Checked By (Supervisor)") return "Tested By";
  // Support testing returns to repair so the repair checker can correct the record.
  if (currentStatus === "Tested By" || currentStatus === "Test By" || currentStatus === "Checked By (Senior)") return "Repair By";
  // First stage has no previous workflow queue.
  return "";
}

function getReturnPayload(previousStatus) {
  // Returning to repair means all later sign-offs need to be re-done.
  if (previousStatus === "Repair By") return { repair_by: null, senior_test_by: null, test_by: null };
  // Returning to support testing keeps Repair By but clears support and senior sign-offs.
  if (previousStatus === "Tested By") return { senior_test_by: null, test_by: null };
  // No extra sign-off changes are needed for unsupported status values.
  return {};
}
