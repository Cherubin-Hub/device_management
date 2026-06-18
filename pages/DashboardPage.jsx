import {
  Avatar,
  Box,
  Chip,
  MenuItem,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import BuildCircleRoundedIcon from "@mui/icons-material/BuildCircleRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useEffect, useMemo, useState } from "react";
import { getAvailableQuantity, sparePartColumns } from "./DeviceMonitoringSparePartsPage.jsx";
import { getWorkflowStatusDisplayName } from "../src/lib/repairWorkflow.js";
import { supabase } from "../src/lib/supabase.js";

const dashboardAccent = {
  blue: "#00cfe8",
  green: "#28c76f",
  orange: "#ff9f43",
  purple: "#7367f0",
  red: "#ea5455",
  teal: "#20d0c4",
};

const defaultDashboardData = {
  archivedRecords: [],
  auditTrailCount: 0,
  clients: [],
  deviceTypes: [],
  inventory: [],
  releaseNotes: [],
  repairRecords: [],
  spareParts: [],
  statuses: [],
  testing: [],
  users: [],
};

export default function DashboardPage({ mode, onChangeMode, userDisplayName, userEmail }) {
  const theme = useTheme();
  const [dashboardData, setDashboardData] = useState(defaultDashboardData);

  useEffect(() => {
    let ignore = false;

    async function loadDashboardData() {
      if (!supabase) return;

      // Load every current module source in parallel so the dashboard remains aligned with the sidebar.
      const [
        clientsResult,
        inventoryResult,
        testingResult,
        statusesResult,
        deviceTypesResult,
        repairRecordsResult,
        sparePartsResult,
        archivedRecordsResult,
        auditTrailResult,
        usersResult,
        releaseNotesResult,
      ] = await Promise.all([
        supabase.from("clients").select("id, name, client_code, is_active").order("name"),
        supabase.from("device_inventory_items").select("id, client_id, status_id"),
        supabase.from("ongoing_testing_items").select("id, client_id, status_id"),
        supabase.from("statuses").select("id, name, color, is_active").order("name"),
        supabase.from("device_types").select("id, name, is_active").order("name"),
        supabase.from("repair_device_records").select("id, workflow_status, assigned_to_email, client_code, company"),
        supabase
          .from("spare_parts_inventory")
          .select("id, client_id, device_type_id, box_serial_number, quantity_available, parts_status"),
        supabase.from("archived_records").select("id, module"),
        supabase.from("audit_trail").select("id", { count: "exact", head: true }),
        supabase.from("app_users").select("id, display_name, email, is_active"),
        supabase.from("release_notes").select("id, title, created_at"),
      ]);

      if (ignore) return;

      setDashboardData({
        archivedRecords: getRows(archivedRecordsResult),
        auditTrailCount: auditTrailResult.count || 0,
        clients: getRows(clientsResult),
        deviceTypes: getRows(deviceTypesResult),
        inventory: getRows(inventoryResult),
        releaseNotes: getRows(releaseNotesResult),
        repairRecords: getRows(repairRecordsResult),
        spareParts: getRows(sparePartsResult),
        statuses: getRows(statusesResult),
        testing: getRows(testingResult),
        users: getRows(usersResult),
      });
    }

    loadDashboardData();

    return () => {
      ignore = true;
    };
  }, []);

  const statusById = useMemo(
    // Status lookup keeps repeated inventory/tracking counts fast and readable.
    () => new Map(dashboardData.statuses.map((status) => [status.id, status])),
    [dashboardData.statuses]
  );

  const workflowCounts = useMemo(
    // Testing Device queues are calculated from the same workflow labels used by the repair pages.
    () => buildWorkflowCounts(dashboardData.repairRecords, userEmail),
    [dashboardData.repairRecords, userEmail]
  );

  const inventoryCompleted = countByStatus(dashboardData.inventory, statusById, isCompleted);
  const testingCompleted = countByStatus(dashboardData.testing, statusById, isCompleted);
  const inventoryIssues = countByStatus(dashboardData.inventory, statusById, isFailed);
  const testingIssues = countByStatus(dashboardData.testing, statusById, isFailed);
  const activeUsers = dashboardData.users.filter((user) => user.is_active !== false).length;
  const inactiveUsers = dashboardData.users.length - activeUsers;
  const activeConfigurationCount = [
    ...dashboardData.clients,
    ...dashboardData.statuses,
    ...dashboardData.deviceTypes,
  ].filter((item) => item.is_active !== false).length;
  const configurationCount =
    dashboardData.clients.length + dashboardData.statuses.length + dashboardData.deviceTypes.length;
  const repairManagementTotal = dashboardData.inventory.length + dashboardData.testing.length;
  const sparePartsMetrics = useMemo(
    // Spare-parts counts are derived from the same part-status fields used by Device Monitoring.
    () => buildSparePartsMetrics(dashboardData.spareParts),
    [dashboardData.spareParts]
  );
  const issueTotal = inventoryIssues + testingIssues;
  // Operational Records should reflect only active ongoing repair workflow records,
  // not the combined Repair Records + Repair Tracking + repair workflow totals.
  const totalOperationalRecords = workflowCounts.allActive;
  // Completion Rate is based on the repair workflow only so it stays consistent with Operational Records.
  const completionRate = formatPercent(workflowCounts.done, workflowCounts.done + workflowCounts.allActive);

  const summaryCards = [
    {
      color: dashboardAccent.purple,
      description: "Device records in Repair Management.",
      icon: <Inventory2RoundedIcon />,
      title: "Repair Records",
      value: dashboardData.inventory.length,
    },
    {
      color: dashboardAccent.blue,
      description: "Devices visible in Repair Tracking.",
      icon: <AssessmentRoundedIcon />,
      title: "Repair Tracking",
      value: dashboardData.testing.length,
    },
    {
      color: dashboardAccent.orange,
      description: "Claimed or queued testing workflow tasks.",
      icon: <BuildCircleRoundedIcon />,
      title: "Active Repair Tasks",
      value: workflowCounts.allActive,
    },
    {
      color: dashboardAccent.green,
      description: "Completed repair workflow records.",
      icon: <TaskAltRoundedIcon />,
      title: "Done Repair Device",
      value: workflowCounts.done,
    },
  ];

  const statusBreakdown = useMemo(() => {
    const counts = new Map();

    // Workflow Breakdown should summarize Repair Records only for Repair Management statuses.
    // Repair Tracking mirrors some inventory statuses, so including it here double-counts records.
    dashboardData.inventory.forEach((record) => {
      const name = statusById.get(record.status_id)?.name || "Inventory Pending";
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    dashboardData.repairRecords.forEach((record) => {
      const name = getWorkflowStatusDisplayName(record.workflow_status);
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([name, count]) => ({ color: getStatusColor(name, dashboardData.statuses), count, name }))
      .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
  }, [dashboardData.inventory, dashboardData.repairRecords, dashboardData.statuses, statusById]);

  const maxStatusCount = Math.max(...statusBreakdown.map((item) => item.count), 1);
  const activityRows = [
    {
      color: dashboardAccent.purple,
      label: "Repair Management",
      value: repairManagementTotal + configurationCount,
    },
    {
      color: dashboardAccent.orange,
      label: "Testing Device",
      value: dashboardData.repairRecords.length,
    },
    {
      color: dashboardAccent.green,
      label: "Administration",
      value: dashboardData.users.length + dashboardData.releaseNotes.length,
    },
    {
      color: dashboardAccent.teal,
      label: "Device Inventory",
      value: sparePartsMetrics.records,
    },
    {
      color: dashboardAccent.blue,
      label: "Audit and Archive",
      value: dashboardData.auditTrailCount + dashboardData.archivedRecords.length,
    },
  ];
  const maxActivityValue = Math.max(...activityRows.map((item) => item.value), 1);

  const workflowRows = [
    { color: dashboardAccent.purple, label: "New Repair Queue", value: workflowCounts.newQueue },
    { color: dashboardAccent.blue, label: "Support Testing Queue", value: workflowCounts.supportQueue },
    { color: dashboardAccent.orange, label: "Senior Testing Queue", value: workflowCounts.seniorQueue },
    { color: dashboardAccent.teal, label: "My Assigned Tasks", value: workflowCounts.myActive },
    { color: dashboardAccent.green, label: "Done Repair Device", value: workflowCounts.done },
  ];
  const maxWorkflowValue = Math.max(...workflowRows.map((item) => item.value), 1);

  const configRows = [
    { color: dashboardAccent.purple, label: "Clients", value: dashboardData.clients.length },
    { color: dashboardAccent.green, label: "Statuses", value: dashboardData.statuses.length },
    { color: dashboardAccent.blue, label: "Device Types", value: dashboardData.deviceTypes.length },
    { color: dashboardAccent.red, label: "Inactive Users", value: inactiveUsers },
  ];
  const maxConfigValue = Math.max(...configRows.map((item) => item.value), 1);
  const sparePartsRows = [
    { color: dashboardAccent.green, label: "Available", value: sparePartsMetrics.available },
    { color: dashboardAccent.orange, label: "Not Available", value: sparePartsMetrics.notAvailable },
    { color: dashboardAccent.red, label: "Defective", value: sparePartsMetrics.defective },
    { color: "#8a94a6", label: "N/A", value: sparePartsMetrics.notApplicable },
  ];
  const maxSparePartsValue = Math.max(...sparePartsRows.map((item) => item.value), 1);

  return (
    <Box className="vuexy-dashboard" component="main" sx={dashboardRootSx(theme)}>
      <Box
        className="module-page-header"
        sx={{
          alignItems: "center",
          display: "block",
          gap: 1.5,
          mb: 2,
          minHeight: { xs: "auto", md: 46 },
          position: "relative",
          width: "100%",
        }}
      >
        <Box className="module-page-copy" sx={{ pr: { xs: 0, md: "460px" } }}>
          <Typography className="module-page-title" variant="h4" component="h1">
            Dashboard
          </Typography>
          <Typography className="module-page-description" variant="body2" color="text.secondary">
            Repair management, testing workflow, administration, and audit overview.
          </Typography>
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          spacing={1.25}
          sx={{
            mt: { xs: 1.5, md: 0 },
            position: { xs: "static", md: "absolute" },
            right: 0,
            top: { md: "50%" },
            transform: { md: "translateY(-50%)" },
            width: { xs: "100%", md: "auto" },
          }}
        >
          <TextField
            className="theme-mode-select"
            select
            size="small"
            value={mode}
            onChange={(event) => onChangeMode(event.target.value)}
            SelectProps={{ MenuProps: { PaperProps: { className: "compact-select-menu-paper" } } }}
            sx={{ minWidth: 128 }}
          >
            <MenuItem value="light">
              <Stack direction="row" alignItems="center" spacing={1}>
                <LightModeRoundedIcon fontSize="small" />
                <span>Light</span>
              </Stack>
            </MenuItem>
            <MenuItem value="dark">
              <Stack direction="row" alignItems="center" spacing={1}>
                <DarkModeRoundedIcon fontSize="small" />
                <span>Dark</span>
              </Stack>
            </MenuItem>
            <MenuItem value="pink">
              <Stack direction="row" alignItems="center" spacing={1}>
                <PaletteRoundedIcon fontSize="small" />
                <span>Pink</span>
              </Stack>
            </MenuItem>
          </TextField>
          <Avatar sx={{ bgcolor: dashboardAccent.teal, color: "#061413", fontSize: 12, height: 34, width: 34 }}>
            {getInitials(userDisplayName || userEmail)}
          </Avatar>
          <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 0 }}>
            <Typography sx={leftTextSx} variant="body2" noWrap>
              {userDisplayName || "User"}
            </Typography>
            <Typography sx={mutedTextSx} variant="caption" noWrap>
              Signed in
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={dashboardGridSx}>
        <Paper elevation={0} sx={{ ...vuexyCardSx(theme), gridColumn: { xs: "1 / -1", lg: "span 8" }, p: 2.4 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
            <Box align="left" sx={{ flex: 1, minWidth: 0 }}>
              <Chip
                label="Endivio Workspace"
                size="small"
                sx={{
                  bgcolor: theme.palette.mode === "dark" ? "rgba(115,103,240,0.16)" : "rgba(115,103,240,0.10)",
                  color: dashboardAccent.purple,
                  mb: 1.25,
                }}
              />
              <Typography sx={{ ...leftTextSx, fontSize: { xs: 22, md: 27 }, lineHeight: 1.15 }} variant="h4">
                Repair Operations Dashboard
              </Typography>
              <Typography sx={{ ...mutedTextSx, mt: 0.75, maxWidth: 700 }} variant="body2">
                Live module summary for device records, repair queues, workflow completion, archive activity, and administration data.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }}>
                <HeroMetric label="Operational Records" value={totalOperationalRecords} />
                <HeroMetric label="Completion Rate" value={`${completionRate}%`} />
                <HeroMetric label="Issue Records" value={issueTotal} />
              </Stack>
            </Box>

            <Box sx={heroRingSx(completionRate)}>
              <Box sx={heroRingInnerSx(theme)}>
                <Typography sx={{ color: "text.primary", fontSize: 28, lineHeight: 1 }} variant="h4">
                  {completionRate}%
                </Typography>
                <Typography sx={mutedCenterTextSx} variant="caption">
                  Complete
                </Typography>
              </Box>
            </Box>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ ...vuexyCardSx(theme), gridColumn: { xs: "1 / -1", lg: "span 4" }, p: 2.2 }}>
          <PanelTitle
            icon={<TimelineRoundedIcon />}
            subtitle="Current Testing Device queue movement"
            title="Workflow Tracker"
          />
          <Stack spacing={1.25} sx={{ mt: 1.25 }}>
            {workflowRows.map((item) => (
              <ProgressRow
                key={item.label}
                color={item.color}
                label={item.label}
                max={maxWorkflowValue}
                value={item.value}
              />
            ))}
          </Stack>
        </Paper>

        {summaryCards.map((card) => (
          <Paper key={card.title} elevation={0} sx={{ ...vuexyCardSx(theme), gridColumn: { xs: "1 / -1", sm: "span 6", lg: "span 3" }, p: 1.9 }}>
            <SummaryCard {...card} />
          </Paper>
        ))}

        <Paper elevation={0} sx={{ ...vuexyCardSx(theme), gridColumn: { xs: "1 / -1", xl: "span 4" }, p: 2.2 }}>
          <PanelTitle
            icon={<Inventory2RoundedIcon />}
            subtitle="Device Monitoring spare-parts availability"
            title="Spare Parts Snapshot"
          />
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            {sparePartsRows.map((item) => (
              <ProgressRow
                key={item.label}
                color={item.color}
                label={item.label}
                max={maxSparePartsValue}
                value={item.value}
              />
            ))}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ ...vuexyCardSx(theme), gridColumn: { xs: "1 / -1", xl: "span 4" }, p: 2.2 }}>
          <PanelTitle
            icon={<AssessmentRoundedIcon />}
            subtitle="Record count by application area"
            title="Module Activity"
          />
          <Stack spacing={1.3} sx={{ mt: 1.5 }}>
            {activityRows.map((item) => (
              <ProgressRow
                key={item.label}
                color={item.color}
                label={item.label}
                max={maxActivityValue}
                value={item.value}
              />
            ))}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ ...vuexyCardSx(theme), gridColumn: { xs: "1 / -1", xl: "span 4" }, p: 2.2 }}>
          <PanelTitle
            icon={<SettingsRoundedIcon />}
            subtitle="Setup records that feed dropdowns and access"
            title="Configuration Snapshot"
          />
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            {configRows.map((item) => (
              <ProgressRow
                key={item.label}
                color={item.color}
                label={item.label}
                max={maxConfigValue}
                value={item.value}
              />
            ))}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ ...vuexyCardSx(theme), gridColumn: { xs: "1 / -1", xl: "span 4" }, p: 2.2 }}>
          <PanelTitle
            icon={<WarningAmberRoundedIcon />}
            subtitle="Status count across Repair Management and Testing Device"
            title="Workflow Breakdown"
          />
          <Stack spacing={1.15} sx={{ mt: 1.5 }}>
            {statusBreakdown.length === 0 ? (
              <Typography sx={mutedTextSx} variant="caption">
                No workflow status data available.
              </Typography>
            ) : null}
            {statusBreakdown.slice(0, 8).map((item) => (
              <ProgressRow
                key={item.name}
                color={item.color}
                label={item.name}
                max={maxStatusCount}
                value={item.count}
              />
            ))}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

