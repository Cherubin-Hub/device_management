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
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useEffect, useMemo, useState } from "react";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { supabase } from "../src/lib/supabase.js";

export default function ClientStatusPage() {
  // Store configurable clients used by inventory and testing client-code selectors.
  const [clients, setClients] = useState([]);
  // Store configurable statuses used by inventory and testing status selectors.
  const [statuses, setStatuses] = useState([]);
  // Store configurable device types used by the inventory Device Type selector.
  const [deviceTypes, setDeviceTypes] = useState([]);
  // Switch between Clients, Status, and Device Types without changing pages.
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
      // Load all configuration lists together because the page can switch tabs instantly.
      const [clientsResult, statusesResult, deviceTypesResult] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, client_code, is_active")
          .order("name", { ascending: true }),
        supabase
          .from("statuses")
          .select("id, name, color, is_active")
          .order("name", { ascending: true }),
        supabase
          .from("device_types")
          .select("id, name, is_active")
          .order("name", { ascending: true }),
      ]);

      if (ignore) {
        return;
      }

      if (clientsResult.error || statusesResult.error || deviceTypesResult.error) {
        setError(
          clientsResult.error?.message ||
            statusesResult.error?.message ||
            deviceTypesResult.error?.message ||
            "Failed to load data"
        );
        setIsLoading(false);
        return;
      }

      setClients(clientsResult.data || []);
      setStatuses(statusesResult.data || []);
      setDeviceTypes(deviceTypesResult.data || []);
      setSelectedId((current) => current || clientsResult.data?.[0]?.id || null);
      setIsLoading(false);
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleToggleActive = async (type, id, currentStatus) => {
    const table = getConfigTable(type);
    const sourceItem = getConfigItems(type, { clients, statuses, deviceTypes }).find((item) => item.id === id);
    // Toggle active state used by dropdowns without deleting the configuration record.
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
    } else if (type === "status") {
      setStatuses((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_active: !currentStatus } : item
        )
      );
    } else {
      setDeviceTypes((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_active: !currentStatus } : item
        )
      );
    }

    // Record configuration enable/disable movement for audit reporting.
    await logAuditEvent({
      action: "UPDATE",
      afterData: { ...sourceItem, is_active: !currentStatus },
      beforeData: sourceItem || null,
      entityId: id,
      entityTable: table,
      module: "Configurations",
      recordLabel: getConfigLabel(type, sourceItem),
      summary: `${!currentStatus ? "Enabled" : "Disabled"} ${getConfigTypeLabel(type)} ${getConfigLabel(type, sourceItem)}.`,
    });
  };

  const handleCreateOption = async (type, value) => {
    const payload = {
      name: value.name.trim(),
      ...(type === "client" ? { client_code: value.clientCode.trim() } : {}),
      ...(type === "status" ? { color: value.color || "#4b5563" } : {}),
      is_active: true,
    };
    const table = getConfigTable(type);
    // Insert a new dropdown configuration option used by inventory/testing forms.
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
    } else if (type === "status") {
      setStatuses((current) => [...current, data].sort(sortByName));
      setSelectedId(data.id);
    } else {
      setDeviceTypes((current) => [...current, data].sort(sortByName));
      setSelectedId(data.id);
    }

    // Record newly created configuration values so setup changes are traceable.
    await logAuditEvent({
      action: "CREATE",
      afterData: data,
      entityId: data.id,
      entityTable: table,
      module: "Configurations",
      recordLabel: getConfigLabel(type, data),
      summary: `Created ${getConfigTypeLabel(type)} ${getConfigLabel(type, data)}.`,
    });
    setDialogMode(null);
  };

  const handleUpdateOption = async (type, id, value) => {
    const table = getConfigTable(type);
    const payload = {
      name: value.name.trim(),
      ...(type === "client" ? { client_code: value.clientCode.trim() } : {}),
      ...(type === "status" ? { color: value.color || "#4b5563" } : {}),
    };
    // Update an existing configuration option while preserving its database identifier.
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

    const previousItem = getConfigItems(type, { clients, statuses, deviceTypes }).find((item) => item.id === id);
    if (type === "client") {
      setClients((current) =>
        current.map((item) => (item.id === id ? data : item)).sort(sortByName)
      );
    } else if (type === "status") {
      setStatuses((current) =>
        current.map((item) => (item.id === id ? data : item)).sort(sortByName)
      );
    } else {
      setDeviceTypes((current) =>
        current.map((item) => (item.id === id ? data : item)).sort(sortByName)
      );
    }

    // Record before/after snapshots for configuration updates.
    await logAuditEvent({
      action: "UPDATE",
      afterData: data,
      beforeData: previousItem || null,
      entityId: id,
      entityTable: table,
      module: "Configurations",
      recordLabel: getConfigLabel(type, data),
      summary: `Updated ${getConfigTypeLabel(type)} ${getConfigLabel(type, data)}.`,
    });
    setDialogMode(null);
  };

  const handleDeleteOption = async (type, id) => {
    const table = getConfigTable(type);
    const itemToDelete = getConfigItems(type, { clients, statuses, deviceTypes }).find((item) => item.id === id);
    // Delete configuration values only when the user explicitly chooses the row action.
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
      if (type === "status") {
        setStatuses((current) => current.filter((item) => item.id !== id));
        setSelectedId((current) =>
          current === id ? statuses.find((item) => item.id !== id)?.id || null : current
        );
      } else {
        setDeviceTypes((current) => current.filter((item) => item.id !== id));
        setSelectedId((current) =>
          current === id ? deviceTypes.find((item) => item.id !== id)?.id || null : current
        );
      }
    }

    // Record deleted configuration values for audit visibility.
    await logAuditEvent({
      action: "DELETE",
      beforeData: itemToDelete || null,
      entityId: id,
      entityTable: table,
      module: "Configurations",
      recordLabel: getConfigLabel(type, itemToDelete),
      summary: `Deleted ${getConfigTypeLabel(type)} ${getConfigLabel(type, itemToDelete)}.`,
    });
  };

  const currentItems = tabValue === 0 ? clients : tabValue === 1 ? statuses : deviceTypes;
  // Determine which table and dialog fields should be used for the active tab.
  const itemType = tabValue === 0 ? "client" : tabValue === 1 ? "status" : "deviceType";
  // Keep loading and empty states aligned to the active tab's column count.
  const tableColumnCount = itemType === "deviceType" ? 4 : 5;
  const selectedItem = useMemo(
    () => currentItems.find((item) => item.id === selectedId) || null,
    [currentItems, selectedId]
  );

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        p: { xs: 2, md: 3 },
        textAlign: "left",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#f0e8ff",
              borderRadius: 1.5,
              color: "#6b21a8",
              display: "flex",
              height: 38,
              justifyContent: "center",
              width: 38,
            }}
          >
            <SettingsRoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={900}>
              Configurations
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Manage clients and statuses. Enable or disable them as needed.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogMode("new")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            New {getConfigTypeTitle(itemType)}
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
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                fontSize: 11,
                fontWeight: 700,
                minHeight: 40,
                py: 0.75,
                textTransform: "uppercase",
              },
            }}
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
            <Tab align="center" label="Device Types" />
          </Tabs>
        </Box>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table
            sx={{
              minWidth: 900,
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
            size="small"
          >
            <TableHead>
              <TableRow>
                {itemType === "client" ? <TableCell width={140}>Client Code</TableCell> : null}
                <TableCell align="center">{getConfigNameColumn(itemType)}</TableCell>
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
                    colSpan={tableColumnCount}
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
                    colSpan={tableColumnCount}
                    align="center"
                    sx={{ py: 4 }}
                  >
                    No {getConfigTypeTitle(itemType).toLowerCase()} yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {currentItems.map((item) => {
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
                    {itemType === "client" ? (
                      <TableCell align="center">
                        <Typography fontWeight={700}>
                          {item.client_code || "-"}
                        </Typography>
                      </TableCell>
                    ) : null}
                    <TableCell align="center" sx={{ textAlign: "center" }}>
                      <Typography
                        component="span"
                        fontWeight={700}
                        sx={{
                          // Keep Client Name, Status Name, and Device Type values centered under their headers.
                          display: "block",
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        {item.name}
                      </Typography>
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
                        sx={{ fontWeight: 700, height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={item.is_active ? "Disable" : "Enable"}>
                        <Switch
                          checked={item.is_active}
                          onChange={() => handleToggleActive(itemType, item.id, item.is_active)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          sx={{ transform: "scale(0.9)" }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center" sx={{ height: 34, p: 0, position: "relative", whiteSpace: "nowrap" }}>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        justifyContent="center"
                        flexWrap="nowrap"
                        sx={{
                          left: "50%",
                          position: "absolute",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            sx={{ p: 0.5 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(item.id);
                              setDialogMode("edit");
                            }}
                          >
                            <EditRoundedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            sx={{ p: 0.5 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(item.id);
                              handleDeleteOption(itemType, item.id);
                            }}
                          >
                            <DeleteRoundedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
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

const getConfigTable = (type) => {
  // Map the active configuration tab to the Supabase table it manages.
  if (type === "client") return "clients";
  if (type === "status") return "statuses";
  return "device_types";
};

const getConfigItems = (type, collections) => {
  // Return the correct local state array for the active configuration tab.
  if (type === "client") return collections.clients;
  if (type === "status") return collections.statuses;
  return collections.deviceTypes;
};

const getConfigLabel = (type, item) => {
  // Build the readable label used in audit trail summaries.
  if (!item) return "Untitled record";
  if (type === "client") return item.client_code ? `${item.client_code} - ${item.name}` : item.name;
  return item.name || "Untitled record";
};

const getConfigTypeLabel = (type) => {
  // Build lowercase labels used inside audit trail sentences.
  if (type === "client") return "client";
  if (type === "status") return "status";
  return "device type";
};

const getConfigTypeTitle = (type) => {
  // Build title-case labels used by buttons, empty states, and dialogs.
  if (type === "client") return "Client";
  if (type === "status") return "Status";
  return "Device Type";
};

const getConfigNameColumn = (type) => {
  // Build the name column label based on the active configuration tab.
  if (type === "client") return "Client Name";
  if (type === "status") return "Status Name";
  return "Device Type";
};

function ClientStatusDialog({ initialValue, itemType, mode, onClose, onCreate, onUpdate }) {
  // Store dialog field values locally until the user clicks Save.
  const [form, setForm] = useState({
    name: initialValue?.name || "",
    clientCode: initialValue?.client_code || "",
    color: initialValue?.color || "#4b5563",
  });

  const title = `${mode === "new" ? "New" : "Edit"} ${getConfigTypeTitle(itemType)}`;
  const canSave = form.name.trim() && (itemType !== "client" || form.clientCode.trim());
  const handleSave = () => {
    // Prevent save when required configuration fields are incomplete.
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
            label={getConfigNameColumn(itemType)}
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
