import {
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Divider,
  Stack,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import BuildCircleRoundedIcon from "@mui/icons-material/BuildCircleRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import ArchivedRecordsPage from "../pages/ArchivedRecordsPage";
import AuditTrailPage from "../pages/AuditTrailPage";
import ConfigurationsPage from "../pages/ConfigurationsPage";
import DashboardPage from "../pages/DashboardPage";
import DeviceManagementPage from "../pages/InventoryRecordsPage";
import DeviceTestingPage from "../pages/DeviceTestingPage";
import LoginPage from "../pages/LoginPage";
import OngoingTestingPage from "../pages/OngoingTestingPage";
import RepairDeviceCheckPage from "../pages/RepairDeviceCheckPage";
import RepairDeviceWorkflowPage from "../pages/RepairDeviceWorkflowPage";
import { getUserDisplayName } from "./lib/repairWorkflow";
import { supabase } from "./lib/supabase";

function App() {
  // Track the active module so the sidebar can switch pages without changing routes.
  const [activePage, setActivePage] = useState("dashboard");
  // Keep the Device Inventory group collapsed on refresh so child modules appear only after the user clicks it.
  const [deviceInventoryOpen, setDeviceInventoryOpen] = useState(false);
  // Keep the Testing Device group collapsed until the user opens the repair workflow.
  const [testingDeviceOpen, setTestingDeviceOpen] = useState(false);
  // Store the selected repair workflow id when the user opens the checking page.
  const [activeRepairRecordId, setActiveRepairRecordId] = useState(null);
  // Track whether the repair checking page is opened from a queue for viewing only.
  const [repairReadOnly, setRepairReadOnly] = useState(false);
  // Remember where the repair checking page was opened from so Back returns to the right module.
  const [repairBackPage, setRepairBackPage] = useState("myRepairDevice");
  // Persist the selected visual theme so the app keeps the same mode after reload.
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("endivio-theme") || "light");
  // Store the Supabase Auth session used to protect the application pages.
  const [session, setSession] = useState(null);
  // Store the freshest Supabase Auth user because profile metadata can change after login.
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  // Build the MUI theme from the selected mode while preserving the existing UI styling.
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: { main: "#1976d2" },
          background: {
            default: themeMode === "dark" ? "#111827" : "#f6f8fb",
            paper: themeMode === "dark" ? "#1f2937" : "#ffffff",
          },
          text: {
            primary: themeMode === "dark" ? "#f8fafc" : "#172033",
            secondary: themeMode === "dark" ? "#cbd5e1" : "#4b5b70",
          },
        },
        typography: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        shape: { borderRadius: 8 },
      }),
    [themeMode]
  );

  const toggleThemeMode = () => {
    setThemeMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      // Save the theme preference locally because login state and theme are independent.
      localStorage.setItem("endivio-theme", next);
      return next;
    });
  };

  useEffect(() => {
    // Expose the selected theme mode to global CSS so hardcoded areas stay readable.
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!supabase) {
        // Allow the login screen to render even when environment variables are missing.
        setIsAuthLoading(false);
        return;
      }

      // Retrieve the current Supabase session before deciding whether to show login or the app.
      const { data } = await supabase.auth.getSession();
      // Fetch the user from Supabase Auth so display_name changes are not stuck on the cached session.
      const { data: userData } = data.session ? await supabase.auth.getUser() : { data: { user: null } };
      if (mounted) {
        setSession(data.session || null);
        setCurrentUser(userData.user || data.session?.user || null);
        setIsAuthLoading(false);
      }
    }

    loadSession();
    // Keep the UI in sync when Supabase signs the user in or out.
    const { data: authListener } = supabase?.auth.onAuthStateChange(async (_event, nextSession) => {
      // Refresh the user object after auth changes so dashboard/sidebar display metadata updates.
      const { data: userData } = nextSession ? await supabase.auth.getUser() : { data: { user: null } };
      setSession(nextSession);
      setCurrentUser(userData.user || nextSession?.user || null);
      setIsAuthLoading(false);
    }) || { data: null };

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (!supabase) return;
    // Sign out through Supabase, then reset the visible page to the dashboard.
    await supabase.auth.signOut();
    setSession(null);
    setCurrentUser(null);
    setActivePage("dashboard");
  };

  const currentUserEmail = currentUser?.email || session?.user?.email || "";
  // Build one consistent display name for headers, sidebars, sign-offs, and workflow actions.
  const currentUserDisplayName = getUserDisplayName(currentUser || session?.user, currentUserEmail);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isAuthLoading ? (
        <Box sx={{ alignItems: "center", bgcolor: "background.default", display: "flex", justifyContent: "center", minHeight: "100svh" }}>
          <CircularProgress />
        </Box>
      ) : !session ? (
        <LoginPage mode={themeMode} onLogin={setSession} onToggleMode={toggleThemeMode} />
      ) : (
      <Box sx={{ display: "flex", minHeight: "100svh", bgcolor: "background.default" }}>
      <Box
        className="app-sidebar"
        component="aside"
        sx={{
          bgcolor: "#2f3940",
          color: "#f8fafc",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          position: "sticky",
          top: 0,
          width: 232,
          height: "100svh",
          overflowY: "auto",
        }}
      >
        <SidebarItem
          active={activePage === "dashboard"}
          icon={<HomeRoundedIcon fontSize="small" />}
          label="Dashboard"
          onClick={() => setActivePage("dashboard")}
        />

        <SidebarGroup
          icon={<Inventory2RoundedIcon fontSize="small" />}
          label="Device Inventory"
          open={deviceInventoryOpen}
          onClick={() => setDeviceInventoryOpen((current) => !current)}
        />

        {deviceInventoryOpen ? (
          <Stack>
            <SidebarItem
              active={activePage === "deviceInventoryRecords"}
              child
              icon={<Inventory2RoundedIcon fontSize="small" />}
              label="Inventory Records"
              onClick={() => setActivePage("deviceInventoryRecords")}
            />
            <SidebarItem
              active={activePage === "ongoingTesting"}
              child
              icon={<AssessmentRoundedIcon fontSize="small" />}
              label="Ongoing Testing"
              onClick={() => setActivePage("ongoingTesting")}
            />
            <SidebarItem
              active={activePage === "ConfigurationsPage"}
              child
              icon={<SettingsRoundedIcon fontSize="small" />}
              label="Configurations"
              onClick={() => setActivePage("ConfigurationsPage")}
            />
            <SidebarItem
              active={activePage === "archivedRecords"}
              child
              icon={<ArchiveRoundedIcon fontSize="small" />}
              label="Archived Records"
              onClick={() => setActivePage("archivedRecords")}
            />
            <SidebarItem
              active={activePage === "auditTrail"}
              child
              icon={<HistoryRoundedIcon fontSize="small" />}
              label="Audit Trail"
              onClick={() => setActivePage("auditTrail")}
            />
          </Stack>
        ) : null}

        <SidebarGroup
          icon={<BuildCircleRoundedIcon fontSize="small" />}
          label="Testing Device"
          open={testingDeviceOpen}
          onClick={() => setTestingDeviceOpen((current) => !current)}
        />

        {testingDeviceOpen ? (
          <Stack>
            <SidebarItem
              active={activePage === "newRepairDevice"}
              child
              icon={<BuildCircleRoundedIcon fontSize="small" />}
              label="New Repair Device"
              onClick={() => setActivePage("newRepairDevice")}
            />
            <SidebarItem
              active={activePage === "ongoingSupportTesting" || (activePage === "repairDeviceCheck" && repairBackPage === "ongoingSupportTesting")}
              child
              icon={<AssessmentRoundedIcon fontSize="small" />}
              label="Ongoing Support Testing"
              onClick={() => setActivePage("ongoingSupportTesting")}
            />
            <SidebarItem
              active={activePage === "ongoingSeniorTesting" || (activePage === "repairDeviceCheck" && repairBackPage === "ongoingSeniorTesting")}
              child
              icon={<AssessmentRoundedIcon fontSize="small" />}
              label="Ongoing Senior Testing"
              onClick={() => setActivePage("ongoingSeniorTesting")}
            />
            <SidebarItem
              active={activePage === "myRepairDevice" || (activePage === "repairDeviceCheck" && repairBackPage === "myRepairDevice")}
              child
              icon={<AssessmentRoundedIcon fontSize="small" />}
              label="My Repair/Testing Device"
              onClick={() => setActivePage("myRepairDevice")}
            />
            <SidebarItem
              active={activePage === "doneRepairDevice"}
              child
              icon={<ArchiveRoundedIcon fontSize="small" />}
              label="Done Repair Device"
              onClick={() => setActivePage("doneRepairDevice")}
            />
          </Stack>
        ) : null}

        {/* <SidebarItem
          active={activePage === "testing"}
          icon={<AssessmentRoundedIcon fontSize="small" />}
          label="Testing Report"
          onClick={() => setActivePage("testing")}
        /> */}

        <Box sx={{ mt: "auto", p: 1.25 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", mb: 1.25 }} />
          <Typography variant="caption" sx={{ color: "#9fb0bf", display: "block", mb: 0.5 }}>
            Signed in as
          </Typography>
          <Typography variant="body2" fontWeight={800} noWrap sx={{ color: "#ffffff", mb: 1 }}>
            {currentUserDisplayName}
          </Typography>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<LogoutRoundedIcon />}
            onClick={handleLogout}
            sx={{
              borderColor: "rgba(255,255,255,0.22)",
              color: "#f8fafc",
              justifyContent: "flex-start",
              textTransform: "none",
              "&:hover": { borderColor: "#38bdf8", bgcolor: "rgba(56,189,248,0.12)" },
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Render only the selected module so inactive pages do not keep unnecessary UI state mounted. */}
        {activePage === "dashboard" ? (
          <DashboardPage mode={themeMode} onToggleMode={toggleThemeMode} userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} />
        ) : null}
        {activePage === "deviceInventoryRecords" ? <DeviceManagementPage /> : null}
        {activePage === "ongoingTesting" ? <OngoingTestingPage /> : null}
        {activePage === "ConfigurationsPage" ? <ConfigurationsPage /> : null}
        {activePage === "archivedRecords" ? <ArchivedRecordsPage /> : null}
        {activePage === "auditTrail" ? <AuditTrailPage /> : null}
        {activePage === "newRepairDevice" ? <RepairDeviceWorkflowPage mode="new" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("newRepairDevice"); setActivePage("repairDeviceCheck"); }} /> : null}
        {activePage === "myRepairDevice" ? <RepairDeviceWorkflowPage mode="my" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = false) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("myRepairDevice"); setActivePage("repairDeviceCheck"); }} /> : null}
        {activePage === "ongoingSupportTesting" ? <RepairDeviceWorkflowPage mode="support" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("ongoingSupportTesting"); setActivePage("repairDeviceCheck"); }} /> : null}
        {activePage === "ongoingSeniorTesting" ? <RepairDeviceWorkflowPage mode="senior" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("ongoingSeniorTesting"); setActivePage("repairDeviceCheck"); }} /> : null}
        {activePage === "doneRepairDevice" ? <RepairDeviceWorkflowPage mode="done" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("doneRepairDevice"); setActivePage("repairDeviceCheck"); }} /> : null}
        {activePage === "repairDeviceCheck" && activeRepairRecordId ? <RepairDeviceCheckPage readOnly={repairReadOnly} recordId={activeRepairRecordId} userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onBack={() => setActivePage(repairBackPage)} /> : null}
        {activePage === "testing" ? <DeviceTestingPage /> : null}
      </Box>
      </Box>
      )}
    </ThemeProvider>
  );
}

