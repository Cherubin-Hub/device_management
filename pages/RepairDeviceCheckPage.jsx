import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { useCallback, useEffect, useState } from "react";
import TestChecklist from "../components/TestChecklist.jsx";
import { tests } from "../components/testScripts.js";
import { WorkflowStatusChip } from "../components/RepairWorkflowChips.jsx";
import { logAuditEvent } from "../src/lib/auditTrail.js";
import { getRecordLabel, getUserDisplayName } from "../src/lib/repairWorkflow.js";
import { supabase } from "../src/lib/supabase.js";

const emptyResults = tests.map(() => ({
  // Empty checklist status until the assigned user marks Yes, No, or N/A.
  status: "",
  // Empty checklist remarks until the assigned user adds notes.
  remarks: "",
}));

const emptyRepairForm = {
  // Device algorithm/version captured during checking.
  deviceAlgorithm: "",
  // Current device pin width captured during checking.
  devicePinwidth: "",
  // Previous device pin width captured during checking.
  previousPinwidth: "",
  // General checking remarks captured during checking.
  checkingRemarks: "",
  // Name of the user who got the repair task.
  repairBy: "",
  // Name of the user who completed the testing stage.
  testBy: "",
  // Name of the user who completed senior/supervisor checking stages.
  seniorTestBy: "",
  // Additional final comments for the workflow.
  additionalComments: "",
};

export default function RepairDeviceCheckPage({ recordId, onBack, userEmail }) {
  // Store the repair workflow row being checked.
  const [record, setRecord] = useState(null);
  // Store editable checking fields separately from the locked inventory fields.
  const [form, setForm] = useState(emptyRepairForm);
  // Store one checklist result object per test script row.
  const [testResults, setTestResults] = useState(emptyResults);
  // Store loading state while the selected repair workflow row is loading.
  const [isLoading, setIsLoading] = useState(true);
  // Store readable errors for SQL, permissions, or network issues.
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadRecord() {
      setIsLoading(true);
      setError("");

      // Load the selected repair workflow row from Supabase.
      const { data, error: loadError } = await supabase
        .from("repair_device_records")
        .select("*")
        .eq("id", recordId)
        .single();

      if (ignore) return;

      if (loadError) {
        setError(loadError.message);
        setIsLoading(false);
        return;
      }

      setRecord(data);
      setForm({
        deviceAlgorithm: data.device_algorithm || "",
        devicePinwidth: data.device_pinwidth || "",
        previousPinwidth: data.previous_pinwidth || "",
        checkingRemarks: data.checking_remarks || "",
        repairBy: data.repair_by || "",
        testBy: data.test_by || "",
        seniorTestBy: data.senior_test_by || "",
        additionalComments: data.additional_comments || "",
      });
      setTestResults(normalizeChecklist(data.test_results));
      setIsLoading(false);
    }

    loadRecord();

    return () => {
      ignore = true;
    };
  }, [recordId]);

  const updateForm = (field) => (event) => {
    // Update one checking field while preserving all other form values.
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const buildPayload = useCallback(() => ({
    // Save editable checking metadata.
    device_algorithm: form.deviceAlgorithm || null,
    // Save current pin width.
    device_pinwidth: form.devicePinwidth || null,
    // Save previous pin width.
    previous_pinwidth: form.previousPinwidth || null,
    // Save checking remarks.
    checking_remarks: form.checkingRemarks || null,
    // Save the full checklist as JSON so each script keeps status and remarks.
    test_results: testResults,
    // Save automatically captured personnel names.
    repair_by: form.repairBy || null,
    // Save automatically captured tester name.
    test_by: form.testBy || null,
    // Save automatically captured senior/supervisor checker name.
    senior_test_by: form.seniorTestBy || null,
    additional_comments: form.additionalComments || null,
    // Touch updated_at so users can see the latest movement in the database.
    updated_at: new Date().toISOString(),
  }), [form, testResults]);

  const saveDraft = useCallback(async () => {
    if (!record) return null;

    // Save the current draft without changing the workflow stage.
    const { data, error: saveError } = await supabase
      .from("repair_device_records")
      .update(buildPayload())
      .eq("id", record.id)
      .select()
      .single();

    if (saveError) {
      setError(saveError.message);
      return null;
    }

    setRecord(data);
    return data;
  }, [buildPayload, record]);

  useEffect(() => {
    if (!record || isLoading) return undefined;

    // Debounce auto-save so typing does not send a request on every keystroke.
    const saveTimer = window.setTimeout(() => {
      saveDraft();
    }, 650);

    return () => window.clearTimeout(saveTimer);
  }, [form, isLoading, record, saveDraft, testResults]);

  const handleDone = async () => {
    if (!record) return;

    // Save the latest form values before moving to the next checker stage.
    const savedRecord = await saveDraft();
    if (!savedRecord) return;

    // Resolve the next workflow stage based on the current stage.
    const nextStatus = getNextWorkflowStatus(savedRecord.workflow_status);
    // Read the signed-in user so automatic sign-off fields can use the display name.
    const { data: userData } = await supabase.auth.getUser();
    const actorName = getUserDisplayName(userData?.user, userEmail);
    // Fill the correct sign-off field for the stage being completed.
    const signoffPayload = getSignoffPayload(savedRecord.workflow_status, form, actorName);

    const { data, error: doneError } = await supabase
      .from("repair_device_records")
      .update({
        ...signoffPayload,
        assigned_at: savedRecord.assigned_at || new Date().toISOString(),
        assigned_to: savedRecord.assigned_to || null,
        assigned_to_email: savedRecord.assigned_to_email || userEmail || null,
        completed_at: nextStatus === "Done Repair Device" ? new Date().toISOString() : savedRecord.completed_at,
        updated_at: new Date().toISOString(),
        workflow_status: nextStatus,
      })
      .eq("id", savedRecord.id)
      .select()
      .single();

    if (doneError) {
      setError(doneError.message);
      return;
    }

    await logAuditEvent({
      action: "REPAIR_STAGE_DONE",
      afterData: data,
      beforeData: savedRecord,
      entityId: savedRecord.id,
      entityTable: "repair_device_records",
      module: "Testing Device",
      recordLabel: getRecordLabel(savedRecord),
      summary: `${getRecordLabel(savedRecord)} moved to ${nextStatus}.`,
    });

    // Mirror automatic personnel fields into Ongoing Testing after the repair workflow stage changes.
    await syncOngoingTestingPeople(data);

    onBack();
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!record) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Repair record not found.</Alert>
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      {error ? (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", lg: "center" }} spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="h5" component="h1" fontWeight={900}>
              Device Repair Checking
            </Typography>
            <WorkflowStatusChip value={record.workflow_status} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Double-click workflow page with automatic saving for device checking.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackRoundedIcon />} variant="outlined" onClick={onBack} sx={{ textTransform: "none" }}>
            Back
          </Button>
          <Button startIcon={<TaskAltRoundedIcon />} variant="contained" onClick={handleDone} sx={{ textTransform: "none" }}>
            Done
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Paper elevation={0} sx={panelSx}>
          <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={900}>
              Repair Device Information
            </Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
            <ReadOnlyField label="Company" value={record.company} />
            <ReadOnlyField label="Client Code" value={record.client_code} />
            <ReadOnlyField label="Date Received" value={formatDate(record.date_received)} />
            <ReadOnlyField label="Package Style" value={record.package_style} />
            <ReadOnlyField label="CST Number" value={record.cst_number} />
            <ReadOnlyField label="Ticket Number" value={record.ticket_number} />
            <ReadOnlyField label="SN Number" value={record.sn_number} />
            <ReadOnlyField label="Device Type" value={record.device_type} />
            <ReadOnlyField label="With Adapter" value={record.with_adapter} />
            <TextField size="small" label="Device Algorithm" value={form.deviceAlgorithm} onChange={updateForm("deviceAlgorithm")} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Device Pinwidth" value={form.devicePinwidth} onChange={updateForm("devicePinwidth")} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Previous Pinwidth" value={form.previousPinwidth} onChange={updateForm("previousPinwidth")} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" label="Remarks" value={form.checkingRemarks} onChange={updateForm("checkingRemarks")} multiline minRows={3} slotProps={{ inputLabel: { shrink: true } }} sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }} />
          </Box>
        </Paper>

        <Paper elevation={0} sx={panelSx}>
          <TestChecklist hideSummaryChip results={testResults} onResultsChange={setTestResults} />
        </Paper>

        <Paper elevation={0} sx={panelSx}>
          <Typography variant="subtitle1" fontWeight={900} sx={{ mb: 2 }}>
            Checking Sign-Off
          </Typography>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
            <ReadOnlyField label="Repair By" value={form.repairBy} />
            <ReadOnlyField label="Tested By" value={form.testBy} />
            <ReadOnlyField label="Senior Tested By" value={form.seniorTestBy} />
            <TextField size="small" label="Additional Comments" value={form.additionalComments} onChange={updateForm("additionalComments")} multiline minRows={3} slotProps={{ inputLabel: { shrink: true } }} sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }} />
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <TextField
      size="small"
      label={label}
      value={value || "-"}
      disabled
      slotProps={{ inputLabel: { shrink: true } }}
      sx={{
        "& .MuiInputBase-root.Mui-disabled": { bgcolor: "action.disabledBackground" },
        "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#6b7280" },
      }}
    />
  );
}

