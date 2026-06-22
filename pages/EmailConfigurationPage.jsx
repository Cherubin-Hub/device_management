import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import { useEffect, useMemo, useState } from "react";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { useAppToast } from "../src/lib/appToast.js";
import { defaultEmailTemplates, emailTemplateTypes } from "../src/lib/emailTemplates.js";
import { EMAIL_PLACEHOLDER_OPTIONS } from "../src/lib/repairRecordFields.js";
import { validateEmailTemplateForm } from "../src/lib/validation.js";
import { fetchEmailConfigurations, saveEmailConfiguration } from "../src/services/emailConfigurationService.js";

export default function EmailConfigurationPage() {
  const { showToast } = useAppToast();
  const [templates, setTemplates] = useState(defaultEmailTemplates);
  const [selectedKey, setSelectedKey] = useState(null);
  const [dialogKey, setDialogKey] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadTemplates() {
      setIsLoading(true);
      try {
        const loadedTemplates = await fetchEmailConfigurations();
        if (ignore) {
          return;
        }
        setTemplates(loadedTemplates);
        setError("");
        setIsLoading(false);
      } catch {
        if (ignore) {
          return;
        }
        setError("Run the Email Configuration SQL in SUPABASE.md to enable this page.");
        setTemplates(defaultEmailTemplates);
        setIsLoading(false);
      }
    }

    loadTemplates();

    return () => {
      ignore = true;
    };
  }, []);

  const rows = useMemo(
    () => emailTemplateTypes.map((item) => templates[item.key] || defaultEmailTemplates[item.key]),
    [templates]
  );

  const handleSave = async (templateKey, value) => {
    const validationErrors = validateEmailTemplateForm(value);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      showToast("Please complete the required email template fields.", "error");
      return;
    }

    const previousTemplate = templates[templateKey] || defaultEmailTemplates[templateKey];
    let data;
    try {
      data = await saveEmailConfiguration(templateKey, value);
    } catch (saveError) {
      setError(saveError.message || "Failed to save email configuration.");
      return;
    }

    setTemplates((current) => ({
      ...current,
      [templateKey]: {
        ...defaultEmailTemplates[templateKey],
        ...data,
      },
    }));
    setDialogKey(null);
    setError("");

    await logAuditEvent({
      action: "UPDATE",
      afterData: data,
      beforeData: previousTemplate || null,
      entityId: data.id,
      entityTable: "email_configurations",
      module: "Email Configuration",
      recordLabel: data.name,
      summary: `Updated ${data.name} email configuration.`,
    });
    showToast("Email configuration saved.", "success");
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <Stack className="module-page-header" direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.5} sx={{ mb: 2 }}>
        <Stack className="module-page-heading" direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#dcfce7",
              borderRadius: 1.5,
              color: "#166534",
              display: "flex",
              height: 38,
              justifyContent: "center",
              width: 38,
            }}
          >
            <MarkEmailReadRoundedIcon fontSize="small" />
          </Box>
          <Box className="module-page-copy">
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "left !important" }}>
              Administration / Email Configuration
            </Typography>
            <Typography className="module-page-title" variant="h5" component="h1" fontWeight={900}>
              Email Configuration
            </Typography>
            <Typography className="module-page-description" variant="caption" color="text.secondary">
              Manage Outlook email templates for register and unregister device actions.
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {error ? (
        <Box sx={{ bgcolor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 1.5, color: "#be123c", mb: 2, p: 1.5 }}>
          {error}
        </Box>
      ) : null}

      <Paper elevation={0} sx={{ border: "1px solid #dde5ef", borderRadius: 2 }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table className="email-configuration-table" size="small" sx={{ minWidth: 900, "& th": { bgcolor: "#d9d9d9", fontSize: 11, fontWeight: 900, textAlign: "center" }, "& td": { fontSize: 11, lineHeight: 1.25 }, "& td, & th": { borderColor: "#dddddd" } }}>
            <TableHead>
              <TableRow>
                <TableCell width={180}>Configuration</TableCell>
                <TableCell>To</TableCell>
                <TableCell>CC</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Body</TableCell>
                <TableCell width={110}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : null}
              {!isLoading ? rows.map((template) => (
                <TableRow key={template.template_key} hover selected={selectedKey === template.template_key} onClick={() => setSelectedKey(template.template_key)} onDoubleClick={() => setDialogKey(template.template_key)} sx={{ cursor: "pointer" }}>
                  <TableCell align="center">{template.name}</TableCell>
                  <TableCell>{template.to_email || "-"}</TableCell>
                  <TableCell>{template.cc_email || "-"}</TableCell>
                  <TableCell>{template.subject || "-"}</TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Box sx={{ display: "-webkit-box", overflow: "hidden", textOverflow: "ellipsis", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, whiteSpace: "normal" }}>
                      {template.body || "-"}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={(event) => { event.stopPropagation(); setSelectedKey(template.template_key); setDialogKey(template.template_key); }} sx={{ minWidth: 78, textTransform: "none" }}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              )) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {dialogKey ? (
        <EmailTemplateDialog
          initialValue={templates[dialogKey] || defaultEmailTemplates[dialogKey]}
          onClose={() => setDialogKey(null)}
          onSave={(value) => handleSave(dialogKey, value)}
          onToast={showToast}
        />
      ) : null}
    </Box>
  );
}

