import {
  Box,
  Button,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import {
  applySparePartsWorkbookStyles,
  formatDateForFile,
  getAvailableQuantity,
  mapSparePartFromDb,
  sparePartColumns,
  sparePartsExportHeaders,
} from "./DeviceMonitoringSparePartsPage.jsx";
import {
  exportRepairRecordsExcel,
  mapDeviceFromDb,
} from "./RepairRecordsPage.jsx";
import { supabase } from "../src/lib/supabase.js";

const allClientsValue = "__all_clients__";
const allDeviceTypesValue = "__all_device_types__";

const compactSelectMenuProps = {
  marginThreshold: 12,
  MenuListProps: {
    dense: true,
    className: "compact-select-menu-list",
  },
  PaperProps: {
    className: "compact-select-menu-paper",
  },
};

export default function ReportsPage({ mode = "deviceInventory" }) {
  const isDeviceInventoryMode = mode === "deviceInventory";
  const [records, setRecords] = useState([]);
  const [repairRecords, setRepairRecords] = useState([]);
  const [repairStatuses, setRepairStatuses] = useState([]);
  const [clients, setClients] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [selectedReport, setSelectedReport] = useState("");
  const [clientFilter, setClientFilter] = useState(allClientsValue);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState(allDeviceTypesValue);
  const [repairDateFilters, setRepairDateFilters] = useState({
    receivedFrom: "",
    receivedTo: "",
    deliveredFrom: "",
    deliveredTo: "",
  });
  const [outputType, setOutputType] = useState("PDF");
  const [notice, setNotice] = useState("");

  const pageTitle = isDeviceInventoryMode ? "Reports - Device Inventory" : "Reports - Repair Management";
  const pageDescription = isDeviceInventoryMode
    ? "Generate device inventory reports from monitoring and spare-parts records."
    : "Generate repair management reports from repair records, tracking, and workflow activity.";

  useEffect(() => {
    let ignore = false;

    async function loadReportLookups() {
      const [recordsResult, clientsResult, deviceTypesResult, repairRecordsResult, repairStatusesResult] = await Promise.all([
        supabase
          .from("spare_parts_inventory")
          .select(`
            id,
            client_id,
            device_type_id,
            box_serial_number,
            quantity_available,
            remarks,
            parts_status,
            clients ( id, name, client_code ),
            device_types ( id, name )
          `)
          .order("created_at", { ascending: true }),
        supabase
          .from("clients")
          .select("id, name, client_code, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("device_types")
          .select("id, name, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("device_inventory_items")
          .select(`
            id,
            company,
            client_id,
            raised_by,
            date_received,
            package_style,
            cst_number,
            ticket_number,
            sn_number,
            device_type,
            with_adapter,
            start_repairing_support,
            end_date_support,
            start_qa,
            end_date_qa,
            status_id,
            date_delivered,
            give_to,
            remarks,
            clients ( id, name, client_code ),
            statuses ( id, name, color )
          `)
          .order("date_received", { ascending: false }),
        supabase
          .from("statuses")
          .select("id, name, color, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (ignore) return;

      if (
        recordsResult.error ||
        clientsResult.error ||
        deviceTypesResult.error ||
        repairRecordsResult.error ||
        repairStatusesResult.error
      ) {
        setNotice("Unable to load report data. Please refresh the page and try again.");
        return;
      }

      setRecords((recordsResult.data || []).map(mapSparePartFromDb));
      setClients(clientsResult.data || []);
      setDeviceTypes(deviceTypesResult.data || []);
      setRepairRecords((repairRecordsResult.data || []).map(mapDeviceFromDb));
      setRepairStatuses(repairStatusesResult.data || []);
    }

    loadReportLookups();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const matchesClient = clientFilter === allClientsValue || record.clientId === clientFilter;
        const matchesDeviceType = deviceTypeFilter === allDeviceTypesValue || record.deviceTypeId === deviceTypeFilter;
        return matchesClient && matchesDeviceType;
      }),
    [clientFilter, deviceTypeFilter, records]
  );

  const reportRows = useMemo(
    () =>
      filteredRecords.map((record, index) => [
        index + 1,
        record.clientName || "",
        record.deviceTypeName || "",
        record.boxSerialNumber || "",
        getAvailableQuantity(record.parts),
        record.remarks || "",
        ...sparePartColumns.map((column) => record.parts[column.key] || ""),
      ]),
    [filteredRecords]
  );

  const filteredRepairRecords = useMemo(
    () =>
      repairRecords.filter((record) => {
        const receivedDate = normalizeDateText(record.dateReceived);
        const deliveredDate = normalizeDateText(record.dateDelivered);
        const matchesReceivedFrom = !repairDateFilters.receivedFrom || receivedDate >= repairDateFilters.receivedFrom;
        const matchesReceivedTo = !repairDateFilters.receivedTo || receivedDate <= repairDateFilters.receivedTo;
        const matchesDeliveredFrom = !repairDateFilters.deliveredFrom || deliveredDate >= repairDateFilters.deliveredFrom;
        const matchesDeliveredTo = !repairDateFilters.deliveredTo || deliveredDate <= repairDateFilters.deliveredTo;

        return matchesReceivedFrom && matchesReceivedTo && matchesDeliveredFrom && matchesDeliveredTo;
      }),
    [repairDateFilters, repairRecords]
  );

  const handleGenerateReport = () => {
    if (!selectedReport) {
      setNotice("Please select a report before generating an output.");
      return;
    }

    if (selectedReport === "sparePartsMonitoring" && outputType === "Excel") {
      if (!reportRows.length) {
        setNotice("No records found for the selected report filters.");
        return;
      }
      generateSparePartsExcel(reportRows);
      return;
    }

    if (selectedReport === "sparePartsMonitoring") {
      if (!reportRows.length) {
        setNotice("No records found for the selected report filters.");
        return;
      }
      generateSparePartsPdf(reportRows, {
        clientName: getSelectedClientName(clients, clientFilter),
        deviceTypeName: getSelectedDeviceTypeName(deviceTypes, deviceTypeFilter),
      });
      return;
    }

    if (!filteredRepairRecords.length) {
      setNotice("No repair records found for the selected report filters.");
      return;
    }

    if (outputType === "Excel") {
      exportRepairRecordsExcel(filteredRepairRecords, repairStatuses);
      return;
    }

    generateRepairRecordsPdf(filteredRepairRecords, repairStatuses, repairDateFilters);
  };

  return (
    <Box
      component="main"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100svh",
        p: { xs: 2, md: 3 },
        textAlign: "left",
      }}
    >
      <Stack className="module-page-header" direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.75 }}>
        <Box className="module-page-icon">
          <AssessmentRoundedIcon fontSize="small" />
        </Box>
        <Box className="module-page-copy">
          <Typography className="module-page-title" variant="h5" component="h1">
            {pageTitle}
          </Typography>
          <Typography className="module-page-description" variant="caption" color="text.secondary">
            {pageDescription}
          </Typography>
        </Box>
      </Stack>

      {isDeviceInventoryMode ? (
        <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 0, overflow: "hidden" }}>
            <ReportListRow
              active={selectedReport === "sparePartsMonitoring"}
              icon={<TableChartRoundedIcon fontSize="small" />}
              title="Device Monitoring (Spare Parts)"
              onClick={() => setSelectedReport("sparePartsMonitoring")}
            />
          </Paper>

          {selectedReport === "sparePartsMonitoring" && (
            <Paper
              className="reports-repair-filter-panel"
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0,
                mt: "auto",
                p: 1.5,
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <TextField
                  select
                  label="Client"
                  size="small"
                  value={clientFilter}
                  SelectProps={{ MenuProps: compactSelectMenuProps }}
                  sx={{ minWidth: { xs: "100%", md: 240 } }}
                  onChange={(event) => setClientFilter(event.target.value)}
                >
                  <MenuItem value={allClientsValue}>All Clients</MenuItem>
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Device Type"
                  size="small"
                  value={deviceTypeFilter}
                  SelectProps={{ MenuProps: compactSelectMenuProps }}
                  sx={{ minWidth: { xs: "100%", md: 240 } }}
                  onChange={(event) => setDeviceTypeFilter(event.target.value)}
                >
                  <MenuItem value={allDeviceTypesValue}>All Device Types</MenuItem>
                  {deviceTypes.map((deviceType) => (
                    <MenuItem key={deviceType.id} value={deviceType.id}>
                      {deviceType.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Type"
                  size="small"
                  value={outputType}
                  SelectProps={{ MenuProps: compactSelectMenuProps }}
                  sx={{ minWidth: { xs: "100%", md: 150 } }}
                  onChange={(event) => setOutputType(event.target.value)}
                >
                  <MenuItem value="PDF">PDF</MenuItem>
                  <MenuItem value="Excel">Excel</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  startIcon={outputType === "PDF" ? <PictureAsPdfRoundedIcon /> : <DownloadRoundedIcon />}
                  sx={{ minHeight: 40, px: 2.4 }}
                  onClick={handleGenerateReport}
                >
                  Generate Report
                </Button>
              </Stack>
            </Paper>
          )}
        </Box>
      ) : (
        <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 0, overflow: "hidden" }}>
            <ReportListRow
              active={selectedReport === "repairRecords"}
              icon={<DescriptionRoundedIcon fontSize="small" />}
              title="Repair Records"
              onClick={() => setSelectedReport("repairRecords")}
            />
          </Paper>

          {selectedReport === "repairRecords" && (
            <Paper
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0,
                mt: "auto",
                p: 1.5,
              }}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.25}
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <ReportDateField
                    label="Date Received From"
                    value={repairDateFilters.receivedFrom}
                    onChange={(value) => setRepairDateFilters((current) => ({ ...current, receivedFrom: value }))}
                  />
                  <ReportDateField
                    label="Date Received To"
                    value={repairDateFilters.receivedTo}
                    onChange={(value) => setRepairDateFilters((current) => ({ ...current, receivedTo: value }))}
                  />
                  <ReportDateField
                    label="Date Deliver From"
                    value={repairDateFilters.deliveredFrom}
                    onChange={(value) => setRepairDateFilters((current) => ({ ...current, deliveredFrom: value }))}
                  />
                  <ReportDateField
                    label="Date Deliver To"
                    value={repairDateFilters.deliveredTo}
                    onChange={(value) => setRepairDateFilters((current) => ({ ...current, deliveredTo: value }))}
                  />
                  <TextField
                    select
                    label="Type"
                    size="small"
                    value={outputType}
                    SelectProps={{ MenuProps: compactSelectMenuProps }}
                    sx={{ minWidth: { xs: "100%", md: 150 } }}
                    onChange={(event) => setOutputType(event.target.value)}
                  >
                    <MenuItem value="PDF">PDF</MenuItem>
                    <MenuItem value="Excel">Excel</MenuItem>
                  </TextField>
                </Stack>
                <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                  <Button
                    variant="contained"
                    startIcon={outputType === "PDF" ? <PictureAsPdfRoundedIcon /> : <DownloadRoundedIcon />}
                    sx={{ minHeight: 40, px: 2.4 }}
                    onClick={handleGenerateReport}
                  >
                    Generate Report
                  </Button>
                </Box>
              </Stack>
            </Paper>
          )}
        </Box>
      )}

      <Snackbar
        autoHideDuration={3500}
        message={notice}
        open={Boolean(notice)}
        onClose={() => setNotice("")}
      />
    </Box>
  );
}

