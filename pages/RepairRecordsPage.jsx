// Repair Records is the main inventory intake module and the source for repair/testing workflow records.
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import UnsubscribeRoundedIcon from "@mui/icons-material/UnsubscribeRounded";
import { useEffect, useMemo, useState } from "react";
import { archiveRecord } from "../src/lib/archiveRecord.js";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { supabase } from "../src/lib/supabase.js";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { defaultEmailTemplates } from "../src/lib/emailTemplates.js";
import { paginateRows } from "../src/lib/pagination.js";
import { applyRepairRecordTemplate } from "../src/lib/repairRecordFields.js";
import { validateRepairRecordForm } from "../src/lib/validation.js";
import { mergeEmailTemplates } from "../src/services/emailConfigurationService.js";
import { openMailDraft, sendWithOutlookHelper } from "../src/services/outlookMailService.js";
import { deleteRepairRecord, fetchRepairRecordsData, insertRepairRecord, updateRepairRecord } from "../src/services/repairRecordsService.js";
import * as XLSX from "xlsx-js-style";

const blankDevice = {
  company: "",
  clientId: "",
  raisedBy: "",
  dateReceived: "",
  packageStyle: "",
  cstNumber: "",
  ticketNumber: "",
  snNumber: "",
  deviceType: "",
  withAdapter: "No",
  startRepairingSupport: "",
  endDateSupport: "",
  startQa: "",
  endDateQa: "",
  statusId: "",
  dateDelivered: "",
  giveTo: "",
  remarks: "",
};

const packageStyles = ["With Box", "Plastic", "Paper Bag"];
const adapterOptions = ["Yes", "No"];
// Table remarks are intentionally shortened; the full text remains available in the edit dialog.
const remarksPreviewMaxLength = 90;

const compactSelectMenuProps = {
  marginThreshold: 12,
  MenuListProps: {
    dense: true,
    className: "compact-select-menu-list",
    sx: {
      maxHeight: 220,
      overflowX: "hidden",
      overflowY: "hidden",
      p: 0,
      "& .MuiMenuItem-root": {
        minHeight: 34,
        px: 1.5,
        py: 0.75,
      },
    },
  },
  PaperProps: {
    className: "compact-select-menu-paper",
    sx: {
      maxHeight: "220px !important",
      maxWidth: "420px !important",
      minWidth: "260px !important",
      overflow: "hidden !important",
      width: "auto !important",
    },
  },
  slotProps: {
    paper: {
      className: "compact-select-menu-paper",
      sx: {
        maxHeight: "220px !important",
        maxWidth: "420px !important",
        minWidth: "260px !important",
        overflow: "hidden !important",
        width: "auto !important",
      },
    },
  },
};

// Pass the same compact menu settings through MUI's current TextField select API.
const compactSelectSlotProps = {
  select: {
    MenuProps: compactSelectMenuProps,
  },
};

