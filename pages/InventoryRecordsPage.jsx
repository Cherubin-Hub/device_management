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
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../src/lib/supabase.js";

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

export default function DeviceManagementPage() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [statuses, setStatuses] = useState([]);
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

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  useEffect(() => {
    let ignore = false;

    async function loadDevices() {
      setIsLoading(true);
      const [devicesResult, statusesResult, clientsResult] = await Promise.all([
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
        supabase
          .from("clients")
          .select("id, name, client_code, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (ignore) {
        return;
      }

      if (devicesResult.error || statusesResult.error || clientsResult.error) {
        setError(devicesResult.error?.message || statusesResult.error?.message || clientsResult.error?.message);
        setIsLoading(false);
        return;
      }

      const mappedItems = (devicesResult.data || []).map(mapDeviceFromDb);
      setItems(mappedItems);
      setStatuses(statusesResult.data || []);
      setClients(clientsResult.data || []);
      setSelectedId(mappedItems[0]?.id || null);
      setIsLoading(false);
    }

    loadDevices();

    return () => {
      ignore = true;
    };
  }, []);

  const displayedItems = useMemo(
    () =>
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

  const handleSave = async (form) => {
    const payload = mapDeviceToDb(form);

    if (dialogMode === "new") {
      const { data, error: insertError } = await supabase
        .from("device_inventory_items")
        .insert(payload)
        .select("*, clients ( id, name, client_code ), statuses ( id, name, color )")
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      const nextItem = mapDeviceFromDb(data);
      setItems((current) => [nextItem, ...current]);
      setSelectedId(nextItem.id);
      setDialogMode(null);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("device_inventory_items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", selectedId)
      .select("*, clients ( id, name, client_code ), statuses ( id, name, color )")
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updatedItem = mapDeviceFromDb(data);
    const oldStatus = selectedItem?.statusName;
    const newStatus = updatedItem.statusName;

    if (isClosedStatus(oldStatus) && !isClosedStatus(newStatus)) {
      const transferred = await transferBackToOngoingTesting(updatedItem);
      if (transferred) {
        const { error: deleteError } = await supabase
          .from("device_inventory_items")
          .delete()
          .eq("id", selectedId);

        if (deleteError) {
          setError(`Transferred back, but failed to remove from inventory: ${deleteError.message}`);
          return;
        }

        setItems((current) => current.filter((item) => item.id !== selectedId));
        setSelectedId(items.find((item) => item.id !== selectedId)?.id || null);
        setDialogMode(null);
        return;
      }
    }

    setItems((current) => current.map((item) => (item.id === selectedId ? updatedItem : item)));
    setDialogMode(null);
  };

  const handleDelete = async () => {
    if (!selectedItem) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("device_inventory_items")
      .delete()
      .eq("id", selectedId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(items.find((item) => item.id !== selectedId)?.id || null);
  };

  const updateFilter = (field) => (event) => {
    setDraftFilters((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleExport = () => {
    exportExcel(displayedItems, statuses);
  };

  const transferBackToOngoingTesting = async (inventoryItem) => {
    try {
      const ongoingPayload = {
        client_id: inventoryItem.clientId || null,
        date_received: inventoryItem.dateReceived,
        package_style: inventoryItem.packageStyle,
        model: inventoryItem.deviceType,
        with_adapter: inventoryItem.withAdapter,
        serial_number: inventoryItem.snNumber,
        status_id: inventoryItem.statusId,
        repair_by: inventoryItem.company,
        remarks: inventoryItem.remarks,
        source_inventory_id: inventoryItem.id,
      };

      const { error: insertError } = await supabase
        .from("ongoing_testing_items")
        .insert(ongoingPayload);

      if (insertError) {
        setError(`Failed to transfer back to ongoing testing: ${insertError.message}`);
        return false;
      }

      return true;
    } catch (err) {
      setError(`Transfer error: ${err.message}`);
      return false;
    }
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        spacing={1.5}
        sx={{ mb: 1.75 }}
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
            <Inventory2RoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={900}>
              Device Inventory
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Track device movement, QA dates, delivery, and remarks.
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
          size="small" variant="contained" startIcon={<EditRoundedIcon />} 
          disabled={!selectedItem} 
          onClick={() => setDialogMode("edit")} 
          sx={{ textTransform: "none", fontWeight: 600 }}>
            Edit Record
          </Button>
          <Button size="small" variant="contained" color="error" startIcon={<DeleteRoundedIcon />} disabled={!selectedItem} onClick={handleDelete} sx={{ textTransform: "none", fontWeight: 600 }}>
            Delete
          </Button>
          <Button size="small" variant="contained" startIcon={<DownloadRoundedIcon />} onClick={handleExport} sx={{ textTransform: "none", fontWeight: 600 }}>
            Export
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
            onClick={() => setFilters(draftFilters)}
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
        <TableContainer sx={{ overflowX: "auto" }}>
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
              {displayedItems.map((item) => {
                const status = statuses.find((entry) => entry.id === item.statusId);
                return (
                  <TableRow key={item.id} hover selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} sx={{ cursor: "pointer" }}>
                    <TableCell align="center">{item.company || "-"}</TableCell>
                    <TableCell align="center">{item.clientCode || "-"}</TableCell>
                    <TableCell align="center">{item.raisedBy || "-"}</TableCell>
                    <TableCell align="center">{formatDisplayDate(item.dateReceived)}</TableCell>
                    <TableCell align="center"><PackageChip value={item.packageStyle} /></TableCell>
                    <TableCell align="center">{item.cstNumber || "-"}</TableCell>
                    <TableCell align="center" sx={{ bgcolor: item.ticketNumber ? "#f0f9ff" : "inherit" }}>
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
                      <Chip label={status?.name || item.statusName || "-"} size="small" sx={{ bgcolor: `${status?.color || item.statusColor || "#64748b"}22`, color: status?.color || item.statusColor || "#475569", fontWeight: 900 }} />
                    </TableCell>
                    <TableCell align="center">{formatDisplayDate(item.dateDelivered)}</TableCell>
                    <TableCell align="center">{item.giveTo || "-"}</TableCell>
                    <TableCell align="left" sx={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                      {item.remarks || "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {dialogMode ? (
        <DeviceDialog
          key={`${dialogMode}-${selectedId || "new"}`}
          clients={clients}
          initialValue={dialogMode === "edit" ? selectedItem : { ...blankDevice, statusId: statuses[0]?.id || "" }}
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

function DeviceDialog({ clients, initialValue, onClose, onSave, open, statuses, title }) {
  const [form, setForm] = useState(initialValue || blankDevice);
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
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
  const canSave = form.snNumber.trim() || form.cstNumber.trim() || form.ticketNumber.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle fontWeight={900}>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, pt: 1 }}>
          <TextField label="Company" value={form.company} onChange={updateField("company")} />
          <TextField select label="Client" value={form.clientId || ""} onChange={updateClient}>
            <MenuItem value="">Select Client</MenuItem>
            {clients.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {client.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Client Code" value={form.clientCode || ""} InputProps={{ readOnly: true }} />
          <TextField label="Raised by" value={form.raisedBy} onChange={updateField("raisedBy")} />
          <TextField label="Date Received" type="date" value={form.dateReceived} onChange={updateField("dateReceived")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Package Style" value={form.packageStyle} onChange={updateField("packageStyle")}>{packageStyles.map((style) => <MenuItem key={style} value={style}>{style}</MenuItem>)}</TextField>
          <TextField label="CST Number" value={form.cstNumber} onChange={updateField("cstNumber")} />
          <TextField label="Ticket Number" value={form.ticketNumber} onChange={updateField("ticketNumber")} />
          <TextField label="SN Number" value={form.snNumber} onChange={updateField("snNumber")} />
          <TextField label="Device Type" value={form.deviceType} onChange={updateField("deviceType")} />
          <TextField select label="With Adapter" value={form.withAdapter} onChange={updateField("withAdapter")}>{adapterOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField>
          <TextField label="Start Repairing Support" type="date" value={form.startRepairingSupport} onChange={updateField("startRepairingSupport")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="End Date Support" type="date" value={form.endDateSupport} onChange={updateField("endDateSupport")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Start QA" type="date" value={form.startQa} onChange={updateField("startQa")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="End Date QA" type="date" value={form.endDateQa} onChange={updateField("endDateQa")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Status" value={form.statusId} onChange={updateField("statusId")}>{statuses.map((status) => <MenuItem key={status.id} value={status.id}>{status.name}</MenuItem>)}</TextField>
          <TextField label="Date Delivered" type="date" value={form.dateDelivered} onChange={updateField("dateDelivered")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Give to" value={form.giveTo} onChange={updateField("giveTo")} />
          <TextField label="Remarks" multiline minRows={4} value={form.remarks} onChange={updateField("remarks")} sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!canSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function PackageChip({ value }) {
  if (!value) return <>-</>;
  const color = value === "With Box" ? "#bae6fd" : value === "Plastic" ? "#fde68a" : "#fecaca";
  return <Chip label={value} size="small" sx={{ bgcolor: color, fontWeight: 800 }} />;
}

const isInsideRange = (value, from, to) => {
  if (!value && (from || to)) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
};

const formatDisplayDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";

const mapDeviceFromDb = (item) => ({
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

const mapDeviceToDb = (item) => ({
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

const exportExcel = (items, statuses) => {
  const headers = ["Company", "Client Code", "Raised by", "Date Received", "Package Style", "CST Number", "Ticket Number", "SN Number", "Device Type", "With Adapter", "Start Repairing Support", "End Date Support", "Start QA", "End Date QA", "Status", "Date Delivered", "Give to", "Remarks"];
  const rows = items.map((item) => {
    const status = statuses.find((entry) => entry.id === item.statusId);
    return {
      cells: [item.company, item.clientCode, item.raisedBy, item.dateReceived, item.packageStyle, item.cstNumber, item.ticketNumber, item.snNumber, item.deviceType, item.withAdapter, item.startRepairingSupport, item.endDateSupport, item.startQa, item.endDateQa, status?.name || item.statusName, item.dateDelivered, item.giveTo, item.remarks],
      packageStyle: item.packageStyle,
      statusName: status?.name || item.statusName,
      statusColor: status?.color || item.statusColor,
      remarks: item.remarks,
      ticketNumber: item.ticketNumber,
    };
  });

  const columnWidths = [90, 95, 90, 95, 95, 90, 125, 190, 100, 90, 115, 110, 95, 95, 100, 100, 80, 260];
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          th, td { border: 1px solid #d9d9d9; padding: 5px; vertical-align: middle; white-space: normal; }
          .title { background: #b7e1cd; font-weight: 700; text-align: center; font-size: 12pt; }
          .header { background: #b7e1cd; font-weight: 700; text-align: center; }
          .center { text-align: center; }
          .ticket { background: #00e5e5; }
          .status { font-weight: 700; text-align: center; }
          .remarks { color: #ffffff; }
          .pkg-box { background: #bfe3ff; color: #075985; text-align: center; border-radius: 8px; }
          .pkg-plastic { background: #fde68a; color: #92400e; text-align: center; border-radius: 8px; }
          .pkg-paper { background: #fecaca; color: #b91c1c; text-align: center; border-radius: 8px; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            ${columnWidths.map((width) => `<col style="width:${width}px" />`).join("")}
          </colgroup>
          <thead>
            <tr><th class="title" colspan="${headers.length}">DEVICE INVENTORY</th></tr>
            <tr>${headers.map((header) => `<th class="header">${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => renderExcelRow(row)).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `device-inventory-${new Date().toISOString().slice(0, 10)}.xls`;
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

const renderExcelRow = (row) => {
  const statusBg = row.statusColor || getStatusExportColor(row.statusName);
  return `<tr>${row.cells
    .map((cell, index) => {
      const className = getExportCellClass(index, row);
      const style = index === 14
        ? ` style="background:${statusBg}; color:${getTextColor(statusBg)};"`
        : index === 17 && row.remarks
          ? ` style="background:${getRemarksExportColor(row.remarks)};"`
          : "";
      return `<td class="${className}"${style}>${escapeHtml(cell || "")}</td>`;
    })
    .join("")}</tr>`;
};

const getExportCellClass = (index, row) => {
  if ([1, 3, 9, 10, 11, 12, 13, 15, 16].includes(index)) {
    return "center";
  }
  if (index === 4) {
    if (row.packageStyle === "With Box") return "pkg-box";
    if (row.packageStyle === "Plastic") return "pkg-plastic";
    if (row.packageStyle === "Paper Bag") return "pkg-paper";
  }
  if (index === 6 && row.ticketNumber) {
    return "ticket center";
  }
  if (index === 14) {
    return "status";
  }
  if (index === 17 && row.remarks) {
    return "remarks";
  }
  return "";
};

const getStatusExportColor = (statusName) => {
  if (statusName === "Completed" || statusName === "Complete" || statusName === "Deployed") return "#00ff00";
  if (statusName === "N/A") return "#c9daf8";
  if (statusName === "Defect") return "#ff0000";
  return "#ffffff";
};

const getRemarksExportColor = (remarks) => {
  const lower = remarks.toLowerCase();
  if (lower.includes("cancel")) return "#cc0000";
  if (lower.includes("accounting")) return "#ff9900";
  if (lower.includes("recurring")) return "#eadcf8";
  if (lower.includes("waiting")) return "#1155cc";
  if (lower.includes("ongoing")) return "#ffff00";
  return "#ffffff";
};

const getTextColor = (background) => {
  if (!background || background === "#ffffff") return "#000000";
  const hex = background.replace("#", "");
  if (hex.length !== 6) return "#000000";
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? "#000000" : "#ffffff";
};

const isClosedStatus = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  return normalized === "completed" || normalized === "complete" || normalized === "n/a";
};
