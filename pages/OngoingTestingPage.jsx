import {
  Box,
  Button,
  Chip,
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
} from "@mui/material";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { useEffect, useMemo, useState } from "react";
import { formatPersonName } from "../src/lib/repairWorkflow.js";
import { supabase } from "../src/lib/supabase.js";

export default function OngoingTestingPage() {
  // Store testing rows in the same shape expected by the table and dialog.
  const [items, setItems] = useState([]);
  // Store selected row id so the generated table can still highlight the row the user clicked.
  const [selectedId, setSelectedId] = useState(null);
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

  useEffect(() => {
    let ignore = false;

    async function loadTests() {
      setIsLoading(true);
      // Load testing records with joined client/status labels to avoid separate per-row requests.
      const testsResult = await supabase
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
          start_repairing_support,
          end_date_support,
          start_qa,
          end_date_qa,
          status_id,
          repair_by,
          test_by,
          senior_test_by,
          remarks,
          clients ( id, name, client_code ),
          statuses ( id, name, color )
        `)
        .order("date_received", { ascending: false });

      if (ignore) {
        return;
      }

      if (testsResult.error) {
        setError(testsResult.error.message);
        setIsLoading(false);
        return;
      }

      const mappedItems = (testsResult.data || []).map(mapTestFromDb);
      setItems(mappedItems);
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
                Tested By
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "8%" }} align="center">
                Senior Tested By
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: "24%" }} align="center">
                Remarks
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} sx={{ textAlign: "center", py: 4 }}>
                  <Typography color="text.secondary">No test records found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              displayedItems.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  sx={getTestingRowSx(item, selectedId === item.id)}
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
                          fontWeight: 400,
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
                  <TruncatedCell align="center">{formatPersonName(item.repairBy)}</TruncatedCell>
                  <TruncatedCell align="center">{formatPersonName(item.testBy)}</TruncatedCell>
                  <TruncatedCell align="center">{formatPersonName(item.seniorTestBy)}</TruncatedCell>
                  <TruncatedCell>{item.remarks}</TruncatedCell>
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

    </Box>
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
    startRepairingSupport: dbItem.start_repairing_support || "",
    endDateSupport: dbItem.end_date_support || "",
    startQa: dbItem.start_qa || "",
    endDateQa: dbItem.end_date_qa || "",
    statusId: dbItem.status_id || "",
    repairBy: dbItem.repair_by || "",
    testBy: dbItem.test_by || "",
    seniorTestBy: dbItem.senior_test_by || "",
    remarks: dbItem.remarks || "",
    status: dbItem.statuses || null,
  };
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
  return <Chip label={value} size="small" sx={{ bgcolor: color, color: textColor, fontWeight: 400, minWidth: 72 }} />;
}

function getLocalDateString() {
  // Build today's date from the browser's local calendar so due-date colors match the user's day.
  const today = new Date();
  // Use the current full year as the yyyy part of the ISO date.
  const year = today.getFullYear();
  // Pad month because JavaScript months are zero-based and ISO strings need two digits.
  const month = String(today.getMonth() + 1).padStart(2, "0");
  // Pad day so string comparison remains safe for yyyy-mm-dd dates.
  const day = String(today.getDate()).padStart(2, "0");
  // Return a date-only value that can be compared with Supabase date columns.
  return `${year}-${month}-${day}`;
}

function getDaysUntilDate(dateValue) {
  // Without an end support date there is no countdown, so return null.
  if (!dateValue) return null;
  // Parse today's local date at midnight for stable calendar-day math.
  const today = new Date(`${getLocalDateString()}T00:00:00`);
  // Parse the support end date at midnight so time zones do not shift the day.
  const targetDate = new Date(`${dateValue}T00:00:00`);
  // Convert milliseconds into whole calendar days.
  return Math.round((targetDate - today) / 86400000);
}

function getTestingRowSx(item, isSelected) {
  // Normalize the status label so configured capitalization does not affect color rules.
  const statusName = String(item.status?.name || "").trim().toLowerCase();
  // Calculate how many days are left before the support end date passes.
  const daysUntilEnd = getDaysUntilDate(item.endDateSupport);
  // Red means support is already overdue or the automatic status says overdue.
  const isOverdue = statusName === "overdue support" || (item.endDateSupport && item.endDateSupport < getLocalDateString());
  // Orange means Ongoing Support has three or fewer days left before becoming overdue.
  const isNearDue = statusName === "ongoing support" && daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 3;
  // Green means Ongoing Support is active and not yet inside the three-day warning window.
  const isHealthySupport = statusName === "ongoing support" && !isOverdue && !isNearDue;
  // Pick a soft row color so status is obvious without hurting readability.
  const baseColor = isOverdue
    ? "#fee2e2"
    : isNearDue
      ? "#ffedd5"
      : isHealthySupport
        ? "#dcfce7"
        : isSelected
          ? "#e8f2ff"
          : "transparent";
  // Pick a slightly stronger hover color for the same row state.
  const hoverColor = isOverdue
    ? "#fecaca"
    : isNearDue
      ? "#fed7aa"
      : isHealthySupport
        ? "#bbf7d0"
        : "#f3f4f6";
  // Return a reusable MUI sx object for every generated testing row.
  return {
    bgcolor: baseColor,
    cursor: "default",
    "&:hover": { bgcolor: hoverColor },
  };
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

