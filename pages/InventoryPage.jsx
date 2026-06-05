import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../src/lib/supabase";

const blankInventoryItem = {
  dateDelivered: "",
  serialNoCloudId: "",
  deviceModel: "",
  clientId: "",
  statusId: "",
  remarks: "",
  dateDeployed: "",
};

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  useEffect(() => {
    let ignore = false;

    async function loadAllData() {
      setIsLoading(true);
      const [itemsResult, clientsResult, statusesResult] = await Promise.all([
        supabase
          .from("inventory_items")
          .select(`
            id,
            date_delivered,
            serial_no_cloud_id,
            device_model,
            client_id,
            status_id,
            remarks,
            date_deployed,
            clients ( id, name ),
            statuses ( id, name, color )
          `)
          .order("id", { ascending: true }),
        supabase
          .from("clients")
          .select("id, name, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("statuses")
          .select("id, name, color, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (ignore) {
        return;
      }

      if (itemsResult.error || clientsResult.error || statusesResult.error) {
        setError(
          itemsResult.error?.message ||
            clientsResult.error?.message ||
            statusesResult.error?.message
        );
        setIsLoading(false);
        return;
      }

      const mappedItems = (itemsResult.data || []).map(mapInventoryFromDb);
      setItems(mappedItems);
      setClients(clientsResult.data || []);
      setStatuses(statusesResult.data || []);
      setSelectedId((current) => current || mappedItems[0]?.id || null);
      setIsLoading(false);
    }

    loadAllData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleSave = async (form) => {
    const payload = mapInventoryToDb(form);

    if (dialogMode === "new") {
      const { data, error: insertError } = await supabase
        .from("inventory_items")
        .insert(payload)
        .select(`
          id,
          date_delivered,
          serial_no_cloud_id,
          device_model,
          client_id,
          status_id,
          remarks,
          date_deployed,
          clients ( id, name ),
          statuses ( id, name, color )
        `)
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      const nextItem = mapInventoryFromDb(data);
      setItems((current) => [...current, nextItem]);
      setSelectedId(nextItem.id);
      setDialogMode(null);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("inventory_items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", selectedId)
      .select(`
        id,
        date_delivered,
        serial_no_cloud_id,
        device_model,
        client_id,
        status_id,
        remarks,
        date_deployed,
        clients ( id, name ),
        statuses ( id, name, color )
      `)
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updatedItem = mapInventoryFromDb(data);
    setItems((current) => current.map((item) => (item.id === selectedId ? updatedItem : item)));
    setDialogMode(null);
  };

  const handleDelete = async () => {
    if (!selectedItem) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", selectedId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== selectedId));
    const nextItem = items.find((item) => item.id !== selectedId);
    setSelectedId(nextItem?.id || null);
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        px: { xs: 2, md: 4 },
        py: { xs: 2.5, md: 4 },
        textAlign: "left",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#e8f2ff",
              borderRadius: 1.5,
              color: "#1f5f99",
              display: "flex",
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            <Inventory2RoundedIcon />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight={800}>
              Device Inventory Management
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
              Track delivered devices, clients, deployment status, and remarks.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogMode("new")}
          >
            New
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditRoundedIcon />}
            disabled={!selectedItem}
            onClick={() => setDialogMode("edit")}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteRoundedIcon />}
            disabled={!selectedItem}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Box
          sx={{
            bgcolor: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: 1.5,
            color: "#be123c",
            mb: 2,
            p: 1.5,
          }}
        >
          {error}
        </Box>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          border: "1px solid #dde5ef",
          borderRadius: 2,
          boxShadow: "0 16px 40px rgba(21, 34, 50, 0.08)",
          overflow: "hidden",
        }}
      >
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 1120 }} size="small">
            <TableHead>
              <TableRow>
                <TableCell width={64} align="center">No.</TableCell>
                <TableCell align="center">Date Delivered to Office</TableCell>
                <TableCell align="center">Serial No./Cloud ID</TableCell>
                <TableCell align="center">Device Model</TableCell>
                <TableCell align="center">Client</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Remarks</TableCell>
                <TableCell align="center">Date Deployed</TableCell>
                <TableCell width={96} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    Loading inventory from Supabase...
                  </TableCell>
                </TableRow>
              ) : null}
              {!isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    No inventory records yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {items.map((item, index) => {
                const status = statuses.find((entry) => entry.id === item.statusId);
                const client = clients.find((entry) => entry.id === item.clientId);
                const selected = item.id === selectedId;
                return (
                  <TableRow
                    key={item.id}
                    hover
                    selected={selected}
                    onClick={() => setSelectedId(item.id)}
                    sx={{
                      cursor: "pointer",
                      "& th": { fontWeight: 800 },
                    }}
                  >
                    <TableCell align="center" component="th" scope="row">
                      {index + 1}
                    </TableCell>
                    <TableCell align="center">
                      {formatDisplayDate(item.dateDelivered)}
                    </TableCell>
                    <TableCell align="center">
                      {item.serialNoCloudId}
                    </TableCell>
                    <TableCell align="center">
                      {item.deviceModel}
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight={700} variant="body2">
                        {client?.name || item.clientName || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={status?.name || item.statusName || "-"}
                        size="small"
                        sx={{
                          bgcolor: `${status?.color || item.statusColor || "#64748b"}1a`,
                          color: status?.color || item.statusColor || "#475569",
                          fontWeight: 900,
                        }}
                      />
                    </TableCell >
                    <TableCell align="center" sx={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>
                      {item.remarks || "-"}
                    </TableCell>
                    <TableCell align="center">
                      {formatDisplayDate(item.dateDeployed)}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(item.id);
                            setDialogMode("edit");
                          }}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {dialogMode ? (
        <InventoryDialog
          key={`${dialogMode}-${selectedId || "new"}`}
          clients={clients}
          initialValue={
            dialogMode === "edit"
              ? selectedItem
              : {
                  ...blankInventoryItem,
                  clientId: clients[0]?.id || "",
                  statusId: statuses[0]?.id || "",
                }
          }
          onClose={() => setDialogMode(null)}
          onSave={handleSave}
          open
          statuses={statuses}
          title={dialogMode === "new" ? "New Inventory Item" : "Edit Inventory Item"}
        />
      ) : null}
    </Box>
  );
}

function InventoryDialog({ clients, initialValue, onClose, onSave, open, statuses, title }) {
  const [form, setForm] = useState(initialValue || blankInventoryItem);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const canSave = form.serialNoCloudId.trim() && form.statusId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={900}>{title}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            pt: 1,
          }}
        >
          <TextField
            label="Date Delivered to Office"
            type="date"
            value={form.dateDelivered}
            onChange={updateField("dateDelivered")}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Serial No./Cloud ID"
            required
            value={form.serialNoCloudId}
            onChange={updateField("serialNoCloudId")}
          />
          <TextField
            label="Device Model"
            value={form.deviceModel}
            onChange={updateField("deviceModel")}
          />
          <TextField select label="Client" value={form.clientId} onChange={updateField("clientId")}>
            {clients.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {client.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            required
            value={form.statusId}
            onChange={updateField("statusId")}
          >
            {statuses.map((status) => (
              <MenuItem key={status.id} value={status.id}>
                {status.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Date Deployed"
            type="date"
            value={form.dateDeployed}
            onChange={updateField("dateDeployed")}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Remarks"
            multiline
            minRows={4}
            value={form.remarks}
            onChange={updateField("remarks")}
            sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!canSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const formatDisplayDate = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
};

const mapInventoryFromDb = (item) => ({
  id: item.id,
  dateDelivered: item.date_delivered || "",
  serialNoCloudId: item.serial_no_cloud_id || "",
  deviceModel: item.device_model || "",
  clientId: item.client_id || "",
  clientName: item.clients?.name || "",
  statusId: item.status_id || "",
  statusName: item.statuses?.name || "",
  statusColor: item.statuses?.color || "",
  remarks: item.remarks || "",
  dateDeployed: item.date_deployed || "",
});

const mapInventoryToDb = (item) => ({
  date_delivered: item.dateDelivered || null,
  serial_no_cloud_id: item.serialNoCloudId,
  device_model: item.deviceModel || null,
  client_id: item.clientId || null,
  status_id: item.statusId,
  remarks: item.remarks || null,
  date_deployed: item.dateDeployed || null,
});