function HeroMetric({ label, value }) {
  return (
    <Box sx={heroMetricSx}>
      <Typography sx={{ ...mutedTextSx, fontSize: 11 }} variant="caption">
        {label}
      </Typography>
      <Typography sx={{ ...leftTextSx, fontSize: 22, lineHeight: 1.1 }} variant="h5">
        {value}
      </Typography>
    </Box>
  );
}

function SummaryCard({ color, description, icon, title, value }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minHeight: 58 }}>
      <Box sx={summaryIconSx(color)}>{icon}</Box>
      <Stack alignItems="center" spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ ...mutedCenterTextSx, fontSize: 11 }} variant="caption">
          {title}
        </Typography>
        <Typography sx={{ ...centerTextSx, fontSize: 24, lineHeight: 1.1 }} variant="h5">
          {value}
        </Typography>
        <Typography sx={{ ...mutedCenterTextSx, fontSize: 11 }} variant="caption">
          {description}
        </Typography>
      </Stack>
    </Stack>
  );
}

function PanelTitle({ icon, subtitle, title }) {
  return (
    <Stack direction="row" spacing={1.15} alignItems="center">
      <Box sx={panelIconSx}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ ...leftTextSx, fontSize: 16 }} variant="h6">
          {title}
        </Typography>
        <Typography sx={{ ...mutedTextSx, fontSize: 11 }} variant="caption">
          {subtitle}
        </Typography>
      </Box>
    </Stack>
  );
}