function normalizeChecklist(value) {
  // Keep existing saved checklist rows, otherwise create a row for every configured test script.
  if (Array.isArray(value) && value.length === tests.length) return value;
  return emptyResults;
}

function getNextWorkflowStatus(currentStatus) {
  // Repair completion moves the workflow into the tested stage.
  if (currentStatus === "Repair By" || currentStatus === "For Testing") return "Tested By";
  // Tested completion moves the workflow into the senior tested stage.
  if (currentStatus === "Tested By" || currentStatus === "Test By" || currentStatus === "Checked By (Senior)") return "Senior Tested By";
  // Supervisor completion closes the repair workflow.
  return "Done Repair Device";
}

function getSignoffPayload(currentStatus, form, actorName) {
  // Fill Tested By when the repair stage is completed.
  if (currentStatus === "Repair By" || currentStatus === "For Testing") return { test_by: form.testBy || actorName };
  // Fill Senior Tested By when tested or senior-tested stages are completed.
  return { senior_test_by: form.seniorTestBy || actorName };
}

async function syncOngoingTestingPeople(record) {
  // Skip sync when this repair record is not linked to an inventory-generated ongoing testing row.
  if (!record?.source_inventory_id) return;
  // Update Ongoing Testing personnel columns from the repair workflow personnel fields.
  await supabase
    .from("ongoing_testing_items")
    .update({
      repair_by: record.repair_by || null,
      senior_test_by: record.senior_test_by || null,
      test_by: record.test_by || null,
      updated_at: new Date().toISOString(),
    })
    .eq("source_inventory_id", record.source_inventory_id);
}

function formatDate(value) {
  // Render date-only values without timezone shifts.
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";
}

const panelSx = {
  // Shared panel style keeps the repair checking page visually aligned with other modules.
  border: "1px solid #dde5ef",
  borderRadius: 2,
  p: { xs: 2, md: 2.5 },
};
