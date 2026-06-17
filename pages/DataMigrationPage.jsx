import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import {
  applySparePartsWorkbookStyles,
  formatDateForFile,
  getAvailableQuantity,
  getLatestRecordBySerial,
  mapSparePartFromDb,
  mapSparePartToDb,
  normalizeImportKey,
  parseSparePartsImportRows,
  sparePartColumns,
  sparePartsExportHeaders,
} from "./DeviceMonitoringSparePartsPage.jsx";
import {
  exportRepairRecordsExcel,
  findStatusByName,
  getAutomaticInventoryStatusName,
  getDeviceLabel,
  mapDeviceFromDb,
  mapDeviceToDb,
  syncOngoingTestingFromInventory,
  syncRepairDeviceFromInventory,
} from "./RepairRecordsPage.jsx";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { supabase } from "../src/lib/supabase.js";

export default function DataMigrationPage({ mode = "deviceInventory" }) {
  const fileInputRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [sparePartsStatuses, setSparePartsStatuses] = useState([]);
  const [sparePartsRecords, setSparePartsRecords] = useState([]);
  const [repairRecords, setRepairRecords] = useState([]);
  const [repairStatuses, setRepairStatuses] = useState([]);
  const [activeImportKey, setActiveImportKey] = useState("");
  const [notice, setNotice] = useState({ message: "", severity: "success" });

  const isDeviceInventoryMode = mode === "deviceInventory";
  const pageTitle = isDeviceInventoryMode ? "Data Migration - Device Inventory" : "Data Migration - Repair Management";
  const pageDescription = isDeviceInventoryMode
    ? "Import and export device inventory source files from one controlled migration area."
    : "Export repair management records using the approved corporate workbook format.";

  useEffect(() => {
    let ignore = false;

    async function loadMigrationLookups() {
      const [clientsResult, deviceTypesResult, statusesResult, sparePartsResult, repairRecordsResult, repairStatusesResult] = await Promise.all([
        supabase.from("clients").select("id, name, client_code, is_active").order("name", { ascending: true }),
        supabase.from("device_types").select("id, name, is_active").order("name", { ascending: true }),
        supabase.from("spare_parts_statuses").select("id, name, color, is_active").order("name", { ascending: true }),
        supabase
          .from("spare_parts_inventory")
          .select("*, clients ( id, name, client_code ), device_types ( id, name )")
          .order("created_at", { ascending: false }),
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
        supabase.from("statuses").select("id, name, color, is_active").order("name", { ascending: true }),
      ]);

      if (ignore) return;

      const firstError =
        clientsResult.error ||
        deviceTypesResult.error ||
        statusesResult.error ||
        sparePartsResult.error ||
        repairRecordsResult.error ||
        repairStatusesResult.error;

      if (firstError) {
        setNotice({ message: firstError.message, severity: "error" });
        return;
      }

      setClients(clientsResult.data || []);
      setDeviceTypes(deviceTypesResult.data || []);
      setSparePartsStatuses(statusesResult.data || []);
      setSparePartsRecords((sparePartsResult.data || []).map(mapSparePartFromDb));
      setRepairRecords((repairRecordsResult.data || []).map(mapDeviceFromDb));
      setRepairStatuses(repairStatusesResult.data || []);
    }

    loadMigrationLookups();
    return () => {
      ignore = true;
    };
  }, []);

  const migrationRows = useMemo(
    () =>
      isDeviceInventoryMode
        ? [
            {
              description: "Spare-parts monitoring workbook import and export.",
              key: "sparePartsMonitoring",
              title: "Device Monitoring (Spare Parts)",
            },
          ]
        : [
            {
              description: "Repair records workbook import and export.",
              key: "repairRecords",
              title: "Repair Records",
            },
          ],
    [isDeviceInventoryMode]
  );

  const handleSparePartsExport = () => {
    const generatedDate = formatDateForFile(new Date());
    const rows = sparePartsRecords.map((record, index) => [
      index + 1,
      record.clientName || "",
      record.deviceTypeName || "",
      record.boxSerialNumber || "",
      getAvailableQuantity(record.parts),
      record.remarks || "",
      ...sparePartColumns.map((column) => record.parts[column.key] || ""),
    ]);

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
  };

  const handleSparePartsImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const importedRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const parsedRecords = parseSparePartsImportRows(importedRows, clients, deviceTypes, sparePartsStatuses);

      if (!parsedRecords.length) {
        setNotice({ message: "Import stopped. The selected workbook has no spare-parts monitoring records.", severity: "error" });
        return;
      }

      const uniqueImportRecords = getLatestRecordBySerial(parsedRecords);
      const existingBySerial = new Map(sparePartsRecords.map((record) => [normalizeImportKey(record.boxSerialNumber), record]));
      const recordsToUpdate = uniqueImportRecords.filter((record) => existingBySerial.has(normalizeImportKey(record.boxSerialNumber)));
      const recordsToInsert = uniqueImportRecords.filter((record) => !existingBySerial.has(normalizeImportKey(record.boxSerialNumber)));

      const updatedResults = await Promise.all(
        recordsToUpdate.map((record) => {
          const existingRecord = existingBySerial.get(normalizeImportKey(record.boxSerialNumber));
          return supabase
            .from("spare_parts_inventory")
            .update({ ...mapSparePartToDb(record), updated_at: new Date().toISOString() })
            .eq("id", existingRecord.id)
            .select("*, clients ( id, name, client_code ), device_types ( id, name )")
            .single();
        })
      );
      const firstUpdateError = updatedResults.find((result) => result.error)?.error;
      if (firstUpdateError) {
        setNotice({ message: firstUpdateError.message, severity: "error" });
        return;
      }

      const insertPayloads = recordsToInsert.map(mapSparePartToDb);
      const insertResult = insertPayloads.length
        ? await supabase
            .from("spare_parts_inventory")
            .insert(insertPayloads)
            .select("*, clients ( id, name, client_code ), device_types ( id, name )")
        : { data: [], error: null };

      if (insertResult.error) {
        setNotice({ message: insertResult.error.message, severity: "error" });
        return;
      }

      const updatedRecords = updatedResults.map((result) => mapSparePartFromDb(result.data));
      const insertedRecords = (insertResult.data || []).map(mapSparePartFromDb);
      const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));
      setSparePartsRecords((current) => [...current.map((record) => updatedById.get(record.id) || record), ...insertedRecords]);
      setNotice({
        message: `Import completed. ${insertedRecords.length} new record(s) added and ${updatedRecords.length} existing record(s) updated.`,
        severity: "success",
      });

      await logAuditEvent({
        action: "IMPORT",
        afterData: {
          inserted: insertPayloads,
          updated: recordsToUpdate.map(mapSparePartToDb),
        },
        entityId: "bulk-import",
        entityTable: "spare_parts_inventory",
        module: "Data Migration",
        recordLabel: file.name,
        summary: `Imported spare parts monitoring file ${file.name}: ${insertedRecords.length} added, ${updatedRecords.length} updated.`,
      });
    } catch (error) {
      setNotice({ message: error.message || "Failed to import the selected workbook.", severity: "error" });
    }
  };

  const handleRepairRecordsImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true, type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const repairImportRows = readRepairRowsFromSheet(sheet);
      const parsedRecords = parseRepairRecordImportRows(repairImportRows, clients, deviceTypes, repairStatuses);

      if (!parsedRecords.length) {
        setNotice({ message: "Import stopped. The selected workbook has no Repair Records data rows.", severity: "error" });
        return;
      }

      validateUniqueRepairImportRows(parsedRecords);

      const existingKeyLookup = buildRepairExistingKeyLookup(repairRecords);
      const recordsToUpdate = [];
      const recordsToInsert = [];

      parsedRecords.forEach((record) => {
        const matchedRecords = getMatchedRepairRecords(record, existingKeyLookup);
        if (matchedRecords.length > 1) {
          throw new Error(`Import stopped. ${getDeviceLabel(record)} matches multiple existing Repair Records by CST, Ticket, or SN Number.`);
        }

        if (matchedRecords.length === 1) {
          recordsToUpdate.push({ existingRecord: matchedRecords[0], record });
          return;
        }

        recordsToInsert.push(record);
      });

      const updatedResults = await Promise.all(
        recordsToUpdate.map(({ existingRecord, record }) =>
          supabase
            .from("device_inventory_items")
            .update({ ...mapDeviceToDb(record), updated_at: new Date().toISOString() })
            .eq("id", existingRecord.id)
            .select("*, clients ( id, name, client_code ), statuses ( id, name, color )")
            .single()
        )
      );
      const updateError = updatedResults.find((result) => result.error)?.error;
      if (updateError) {
        setNotice({ message: updateError.message, severity: "error" });
        return;
      }

      const insertPayloads = recordsToInsert.map(mapDeviceToDb);
      const insertResult = insertPayloads.length
        ? await supabase
            .from("device_inventory_items")
            .insert(insertPayloads)
            .select("*, clients ( id, name, client_code ), statuses ( id, name, color )")
        : { data: [], error: null };

      if (insertResult.error) {
        setNotice({ message: insertResult.error.message, severity: "error" });
        return;
      }

      const updatedRecords = updatedResults.map((result) => mapDeviceFromDb(result.data));
      const insertedRecords = (insertResult.data || []).map(mapDeviceFromDb);
      const changedRecords = [...updatedRecords, ...insertedRecords];

      const syncMessages = (await Promise.all(
        changedRecords.flatMap((record) => [
          syncOngoingTestingFromInventory(record),
          syncRepairDeviceFromInventory(record),
        ])
      )).filter(Boolean);

      if (syncMessages.length) {
        setNotice({ message: syncMessages[0], severity: "warning" });
      } else {
        setNotice({
          message: `Import completed. ${insertedRecords.length} new Repair Record(s) added and ${updatedRecords.length} existing record(s) updated.`,
          severity: "success",
        });
      }

      const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));
      setRepairRecords((current) => [...current.map((record) => updatedById.get(record.id) || record), ...insertedRecords]);

      await logAuditEvent({
        action: "IMPORT",
        afterData: {
          inserted: insertPayloads,
          updated: recordsToUpdate.map(({ record }) => mapDeviceToDb(record)),
        },
        entityId: "bulk-import",
        entityTable: "device_inventory_items",
        module: "Data Migration",
        recordLabel: file.name,
        summary: `Imported Repair Records file ${file.name}: ${insertedRecords.length} added, ${updatedRecords.length} updated.`,
      });
    } catch (error) {
      setNotice({ message: error.message || "Failed to import the selected Repair Records workbook.", severity: "error" });
    }
  };

  const handleImportClick = (rowKey) => {
    if (rowKey !== "sparePartsMonitoring") {
      setActiveImportKey("repairRecords");
      fileInputRef.current?.click();
      return;
    }
    setActiveImportKey("sparePartsMonitoring");
    fileInputRef.current?.click();
  };

  const handleExportClick = async (rowKey) => {
    if (rowKey === "sparePartsMonitoring") {
      handleSparePartsExport();
      return;
    }
    await exportRepairRecordsExcel(repairRecords, repairStatuses);
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack className="module-page-header" direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.75 }}>
        <Box className="module-page-icon">
          <StorageRoundedIcon fontSize="small" />
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

      <input
        ref={fileInputRef}
        accept=".xlsx,.xls"
        hidden
        type="file"
        onChange={activeImportKey === "repairRecords" ? handleRepairRecordsImport : handleSparePartsImport}
      />

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 0, overflow: "hidden" }}>
        {migrationRows.map((row) => (
          <Stack
            key={row.key}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
              px: 2,
              py: 1.5,
              "&:last-of-type": { borderBottom: 0 },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box className="module-page-icon" sx={{ height: 34, width: 34 }}>
                <Inventory2RoundedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.86rem", lineHeight: 1.2 }}>{row.title}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: "0.72rem", lineHeight: 1.4 }}>
                  {row.description}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="text"
                startIcon={<UploadFileRoundedIcon />}
                onClick={() => handleImportClick(row.key)}
                sx={{ minWidth: 0 }}
              >
                Import
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<DownloadRoundedIcon />}
                onClick={() => handleExportClick(row.key)}
                sx={{ minWidth: 0 }}
              >
                Export
              </Button>
            </Stack>
          </Stack>
        ))}
      </Paper>

      <Snackbar open={Boolean(notice.message)} autoHideDuration={5000} onClose={() => setNotice({ message: "", severity: "success" })}>
        <Alert severity={notice.severity} onClose={() => setNotice({ message: "", severity: "success" })}>
          {notice.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const repairImportHeaders = [
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
  "Start Repairing Support",
  "End Date Support",
  "Start QA",
  "End Date QA",
  "Date Delivered",
  "Give to",
  "Remarks",
];

const readRepairRowsFromSheet = (sheet) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1, raw: false });
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeImportKey(cell) === "company") &&
    row.some((cell) => normalizeImportKey(cell) === "sn number")
  );

  if (headerRowIndex === -1) {
    throw new Error("Import stopped. The workbook must include the Repair Records header row.");
  }

  const headers = rows[headerRowIndex].map((header) => String(header || "").trim());
  return rows.slice(headerRowIndex + 1)
    .map((row) =>
      headers.reduce((record, header, index) => {
        if (header) record[header] = row[index] ?? "";
        return record;
      }, {})
    )
    .filter((row) => repairImportHeaders.some((header) => String(row[header] || "").trim()));
};