function SidebarItem({ active, child = false, icon, label, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        alignItems: "center",
        bgcolor: active ? "#1f2933" : "transparent",
        borderLeft: active ? "4px solid #38bdf8" : "4px solid transparent",
        color: active ? "#ffffff" : "#dbe7ef",
        cursor: "pointer",
        display: "grid",
        gap: 0.75,
        gridTemplateColumns: "22px 1fr",
        minHeight: 38,
        pl: child ? 4 : 1.5,
        pr: 1,
        py: 0.6,
        "&:hover": {
          bgcolor: "#37444d",
          color: "#ffffff",
        },
      }}
    >
      {icon}
      <Typography variant="body2" fontWeight={active ? 900 : 700} noWrap sx={{ color: "inherit !important" }}>
        {label}
      </Typography>
    </Box>
  );
}

function SidebarGroup({ icon, label, onClick, open }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        alignItems: "center",
        bgcolor: "#3a454c",
        color: "#38bdf8",
        cursor: "pointer",
        display: "grid",
        gap: 0.75,
        gridTemplateColumns: "22px 22px 1fr",
        minHeight: 38,
        pl: 1.5,
        pr: 1,
        py: 0.6,
      }}
    >
      {open ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
      {icon}
      <Typography variant="body2" fontWeight={800} noWrap sx={{ color: "inherit !important" }}>
        {label}
      </Typography>
    </Box>
  );
}

export default App;