function ReportListRow({ active, icon, title, onClick }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      sx={{
        alignItems: "center",
        bgcolor: active ? "primary.main" : "transparent",
        color: active ? "primary.contrastText" : "text.primary",
        cursor: "pointer",
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: "34px 1fr",
        px: 1.5,
        py: 1.2,
        textAlign: "left",
        transition: "background-color 160ms ease",
        "&:hover": {
          bgcolor: active ? "primary.main" : "action.hover",
        },
      }}
    >
      <Box sx={{ color: active ? "inherit" : "primary.main", display: "grid", placeItems: "center" }}>{icon}</Box>
      <Box className="report-list-row-copy" sx={{ minWidth: 0, textAlign: "left" }}>
        <Typography className="report-list-row-title" sx={{ fontSize: "0.92rem", lineHeight: 1.25 }}>
          {title}
        </Typography>
      </Box>
    </Box>
  );
}

function ReportDateField({ label, value, onChange }) {
  return (
    <TextField
      className="reports-date-filter-field"
      label={label}
      size="small"
      type="date"
      value={value}
      slotProps={{ inputLabel: { shrink: true } }}
      sx={{ minWidth: { xs: "100%", md: 210 } }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function generateSparePartsExcel(rows) {
  const generatedDate = formatDateForFile(new Date());
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Device Monitoring (Spare Parts)"],
    ["Date Generated", generatedDate],
    [],
    sparePartsExportHeaders,
    ...rows,
  ]);

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 18 },
    { wch: 28 },
    { wch: 10 },
    { wch: 32 },
    ...sparePartColumns.map(() => ({ wch: 22 })),
  ];
  worksheet["!rows"] = [{ hpt: 24 }, { hpt: 20 }, { hpt: 10 }, { hpt: 28 }, ...rows.map(() => ({ hpt: 22 }))];
  applySparePartsWorkbookStyles(worksheet, sparePartsExportHeaders.length, rows.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Spare Parts Monitoring");
  XLSX.writeFile(workbook, `Device-Monitoring-(Spare Parts)-${generatedDate}.xlsx`, { bookType: "xlsx" });
}

