// User Management controls app users, active status, and module-level access rights.
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Snackbar,
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
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useEffect, useMemo, useState } from "react";
import TablePaginationControls from "../src/components/TablePaginationControls.jsx";
import { ACCESS_RIGHT_OPTIONS, normalizeAccessRights } from "../src/lib/accessRights.js";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { paginateRows } from "../src/lib/pagination.js";
import { supabase } from "../src/lib/supabase.js";

export default function UserManagementPage({ currentUserEmail = "", onCurrentUserUpdated }) {
  // Store every application user profile loaded from the public app_users table.
  const [users, setUsers] = useState([]);
  // Store the selected user when the admin double-clicks a row.
  const [selectedUser, setSelectedUser] = useState(null);
  // Store editable form values separately so table data changes only after Save.
  const [form, setForm] = useState(buildUserForm(null));
  // Track loading and error states for Supabase operations.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // Store the success message shown after the admin confirms and saves changes.
  const [successMessage, setSuccessMessage] = useState("");
  // Control the save confirmation dialog so changes are not saved by accident.
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  // Disable the Yes/Save action while Supabase is updating the selected user.
  const [isSaving, setIsSaving] = useState(false);
  // Keep the user table rendering at the shared 20-row page size.
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    async function loadUsers() {
      setError("");
      setIsLoading(true);

      // Read app_users instead of auth.users because browser clients cannot safely list auth users.
      const { data, error: loadError } = await supabase
        .from("app_users")
        .select("id, display_name, email, is_active, access_rights, created_at, updated_at")
        .order("display_name", { ascending: true });

      if (ignore) return;

      if (loadError) {
        setError(loadError.message);
        setIsLoading(false);
        return;
      }

      setUsers((data || []).map(normalizeUser));
      setIsLoading(false);
    }

    loadUsers();

    return () => {
      ignore = true;
    };
  }, []);

  const paginatedUsers = useMemo(
    () => paginateRows(users, page),
    [page, users]
  );

  const openUser = (user) => {
    // Double-click opens a full edit view similar to the repair checking page.
    setSelectedUser(user);
    setForm(buildUserForm(user));
  };

  const updateAccessRight = (key) => (event) => {
    // Update one module access checkbox without changing the other checked modules.
    setForm((current) => ({
      ...current,
      accessRights: {
        ...current.accessRights,
        [key]: event.target.checked,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setIsSaving(true);

    const payload = {
      // Save the display name used by dashboard, sidebar, and workflow sign-offs.
      display_name: form.displayName.trim(),
      // Save active state used by the app shell to allow or block login access.
      is_active: form.isActive,
      // Save module visibility map used by the sidebar and route guards.
      access_rights: form.accessRights,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from("app_users")
      .update(payload)
      .eq("id", selectedUser.id)
      .select("id, display_name, email, is_active, access_rights, created_at, updated_at")
      .single();

    if (updateError) {
      setError(updateError.message);
      setConfirmSaveOpen(false);
      setIsSaving(false);
      return;
    }

    const updatedUser = normalizeUser(data);
    setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
    setSelectedUser(updatedUser);
    setForm(buildUserForm(updatedUser));

    // Refresh the current logged-in profile immediately when an admin edits their own account.
    if (updatedUser.email === currentUserEmail) {
      onCurrentUserUpdated?.(updatedUser);
    }

    await logAuditEvent({
      action: "UPDATE",
      afterData: updatedUser,
      beforeData: selectedUser,
      entityId: updatedUser.id,
      entityTable: "app_users",
      module: "Administration",
      recordLabel: updatedUser.email,
      summary: `Updated user profile and access rights for ${updatedUser.email}.`,
    });

    setConfirmSaveOpen(false);
    setIsSaving(false);
    setSuccessMessage("User profile changes saved successfully.");
  };

  if (selectedUser) {
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
              <PersonRoundedIcon fontSize="small" />
            </Box>
            <Box className="module-page-copy">
              <Typography className="module-page-title" variant="h5" component="h1">
                User Profile
              </Typography>
              <Typography className="module-page-description" variant="caption" color="text.secondary">
                Edit display name, account status, and module access rights.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackRoundedIcon />} variant="outlined" onClick={() => setSelectedUser(null)}>
              Back
            </Button>
            <Button startIcon={<SaveRoundedIcon />} variant="contained" onClick={() => setConfirmSaveOpen(true)} disabled={!form.displayName.trim()}>
              Save
            </Button>
          </Stack>
        </Stack>

        <Paper elevation={0} sx={panelSx}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            User Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" } }}>
            <TextField
              label="Display Name"
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              required
              size="small"
            />
            <TextField label="Email Address" value={selectedUser.email} disabled size="small" />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
              }
              label="Active"
            />
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ ...panelSx, mt: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Access Rights
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {groupAccessOptions().map(([group, options]) => (
            <Box key={group} sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75, textAlign: "left !important" }}>
                {group}
              </Typography>
              <Box sx={{ display: "grid", gap: 0.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" } }}>
                {options.map((option) => (
                  <FormControlLabel
                    key={option.key}
                    control={<Checkbox checked={Boolean(form.accessRights[option.key])} onChange={updateAccessRight(option.key)} />}
                    label={option.label}
                  />
                ))}
              </Box>
            </Box>
          ))}
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
          <DialogTitle>Save Changes</DialogTitle>
          <DialogContent sx={{ overflow: "hidden" }}>
            <DialogContentText sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}>
              Do you want to save the changes made to this user profile?
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
            <PersonRoundedIcon fontSize="small" />
          </Box>
          <Box className="module-page-copy">
            <Typography className="module-page-title" variant="h5" component="h1">
              User
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              Manage application users, status, and module visibility.
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2 }}>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell align="center">Name</TableCell>
              <TableCell align="center">Email Address</TableCell>
              <TableCell align="center">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={22} />
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  No users found.
                </TableCell>
              </TableRow>
            ) : null}
            {paginatedUsers.map((user) => (
              <TableRow key={user.id} hover onDoubleClick={() => openUser(user)} sx={{ cursor: "pointer" }}>
                <TableCell align="center">{user.display_name || "-"}</TableCell>
                <TableCell align="center">{user.email || "-"}</TableCell>
                <TableCell align="center">
                  <Chip label={user.is_active ? "Active" : "Inactive"} color={user.is_active ? "success" : "default"} size="small" variant={user.is_active ? "filled" : "outlined"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePaginationControls count={users.length} page={page} onChange={setPage} />
      </TableContainer>
    </Box>
  );
}

function normalizeUser(user) {
  return {
    ...user,
    access_rights: normalizeAccessRights(user?.access_rights),
    display_name: user?.display_name || "",
    email: user?.email || "",
    is_active: user?.is_active !== false,
  };
}

function buildUserForm(user) {
  return {
    accessRights: normalizeAccessRights(user?.access_rights),
    displayName: user?.display_name || "",
    isActive: user?.is_active !== false,
  };
}

function groupAccessOptions() {
  // Group options by parent module so the checkbox layout matches the sidebar structure.
  const groupedOptions = ACCESS_RIGHT_OPTIONS.reduce((groups, option) => {
    const current = groups.get(option.group) || [];
    current.push(option);
    groups.set(option.group, current);
    return groups;
  }, new Map());

  // Convert the Map into an array because JSX can render arrays predictably.
  return Array.from(groupedOptions.entries());
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