const parseRepairRecordImportRows = (rows, clients, deviceTypes, statuses) => {
  const clientLookup = createLookupMap(clients, ["client_code", "name"]);
  const deviceTypeLookup = createLookupMap(deviceTypes, ["name"]);

  return rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const clientText = getImportValue(row, ["Client Code", "Client Name", "Client"]);
    const deviceTypeText = getImportValue(row, ["Device Type"]);
    const snNumber = getImportValue(row, ["SN Number", "Serial Number"]);
    const client = clientLookup.get(normalizeImportKey(clientText));
    const deviceType = deviceTypeLookup.get(normalizeImportKey(deviceTypeText));

    if (!clientText) throw new Error(`Import row ${rowNumber}: Client Code is required.`);
    if (!client) throw new Error(`Import row ${rowNumber}: client "${clientText}" is not configured.`);
    if (!deviceTypeText) throw new Error(`Import row ${rowNumber}: Device Type is required.`);
    if (!deviceType) throw new Error(`Import row ${rowNumber}: device type "${deviceTypeText}" is not configured.`);
    if (!snNumber) throw new Error(`Import row ${rowNumber}: SN Number is required.`);

    const parsedRecord = {
      clientCode: client.client_code || "",
      clientId: client.id,
      clientName: client.name || "",
      company: client.name || getImportValue(row, ["Company"]),
      cstNumber: getImportValue(row, ["CST Number"]),
      dateDelivered: normalizeImportDate(getImportValue(row, ["Date Delivered"])),
      dateReceived: normalizeImportDate(getImportValue(row, ["Date Received"])),
      deviceType: deviceType.name,
      endDateQa: normalizeImportDate(getImportValue(row, ["End Date QA"])),
      endDateSupport: normalizeImportDate(getImportValue(row, ["End Date Support"])),
      giveTo: getImportValue(row, ["Give to", "Give To"]),
      packageStyle: getImportValue(row, ["Package Style"]),
      raisedBy: getImportValue(row, ["Raised by", "Raised By"]),
      remarks: getImportValue(row, ["Remarks"]),
      snNumber,
      startQa: normalizeImportDate(getImportValue(row, ["Start QA"])),
      startRepairingSupport: normalizeImportDate(getImportValue(row, ["Start Repairing Support"])),
      ticketNumber: getImportValue(row, ["Ticket Number"]),
      withAdapter: getImportValue(row, ["With Adapter"]) || "No",
    };
    const automaticStatusName = getAutomaticInventoryStatusName(parsedRecord);
    const automaticStatus = findStatusByName(statuses, automaticStatusName);

    if (!automaticStatus) {
      throw new Error(`Import row ${rowNumber}: please add "${automaticStatusName}" in Configurations > Status before importing.`);
    }

    return {
      ...parsedRecord,
      statusColor: automaticStatus.color,
      statusId: automaticStatus.id,
      statusName: automaticStatus.name,
    };
  });
};

