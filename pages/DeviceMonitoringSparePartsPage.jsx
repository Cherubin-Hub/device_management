import {
  Box,
  Button,
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
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { useEffect, useMemo, useState } from "react";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { paginateRows } from "../src/lib/pagination.js";
import { supabase } from "../src/lib/supabase.js";

const sparePartColumns = [
  { key: "fingerscannerBoard", label: "Fingerscanner Board" },
  { key: "fingerscannerRibbon", label: "Fingerscanner Ribbon" },
  { key: "fingerprintSensorLight", label: "Fingerprint Sensor Light" },
  { key: "coreboard", label: "Coreboard" },
  { key: "motherboard", label: "Motherboard" },
  { key: "keypad", label: "Keypad" },
  { key: "keypadBoard", label: "Keypad Board" },
  { key: "frontCase", label: "Front Case" },
  { key: "backCase", label: "Back Case" },
  { key: "lcdScreen", label: "LCD Screen" },
  { key: "lcdRibbon", label: "LCD Ribbon" },
  { key: "speaker", label: "Speaker" },
  { key: "cmosBattery", label: "CMOS Battery" },
];

const blankSparePartRecord = {
  clientId: "",
  deviceTypeId: "",
  boxSerialNumber: "",
  remarks: "",
  parts: {},
};

const allDeviceTypesFilterValue = "__all_device_types__";

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

export default function DeviceMonitoringSparePartsPage() {
  const [records, setRecords] = useState([]);
  const [clients, setClients] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [sparePartsStatuses, setSparePartsStatuses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);
  const [draftDeviceTypeFilter, setDraftDeviceTypeFilter] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    async function loadMonitoringData() {
      setIsLoading(true);
      setError("");

      const [recordsResult, clientsResult, deviceTypesResult, statusesResult] = await Promise.all([
        supabase
          .from("spare_parts_inventory")
          .select(`
            id,
            device_no,
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
          .from("spare_parts_statuses")
          .select("id, name, color, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (ignore) return;

      if (recordsResult.error || clientsResult.error || deviceTypesResult.error || statusesResult.error) {
        setError(
          recordsResult.error?.message ||
            clientsResult.error?.message ||
            deviceTypesResult.error?.message ||
            statusesResult.error?.message ||
            "Failed to load spare parts monitoring data."
        );
        setRecords([]);
        setIsLoading(false);
        return;
      }

      const mappedRecords = (recordsResult.data || []).map(mapSparePartFromDb);
      setRecords(mappedRecords);
      setClients(clientsResult.data || []);
      setDeviceTypes(deviceTypesResult.data || []);
      setSparePartsStatuses(statusesResult.data || []);
      setSelectedId(mappedRecords[0]?.id || null);
      setIsLoading(false);
    }

    loadMonitoringData();

    return () => {
      ignore = true;
    };
  }, []);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) || null,
    [records, selectedId]
  );

  const filteredRecords = useMemo(
    () => records.filter((record) => !deviceTypeFilter || record.deviceTypeId === deviceTypeFilter),
    [deviceTypeFilter, records]
  );

  const paginatedRecords = useMemo(
    () => paginateRows(filteredRecords, page),
    [filteredRecords, page]
  );
  const sparePartStatusMap = useMemo(
    () => new Map(sparePartsStatuses.map((status) => [status.name.toUpperCase(), status])),
    [sparePartsStatuses]
  );

  const handleSave = async (form) => {
    const payload = mapSparePartToDb(form);

    if (dialogMode === "new") {
      const { data, error: insertError } = await supabase
        .from("spare_parts_inventory")
        .insert(payload)
        .select("*, clients ( id, name, client_code ), device_types ( id, name )")
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      const nextRecord = mapSparePartFromDb(data);
      setRecords((current) => [nextRecord, ...current]);
      setSelectedId(nextRecord.id);
      setDialogMode(null);
      await logAuditEvent({
        action: "CREATE",
        afterData: payload,
        entityId: nextRecord.id,
        entityTable: "spare_parts_inventory",
        module: "Device Monitoring (Spare Parts)",
        recordLabel: getSparePartLabel(nextRecord),
        summary: `Created spare parts monitoring record for ${getSparePartLabel(nextRecord)}.`,
      });
      return;
    }

    const { data, error: updateError } = await supabase
      .from("spare_parts_inventory")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", selectedId)
      .select("*, clients ( id, name, client_code ), device_types ( id, name )")
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updatedRecord = mapSparePartFromDb(data);
    setRecords((current) => current.map((record) => (record.id === selectedId ? updatedRecord : record)));
    setDialogMode(null);
    await logAuditEvent({
      action: "UPDATE",
      afterData: payload,
      beforeData: selectedRecord ? mapSparePartToDb(selectedRecord) : null,
      entityId: updatedRecord.id,
      entityTable: "spare_parts_inventory",
      module: "Device Monitoring (Spare Parts)",
      recordLabel: getSparePartLabel(updatedRecord),
      summary: `Updated spare parts monitoring record for ${getSparePartLabel(updatedRecord)}.`,
    });
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;

    const { error: deleteError } = await supabase
      .from("spare_parts_inventory")
      .delete()
      .eq("id", selectedRecord.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await logAuditEvent({
      action: "DELETE",
      beforeData: mapSparePartToDb(selectedRecord),
      entityId: selectedRecord.id,
      entityTable: "spare_parts_inventory",
      module: "Device Monitoring (Spare Parts)",
      recordLabel: getSparePartLabel(selectedRecord),
      summary: `Deleted spare parts monitoring record for ${getSparePartLabel(selectedRecord)}.`,
    });
    setRecords((current) => current.filter((record) => record.id !== selectedRecord.id));
    setSelectedId(records.find((record) => record.id !== selectedRecord.id)?.id || null);
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
            <Typography className="module-page-title" variant="h5" component="h1">
              Device Monitoring (Spare Parts)
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              Monitor spare part availability by client, device type, serial number, and part status.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialogMode("new")}>
            Add New Record
          </Button>
          <Button size="small" variant="contained" disabled={!selectedRecord} onClick={() => setDialogMode("edit")}>
            Edit Record
          </Button>
          <Button size="small" variant="contained" color="error" startIcon={<DeleteRoundedIcon />} disabled={!selectedRecord} onClick={handleDelete}>
            Delete
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ mb: 2, p: 1.5, border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="Device Type"
            value={draftDeviceTypeFilter || allDeviceTypesFilterValue}
            onChange={(event) =>
              setDraftDeviceTypeFilter(event.target.value === allDeviceTypesFilterValue ? "" : event.target.value)
            }
            SelectProps={{ MenuProps: compactSelectMenuProps }}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value={allDeviceTypesFilterValue}>All Device Types</MenuItem>
            {deviceTypes.map((deviceType) => (
              <MenuItem key={deviceType.id} value={deviceType.id}>
                {deviceType.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltRoundedIcon />}
            onClick={() => {
              setPage(1);
              setDeviceTypeFilter(draftDeviceTypeFilter);
            }}
          >
            Apply
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ClearRoundedIcon />}
            onClick={() => {
              setPage(1);
              setDraftDeviceTypeFilter("");
              setDeviceTypeFilter("");
            }}
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
              minWidth: 3200,
              tableLayout: "fixed",
              "& th, & td": {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>Device No.</TableCell>
                <TableCell sx={{ width: 80 }}>Client Name</TableCell>
                <TableCell sx={{ width: 50 }}>Device Type</TableCell>
                <TableCell sx={{ width: 90 }}>Box Number / Serial Number</TableCell>
                <TableCell sx={{ width: 40 }}>Quantity</TableCell>
                <TableCell sx={{ width: 100 }}>Remarks</TableCell>
                {sparePartColumns.map((column) => (
                  <TableCell key={column.key} sx={{ width: 70 }}>{column.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={sparePartColumns.length + 6}>Loading...</TableCell>
                </TableRow>
              ) : null}
              {!isLoading && filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={sparePartColumns.length + 6}>No spare parts monitoring records found.</TableCell>
                </TableRow>
              ) : null}
              {paginatedRecords.map((record, index) => (
                <TableRow
                  key={record.id}
                  hover
                  selected={record.id === selectedId}
                  onClick={() => setSelectedId(record.id)}
                  onDoubleClick={() => {
                    setSelectedId(record.id);
                    setDialogMode("edit");
                  }}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{getDisplayDeviceNumber(page, index)}</TableCell>
                  <TableCell>{record.clientName || "-"}</TableCell>
                  <TableCell>{record.deviceTypeName || "-"}</TableCell>
                  <TableCell>{record.boxSerialNumber || "-"}</TableCell>
                  <TableCell>{getAvailableQuantity(record.parts)}</TableCell>
                  <TableCell>{record.remarks || "-"}</TableCell>
                  {sparePartColumns.map((column) => (
                    <TableCell key={column.key}>
                      <SparePartStatusChip status={record.parts[column.key]} statusMap={sparePartStatusMap} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationControls count={filteredRecords.length} page={page} onChange={setPage} />
      </Paper>

      {dialogMode ? (
        <SparePartsDialog
          clients={clients}
          deviceTypes={deviceTypes}
          initialValue={dialogMode === "edit" ? selectedRecord : blankSparePartRecord}
          mode={dialogMode}
          onClose={() => setDialogMode(null)}
          onSave={handleSave}
          sparePartsStatuses={sparePartsStatuses}
        />
      ) : null}
    </Box>
  );
}

function SparePartStatusChip({ status, statusMap }) {
  const normalizedStatus = String(status || "").trim();

  if (!normalizedStatus) {
    return "-";
  }

  const configuredStatus = statusMap.get(normalizedStatus.toUpperCase());
  const color = configuredStatus?.color || getFallbackStatusColor(normalizedStatus);

  return (
    <Box
      component="span"
      title={normalizedStatus}
      sx={{
        bgcolor: `${color}22`,
        border: `1px solid ${color}55`,
        borderRadius: 999,
        color,
        display: "inline-flex",
        fontSize: "11px !important",
        justifyContent: "center",
        lineHeight: 1.2,
        maxWidth: "100%",
        minWidth: 92,
        overflow: "hidden",
        px: 1,
        py: 0.35,
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {normalizedStatus}
    </Box>
  );
}

function SparePartsDialog({ clients, deviceTypes, initialValue, mode, onClose, onSave, sparePartsStatuses }) {
  const [form, setForm] = useState({
    ...blankSparePartRecord,
    ...initialValue,
    parts: { ...(initialValue?.parts || {}) },
  });

  const canSave = form.deviceTypeId && form.boxSerialNumber.trim();
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const updatePart = (field) => (event) =>
    setForm((current) => ({
      ...current,
      parts: {
        ...current.parts,
        [field]: event.target.value,
      },
    }));

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { overflow: "hidden" } } }}>
      <DialogTitle>{mode === "new" ? "New" : "Edit"} Spare Parts Monitoring</DialogTitle>
      <DialogContent sx={{ overflow: "hidden" }}>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
            pt: 1,
          }}
        >
          <TextField select size="small" label="Client" value={form.clientId} onChange={updateField("clientId")} SelectProps={{ MenuProps: compactSelectMenuProps }}>
            <MenuItem value="">Select Client</MenuItem>
            {clients.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {client.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select required size="small" label="Device Type" value={form.deviceTypeId} onChange={updateField("deviceTypeId")} SelectProps={{ MenuProps: compactSelectMenuProps }}>
            <MenuItem value="">Select Device Type</MenuItem>
            {deviceTypes.map((deviceType) => (
              <MenuItem key={deviceType.id} value={deviceType.id}>
                {deviceType.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField required size="small" label="Box Number / Serial Number" value={form.boxSerialNumber} onChange={updateField("boxSerialNumber")} />
          <TextField size="small" label="Remarks" value={form.remarks} onChange={updateField("remarks")} />
          {sparePartColumns.map((column) => (
            <TextField
              key={column.key}
              select
              size="small"
              label={column.label}
              value={form.parts[column.key] || ""}
              onChange={updatePart(column.key)}
              SelectProps={{ MenuProps: compactSelectMenuProps }}
            >
              <MenuItem value="">-</MenuItem>
              {sparePartsStatuses.map((status) => (
                <MenuItem key={status.id} value={status.name}>
                  {status.name}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => onSave(form)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const mapSparePartFromDb = (item) => ({
  id: item.id,
  clientId: item.client_id || "",
  clientName: item.clients?.name || "",
  clientCode: item.clients?.client_code || "",
  deviceTypeId: item.device_type_id || "",
  deviceTypeName: item.device_types?.name || "",
  boxSerialNumber: item.box_serial_number || "",
  remarks: item.remarks || "",
  parts: item.parts_status || {},
});

const mapSparePartToDb = (item) => ({
  device_no: null,
  client_id: item.clientId || null,
  device_type_id: item.deviceTypeId || null,
  box_serial_number: item.boxSerialNumber || null,
  quantity_available: getAvailableQuantity(item.parts),
  remarks: item.remarks || null,
  parts_status: item.parts || {},
});

const getAvailableQuantity = (parts = {}) =>
  sparePartColumns.reduce(
    (total, column) => total + (String(parts[column.key] || "").trim().toUpperCase() === "AVAILABLE" ? 1 : 0),
    0
  );

const getDisplayDeviceNumber = (page, index) => (page - 1) * 20 + index + 1;

const getFallbackStatusColor = (status) => {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (normalizedStatus === "AVAILABLE") return "#16a34a";
  if (normalizedStatus === "DEFECTIVE") return "#dc2626";
  if (normalizedStatus === "NOT AVAILABLE") return "#f59e0b";
  return "#64748b";
};

const getSparePartLabel = (item) =>
  item?.boxSerialNumber || item?.clientName || item?.deviceTypeName || "Untitled spare parts record";