export default function DeviceManagementPage() {
  // Store inventory rows exactly as the UI table consumes them.
  const [items, setItems] = useState([]);
  // Store active clients and statuses for dropdowns and display chips.
  const [clients, setClients] = useState([]);
  const [statuses, setStatuses] = useState([]);
  // Store configured device types so the inventory dialog uses a controlled selection list.
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState(defaultEmailTemplates);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    receivedFrom: "",
    receivedTo: "",
    deliveredFrom: "",
    deliveredTo: "",
  });
  const [draftFilters, setDraftFilters] = useState({
    receivedFrom: "",
    receivedTo: "",
    deliveredFrom: "",
    deliveredTo: "",
  });
  // Track the visible table page so only 20 inventory rows render at a time.
  const [page, setPage] = useState(1);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  useEffect(() => {
    let ignore = false;

    async function loadDevices() {
      setIsLoading(true);
      try {
        // Load inventory rows and lookup tables together so the table can render labels immediately.
        const data = await fetchRepairRecordsData();
        if (ignore) {
          return;
        }

        const mappedItems = data.records.map(mapDeviceFromDb);
        setItems(mappedItems);
        setStatuses(data.statuses);
        setClients(data.clients);
        setDeviceTypes(data.deviceTypes);
        // Merge saved email settings over defaults so Register/Unregister still work before configuration is edited.
        setEmailTemplates(mergeEmailTemplates(data.emailTemplates));
        // Do not auto-select the first row; users must click a row before editing or deleting.
        setSelectedId((current) => (mappedItems.some((item) => item.id === current) ? current : null));
        setError("");
        setIsLoading(false);
      } catch (loadError) {
        if (ignore) {
          return;
        }
        setError(loadError.message || "Failed to load repair records.");
        setIsLoading(false);
      }
    }

    loadDevices();

    return () => {
      ignore = true;
    };
  }, []);

  const displayedItems = useMemo(
    () =>
      // Apply date filters only after the user clicks Apply, matching the existing workflow.
      items.filter((item) => {
        const receivedOk = isInsideRange(
          item.dateReceived,
          filters.receivedFrom,
          filters.receivedTo
        );
        const deliveredOk = isInsideRange(
          item.dateDelivered,
          filters.deliveredFrom,
          filters.deliveredTo
        );
        return receivedOk && deliveredOk;
      }),
    [filters, items]
  );

  // Keep the full filtered list available for export while showing only one page in the table.
  const paginatedItems = useMemo(
    () => paginateRows(displayedItems, page),
    [displayedItems, page]
  );

  const handleSave = async (form) => {
    const validationErrors = validateRepairRecordForm(form);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    // Derive inventory status from date fields so users do not manually choose workflow status.
    const automaticStatusName = getAutomaticInventoryStatusName(form);
    // Look up the automatic status from Configurations to keep status values centrally managed.
    const automaticStatus = findStatusByName(statuses, automaticStatusName);
    if (!automaticStatus) {
      setError(`Please add "${automaticStatusName}" in Configurations > Status before saving this inventory record.`);
      return;
    }
    const formWithAutomaticStatus = {
      ...form,
      statusId: automaticStatus.id,
      statusName: automaticStatus.name,
      statusColor: automaticStatus.color,
    };
    // Convert UI field names into database column names before saving.
    const payload = mapDeviceToDb(formWithAutomaticStatus);

    if (dialogMode === "new") {
      // Insert newly encoded inventory record into Supabase.
      let data;
      try {
        data = await insertRepairRecord(payload);
      } catch (insertError) {
        setError(insertError.message || "Failed to save repair record.");
        return;
      }

      const nextItem = mapDeviceFromDb(data);
      // Mirror the new inventory record into Ongoing Testing so that page becomes a generated workflow view.
      const syncError = await syncOngoingTestingFromInventory(nextItem);
      // Mirror the new inventory record into Testing Device so repair tasks appear in New Repair Device.
      const repairSyncError = await syncRepairDeviceFromInventory(nextItem);
      // Keep the saved inventory row visible even if the generated testing sync fails.
      setItems((current) => [nextItem, ...current]);
      // Select the saved row so the user can immediately see which inventory record was created.
      setSelectedId(nextItem.id);
      // Close the dialog after the inventory save to avoid duplicate inserts on another Save click.
      setDialogMode(null);
      // Show the sync problem after the inventory row is safely saved.
      if (syncError || repairSyncError) {
        setError([syncError, repairSyncError].filter(Boolean).join(" "));
        return;
      }
      await logAuditEvent({
        action: "CREATE",
        afterData: payload,
        entityId: nextItem.id,
        entityTable: "device_inventory_items",
        module: "Inventory Records",
        recordLabel: getDeviceLabel(nextItem),
        summary: `Created inventory record for ${getDeviceLabel(nextItem)}.`,
      });
      setError("");
      return;
    }

    // Update the selected inventory record while preserving its row identity.
    let data;
    try {
      data = await updateRepairRecord(selectedId, payload);
    } catch (updateError) {
      setError(updateError.message || "Failed to update repair record.");
      return;
    }

    const updatedItem = mapDeviceFromDb(data);
    // Keep the generated Ongoing Testing row aligned whenever inventory dates or status change.
    const syncError = await syncOngoingTestingFromInventory(updatedItem);
    // Keep the generated Testing Device row aligned whenever inventory identifying details change.
    const repairSyncError = await syncRepairDeviceFromInventory(updatedItem);
    // Keep the edited inventory row visible even if the generated testing sync fails.
    setItems((current) => current.map((item) => (item.id === selectedId ? updatedItem : item)));
    // Close the dialog after the inventory update to avoid repeated saves against the same edit.
    setDialogMode(null);
    // Show the sync problem after the inventory row is safely updated.
    if (syncError || repairSyncError) {
      setError([syncError, repairSyncError].filter(Boolean).join(" "));
      return;
    }
    await logAuditEvent({
      action: "UPDATE",
      afterData: payload,
      beforeData: selectedItem ? mapDeviceToDb(selectedItem) : null,
      entityId: updatedItem.id,
      entityTable: "device_inventory_items",
      module: "Inventory Records",
      recordLabel: getDeviceLabel(updatedItem),
      summary: `Updated inventory record for ${getDeviceLabel(updatedItem)}.`,
    });
    setError("");

  };

  const handleDelete = async () => {
    if (!selectedItem) {
      return;
    }

    // Archive first so deleted inventory records can be restored by the user later.
    const { error: archiveError } = await archiveRecord({
      recordData: mapDeviceToDb(selectedItem),
      recordLabel: selectedItem.snNumber || selectedItem.cstNumber || selectedItem.ticketNumber || selectedItem.company,
      recordType: "Inventory Record",
      sourceTable: "device_inventory_items",
    });

    if (archiveError) {
      setError(`Failed to archive record: ${archiveError.message}`);
      return;
    }

    try {
      await deleteRepairRecord(selectedId);
    } catch (deleteError) {
      setError(deleteError.message || "Failed to archive repair record.");
      return;
    }

    await logAuditEvent({
      action: "ARCHIVE",
      beforeData: mapDeviceToDb(selectedItem),
      entityId: selectedItem.id,
      entityTable: "device_inventory_items",
      module: "Inventory Records",
      recordLabel: getDeviceLabel(selectedItem),
      summary: `Archived inventory record for ${getDeviceLabel(selectedItem)}.`,
    });
    setItems((current) => current.filter((item) => item.id !== selectedId));
    // Keep Edit/Delete disabled after deletion until the user intentionally selects another row.
    setSelectedId(null);
    setError("");
  };

  const updateFilter = (field) => (event) => {
    setDraftFilters((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleOpenEmail = async (templateKey) => {
    if (!selectedItem) {
      return;
    }

    // Replace placeholders such as #SN and #DEVICE_TYPE with values from the selected repair record.
    const template = emailTemplates[templateKey] || defaultEmailTemplates[templateKey];
    const payload = {
      to: applyRepairRecordTemplate(template.to_email || "", selectedItem, formatDisplayDate),
      cc: applyRepairRecordTemplate(template.cc_email || "", selectedItem, formatDisplayDate),
      subject: applyRepairRecordTemplate(template.subject || "", selectedItem, formatDisplayDate),
      body: applyRepairRecordTemplate(template.body || "", selectedItem, formatDisplayDate),
    };

    try {
      // Prefer the local Outlook COM helper for automatic sending; fall back to an editable draft if it is not running.
      await sendWithOutlookHelper(payload);
      setError("");
    } catch {
      openMailDraft(payload);
      setError("");
    }
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack
        className="module-page-header"
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        spacing={1.5}
        sx={{ mb: 1.75 }}
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
              <Inventory2RoundedIcon fontSize="small" />
          </Box>
          <Box className="module-page-copy">
            <Typography className="module-page-title" variant="h5" component="h1" fontWeight={900}>
              Repair Records
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              Manage device movement, QA dates, delivery, and remarks.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogMode("new")}
            variant="contained"
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Add New Record
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<EditRoundedIcon />}
            disabled={!selectedItem}
            onClick={() => setDialogMode("edit")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Edit Record
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<MarkEmailReadRoundedIcon />}
            disabled={!selectedItem}
            onClick={() => handleOpenEmail("registerDevice")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Register Device
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<UnsubscribeRoundedIcon />}
            disabled={!selectedItem}
            onClick={() => handleOpenEmail("unregisterDevice")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Unregister Device
          </Button>
          <Button size="small" variant="contained" color="error" startIcon={<DeleteRoundedIcon />} disabled={!selectedItem} onClick={handleDelete} sx={{ textTransform: "none", fontWeight: 600 }}>
            Delete
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ mb: 2, p: 1.5, border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Date Received From" type="date" value={draftFilters.receivedFrom} onChange={updateFilter("receivedFrom")} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 180 }} />
          <TextField size="small" label="Date Received To" type="date" value={draftFilters.receivedTo} onChange={updateFilter("receivedTo")} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 180 }} />
          <TextField size="small" label="Date Delivered From" type="date" value={draftFilters.deliveredFrom} onChange={updateFilter("deliveredFrom")} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 180 }} />
          <TextField size="small" label="Date Delivered To" type="date" value={draftFilters.deliveredTo} onChange={updateFilter("deliveredTo")} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 180 }} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltRoundedIcon />}
            onClick={() => {
              setPage(1);
              setFilters(draftFilters);
            }}
            sx={{ textTransform: "none" }}
          >
            Apply
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ClearRoundedIcon />}
            onClick={() => {
              const emptyFilters = {
                receivedFrom: "",
                receivedTo: "",
                deliveredFrom: "",
                deliveredTo: "",
              };
              setPage(1);
              setDraftFilters(emptyFilters);
              setFilters(emptyFilters);
            }}
            sx={{ textTransform: "none" }}
          >
            Clear
          </Button>
        </Stack>
      </Paper>

      {error ? (
        <Box sx={{ bgcolor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 1.5, color: "#be123c", mb: 2, p: 1.5 }}>
          {error}
        </Box>
      ) : null}

      <Paper elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2, overflow: "hidden" }}>
        <TableContainer className="inventory-records-table-scroll" sx={{ overflowX: "auto" }}>
          <Table
            size="small"
            sx={{
              minWidth: 1860,
              "& th": {
                bgcolor: "#d9d9d9",
                fontSize: 11,
                fontWeight: 900,
                lineHeight: 1.2,
                px: 0.5,
                py: 0.85,
                textAlign: "center",
              },
              "& td": {
                fontSize: 11,
                lineHeight: 1.25,
                px: 0.5,
                py: 0.6,
              },
              "& td *": {
                fontSize: "11px !important",
              },
              "& td, & th": { borderColor: "#dddddd" },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell align="center">Company</TableCell>
                <TableCell align="center">Client Code</TableCell>
                <TableCell align="center">Raised by</TableCell>
                <TableCell align="center">Date Received</TableCell>
                <TableCell align="center">Package Style</TableCell>
                <TableCell align="center">CST Number</TableCell>
                <TableCell align="center">Ticket Number</TableCell>
                <TableCell align="center">SN Number</TableCell>
                <TableCell align="center">Device Type</TableCell>
                <TableCell align="center">With Adapter</TableCell>
                <TableCell align="center">Start Repairing Support</TableCell>
                <TableCell align="center">End Date Support</TableCell>
                <TableCell align="center">Start QA</TableCell>
                <TableCell align="center">End Date QA</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Date Delivered</TableCell>
                <TableCell align="center">Give to</TableCell>
                <TableCell align="center">Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={18} align="center" sx={{ py: 4 }}>
                    Loading records from Database...
                  </TableCell>
                </TableRow>
              ) : null}
              {!isLoading && displayedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={18} align="center" sx={{ py: 4 }}>
                    No records found.
                  </TableCell>
                </TableRow>
              ) : null}
              {paginatedItems.map((item) => {
                const status = statuses.find((entry) => entry.id === item.statusId);
                return (
                  <TableRow key={item.id} hover selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} sx={{ cursor: "pointer" }}>
                    <TableCell align="center">{item.company || "-"}</TableCell>
                    <TableCell align="center">{item.clientCode || "-"}</TableCell>
                    <TableCell align="center">{item.raisedBy || "-"}</TableCell>
                    <TableCell align="center">{formatDisplayDate(item.dateReceived)}</TableCell>
                    <TableCell align="center"><PackageChip value={item.packageStyle} /></TableCell>
                    <TableCell align="center">{item.cstNumber || "-"}</TableCell>
                    <TableCell align="center">
                      {item.ticketNumber || "-"}
                    </TableCell>
                    <TableCell align="center">{item.snNumber || "-"}</TableCell>
                    <TableCell align="center">{item.deviceType || "-"}</TableCell>
                    <TableCell align="center">{item.withAdapter || "-"}</TableCell>
                    <TableCell align="center">{formatDisplayDate(item.startRepairingSupport)}</TableCell>
                    <TableCell align="center">{formatDisplayDate(item.endDateSupport)}</TableCell>
                    <TableCell align="center">{formatDisplayDate(item.startQa)}</TableCell>
                    <TableCell align="center">{formatDisplayDate(item.endDateQa)}</TableCell>
                    <TableCell align="center">
                      <Chip label={status?.name || item.statusName || "-"} size="small" sx={{ bgcolor: `${status?.color || item.statusColor || "#64748b"}22`, color: status?.color || item.statusColor || "#475569", fontWeight: 400 }} />
                    </TableCell>
                    <TableCell align="center">{formatDisplayDate(item.dateDelivered)}</TableCell>
                    <TableCell align="center">{item.giveTo || "-"}</TableCell>
                    <TableCell align="left" sx={{ maxWidth: 280, overflow: "hidden" }}>
                      <RemarksPreview value={item.remarks} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationControls count={displayedItems.length} page={page} onChange={setPage} />
      </Paper>

      {dialogMode ? (
        <DeviceDialog
          key={`${dialogMode}-${selectedId || "new"}`}
          clients={clients}
          deviceTypes={deviceTypes}
          initialValue={dialogMode === "edit" ? selectedItem : { ...blankDevice, statusId: findStatusByName(statuses, "N/A")?.id || "" }}
          onClose={() => setDialogMode(null)}
          onSave={handleSave}
          open
          statuses={statuses}
          title={dialogMode === "new" ? "New Device Inventory" : "Edit Device Inventory"}
        />
      ) : null}
    </Box>
  );
}

function DeviceDialog({ clients, deviceTypes, initialValue, onClose, onSave, open, statuses, title }) {
  // Store the dialog form separately so typing does not update the table until Save is clicked.
  const [form, setForm] = useState(initialValue || blankDevice);
  // Update one form field while preserving every other field value.
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  // Select client by client code and use the linked client name as the read-only company value.
  const updateClient = (event) => {
    const clientId = event.target.value;
    const selectedClient = clients.find((client) => String(client.id) === String(clientId));
    setForm((current) => ({
      ...current,
      clientId,
      company: selectedClient?.name || current.company,
      clientCode: selectedClient?.client_code || "",
    }));
  };
  // Require client code, serial number, and device type before allowing a new inventory record to save.
  const canSave = Boolean(form.clientId && form.clientCode && form.snNumber.trim() && form.deviceType.trim());
  // Show the automatic status in the disabled Status field while the user edits date fields.
  const automaticStatusName = getAutomaticInventoryStatusName(form);
  const automaticStatus = findStatusByName(statuses, automaticStatusName);
  const statusDisplayValue = automaticStatus?.name || automaticStatusName;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      sx={{
        "& .MuiDialog-container": {
          overflow: "hidden !important",
        },
        "& .MuiDialog-paper": {
          boxSizing: "border-box",
          maxHeight: "none !important",
          maxWidth: "calc(100vw - 120px) !important",
          overflow: "hidden !important",
          width: "min(1160px, calc(100vw - 120px)) !important",
        },
        "& .MuiDialogContent-root": {
          flex: "0 0 auto",
          overflow: "hidden !important",
        },
      }}
      PaperProps={{
        className: "device-inventory-dialog-paper",
        sx: {
          boxSizing: "border-box",
          maxHeight: "none !important",
          maxWidth: "calc(100vw - 120px) !important",
          overflow: "hidden !important",
          width: "min(1160px, calc(100vw - 120px)) !important",
        },
      }}
    >
      <DialogTitle fontWeight={900} sx={{ pb: 1, pt: 2 }}>
        {title}
      </DialogTitle>
      <DialogContent
        className="device-inventory-dialog-content"
        sx={{
          overflow: "hidden !important",
          px: 3,
          py: 1,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: 1.35,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
            pt: 0.5,
            "& .MuiTextField-root": {
              minWidth: 0,
            },
            "& .MuiInputBase-root": {
              minHeight: 46,
            },
          }}
        >
          <TextField
            label="Company"
            value={form.company}
            disabled
            InputProps={{ readOnly: true }}
            sx={{
              "& .MuiInputBase-root": { bgcolor: "action.disabledBackground" },
              "& .MuiInputBase-input": { color: "text.secondary" },
            }}
          />
          <TextField select required size="small" label="Client Code" value={form.clientId || ""} onChange={updateClient} SelectProps={{ MenuProps: compactSelectMenuProps }} slotProps={compactSelectSlotProps}>
            <MenuItem value="">Select Client Code</MenuItem>
            {clients.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {client.client_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Raised by" value={form.raisedBy} onChange={updateField("raisedBy")} />
          <TextField size="small" label="Date Received" type="date" value={form.dateReceived} onChange={updateField("dateReceived")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select size="small" label="Package Style" value={form.packageStyle} onChange={updateField("packageStyle")} SelectProps={{ MenuProps: compactSelectMenuProps }} slotProps={compactSelectSlotProps}>{packageStyles.map((style) => <MenuItem key={style} value={style}>{style}</MenuItem>)}</TextField>
          <TextField size="small" label="CST Number" value={form.cstNumber} onChange={updateField("cstNumber")} />
          <TextField size="small" label="Ticket Number" value={form.ticketNumber} onChange={updateField("ticketNumber")} />
          <TextField required size="small" label="SN Number" value={form.snNumber} onChange={updateField("snNumber")} />
          <TextField required select size="small" label="Device Type" value={form.deviceType} onChange={updateField("deviceType")} SelectProps={{ MenuProps: compactSelectMenuProps }} slotProps={compactSelectSlotProps}>
            <MenuItem value="">Select Device Type</MenuItem>
            {deviceTypes.map((deviceType) => (
              <MenuItem key={deviceType.id} value={deviceType.name}>
                {deviceType.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="With Adapter" value={form.withAdapter} onChange={updateField("withAdapter")} SelectProps={{ MenuProps: compactSelectMenuProps }} slotProps={compactSelectSlotProps}>{adapterOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField>
          <TextField size="small" label="Start Repairing Support" type="date" value={form.startRepairingSupport} onChange={updateField("startRepairingSupport")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="End Date Support" type="date" value={form.endDateSupport} onChange={updateField("endDateSupport")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="Start QA" type="date" value={form.startQa} onChange={updateField("startQa")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="End Date QA" type="date" value={form.endDateQa} onChange={updateField("endDateQa")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            size="small"
            label="Status"
            value={statusDisplayValue}
            disabled
            fullWidth
            helperText={automaticStatus ? "Automatic status" : `Add "${automaticStatusName}" in Configurations > Status`}
            sx={{
              "& .MuiInputBase-root": { bgcolor: "action.disabledBackground" },
              "& .MuiInputBase-input": { color: "text.secondary" },
            }}
          />
          <TextField size="small" label="Date Delivered" type="date" value={form.dateDelivered} onChange={updateField("dateDelivered")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="Give to" value={form.giveTo} onChange={updateField("giveTo")} />
          <TextField size="small" label="Remarks" multiline minRows={3} value={form.remarks} onChange={updateField("remarks")} sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!canSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function PackageChip({ value }) {
  if (!value) return <>-</>;
  const color = value === "With Box" ? "#bae6fd" : value === "Plastic" ? "#fde68a" : "#fecaca";
  return <Chip label={value} size="small" sx={{ bgcolor: color, fontWeight: 400 }} />;
}

const isInsideRange = (value, from, to) => {
  if (!value && (from || to)) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
};

const formatDisplayDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";

function RemarksPreview({ value }) {
  const text = value?.trim();

  if (!text) {
    return "-";
  }

  const preview = text.length > remarksPreviewMaxLength
    ? `${text.slice(0, remarksPreviewMaxLength).trimEnd()}.........`
    : text;

  // Keep the row height stable even when users enter very long free-form remarks.
  return (
    <Box
      component="span"
      sx={{
        display: "block",
        maxWidth: 280,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {preview}
    </Box>
  );
}

export const mapDeviceFromDb = (item) => ({
  // Normalize Supabase row shape into the field names used by React state and forms.
  id: item.id,
  company: item.company || "",
  clientId: item.client_id || "",
  clientName: item.clients?.name || "",
  clientCode: item.clients?.client_code || "",
  raisedBy: item.raised_by || "",
  dateReceived: item.date_received || "",
  packageStyle: item.package_style || "",
  cstNumber: item.cst_number || "",
  ticketNumber: item.ticket_number || "",
  snNumber: item.sn_number || "",
  deviceType: item.device_type || "",
  withAdapter: item.with_adapter || "No",
  startRepairingSupport: item.start_repairing_support || "",
  endDateSupport: item.end_date_support || "",
  startQa: item.start_qa || "",
  endDateQa: item.end_date_qa || "",
  statusId: item.status_id || "",
  statusName: item.statuses?.name || "",
  statusColor: item.statuses?.color || "",
  dateDelivered: item.date_delivered || "",
  giveTo: item.give_to || "",
  remarks: item.remarks || "",
});

export const mapDeviceToDb = (item) => ({
  // Normalize React form state back into Supabase column names.
  company: item.company || null,
  client_id: item.clientId || null,
  raised_by: item.raisedBy || null,
  date_received: item.dateReceived || null,
  package_style: item.packageStyle || null,
  cst_number: item.cstNumber || null,
  ticket_number: item.ticketNumber || null,
  sn_number: item.snNumber || null,
  device_type: item.deviceType || null,
  with_adapter: item.withAdapter || null,
  start_repairing_support: item.startRepairingSupport || null,
  end_date_support: item.endDateSupport || null,
  start_qa: item.startQa || null,
  end_date_qa: item.endDateQa || null,
  status_id: item.statusId || null,
  date_delivered: item.dateDelivered || null,
  give_to: item.giveTo || null,
  remarks: item.remarks || null,
});

const mapInventoryToOngoingDb = (item) => ({
  // Copy only fields that belong to the Ongoing Testing table.
  client_id: item.clientId || null,
  // Keep the received date aligned with the inventory record.
  date_received: item.dateReceived || null,
  // Carry the package style so the generated testing row matches the inventory intake data.
  package_style: item.packageStyle || null,
  // Store the inventory device type as the testing model.
  model: item.deviceType || null,
  // Preserve adapter information from the inventory record.
  with_adapter: item.withAdapter || "No",
  // Preserve the serial number for tracking and matching.
  serial_number: item.snNumber || null,
  // Use the automatic inventory status for the generated testing status.
  status_id: item.statusId || null,
  // Support and QA dates are needed by Ongoing Testing for green/orange/red row color rules.
  start_repairing_support: item.startRepairingSupport || null,
  // End support date is the due-date used by the warning and overdue colors.
  end_date_support: item.endDateSupport || null,
  // Start QA is carried so the generated row can show the latest workflow state.
  start_qa: item.startQa || null,
  // End QA is carried so completed workflow state remains synchronized.
  end_date_qa: item.endDateQa || null,
  // Remarks should follow the inventory record because Ongoing Testing is generated from it.
  remarks: item.remarks || null,
  // Store the source inventory id so future saves update the same generated testing row instead of duplicating it.
  source_inventory_id: item.id || null,
});

export const syncOngoingTestingFromInventory = async (item) => {
  // Build the generated Ongoing Testing payload from the saved inventory row.
  const payload = mapInventoryToOngoingDb(item);
  // Update the existing generated testing row first, using source_inventory_id as the link.
  const { data: updatedRows, error: updateError } = await supabase
    .from("ongoing_testing_items")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("source_inventory_id", item.id)
    .select("id");

  // Return a readable error message so Inventory Records can show the user what failed.
  if (updateError) {
    return `Inventory saved, but Ongoing Testing sync failed: ${updateError.message}`;
  }

  // If an existing generated row was found, no insert is needed.
  if ((updatedRows || []).length > 0) {
    return "";
  }

  // Insert a generated testing row when this inventory record has never been mirrored before.
  const { error: insertError } = await supabase
    .from("ongoing_testing_items")
    .insert(payload);

  // Return a readable insert error, if Supabase rejects the generated row.
  if (insertError) {
    return `Inventory saved, but Ongoing Testing sync failed: ${insertError.message}`;
  }

  // Empty string means the sync completed successfully.
  return "";
};

const mapInventoryToRepairDb = (item) => ({
  // Link the repair task to the source inventory row so updates do not create duplicates.
  source_inventory_id: item.id || null,
  // Copy company because the repair list shows it as the first identifying field.
  company: item.company || null,
  // Copy client id for future reporting and filtering.
  client_id: item.clientId || null,
  // Copy client code because users identify repairs by client code in the workflow.
  client_code: item.clientCode || null,
  // Copy the date received from inventory.
  date_received: item.dateReceived || null,
  // Copy the package style shown in the repair queue.
  package_style: item.packageStyle || null,
  // Copy CST number shown in the repair queue.
  cst_number: item.cstNumber || null,
  // Copy ticket number shown in the repair queue.
  ticket_number: item.ticketNumber || null,
  // Copy serial number shown in the repair queue.
  sn_number: item.snNumber || null,
  // Copy device type shown in the repair queue and checking page.
  device_type: item.deviceType || null,
  // Copy adapter flag shown in the repair queue and checking page.
  with_adapter: item.withAdapter || "No",
});

export const syncRepairDeviceFromInventory = async (item) => {
  // Build the repair workflow payload from inventory fields only.
  const payload = mapInventoryToRepairDb(item);
  // Try updating an existing generated repair row first.
  const { data: updatedRows, error: updateError } = await supabase
    .from("repair_device_records")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("source_inventory_id", item.id)
    .select("id");

  // Return a readable error if the repair workflow table has not been created or policy blocks the update.
  if (updateError) {
    return `Inventory saved, but Testing Device sync failed: ${updateError.message}`;
  }

  // Stop after update when a linked repair row already exists.
  if ((updatedRows || []).length > 0) {
    return "";
  }

  // Insert a new repair queue row for a newly created inventory record.
  const { error: insertError } = await supabase
    .from("repair_device_records")
    .insert({
      ...payload,
      workflow_status: "Repair By",
    });

  // Return a readable insert error if Supabase rejects the generated repair row.
  if (insertError) {
    return `Inventory saved, but Testing Device sync failed: ${insertError.message}`;
  }

  // Empty string means the repair workflow sync completed successfully.
  return "";
};

export const getDeviceLabel = (item) =>
  item?.snNumber || item?.cstNumber || item?.ticketNumber || item?.clientCode || item?.company || "Untitled record";

const normalizeStatusName = (value) =>
  // Normalize status names so lookup still works even if casing or spaces differ.
  String(value || "").trim().toLowerCase();

export const findStatusByName = (statuses, statusName) =>
  // Find the configured Status row that matches the automatic workflow status name.
  statuses.find((status) => normalizeStatusName(status.name) === normalizeStatusName(statusName));

const getLocalDateString = () => {
  // Build today's date in local time so support overdue checks match the user's calendar day.
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getAutomaticInventoryStatusName = (item) => {
  // Completed is the final inventory workflow state once QA has an end date.
  if (item.endDateQa) return "Completed";
  // Ongoing QA starts as soon as Start QA has a value.
  if (item.startQa) return "Ongoing QA";
  // Overdue Support applies only after the support end date has passed and QA has not started.
  if (item.endDateSupport && !item.startQa && item.endDateSupport < getLocalDateString()) {
    return "Overdue Support";
  }
  // Ongoing Support starts as soon as Start Repairing Support has a value.
  if (item.startRepairingSupport) return "Ongoing Support";
  // N/A is the default automatic status for newly created records with no workflow dates.
  return "N/A";
};

export const exportRepairRecordsExcel = async (items, statuses) => {
  // Pull workflow assignee names from the generated tracking records so the Excel output includes every tester column.
  const trackingByInventoryId = await loadTrackingPeopleByInventoryId(items);
  const generatedDate = getLocalDateString();
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
    "Repair By",
    "Tested By",
    "Senior Tested By",
    "Start Repairing Support",
    "End Date Support",
    "Start QA",
    "End Date QA",
    "Status",
    "Date Delivered",
    "Give to",
    "Remarks",
  ];
  const rows = items.map((item) => {
    const status = statuses.find((entry) => entry.id === item.statusId);
    const trackingPeople = trackingByInventoryId.get(item.id) || {};
    return {
      item,
      values: [
        item.company,
        item.clientCode,
        item.raisedBy,
        parseExcelDate(item.dateReceived),
        item.packageStyle,
        item.cstNumber,
        item.ticketNumber,
        item.snNumber,
        item.deviceType,
        item.withAdapter,
        trackingPeople.repairBy || "",
        trackingPeople.testedBy || "",
        trackingPeople.seniorTestedBy || "",
        parseExcelDate(item.startRepairingSupport),
        parseExcelDate(item.endDateSupport),
        parseExcelDate(item.startQa),
        parseExcelDate(item.endDateQa),
        status?.name || item.statusName,
        parseExcelDate(item.dateDelivered),
        item.giveTo,
        item.remarks,
      ],
    };
  });

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Repair Record Report"],
    ["Date Generate:", parseExcelDate(generatedDate)],
    [],
    [],
    headers,
    ...rows.map((row) => row.values),
  ], { cellDates: true });

  worksheet["!cols"] = [
    { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 36 },
  ];
  worksheet["!rows"] = [
    { hpt: 24 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 18 },
    { hpt: 24 },
    ...rows.map(() => ({ hpt: 24 })),
  ];

  applyRepairRecordWorkbookStyles(worksheet, headers.length, rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Repair Records");
  XLSX.writeFile(workbook, `Repair-Record-${generatedDate}.xlsx`, { bookType: "xlsx", cellDates: true });
};

const loadTrackingPeopleByInventoryId = async (items) => {
  const sourceIds = items.map((item) => item.id).filter(Boolean);
  if (!sourceIds.length) return new Map();

  const { data, error } = await supabase
    .from("ongoing_testing_items")
    .select("source_inventory_id, repair_by, test_by, senior_test_by")
    .in("source_inventory_id", sourceIds);

  if (error) {
    console.warn("Repair Records export tracking lookup failed:", error.message);
    return new Map();
  }

  return new Map((data || []).map((row) => [
    row.source_inventory_id,
    {
      repairBy: row.repair_by || "",
      testedBy: row.test_by || "",
      seniorTestedBy: row.senior_test_by || "",
    },
  ]));
};

const applyRepairRecordWorkbookStyles = (worksheet, columnCount, rows) => {
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (!worksheet[address]) worksheet[address] = { t: "s", v: "" };
      worksheet[address].s = getBaseExcelStyle(rowIndex);
    }
  }

  worksheet.A1.s = {
    ...getBaseExcelStyle(0),
    font: { name: "Century Gothic", sz: 14, bold: false, color: { rgb: "000000" } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  worksheet.A2.s = {
    ...getBaseExcelStyle(1),
    alignment: { horizontal: "left", vertical: "center" },
  };
  worksheet.B2.s = {
    ...getBaseExcelStyle(1),
    alignment: { horizontal: "left", vertical: "center" },
    numFmt: "mm-dd-yy",
  };

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const headerAddress = XLSX.utils.encode_cell({ r: 4, c: columnIndex });
    worksheet[headerAddress].s = {
      ...getBaseExcelStyle(4),
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    };
  }

  rows.forEach((row, rowOffset) => {
    const excelRow = rowOffset + 5;
    [3, 13, 14, 15, 16, 18].forEach((columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: excelRow, c: columnIndex });
      if (worksheet[address]) worksheet[address].s = { ...worksheet[address].s, numFmt: "mm-dd-yy" };
    });

    const remarksAddress = XLSX.utils.encode_cell({ r: excelRow, c: 20 });
    if (row.item.remarks && worksheet[remarksAddress]) {
      worksheet[remarksAddress].s = {
        ...worksheet[remarksAddress].s,
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
      };
    }
  });
};

const getBaseExcelStyle = (rowIndex) => ({
  alignment: { horizontal: rowIndex >= 4 ? "center" : "left", vertical: "center", wrapText: true },
  font: { name: "Century Gothic", sz: rowIndex === 0 ? 14 : 10, bold: false, color: { rgb: "000000" } },
});

const parseExcelDate = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day);
};