const validateUniqueRepairImportRows = (records) => {
  [
    ["CST Number", "cstNumber"],
    ["Ticket Number", "ticketNumber"],
    ["SN Number", "snNumber"],
  ].forEach(([label, field]) => {
    const seen = new Set();
    records.forEach((record) => {
      const key = normalizeImportKey(record[field]);
      if (!key) return;
      if (seen.has(key)) throw new Error(`Import stopped. Duplicate ${label} found in the selected workbook: ${record[field]}.`);
      seen.add(key);
    });
  });
};

const buildRepairExistingKeyLookup = (records) => {
  const lookup = new Map();
  records.forEach((record) => {
    ["cstNumber", "ticketNumber", "snNumber"].forEach((field) => {
      const key = normalizeImportKey(record[field]);
      if (!key) return;
      if (!lookup.has(field)) lookup.set(field, new Map());
      lookup.get(field).set(key, record);
    });
  });
  return lookup;
};

const getMatchedRepairRecords = (record, lookup) => {
  const matches = new Map();
  ["cstNumber", "ticketNumber", "snNumber"].forEach((field) => {
    const match = lookup.get(field)?.get(normalizeImportKey(record[field]));
    if (match) matches.set(match.id, match);
  });
  return Array.from(matches.values());
};

const getImportValue = (row, possibleHeaders) => {
  const normalizedRow = new Map(
    Object.entries(row).map(([key, value]) => [normalizeImportKey(key).replace(/[^a-z0-9]/g, ""), String(value ?? "").trim()])
  );
  const matchedHeader = possibleHeaders.find((header) => normalizedRow.has(normalizeImportKey(header).replace(/[^a-z0-9]/g, "")));
  return matchedHeader ? normalizedRow.get(normalizeImportKey(matchedHeader).replace(/[^a-z0-9]/g, "")) : "";
};

const createLookupMap = (items, keys) => {
  const lookup = new Map();
  items.forEach((item) => {
    keys.forEach((key) => {
      const value = item[key];
      if (value) lookup.set(normalizeImportKey(value), item);
    });
  });
  return lookup;
};

const normalizeImportDate = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split("-").map(Number);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) {
    const [month, day, rawYear] = text.split("/").map(Number);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return text;
};