function ProgressRow({ color, label, max, value }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.55 }}>
        <Typography sx={leftTextSx} variant="body2" noWrap>
          {label}
        </Typography>
        <Chip label={value} size="small" sx={valueChipSx(color)} />
      </Stack>
      <LinearProgress
        value={(value / max) * 100}
        variant="determinate"
        sx={progressSx(color)}
      />
    </Box>
  );
}

function getInitials(value) {
  return String(value || "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "U";
}

function getRows(result) {
  if (result?.error) {
    console.warn("Dashboard source load failed:", result.error.message);
    return [];
  }
  return result?.data || [];
}

function buildSparePartsMetrics(records) {
  return records.reduce(
    (totals, record) => {
      const parts = record.parts_status || {};

      // Reuse the Device Monitoring availability rule so dashboard totals match the module table.
      totals.available += getAvailableQuantity(parts);
      totals.records += 1;

      sparePartColumns.forEach((column) => {
        const status = String(parts[column.key] || "N/A").trim().toUpperCase();
        if (status === "DEFECTIVE") totals.defective += 1;
        if (status === "NOT AVAILABLE") totals.notAvailable += 1;
        if (!status || status === "N/A") totals.notApplicable += 1;
      });

      return totals;
    },
    { available: 0, defective: 0, notApplicable: 0, notAvailable: 0, records: 0 }
  );
}

function buildWorkflowCounts(records, userEmail) {
  const normalizedEmail = String(userEmail || "").toLowerCase();
  const isDone = (record) => record.workflow_status === "Done Repair Device";
  return {
    // Active workflow records include both unassigned queue items and assigned user tasks.
    allActive: records.filter((record) => !isDone(record)).length,
    done: records.filter(isDone).length,
    myActive: records.filter((record) => String(record.assigned_to_email || "").toLowerCase() === normalizedEmail && !isDone(record)).length,
    newQueue: records.filter((record) => !record.assigned_to_email && isNewRepairStage(record.workflow_status)).length,
    seniorQueue: records.filter((record) => !record.assigned_to_email && isSeniorStage(record.workflow_status)).length,
    supportQueue: records.filter((record) => !record.assigned_to_email && isSupportStage(record.workflow_status)).length,
  };
}

function countByStatus(records, statusById, predicate) {
  return records.filter((record) => predicate(statusById.get(record.status_id)?.name)).length;
}

function formatPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function isNewRepairStage(value) {
  return value === "Repair By" || value === "For Testing";
}

function isSupportStage(value) {
  return value === "Tested By" || value === "Test By" || value === "Checked By (Senior)";
}

function isSeniorStage(value) {
  return value === "Senior Tested By" || value === "Senior Test By" || value === "Checked By (Supervisor)";
}

const isCompleted = (statusName) => {
  const value = String(statusName || "").toLowerCase();
  return value === "completed" || value === "complete" || value === "deployed";
};

const isFailed = (statusName) => {
  const value = String(statusName || "").toLowerCase();
  return value.includes("fail") || value.includes("defect") || value.includes("issue") || value.includes("cancel");
};

const getStatusColor = (statusName, statuses) => {
  const fromDb = statuses.find((status) => status.name === statusName)?.color;
  if (fromDb) return fromDb;
  const value = String(statusName || "").toLowerCase();
  if (value.includes("repair by")) return dashboardAccent.purple;
  if (value.includes("tested by")) return dashboardAccent.blue;
  if (value.includes("senior")) return dashboardAccent.orange;
  if (value.includes("inventory")) return dashboardAccent.teal;
  if (value.includes("ongoing")) return dashboardAccent.purple;
  if (isCompleted(statusName) || value.includes("done")) return dashboardAccent.green;
  if (isFailed(statusName)) return dashboardAccent.red;
  if (value.includes("pending")) return dashboardAccent.orange;
  return "#8a94a6";
};

const dashboardRootSx = (theme) => ({
  minHeight: "100svh",
  p: { xs: 2, md: 3 },
  textAlign: "left",
  "& .MuiPaper-root::before, & .MuiPaper-root::after": {
    display: "none !important",
  },
  "& .MuiTableContainer-root": {
    borderRadius: "16px !important",
  },
  "& .MuiTableCell-root": {
    borderColor: panelBorder(theme),
  },
});

const dashboardGridSx = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
};

