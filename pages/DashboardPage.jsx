import {
  Avatar,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SortRoundedIcon from "@mui/icons-material/SortRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../src/lib/supabase.js";

const sampleClients = [
  { id: 1, name: "Wilcon Depot, Inc.", client_code: "Wilcon", is_active: true },
  { id: 2, name: "Penscott Corporation", client_code: "Penscott", is_active: true },
  { id: 3, name: "Stalwart Psychological Services Inc.", client_code: "Stalwart", is_active: true },
];

const sampleStatuses = [
  { id: 1, name: "Ongoing Repair", color: "#fb923c" },
  { id: 2, name: "Completed", color: "#16a34a" },
  { id: 3, name: "Defect", color: "#dc2626" },
  { id: 4, name: "N/A", color: "#64748b" },
];

const sampleInventory = [
  { id: 1, client_id: 1, status_id: 2 },
  { id: 2, client_id: 1, status_id: 2 },
  { id: 3, client_id: 2, status_id: 4 },
  { id: 4, client_id: 3, status_id: 3 },
];

const sampleTesting = [
  { id: 1, client_id: 1, status_id: 1 },
  { id: 2, client_id: 1, status_id: 3 },
  { id: 3, client_id: 2, status_id: 1 },
];

export default function DashboardPage({ mode, onToggleMode, userDisplayName, userEmail }) {
  const theme = useTheme();
  // Start with sample data so the dashboard still renders before Supabase data loads.
  const [clients, setClients] = useState(sampleClients);
  const [inventory, setInventory] = useState(sampleInventory);
  const [testing, setTesting] = useState(sampleTesting);
  const [statuses, setStatuses] = useState(sampleStatuses);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "totalRecords", direction: "desc" });

  useEffect(() => {
    let ignore = false;

    async function loadDashboardData() {
      if (!supabase) return;

      // Load dashboard source data in parallel because each summary depends on multiple tables.
      const [clientsResult, inventoryResult, testingResult, statusesResult] = await Promise.all([
        supabase.from("clients").select("id, name, client_code, is_active").order("name"),
        supabase.from("device_inventory_items").select("id, client_id, status_id"),
        supabase.from("ongoing_testing_items").select("id, client_id, status_id"),
        supabase.from("statuses").select("id, name, color, is_active").order("name"),
      ]);

      if (ignore) return;

      if (!clientsResult.error) setClients(clientsResult.data || []);
      if (!inventoryResult.error) setInventory(inventoryResult.data || []);
      if (!testingResult.error) setTesting(testingResult.data || []);
      if (!statusesResult.error) setStatuses(statusesResult.data || []);
    }

    loadDashboardData();

    return () => {
      ignore = true;
    };
  }, []);

  const statusById = useMemo(
    // Build a fast lookup map so status calculations do not repeatedly search the array.
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses]
  );

  const allRecords = useMemo(
    // Combine inventory and testing rows so summary cards can count all device records together.
    () => [
      ...inventory.map((item) => ({ ...item, recordType: "Inventory" })),
      ...testing.map((item) => ({ ...item, recordType: "Ongoing Testing" })),
    ],
    [inventory, testing]
  );

  const dashboardRows = useMemo(() => {
    // Build one dashboard row per client with inventory, testing, and status-based totals.
    const rows = clients.map((client) => {
      const clientInventory = inventory.filter((item) => item.client_id === client.id);
      const clientTesting = testing.filter((item) => item.client_id === client.id);
      const clientRecords = [...clientInventory, ...clientTesting];
      const completed = clientRecords.filter((item) => isCompleted(statusById.get(item.status_id)?.name)).length;
      const failed = clientRecords.filter((item) => isFailed(statusById.get(item.status_id)?.name)).length;
      const pending = clientRecords.filter((item) => {
        const statusName = statusById.get(item.status_id)?.name;
        return !isCompleted(statusName) && !isFailed(statusName);
      }).length;

      return {
        id: client.id,
        clientName: client.name,
        clientCode: client.client_code,
        totalInventory: clientInventory.length,
        ongoingTesting: clientTesting.length,
        completed,
        pending,
        failed,
        totalRecords: clientRecords.length,
      };
    });

    const filtered = rows.filter((row) => {
      const query = search.trim().toLowerCase();
      return (
        !query ||
        row.clientName.toLowerCase().includes(query) ||
        String(row.clientCode || "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((first, second) => {
      const firstValue = first[sortConfig.key];
      const secondValue = second[sortConfig.key];
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      if (typeof firstValue === "number") {
        return (firstValue - secondValue) * direction;
      }
      return String(firstValue || "").localeCompare(String(secondValue || "")) * direction;
    });
  }, [clients, inventory, search, sortConfig, statusById, testing]);

  const statusBreakdown = useMemo(() => {
    // Count records by module and by status for the visual status breakdown section.
    const counts = new Map();
    counts.set("Inventory", inventory.length);
    counts.set("Ongoing Testing", testing.length);
    allRecords.forEach((record) => {
      const name = statusById.get(record.status_id)?.name || "Pending";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].map(([name, count]) => ({
      name,
      count,
      color: getStatusColor(name, statuses),
    }));
  }, [allRecords, inventory.length, statusById, statuses, testing.length]);

  const completedTesting = allRecords.filter((record) => isCompleted(statusById.get(record.status_id)?.name)).length;
  const failedRecords = allRecords.filter((record) => isFailed(statusById.get(record.status_id)?.name)).length;
  const pendingRecords = allRecords.length - completedTesting - failedRecords;

  const summaryCards = [
    {
      title: "Total Inventory",
      value: inventory.length,
      description: "Records currently in inventory.",
      icon: <Inventory2RoundedIcon />,
      color: "#1976d2",
    },
    {
      title: "Ongoing Testing",
      value: testing.length,
      description: "Devices still under testing.",
      icon: <AssessmentRoundedIcon />,
      color: "#0f766e",
    },
    {
      title: "Completed Testing",
      value: completedTesting,
      description: "Records tagged as completed.",
      icon: <TaskAltRoundedIcon />,
      color: "#16a34a",
    },
    {
      title: "Pending Records",
      value: pendingRecords,
      description: "Open records awaiting progress.",
      icon: <PriorityHighRoundedIcon />,
      color: "#f59e0b",
    },
    {
      title: "Failed / Issue Records",
      value: failedRecords,
      description: "Defect, failed, or issue records.",
      icon: <WarningAmberRoundedIcon />,
      color: "#dc2626",
    },
    {
      title: "Total Clients",
      value: clients.length,
      description: "Configured client records.",
      icon: <GroupsRoundedIcon />,
      color: "#7c3aed",
    },
  ];

  const maxStatusCount = Math.max(...statusBreakdown.map((item) => item.count), 1);

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <Box component="main" sx={{ minHeight: "100svh", p: { xs: 2, md: 3 }, textAlign: "left" }}>
      <DashboardHeader mode={mode} onToggleMode={onToggleMode} userDisplayName={userDisplayName} userEmail={userEmail} />

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
          mb: 2,
        }}
      >
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} {...card} />
        ))}
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.55fr) minmax(320px, 0.75fr)" },
        }}
      >
        <Paper elevation={0} sx={{ border: borderColor(theme), borderRadius: 2, overflow: "hidden" }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: borderColor(theme) }}
          >
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Client Overview
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Inventory and testing records grouped by client.
              </Typography>
            </Box>
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client or code"
              InputProps={{ startAdornment: <SearchRoundedIcon sx={{ color: "text.secondary", fontSize: 18, mr: 0.75 }} /> }}
              sx={{ minWidth: { xs: "100%", md: 260 } }}
            />
          </Stack>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={dashboardTableSx(theme)}>
              <TableHead>
                <TableRow>
                  {[
                    ["clientName", "Client Name"],
                    ["totalInventory", "Total Inventory"],
                    ["ongoingTesting", "Ongoing Testing"],
                    ["completed", "Completed"],
                    ["pending", "Pending"],
                    ["failed", "Failed / With Issue"],
                    ["totalRecords", "Total Records"],
                  ].map(([key, label]) => (
                    <TableCell key={key} align={key === "clientName" ? "left" : "center"}>
                      <SortableHeader label={label} onClick={() => handleSort(key)} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {dashboardRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      No client records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboardRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography fontWeight={800}>{row.clientName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.clientCode || "No client code"}
                        </Typography>
                      </TableCell>
                      <NumberCell value={row.totalInventory} />
                      <NumberCell value={row.ongoingTesting} />
                      <NumberCell value={row.completed} color="#16a34a" />
                      <NumberCell value={row.pending} color="#f59e0b" />
                      <NumberCell value={row.failed} color="#dc2626" />
                      <NumberCell value={row.totalRecords} color="#1976d2" />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper elevation={0} sx={{ border: borderColor(theme), borderRadius: 2, p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Status Breakdown
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Visual count per workflow status.
              </Typography>
            </Box>
            <TimelineRoundedIcon sx={{ color: "primary.main" }} />
          </Stack>

          <Stack spacing={1.25}>
            {statusBreakdown.map((item) => (
              <Box key={item.name}>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={800} noWrap>
                    {item.name}
                  </Typography>
                  <Chip label={item.count} size="small" sx={{ bgcolor: `${item.color}22`, color: item.color, fontWeight: 900 }} />
                </Stack>
                <LinearProgress
                  value={(item.count / maxStatusCount) * 100}
                  variant="determinate"
                  sx={{
                    bgcolor: theme.palette.mode === "dark" ? "#334155" : "#e5e7eb",
                    borderRadius: 99,
                    height: 8,
                    "& .MuiLinearProgress-bar": {
                      bgcolor: item.color,
                      borderRadius: 99,
                    },
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

function DashboardHeader({ mode, onToggleMode, userDisplayName, userEmail }) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ border: borderColor(theme), borderRadius: 2, mb: 2, p: 1.5 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#e8f2ff",
              borderRadius: 1.5,
              color: "#1f5f99",
              display: "flex",
              height: 42,
              justifyContent: "center",
              width: 42,
            }}
          >
            <Inventory2RoundedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={900}>
              Endivio Device Management
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Dashboard overview for inventory and testing operations.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {mode === "dark" ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
              <Switch checked={mode === "dark"} onChange={onToggleMode} size="small" />
            </Stack>
          </Tooltip>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar sx={{ bgcolor: "#1f5f99", height: 34, width: 34 }}>{getInitials(userDisplayName || userEmail || "Admin User")}</Avatar>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" fontWeight={900}>
                {userDisplayName || userEmail || "Admin User"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Signed in
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}

function getInitials(value) {
  // Build avatar initials from the visible display name instead of a hardcoded label.
  return String(value || "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "U";
}

function SummaryCard({ color, description, icon, title, value }) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ border: borderColor(theme), borderRadius: 2, p: 1.75 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            alignItems: "center",
            bgcolor: `${color}18`,
            borderRadius: 1.5,
            color,
            display: "flex",
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={950} sx={{ color: "text.primary", my: 0.25 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function SortableHeader({ label, onClick }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      spacing={0.25}
      onClick={onClick}
      sx={{ cursor: "pointer", userSelect: "none" }}
    >
      <Typography component="span" fontWeight={900} sx={{ fontSize: 11 }}>
        {label}
      </Typography>
      <SortRoundedIcon sx={{ fontSize: 14, opacity: 0.65 }} />
    </Stack>
  );
}

function NumberCell({ color = "#334155", value }) {
  return (
    <TableCell align="center">
      <Typography fontWeight={900} sx={{ color }}>
        {value}
      </Typography>
    </TableCell>
  );
}

const dashboardTableSx = (theme) => ({
  minWidth: 900,
  "& th": {
    bgcolor: theme.palette.mode === "dark" ? "#334155" : "#d9d9d9",
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1.2,
    px: 0.75,
    py: 0.9,
  },
  "& td": {
    fontSize: 11,
    lineHeight: 1.25,
    px: 0.75,
    py: 0.75,
  },
  "& td, & th": {
    borderColor: theme.palette.mode === "dark" ? "#334155" : "#dddddd",
  },
});

const borderColor = (theme) => `1px solid ${theme.palette.mode === "dark" ? "#334155" : "#dde5ef"}`;

const isCompleted = (statusName) => {
  const value = String(statusName || "").toLowerCase();
  return value === "completed" || value === "complete" || value === "deployed";
};

const isFailed = (statusName) => {
  const value = String(statusName || "").toLowerCase();
  return (
    value.includes("fail") ||
    value.includes("defect") ||
    value.includes("issue") ||
    value.includes("cancel")
  );
};

const getStatusColor = (statusName, statuses) => {
  const fromDb = statuses.find((status) => status.name === statusName)?.color;
  if (fromDb) return fromDb;
  const value = String(statusName || "").toLowerCase();
  if (value.includes("inventory")) return "#1976d2";
  if (value.includes("ongoing")) return "#fb923c";
  if (isCompleted(statusName)) return "#16a34a";
  if (isFailed(statusName)) return "#dc2626";
  if (value.includes("pending")) return "#f59e0b";
  return "#64748b";
};