function generateSparePartsPdf(rows, filters) {
  const generatedDate = formatDateForFile(new Date());
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Device Monitoring (Spare Parts)", 32, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date Generated: ${generatedDate}`, 32, 50);
  doc.text(`Client: ${filters.clientName}`, 32, 64);
  doc.text(`Device Type: ${filters.deviceTypeName}`, 240, 64);

  autoTable(doc, {
    head: [sparePartsExportHeaders],
    body: rows,
    margin: { left: 18, right: 18 },
    startY: 82,
    styles: {
      cellPadding: 2.2,
      font: "helvetica",
      fontSize: 5.8,
      lineColor: [213, 226, 238],
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [183, 225, 205],
      fontStyle: "bold",
      halign: "center",
      textColor: [0, 0, 0],
    },
    alternateRowStyles: { fillColor: [244, 250, 248] },
    bodyStyles: { halign: "center", textColor: [24, 33, 45] },
    columnStyles: {
      1: { cellWidth: 58 },
      3: { cellWidth: 62 },
      5: { cellWidth: 72 },
    },
    theme: "grid",
  });

  doc.save(`Device-Monitoring-(Spare Parts)-${generatedDate}.pdf`);
}

function generateRepairRecordsPdf(records, statuses, filters) {
  const generatedDate = formatDateForFile(new Date());
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const headers = [
    "Company",
    "Client Code",
    "Raised by",
    "Date Received",
    "Package Style",
    "CST Number",
    "Ticket Number",
    "SN Number",
    "Device Type",
    "With Adapter",
    "Status",
    "Date Delivered",
    "Remarks",
  ];
  const rows = records.map((record) => {
    const status = statuses.find((entry) => entry.id === record.statusId);
    return [
      record.company,
      record.clientCode,
      record.raisedBy,
      record.dateReceived,
      record.packageStyle,
      record.cstNumber,
      record.ticketNumber,
      record.snNumber,
      record.deviceType,
      record.withAdapter,
      status?.name || record.statusName,
      record.dateDelivered,
      record.remarks,
    ];
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Repair Records", 32, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date Generated: ${generatedDate}`, 32, 50);
  doc.text(`Date Received: ${filters.receivedFrom || "All"} to ${filters.receivedTo || "All"}`, 32, 64);
  doc.text(`Date Delivered: ${filters.deliveredFrom || "All"} to ${filters.deliveredTo || "All"}`, 260, 64);

  autoTable(doc, {
    head: [headers],
    body: rows,
    margin: { left: 18, right: 18 },
    startY: 82,
    styles: {
      cellPadding: 2.5,
      font: "helvetica",
      fontSize: 6.2,
      lineColor: [213, 226, 238],
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [32, 208, 196],
      fontStyle: "bold",
      halign: "center",
      textColor: [0, 0, 0],
    },
    alternateRowStyles: { fillColor: [244, 250, 248] },
    bodyStyles: { halign: "center", textColor: [24, 33, 45] },
    columnStyles: {
      0: { cellWidth: 78 },
      6: { cellWidth: 62 },
      7: { cellWidth: 70 },
      12: { cellWidth: 90, halign: "left" },
    },
    theme: "grid",
  });

  doc.save(`Repair-Record-${generatedDate}.pdf`);
}

function getSelectedClientName(clients, selectedId) {
  if (selectedId === allClientsValue) return "All Clients";
  return clients.find((client) => client.id === selectedId)?.name || "All Clients";
}

function getSelectedDeviceTypeName(deviceTypes, selectedId) {
  if (selectedId === allDeviceTypesValue) return "All Device Types";
  return deviceTypes.find((deviceType) => deviceType.id === selectedId)?.name || "All Device Types";
}

function normalizeDateText(value) {
  return String(value || "").slice(0, 10);
}
