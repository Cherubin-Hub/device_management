import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useEffect, useMemo, useState } from "react";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { paginateRows } from "../src/lib/pagination.js";
import { supabase } from "../src/lib/supabase.js";

const blankReleaseNote = {
  content: "",
  title: "",
};

export default function ReleaseNotesPage({ canCreateReleaseNotes = false, userDisplayName = "", userEmail = "" }) {
  // Store all release note rows displayed in the no-header list.
  const [notes, setNotes] = useState([]);
  // Store the note currently opened in the editor; null means the list is visible.
  const [editingNote, setEditingNote] = useState(null);
  // Store local editor input until the user clicks Save.
  const [form, setForm] = useState(blankReleaseNote);
  // Track Supabase loading and error states.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // Store the success message after release note changes are saved.
  const [successMessage, setSuccessMessage] = useState("");
  // Control the confirmation dialog before saving release note changes.
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  // Disable save confirmation buttons while Supabase is processing the request.
  const [isSaving, setIsSaving] = useState(false);
  // Keep release note rows paginated at the shared 20-row page size.
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    async function loadReleaseNotes() {
      setError("");
      setIsLoading(true);

      // Load latest release notes first so the newest version appears at the top.
      const { data, error: loadError } = await supabase
        .from("release_notes")
        .select("id, title, content, created_by, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (ignore) return;

      if (loadError) {
        setError(loadError.message);
        setIsLoading(false);
        return;
      }

      setNotes(data || []);
      setIsLoading(false);
    }

    loadReleaseNotes();

    return () => {
      ignore = true;
    };
  }, []);

  const paginatedNotes = useMemo(
    () => paginateRows(notes, page),
    [notes, page]
  );

  const openNew = () => {
    if (!canCreateReleaseNotes) return;
    // New opens the same editor layout with blank fields.
    setEditingNote({ id: null });
    setForm(blankReleaseNote);
  };

  const openExisting = (note) => {
    // Double-click opens the existing release note for review and updates.
    setEditingNote(note);
    setForm({
      content: note.content || "",
      title: note.title || "",
    });
  };

  const handleSave = async () => {
    const payload = {
      content: form.content.trim(),
      title: form.title.trim(),
      updated_at: new Date().toISOString(),
    };

    if (!payload.title) return;
    if (!editingNote?.id && !canCreateReleaseNotes) {
      setError("You do not have permission to create release notes.");
      return;
    }
    setIsSaving(true);

    if (editingNote?.id) {
      // Update the selected release note while preserving its identity.
      const { data, error: updateError } = await supabase
        .from("release_notes")
        .update(payload)
        .eq("id", editingNote.id)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        setConfirmSaveOpen(false);
        setIsSaving(false);
        return;
      }

      setNotes((current) => current.map((note) => (note.id === data.id ? data : note)));
      setEditingNote(data);

      await logAuditEvent({
        action: "UPDATE",
        afterData: data,
        beforeData: editingNote,
        entityId: data.id,
        entityTable: "release_notes",
        module: "Administration",
        recordLabel: data.title,
        summary: `${userDisplayName || userEmail || "User"} updated release note ${data.title}.`,
      });

      setConfirmSaveOpen(false);
      setIsSaving(false);
      setSuccessMessage("Release note changes saved successfully.");
      return;
    }

    // Create a new release note row and record who created it.
    const { data, error: insertError } = await supabase
      .from("release_notes")
      .insert({
        ...payload,
        created_by: userDisplayName || userEmail || null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setConfirmSaveOpen(false);
      setIsSaving(false);
      return;
    }

    setNotes((current) => [data, ...current]);
    setEditingNote(data);

    await logAuditEvent({
      action: "CREATE",
      afterData: data,
      entityId: data.id,
      entityTable: "release_notes",
      module: "Administration",
      recordLabel: data.title,
      summary: `${userDisplayName || userEmail || "User"} created release note ${data.title}.`,
    });

    setConfirmSaveOpen(false);
    setIsSaving(false);
    setSuccessMessage("Release note created successfully.");
  };

  if (editingNote) {
    return (
      <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
        {error ? (
          <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Stack className="module-page-header" direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.5} sx={{ mb: 2 }}>
          <Stack className="module-page-heading" direction="row" spacing={1.5} alignItems="center">
            <Box sx={pageIconSx}>
              <ArticleRoundedIcon fontSize="small" />
            </Box>
            <Box className="module-page-copy">
              <Typography className="module-page-title" variant="h5" component="h1">
                Release Notes Editor
              </Typography>
              <Typography className="module-page-description" variant="caption" color="text.secondary">
                Encode the release note name and content.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackRoundedIcon />} variant="outlined" onClick={() => setEditingNote(null)}>
              Back
            </Button>
            <Button startIcon={<SaveRoundedIcon />} variant="contained" onClick={() => setConfirmSaveOpen(true)} disabled={!form.title.trim()}>
              Save
            </Button>
          </Stack>
        </Stack>

        <Paper elevation={0} sx={panelSx}>
          <Typography variant="subtitle1" sx={{ mb: 1.5, textAlign: "left !important" }}>
            Release Note Details
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1.5}>
            <TextField
              className="release-notes-editor-field"
              label="Release Notes Name"
              required
              size="small"
              value={form.title}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={editorFieldSx}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <TextField
              className="release-notes-editor-field"
              label="Content"
              multiline
              minRows={12}
              value={form.content}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={editorFieldSx}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            />
          </Stack>
        </Paper>

        <Dialog
          open={confirmSaveOpen}
          onClose={() => setConfirmSaveOpen(false)}
          maxWidth="xs"
          fullWidth
          slotProps={{
            // Keep the confirmation dialog compact and prevent inner scrollbars.
            paper: { sx: { overflow: "hidden" } },
          }}
        >
          <DialogTitle>Save Release Note</DialogTitle>
          <DialogContent sx={{ overflow: "hidden" }}>
            <DialogContentText sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}>
              Do you want to save the changes made to this release note?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmSaveOpen(false)} disabled={isSaving}>
              No
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={isSaving}>
              Yes, Save
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(successMessage)}
          autoHideDuration={3000}
          onClose={() => setSuccessMessage("")}
          anchorOrigin={{ horizontal: "center", vertical: "top" }}
        >
          <Alert severity="success" onClose={() => setSuccessMessage("")} sx={{ width: "100%" }}>
            {successMessage}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack className="module-page-header" direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.5} sx={{ mb: 2 }}>
        <Stack className="module-page-heading" direction="row" spacing={1.5} alignItems="center">
          <Box sx={pageIconSx}>
            <ArticleRoundedIcon fontSize="small" />
          </Box>
          <Box className="module-page-copy">
            <Typography className="module-page-title" variant="h5" component="h1">
              Release Notes
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              Maintain application release notes and version content.
            </Typography>
          </Box>
        </Stack>
        {canCreateReleaseNotes ? (
          <Button size="small" startIcon={<AddRoundedIcon />} variant="contained" onClick={openNew}>
            New
          </Button>
        ) : null}
      </Stack>

      {error ? (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <TableContainer className="release-notes-list-table" component={Paper} elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Table size="small">
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell align="center" sx={{ py: 4 }}>
                  <CircularProgress size={22} />
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && notes.length === 0 ? (
              <TableRow>
                <TableCell align="center" sx={{ py: 4 }}>
                  No release notes found.
                </TableCell>
              </TableRow>
            ) : null}
            {paginatedNotes.map((note) => (
              <TableRow key={note.id} hover onDoubleClick={() => openExisting(note)} sx={{ cursor: "pointer" }}>
                <TableCell align="left" sx={{ px: 2, py: 1.2, textAlign: "left !important" }}>
                  {note.title}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationControls count={notes.length} page={page} onChange={setPage} />
      </TableContainer>
    </Box>
  );
}

const pageIconSx = {
  alignItems: "center",
  bgcolor: "#e8f2ff",
  borderRadius: 1.5,
  color: "#1f5f99",
  display: "flex",
  height: 38,
  justifyContent: "center",
  width: 38,
};

const panelSx = {
  border: "1px solid #dde5ef",
  borderRadius: 2,
  p: { xs: 2, md: 2.5 },
};

const editorFieldSx = {
  // Keep floating labels permanently visible and aligned to the left.
  "& .MuiInputLabel-root": {
    left: 0,
    textAlign: "left !important",
    transformOrigin: "left top",
  },
  // Keep encoded release note values aligned left instead of inheriting global table/page centering.
  "& .MuiInputBase-input": {
    textAlign: "left !important",
  },
  "& textarea.MuiInputBase-input": {
    textAlign: "left !important",
  },
};