function EmailTemplateDialog({ initialValue, onClose, onSave, onToast }) {
  const [form, setForm] = useState({
    toEmail: initialValue?.to_email || "",
    ccEmail: initialValue?.cc_email || "",
    subject: initialValue?.subject || "",
    body: initialValue?.body || "",
  });

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const canSave = form.subject.trim() || form.body.trim() || form.toEmail.trim() || form.ccEmail.trim();

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          className: "email-template-editor-dialog",
        },
      }}
    >
      <DialogTitle fontWeight={900}>Edit {initialValue.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField className="email-template-editor-field" label="To" fullWidth value={form.toEmail} onChange={updateField("toEmail")} sx={emailTemplateFieldSx} />
          <TextField className="email-template-editor-field" label="CC" fullWidth value={form.ccEmail} onChange={updateField("ccEmail")} sx={emailTemplateFieldSx} />
          <TextField className="email-template-editor-field" label="Subject" fullWidth value={form.subject} onChange={updateField("subject")} sx={emailTemplateFieldSx} />
          <TextField
            className="email-template-editor-field"
            label="Body"
            fullWidth
            multiline
            minRows={7}
            value={form.body}
            onChange={updateField("body")}
            sx={emailTemplateFieldSx}
          />
          <PlaceholderPanel onToast={onToast} />
        </Stack>
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

function PlaceholderPanel({ onToast }) {
  const copyPlaceholder = async (placeholder) => {
    try {
      await navigator.clipboard.writeText(placeholder);
      onToast?.(`${placeholder} copied.`, "success");
    } catch {
      onToast?.("Could not copy placeholder.", "error");
    }
  };

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        p: 1.25,
      }}
    >
      <Typography variant="caption" sx={{ display: "block", mb: 1, textAlign: "left !important" }}>
        Placeholders
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {EMAIL_PLACEHOLDER_OPTIONS.map((placeholder) => (
          <Button
            key={placeholder}
            size="small"
            startIcon={<ContentCopyRoundedIcon />}
            variant="outlined"
            onClick={() => copyPlaceholder(placeholder)}
            sx={{ fontSize: 10.5, minHeight: 26, px: 0.85, py: 0.25, textTransform: "none" }}
          >
            {placeholder}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

const emailTemplateFieldSx = {
  "& .MuiInputBase-input": {
    textAlign: "left !important",
  },
  "& textarea": {
    textAlign: "left !important",
  },
};