const vuexyCardSx = (theme) => ({
  bgcolor: panelBg(theme),
  border: `1px solid ${panelBorder(theme)}`,
  borderRadius: "18px !important",
  boxShadow: panelShadow(theme),
  color: "text.primary",
});

const panelBg = (theme) => (theme.palette.mode === "dark" ? "#25293c" : "#ffffff");

const panelBorder = (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "#e3e8f2");

const panelShadow = (theme) =>
  theme.palette.mode === "dark"
    ? "0 14px 36px rgba(0,0,0,0.28)"
    : "0 16px 44px rgba(15,23,42,0.08)";

const leftTextSx = {
  color: "text.primary",
  fontWeight: "400 !important",
  lineHeight: 1.25,
  textAlign: "left !important",
};

const centerTextSx = {
  color: "text.primary",
  fontWeight: "400 !important",
  lineHeight: 1.25,
  textAlign: "center !important",
};

const mutedTextSx = {
  color: "text.secondary",
  fontWeight: "400 !important",
  lineHeight: 1.35,
  textAlign: "left !important",
};

const mutedCenterTextSx = {
  color: "text.secondary",
  fontWeight: "400 !important",
  lineHeight: 1.2,
  textAlign: "center !important",
};

const heroMetricSx = {
  border: "1px solid rgba(115,103,240,0.22)",
  borderRadius: "14px",
  minWidth: 138,
  px: 1.4,
  py: 1,
};

