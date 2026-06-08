import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  Switch,
  Tabs,
  Tab,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../src/lib/supabase.js";

export default function ClientStatusPage() {
  const [clients, setClients] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!supabase) {
        setError("Supabase not configured");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const [clientsResult, statusesResult] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, client_code, is_active")
          .order("name", { ascending: true }),
        supabase
          .from("statuses")
          .select("id, name, color, is_active")
          .order("name", { ascending: true }),
      ]);

      if (ignore) {
        return;
      }

      if (clientsResult.error || statusesResult.error) {
        setError(
          clientsResult.error?.message ||
            statusesResult.error?.message ||
            "Failed to load data"
        );
        setIsLoading(false);
        return;
      }

      setClients(clientsResult.data || []);
      setStatuses(statusesResult.data || []);
      setSelectedId((current) => current || clientsResult.data?.[0]?.id || null);
      setIsLoading(false);
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleToggleActive = async (type, id, currentStatus) => {
    const table = type === "client" ? "clients" : "statuses";
    const { error: updateError } = await supabase
      .from(table)
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (type === "client") {
      setClients((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_active: !currentStatus } : item
        )
      );
    } else {
      setStatuses((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_active: !currentStatus } : item
        )
      );
    }
  };

  const handleCreateOption = async (type, value) => {
    const payload = {
      name: value.name.trim(),
      ...(type === "client" ? { client_code: value.clientCode.trim() } : {}),
      ...(type === "status" ? { color: value.color || "#4b5563" } : {}),
      is_active: true,
    };
    const table = type === "client" ? "clients" : "statuses";
    const { data, error: insertError } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (type === "client") {
      setClients((current) => [...current, data].sort(sortByName));
      setSelectedId(data.id);
    } else {
      setStatuses((current) => [...current, data].sort(sortByName));
      setSelectedId(data.id);
    }
    setDialogMode(null);
  };

  const handleUpdateOption = async (type, id, value) => {
    const table = type === "client" ? "clients" : "statuses";
    const payload = {
      name: value.name.trim(),
      ...(type === "client" ? { client_code: value.clientCode.trim() } : {}),
      ...(type === "status" ? { color: value.color || "#4b5563" } : {}),
    };
    const { data, error: updateError } = await supabase
      .from(table)
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (type === "client") {
      setClients((current) =>
        current.map((item) => (item.id === id ? data : item)).sort(sortByName)
      );
    } else {
      setStatuses((current) =>
        current.map((item) => (item.id === id ? data : item)).sort(sortByName)
      );
    }
    setDialogMode(null);
  };

  const handleDeleteOption = async (type, id) => {
    const table = type === "client" ? "clients" : "statuses";
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (type === "client") {
      setClients((current) => current.filter((item) => item.id !== id));
      setSelectedId((current) =>
        current === id ? clients.find((item) => item.id !== id)?.id || null : current
      );
    } else {
      setStatuses((current) => current.filter((item) => item.id !== id));
      setSelectedId((current) =>
        current === id ? statuses.find((item) => item.id !== id)?.id || null : current
      );
    }
  };

  const currentItems = tabValue === 0 ? clients : statuses;
  const itemType = tabValue === 0 ? "client" : "status";
  const selectedItem = useMemo(
    () => currentItems.find((item) => item.id === selectedId) || null,
    [currentItems, selectedId]
  );

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
              bgcolor: "#f0e8ff",
              borderRadius: 1.5,
              color: "#6b21a8",
              display: "flex",
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            <SettingsRoundedIcon />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight={800}>
              Configurations
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
              Manage clients and statuses. Enable or disable them as needed.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogMode("new")}
          >
            New {itemType === "client" ? "Client" : "Status"}
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
            onClick={() => handleDeleteOption(itemType, selectedId)}
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

      <Paper elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Box sx={{ borderBottom: "1px solid #dde5ef" }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => {
              setTabValue(newValue);
              setSelectedId(null);
              setError("");
            }}
            aria-label="configuration tabs"
          >
            <Tab align="center" label="Clients" />
            <Tab align="center" label="Status" />
          </Tabs>
        </Box>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 900 }} size="small">
            <TableHead>
              <TableRow>
                <TableCell width={64} align="center">No.</TableCell>
                {itemType === "client" ? <TableCell width={140}>Client Code</TableCell> : null}
                <TableCell>{itemType === "client" ? "Client Name" : "Status Name"}</TableCell>
                {itemType === "status" ? <TableCell align="center">Color</TableCell> : null}
                <TableCell align="center">Status</TableCell>
                <TableCell width={120} align="center">Enabled</TableCell>
                <TableCell width={96} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={itemType === "status" ? 6 : 6}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : null}
              {!isLoading && currentItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={itemType === "status" ? 6 : 6}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    No {itemType === "client" ? "clients" : "statuses"} yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {currentItems.map((item, index) => {
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
                    {itemType === "client" ? (
                      <TableCell>
                        <Typography fontWeight={800} variant="body2">
                          {item.client_code || "-"}
                        </Typography>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {item.color ? (
                          <Box
                            sx={{
                              bgcolor: item.color,
                              borderRadius: "50%",
                              height: 12,
                              width: 12,
                              flexShrink: 0,
                            }}
                          />
                        ) : null}
                        <Typography fontWeight={700} variant="body2">
                          {item.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    {itemType === "status" ? (
                      <TableCell align="center">
                        <Box
                          sx={{
                            bgcolor: `${item.color}1a`,
                            borderRadius: 1,
                            color: item.color,
                            display: "inline-flex",
                            height: 24,
                            px: 1,
                          }}
                        >
                          <Box
                            sx={{
                              bgcolor: item.color,
                              borderRadius: "50%",
                              height: 8,
                              width: 8,
                              my: "auto",
                              mr: 0.75,
                            }}
                          />
                        </Box>
                      </TableCell>
                    ) : null}
                    <TableCell align="center">
                      <Chip
                        label={item.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={item.is_active ? "success" : "default"}
                        variant={item.is_active ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={item.is_active ? "Disable" : "Enable"}>
                        <Switch
                          checked={item.is_active}
                          onChange={() => handleToggleActive(itemType, item.id, item.is_active)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                        />
                      </Tooltip>
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
        <ClientStatusDialog
          key={`${itemType}-${dialogMode}-${selectedId || "new"}`}
          initialValue={
            dialogMode === "edit"
              ? selectedItem
              : { name: "", client_code: "", color: "#4b5563" }
          }
          itemType={itemType}
          mode={dialogMode}
          onClose={() => setDialogMode(null)}
          onCreate={handleCreateOption}
          onUpdate={handleUpdateOption}
        />
      ) : null}
    </Box>
  );
}

const sortByName = (first, second) => first.name.localeCompare(second.name);

function ClientStatusDialog({ initialValue, itemType, mode, onClose, onCreate, onUpdate }) {
  const [form, setForm] = useState({
    name: initialValue?.name || "",
    clientCode: initialValue?.client_code || "",
    color: initialValue?.color || "#4b5563",
  });

  const title = `${mode === "new" ? "New" : "Edit"} ${itemType === "client" ? "Client" : "Status"}`;
  const canSave = form.name.trim() && (itemType === "status" || form.clientCode.trim());
  const handleSave = () => {
    if (!canSave) {
      return;
    }
    if (mode === "new") {
      onCreate(itemType, form);
    } else {
      onUpdate(itemType, initialValue.id, form);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={900}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={itemType === "client" ? "Client Name" : "Status Name"}
            required
            fullWidth
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          {itemType === "client" ? (
            <TextField
              label="Client Code"
              required
              fullWidth
              value={form.clientCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, clientCode: event.target.value }))
              }
            />
          ) : null}
          {itemType === "status" ? (
            <TextField
              label="Color"
              type="color"
              value={form.color}
              onChange={(event) =>
                setForm((current) => ({ ...current, color: event.target.value }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
