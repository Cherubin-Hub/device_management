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
  CircularProgress,
  Alert,
  Autocomplete,
  IconButton,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import { archiveRecord } from "../src/lib/archiveRecord.js";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { supabase } from "../src/lib/supabase.js";

const blankTest = {
  clientId: "",
  clientCode: "",
  dateReceived: "",
  packageStyle: "",
  pictureUrl: "",
  model: "",
  withAdapter: "No",
  serialNumber: "",
  statusId: "",
  repairBy: "",
  testBy: "",
  seniorTestBy: "",
  remarks: "",
};

const packageStyles = ["With Box", "Plastic", "Paper Bag"];
const adapterOptions = ["Yes", "No"];

export default function OngoingTestingPage() {
  // Store testing rows in the same shape expected by the table and dialog.
  const [items, setItems] = useState([]);
  // Store lookup records used by client and status selectors.
  const [clients, setClients] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogMode, setDialogMode] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [filters, setFilters] = useState({
    receivedFrom: "",
    receivedTo: "",
  });
  const [draftFilters, setDraftFilters] = useState({
    receivedFrom: "",
    receivedTo: "",
  });

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  useEffect(() => {
    let ignore = false;

    async function loadTests() {
      setIsLoading(true);
      // Load testing records with joined client/status labels to avoid separate per-row requests.
      const [testsResult, statusesResult, clientsResult] = await Promise.all([
        supabase
          .from("ongoing_testing_items")
          .select(`
            id,
            client_id,
            date_received,
            package_style,
            picture_url,
            model,
            with_adapter,
            serial_number,
            status_id,
            repair_by,
            test_by,
            senior_test_by,
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

      if (testsResult.error || statusesResult.error || clientsResult.error) {
        setError(testsResult.error?.message || statusesResult.error?.message || clientsResult.error?.message);
        setIsLoading(false);
        return;
      }

      const mappedItems = (testsResult.data || []).map(mapTestFromDb);
      setItems(mappedItems);
      setStatuses(statusesResult.data || []);
      setClients(clientsResult.data || []);
      setSelectedId(mappedItems[0]?.id || null);
      setIsLoading(false);
    }

    loadTests();

    return () => {
      ignore = true;
    };
  }, []);

  const displayedItems = useMemo(
    () =>
      // Apply the saved date filter state so typing dates does not filter until Apply is clicked.
      items.filter((item) => {
        const receivedOk = isInsideRange(
          item.dateReceived,
          filters.receivedFrom,
          filters.receivedTo
        );
        return receivedOk;
      }),
    [filters, items]
  );

  const handleSave = async (form) => {
    // Convert dialog state into Supabase column names before insert/update.
    const payload = mapTestToDb(form);

    if (dialogMode === "new") {
      // Create a testing record before deciding whether it should move to inventory.
      const { data, error: insertError } = await supabase
        .from("ongoing_testing_items")
        .insert(payload)
        .select("*, clients ( id, name, client_code ), statuses ( id, name, color )")
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      const nextItem = mapTestFromDb(data);
      await logAuditEvent({
        action: "CREATE",
        afterData: payload,
        entityId: nextItem.id,
        entityTable: "ongoing_testing_items",
        module: "Ongoing Testing",
        recordLabel: getTestLabel(nextItem),
        summary: `Created ongoing testing record for ${getTestLabel(nextItem)}.`,
      });
      if (isClosedStatus(nextItem.status?.name)) {
        await transferToInventory(nextItem);
        setDialogMode(null);
        return;
      }

      setItems((current) => [nextItem, ...current]);
      setSelectedId(nextItem.id);
      setDialogMode(null);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("ongoing_testing_items")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", selectedId)
      .select("*, clients ( id, name, client_code ), statuses ( id, name, color )")
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updatedItem = mapTestFromDb(data);
    const newStatus = updatedItem.status?.name;
    await logAuditEvent({
      action: "UPDATE",
      afterData: payload,
      beforeData: selectedItem ? mapTestToDb(selectedItem) : null,
      entityId: updatedItem.id,
      entityTable: "ongoing_testing_items",
      module: "Ongoing Testing",
      recordLabel: getTestLabel(updatedItem),
      summary: `Updated ongoing testing record for ${getTestLabel(updatedItem)}.`,
    });

    if (isClosedStatus(newStatus)) {
      // Closed statuses automatically move the record from Ongoing Testing to Inventory Records.
      const transferred = await transferToInventory(updatedItem);
      if (transferred) {
        setDialogMode(null);
        return;
      }
    }

    setItems((current) => current.map((item) => (item.id === selectedId ? updatedItem : item)));
    setDialogMode(null);
  };

  const transferToInventory = async (testItem) => {
    try {
      // Create a device inventory item using only fields that exist in inventory records.
      const inventoryPayload = {
        company: testItem.clientName || testItem.repairBy || "",
        client_id: testItem.clientId || null,
        raised_by: "",
        date_received: testItem.dateReceived,
        package_style: testItem.packageStyle,
        cst_number: "",
        ticket_number: "",
        sn_number: testItem.serialNumber,
        device_type: testItem.model,
        with_adapter: testItem.withAdapter,
        status_id: testItem.statusId,
        remarks: testItem.remarks,
        give_to: null,
      };

      const { data: insertedInventory, error: insertError } = await supabase
        .from("device_inventory_items")
        .insert(inventoryPayload)
        .select()
        .single();

      if (insertError) {
        setError(`Failed to transfer to inventory: ${insertError.message}`);
        return false;
      }

      await logAuditEvent({
        action: "TRANSFER_TO_INVENTORY",
        afterData: inventoryPayload,
        beforeData: mapTestToDb(testItem),
        entityId: insertedInventory?.id || testItem.id,
        entityTable: "device_inventory_items",
        metadata: { sourceTestingId: testItem.id },
        module: "Device Inventory",
        recordLabel: getTestLabel(testItem),
        summary: `Moved ${getTestLabel(testItem)} from Ongoing Testing to Inventory Records.`,
      });

      // Delete the testing row only after the inventory insert succeeds.
      const { error: deleteError } = await supabase
        .from("ongoing_testing_items")
        .delete()
        .eq("id", testItem.id);

      if (deleteError) {
        setError(`Failed to delete from ongoing testing: ${deleteError.message}`);
        return false;
      }

      setItems((current) => current.filter((item) => item.id !== testItem.id));
      setSelectedId(items.find((item) => item.id !== testItem.id)?.id || null);
      return true;
    } catch (err) {
      setError(`Transfer error: ${err.message}`);
      return false;
    }
  };

  const handleDelete = async (itemId = selectedId) => {
    if (!itemId) {
      return;
    }

    const itemToDelete = items.find((item) => item.id === itemId);
    if (!itemToDelete) {
      return;
    }

    // Archive first so deleted testing records remain restorable.
    const { error: archiveError } = await archiveRecord({
      recordData: mapTestToDb(itemToDelete),
      recordLabel: itemToDelete.serialNumber || itemToDelete.model || itemToDelete.clientCode,
      recordType: "Ongoing Testing",
      sourceTable: "ongoing_testing_items",
    });

    if (archiveError) {
      setError(`Failed to archive record: ${archiveError.message}`);
      return;
    }

    const { error: deleteError } = await supabase
      .from("ongoing_testing_items")
      .delete()
      .eq("id", itemId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await logAuditEvent({
      action: "ARCHIVE",
      beforeData: mapTestToDb(itemToDelete),
      entityId: itemToDelete.id,
      entityTable: "ongoing_testing_items",
      module: "Ongoing Testing",
      recordLabel: getTestLabel(itemToDelete),
      summary: `Archived ongoing testing record for ${getTestLabel(itemToDelete)}.`,
    });
    setItems((current) => current.filter((item) => item.id !== itemId));
    setSelectedId(items.find((item) => item.id !== itemId)?.id || null);
  };

  const handleImageUploadForItem = async (itemId, file) => {
    if (!file) return;
    const previousSelectedId = selectedId;
    setSelectedId(itemId);
    setUploadingId(itemId);

    try {
      // Build a storage-safe file name so uploads do not fail on spaces or special characters.
      const fileExt = file.name.split(".").pop();
      const safeBaseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .slice(0, 40);
      const fileName = `${itemId}-${file.lastModified}-${safeBaseName}.${fileExt}`;
      const filePath = `ongoing-testing/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("ongoing-testing-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setUploadingId(null);
        setSelectedId(previousSelectedId);
        return;
      }

      const { data } = supabase.storage
        .from("ongoing-testing-images")
        .getPublicUrl(filePath);

      const pictureUrl = data?.publicUrl;
      const { error: updateError } = await supabase
        .from("ongoing_testing_items")
        .update({ picture_url: pictureUrl })
        .eq("id", itemId);

      if (updateError) {
        setError(`Failed to update image URL: ${updateError.message}`);
        setUploadingId(null);
        setSelectedId(previousSelectedId);
        return;
      }

      setItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, pictureUrl } : item))
      );
      setUploadingId(null);
      setSelectedId(previousSelectedId);
    } catch (err) {
      setError(`Image upload error: ${err.message}`);
      setUploadingId(null);
      setSelectedId(previousSelectedId);
    }
  };

  const updateFilter = (field) => (event) => {
    setDraftFilters((current) => ({ ...current, [field]: event.target.value }));
  };

  const applyFilters = () => {
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    setFilters({ receivedFrom: "", receivedTo: "" });
    setDraftFilters({ receivedFrom: "", receivedTo: "" });
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
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
            <AssessmentRoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={900}>
              Ongoing Testing
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Manage devices under testing.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogMode("new")}
            variant="contained"
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Add Test Record
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ mb: 2, p: 1.5, border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-end">
          <TextField
            label="Date Received From"
            type="date"
            value={draftFilters.receivedFrom}
            onChange={updateFilter("receivedFrom")}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="Date Received To"
            type="date"
            value={draftFilters.receivedTo}
            onChange={updateFilter("receivedTo")}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ minWidth: 180 }}
          />
          <Button
            startIcon={<FilterAltRoundedIcon />}
            onClick={applyFilters}
            variant="outlined"
            sx={{ textTransform: "none" }}
          >
            Apply
          </Button>
          <Button 
            startIcon={<ClearRoundedIcon />}
            onClick={clearFilters}
            variant="outlined"
            sx={{ textTransform: "none" }}>
            Clear
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2, overflowX: "hidden" }}>
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
            "& td, & th": {
              borderColor: "#dddddd",
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: "6%" }} align="center">
                Client
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "6%" }} align="center">
                Date Received
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "7%" }} align="center">
                Package Style
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "5%" }} align="center">
                Picture
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "5%" }} align="center">
                Model
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "5%" }} align="center">
                With Adapter
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "12%" }} align="center">
                Serial Number
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "8%" }} align="center">
                Status
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "9%" }} align="center">
                Repair By
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "8%" }} align="center">
                Test By
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "8%" }} align="center">
                Senior Test By
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "18%" }} align="center">
                Remarks
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "6%" }} align="center">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} sx={{ textAlign: "center", py: 4 }}>
                  <Typography color="text.secondary">No test records found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              displayedItems.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  onDoubleClick={() => {
                    setSelectedId(item.id);
                    setDialogMode("edit");
                  }}
                  sx={{
                    bgcolor: selectedId === item.id ? "#e8f2ff" : "transparent",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#f3f4f6" },
                  }}
                >
                  <TruncatedCell align="center">{item.clientCode || "-"}</TruncatedCell>
                  <TruncatedCell align="center">{item.dateReceived}</TruncatedCell>
                  <TableCell align="center"><PackageChip value={item.packageStyle} /></TableCell>
                  <TableCell align="center">
                    {item.pictureUrl ? (
                      <Box
                        component="img"
                        src={item.pictureUrl}
                        sx={{ width: 44, height: 34, borderRadius: 1, objectFit: "cover", display: "block", mx: "auto", mb: 0.5 }}
                      />
                    ) : (
                      null
                    )}
                    <Button
                      component="label"
                      size="small"
                      variant="text"
                      startIcon={uploadingId === item.id ? <CircularProgress size={12} /> : <ImageRoundedIcon fontSize="small" />}
                      sx={{ minWidth: 0, px: 0.25, py: 0, fontSize: 10, textTransform: "none", "& .MuiButton-startIcon": { mr: 0.25 } }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.pictureUrl ? "Change" : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleImageUploadForItem(item.id, file);
                        }}
                      />
                    </Button>
                  </TableCell>
                  <TruncatedCell align="center">{item.model}</TruncatedCell>
                  <TruncatedCell align="center">{item.withAdapter}</TruncatedCell>
                  <TruncatedCell align="center">{item.serialNumber}</TruncatedCell>
                  <TableCell align="center">
                    {item.status ? (
                      <Chip
                        label={item.status.name}
                        size="small"
                        sx={{
                          bgcolor: item.status.color || "#6b7280",
                          color: "#ffffff",
                          fontWeight: 600,
                          maxWidth: "100%",
                          "& .MuiChip-label": {
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          },
                        }}
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TruncatedCell align="center">{item.repairBy}</TruncatedCell>
                  <TruncatedCell align="center">{item.testBy}</TruncatedCell>
                  <TruncatedCell align="center">{item.seniorTestBy}</TruncatedCell>
                  <TruncatedCell>{item.remarks}</TruncatedCell>
                  <TableCell align="center" sx={{ height: 38, p: 0, position: "relative", whiteSpace: "nowrap" }}>
                    <Stack
                      direction="row"
                      spacing={0.25}
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
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                          setDialogMode("edit");
                        }}
                        sx={{ p: 0.5 }}
                      >
                        <EditRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                          handleDelete(item.id);
                        }}
                        color="error"
                        sx={{ p: 0.5 }}
                      >
                        <DeleteRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* {selectedItem && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Image Upload
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={uploadingId === selectedId ? <CircularProgress size={20} /> : <ImageRoundedIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingId === selectedId}
              variant="outlined"
              sx={{ textTransform: "none" }}
            >
              {uploadingId === selectedId ? "Uploading..." : "Upload Image"}
            </Button>
            {selectedItem.pictureUrl && (
              <>
                <Box
                  component="img"
                  src={selectedItem.pictureUrl}
                  sx={{ width: 100, height: 100, borderRadius: 1, objectFit: "cover" }}
                />
                <IconButton
                  size="small"
                  onClick={async () => {
                    const { error } = await supabase
                      .from("ongoing_testing_items")
                      .update({ picture_url: null })
                      .eq("id", selectedId);

                    if (!error) {
                      setItems((current) =>
                        current.map((item) =>
                          item.id === selectedId ? { ...item, pictureUrl: null } : item
                        )
                      );
                    }
                  }}
                  color="error"
                >
                  <ClearRoundedIcon />
                </IconButton>
              </>
            )}
          </Stack>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
        </Paper>
      )} */}

      <DeviceTestDialog
        mode={dialogMode}
        onClose={() => setDialogMode(null)}
        onSave={handleSave}
        item={selectedItem}
        clients={clients}
        statuses={statuses}
      />
    </Box>
  );
}