const heroRingSx = (percent) => ({
  alignItems: "center",
  background: `conic-gradient(${dashboardAccent.purple} ${percent * 3.6}deg, rgba(115,103,240,0.16) 0deg)`,
  borderRadius: "50%",
  display: "flex",
  height: 142,
  justifyContent: "center",
  minWidth: 142,
  width: 142,
});

const heroRingInnerSx = (theme) => ({
  alignItems: "center",
  bgcolor: panelBg(theme),
  borderRadius: "50%",
  display: "flex",
  flexDirection: "column",
  height: 104,
  justifyContent: "center",
  width: 104,
});

const summaryIconSx = (color) => ({
  alignItems: "center",
  bgcolor: `${color}1f`,
  borderRadius: "14px",
  color,
  display: "flex",
  flex: "0 0 auto",
  height: 42,
  justifyContent: "center",
  width: 42,
});

const panelIconSx = {
  alignItems: "center",
  bgcolor: "rgba(115,103,240,0.14)",
  borderRadius: "12px",
  color: dashboardAccent.purple,
  display: "flex",
  height: 38,
  justifyContent: "center",
  width: 38,
};

const progressSx = (color) => ({
  bgcolor: "rgba(138,148,166,0.20)",
  borderRadius: 999,
  height: 7,
  mt: 0.75,
  "& .MuiLinearProgress-bar": {
    bgcolor: color,
    borderRadius: 999,
  },
});

const valueChipSx = (color) => ({
  bgcolor: `${color}22`,
  color,
  height: 22,
  minWidth: 34,
});
