import {
  Alert,
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
} from "@mui/material";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useEffect, useMemo, useState } from "react";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { paginateRows } from "../src/lib/pagination.js";
import { supabase } from "../src/lib/supabase.js";

const tableLabels = {
  device_inventory_items: "Inventory Records",
  ongoing_testing_items: "Ongoing Testing",
};

export default function ArchivedRecordsPage() {
  // Store archived records so deleted rows can be reviewed and restored.
  const [archives, setArchives] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  // Keep archive rendering lightweight by showing one 20-record page at a time.
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    async function loadArchives() {
      setIsLoading(true);
      // Retrieve archived rows newest-first so recent deletes are easiest to find.
      const { data, error: loadError } = await supabase
        .from("archived_records")
        .select("id, source_table, record_type, record_label, record_data, archived_at")
        .order("archived_at", { ascending: false });

      if (ignore) return;

      if (loadError) {
        setError(loadError.message);
        setIsLoading(false);
        return;
      }

      setArchives(data || []);
      setIsLoading(false);
    }

    loadArchives();

    return () => {
      ignore = true;
    };
  }, []);

  const displayedArchives = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    // Search archive metadata and saved JSON payload without changing the stored data.
    return archives.filter((item) => {
      const haystack = [
        item.record_type,
        item.record_label,
        tableLabels[item.source_table],
        JSON.stringify(item.record_data || {}),
      ]
        .join(" ")
        .toLowerCase();
      return !normalized || haystack.includes(normalized);
    });
  }, [archives, query]);

  // Paginate only the visible archive rows; restore still works against the original row id.
  const paginatedArchives = useMemo(
    () => paginateRows(displayedArchives, page),
    [displayedArchives, page]
  );

  const handleRestore = async (archive) => {
    setError("");
    // Remove system columns because restored rows should receive fresh ids/timestamps.
    const restorePayload = stripEmptyId(archive.record_data || {});

    // Insert the saved JSON payload back into the original source table.
    const { error: restoreError } = await supabase
      .from(archive.source_table)
      .insert(restorePayload);

    if (restoreError) {
      setError(`Failed to restore record: ${restoreError.message}`);
      return;
    }

    // Remove the archive row only after the source record has been restored.
    const { error: deleteArchiveError } = await supabase
      .from("archived_records")
      .delete()
      .eq("id", archive.id);

    if (deleteArchiveError) {
      setError(`Restored record, but failed to remove archive: ${deleteArchiveError.message}`);
      return;
    }

    await logAuditEvent({
      action: "RESTORE",
      afterData: restorePayload,
      beforeData: archive.record_data || null,
      entityId: archive.id,
      entityTable: archive.source_table,
      module: tableLabels[archive.source_table] || archive.record_type,
      recordLabel: archive.record_label,
      summary: `Restored archived ${archive.record_type} record ${archive.record_label || ""}.`,
    });
    setArchives((current) => current.filter((item) => item.id !== archive.id));
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack
        className="module-page-header"
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
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
            <ArchiveRoundedIcon fontSize="small" />
          </Box>
          <Box className="module-page-copy">
            <Typography className="module-page-title" variant="h5" component="h1" fontWeight={900}>
              Archived Records
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              Restore deleted inventory and ongoing testing records.
            </Typography>
          </Box>
        </Stack>

        <TextField
          size="small"
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search archived records"
          InputProps={{ startAdornment: <SearchRoundedIcon sx={{ color: "text.secondary", fontSize: 18, mr: 0.75 }} /> }}
          sx={{ minWidth: { xs: "100%", sm: 280 } }}
        />
      </Stack>

      {error ? (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Table
          size="small"
          sx={{
            minWidth: 900,
            "& th": {
              bgcolor: "#d9d9d9",
              fontSize: 11,
              fontWeight: 900,
              lineHeight: 1.2,
              px: 0.75,
              py: 0.9,
              textAlign: "center",
            },
            "& td": {
              fontSize: 11,
              lineHeight: 1.25,
              px: 0.75,
              py: 0.75,
            },
            "& td, & th": { borderColor: "#dddddd" },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>Module</TableCell>
              <TableCell>Record</TableCell>
              <TableCell>Details</TableCell>
              <TableCell>Archived Date</TableCell>
              <TableCell width={110}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  Loading archived records...
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && displayedArchives.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  No archived records found.
                </TableCell>
              </TableRow>
            ) : null}
            {paginatedArchives.map((archive) => (
              <TableRow key={archive.id} hover>
                <TableCell align="center">
                  <Chip label={tableLabels[archive.source_table] || archive.record_type} size="small" sx={{ fontWeight: 400 }} />
                </TableCell>
                <TableCell align="center">{archive.record_label || "-"}</TableCell>
                <TableCell>{formatArchiveDetails(archive.record_data)}</TableCell>
                <TableCell align="center">{formatDateTime(archive.archived_at)}</TableCell>
                <TableCell align="center">
                  <Button
                    size="small"
                    startIcon={<RestoreRoundedIcon />}
                    variant="outlined"
                    onClick={() => handleRestore(archive)}
                    sx={{ fontWeight: 700, textTransform: "none" }}
                  >
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationControls count={displayedArchives.length} page={page} onChange={setPage} />
      </TableContainer>
    </Box>
  );
}

const stripEmptyId = (recordData) => {
  // Prevent duplicate primary keys and stale timestamps during restore.
  const rest = { ...recordData };
  delete rest.id;
  delete rest.created_at;
  delete rest.updated_at;
  return rest;
};

const formatArchiveDetails = (recordData = {}) => {
  // Build a compact summary from common inventory/testing fields for the archive table.
  const values = [
    recordData.client_id ? `Client ID: ${recordData.client_id}` : "",
    recordData.sn_number || recordData.serial_number ? `SN: ${recordData.sn_number || recordData.serial_number}` : "",
    recordData.device_type || recordData.model ? `Model: ${recordData.device_type || recordData.model}` : "",
    recordData.status_id ? `Status ID: ${recordData.status_id}` : "",
  ].filter(Boolean);
  return values.join(" | ") || "-";
};

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