function DeviceTestDialog({ clients, mode, onClose, onSave, item, statuses }) {
  const [form, setForm] = useState(blankTest);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (mode === "edit" && item && !initializedRef.current) {
      initializedRef.current = true;
      setForm({
        clientId: item.clientId || "",
        clientCode: item.clientCode || "",
        dateReceived: item.dateReceived || "",
        packageStyle: item.packageStyle || "",
        pictureUrl: item.pictureUrl || "",
        model: item.model || "",
        withAdapter: item.withAdapter || "No",
        serialNumber: item.serialNumber || "",
        statusId: item.statusId || "",
        repairBy: item.repairBy || "",
        testBy: item.testBy || "",
        seniorTestBy: item.seniorTestBy || "",
        remarks: item.remarks || "",
      });
    } else if (mode === "new" && !initializedRef.current) {
      initializedRef.current = true;
      setForm(blankTest);
    }

    return () => {
      initializedRef.current = false;
    };
  }, [mode, item]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const isEditMode = mode === "edit";
  const dialogFieldSx = {
    "& .MuiInputLabel-root": {
      bgcolor: "#ffffff",
      px: 0.5,
    },
  };
  const lockedFieldSx = isEditMode
    ? {
        ...dialogFieldSx,
        "& .MuiInputBase-root.Mui-disabled": {
          bgcolor: "#f3f4f6",
        },
        "& .MuiInputBase-input.Mui-disabled": {
          WebkitTextFillColor: "#6b7280",
        },
        "& .MuiInputLabel-root.Mui-disabled": {
          color: "#6b7280",
        },
      }
    : {};

  if (!mode) {
    return null;
  }

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {mode === "new" ? "Add Test Record" : "Edit Test Record"}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 3.5 }}>
        {isEditMode ? (
          <TextField
            label="Client Code"
            value={form.clientCode || ""}
            fullWidth
            disabled
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ mt: 1.5, ...lockedFieldSx }}
          />
        ) : (
          <Autocomplete
            sx={{ mt: 1.5 }}
            forcePopupIcon
            open={clientSelectOpen}
            onOpen={() => setClientSelectOpen(true)}
            onClose={() => setClientSelectOpen(false)}
            openOnFocus
            popupIcon={<ArrowDropDownRoundedIcon />}
            value={clients.find((client) => String(client.id) === String(form.clientId)) || null}
            onChange={(_, selectedClient) => {
              setForm((current) => ({
                ...current,
                clientId: selectedClient?.id || "",
                clientCode: selectedClient?.client_code || "",
              }));
            }}
            options={clients}
            noOptionsText="No active clients found"
            getOptionLabel={(option) => option?.client_code || ""}
            filterOptions={(options, state) => {
              const search = state.inputValue.trim().toLowerCase();
              return options
                .filter((client) => {
                  const clientName = String(client.name || "").toLowerCase();
                  const clientCode = String(client.client_code || "").toLowerCase();
                  return !search || clientName.includes(search) || clientCode.includes(search);
                })
                .sort((first, second) => first.name.localeCompare(second.name))
                .slice(0, 10);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Client Code"
                placeholder="Select or type client code"
                fullWidth
                slotProps={{
                  ...params.slotProps,
                  inputLabel: {
                    ...params.slotProps?.inputLabel,
                    shrink: true,
                  },
                }}
                sx={{
                  ...dialogFieldSx,
                  "& .MuiOutlinedInput-root": {
                    height: 54,
                    minHeight: 54,
                    py: "0 !important",
                  },
                  "& .MuiAutocomplete-input": {
                    py: "0 !important",
                  },
                  "& .MuiAutocomplete-endAdornment": {
                    right: 9,
                  },
                  "& .MuiAutocomplete-popupIndicator": {
                    color: "#6b7280",
                    display: "inline-flex",
                    visibility: "visible",
                  },
                }}
              />
            )}
          />
        )}
        <TextField
          label="Date Received"
          type="date"
          value={form.dateReceived}
          onChange={handleChange("dateReceived")}
          disabled={isEditMode}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
          sx={{ mt: 1.5, ...(isEditMode ? lockedFieldSx : dialogFieldSx) }}
        />
        <TextField
          select
          label="Package Style"
          value={form.packageStyle}
          onChange={handleChange("packageStyle")}
          disabled={isEditMode}
          fullWidth
          sx={isEditMode ? lockedFieldSx : dialogFieldSx}
        >
          {packageStyles.map((style) => (
            <MenuItem key={style} value={style}>
              {style}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Model"
          value={form.model}
          onChange={handleChange("model")}
          disabled={isEditMode}
          fullWidth
          sx={isEditMode ? lockedFieldSx : dialogFieldSx}
        />
        <TextField
          select
          label="With Adapter"
          value={form.withAdapter}
          onChange={handleChange("withAdapter")}
          disabled={isEditMode}
          fullWidth
          sx={isEditMode ? lockedFieldSx : dialogFieldSx}
        >
          {adapterOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Serial Number"
          value={form.serialNumber}
          onChange={handleChange("serialNumber")}
          disabled={isEditMode}
          fullWidth
          sx={isEditMode ? lockedFieldSx : dialogFieldSx}
        />
        <TextField
          select
          label="Status"
          value={form.statusId}
          onChange={handleChange("statusId")}
          fullWidth
          sx={dialogFieldSx}
        >
          {statuses.map((status) => (
            <MenuItem key={status.id} value={status.id}>
              {status.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Repair By"
          value={form.repairBy}
          onChange={handleChange("repairBy")}
          fullWidth
          sx={dialogFieldSx}
        />
        <TextField
          label="Test By"
          value={form.testBy}
          onChange={handleChange("testBy")}
          fullWidth
          align="center"
          sx={dialogFieldSx}
        />
        <TextField
          label="Senior Test By"
          value={form.seniorTestBy}
          onChange={handleChange("seniorTestBy")}
          fullWidth
          sx={dialogFieldSx}
        />
        <TextField
          label="Remarks"
          value={form.remarks}
          onChange={handleChange("remarks")}
          multiline
          rows={3}
          fullWidth
          align="center"
          sx={dialogFieldSx}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(form)} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Utility functions

function mapTestFromDb(dbItem) {
  return {
    // Normalize Supabase row shape into the field names used by the testing UI.
    id: dbItem.id,
    clientId: dbItem.client_id || "",
    clientName: dbItem.clients?.name || "",
    clientCode: dbItem.clients?.client_code || "",
    dateReceived: dbItem.date_received || "",
    packageStyle: dbItem.package_style || "",
    pictureUrl: dbItem.picture_url || "",
    model: dbItem.model || "",
    withAdapter: dbItem.with_adapter || "No",
    serialNumber: dbItem.serial_number || "",
    statusId: dbItem.status_id || "",
    repairBy: dbItem.repair_by || "",
    testBy: dbItem.test_by || "",
    seniorTestBy: dbItem.senior_test_by || "",
    remarks: dbItem.remarks || "",
    status: dbItem.statuses || null,
  };
}

function mapTestToDb(form) {
  return {
    // Normalize React form state back into Supabase column names.
    client_id: form.clientId || null,
    date_received: form.dateReceived || null,
    package_style: form.packageStyle || null,
    model: form.model || null,
    with_adapter: form.withAdapter || "No",
    picture_url: form.pictureUrl || null,
    serial_number: form.serialNumber || null,
    status_id: form.statusId || null,
    repair_by: form.repairBy || null,
    test_by: form.testBy || null,
    senior_test_by: form.seniorTestBy || null,
    remarks: form.remarks || null,
  };
}

function getTestLabel(item) {
  return item?.serialNumber || item?.model || item?.clientCode || "Untitled record";
}

function isInsideRange(date, from, to) {
  if (!date) return true;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function PackageChip({ value }) {
  if (!value) return <>-</>;
  const color = value === "Box" || value === "With Box" ? "#d9f2c7" : value === "Plastic" ? "#bfe3ff" : "#ffe49a";
  const textColor = value === "Plastic" ? "#075985" : value === "Paper Bag" ? "#92400e" : "#047857";
  return <Chip label={value} size="small" sx={{ bgcolor: color, color: textColor, fontWeight: 800, minWidth: 72 }} />;
}

function TruncatedCell({ align = "left", children }) {
  return (
    <TableCell align={align} sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          display: "-webkit-box",
          lineHeight: 1.25,
          maxHeight: "2.5em",
          maxWidth: "100%",
          minWidth: 0,
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

const isClosedStatus = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  return normalized === "completed" || normalized === "complete" || normalized === "n/a";
};
