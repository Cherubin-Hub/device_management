// App owns authentication, theme state, sidebar navigation, and guarded module rendering.
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Divider,
  IconButton,
  Stack,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import BuildCircleRoundedIcon from "@mui/icons-material/BuildCircleRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import ArchivedRecordsPage from "../pages/ArchivedRecordsPage";
import AuditTrailPage from "../pages/AuditTrailPage";
import ConfigurationsPage from "../pages/ConfigurationsPage";
import DashboardPage from "../pages/DashboardPage";
import DataMigrationPage from "../pages/DataMigrationPage";
import DeviceMonitoringSparePartsPage from "../pages/DeviceMonitoringSparePartsPage";
import DeviceManagementPage from "../pages/RepairRecordsPage";
import DeviceTestingPage from "../pages/DeviceTestingPage";
import EmailConfigurationPage from "../pages/EmailConfigurationPage";
import LoginPage from "../pages/LoginPage";
import OngoingTestingPage from "../pages/RepairTrackingPage";
import RepairDeviceCheckPage from "../pages/RepairDeviceCheckPage";
import RepairDeviceWorkflowPage from "../pages/RepairDeviceWorkflowPage";
import ReportsPage from "../pages/ReportsPage";
import ReleaseNotesPage from "../pages/ReleaseNotesPage";
import UserManagementPage from "../pages/UserManagementPage";
import { DEFAULT_ACCESS_RIGHTS, normalizeAccessRights } from "./lib/accessRights";
import { getUserDisplayName } from "./lib/repairWorkflow";
import { supabase } from "./lib/supabase";

// Centralized UI contrast tokens. Keep this aligned with src/index.css data-theme variables.
const THEME_TOKENS = {
  dark: {
    background: "#121821",
    paper: "#1b2430",
    text: "#f4f7fb",
    mutedText: "#c6ced8",
    divider: "rgba(226,232,240,0.16)",
    primary: "#34d6cb",
    primaryContrast: "#06211f",
  },
  light: {
    background: "#edf2f7",
    paper: "#ffffff",
    text: "#111827",
    mutedText: "#334155",
    divider: "#c8d3df",
    primary: "#0f9f95",
    primaryContrast: "#ffffff",
  },
  pink: {
    background: "#fff5f9",
    paper: "#ffffff",
    text: "#2a1320",
    mutedText: "#5a3245",
    divider: "#e8a9c4",
    primary: "#be185d",
    primaryContrast: "#ffffff",
  },
};

function getThemeTokens(mode) {
  // Fall back to dark tokens when localStorage contains an old or invalid value.
  return THEME_TOKENS[mode] || THEME_TOKENS.dark;
}

function App() {
  // Track the active module so the sidebar can switch pages without changing routes.
  const [activePage, setActivePage] = useState("dashboard");
  // Keep the Device Inventory group collapsed on refresh so child modules appear only after the user clicks it.
  const [deviceInventoryOpen, setDeviceInventoryOpen] = useState(false);
  // Keep the spare-parts inventory group collapsed until the user opens that monitoring area.
  const [sparePartsInventoryOpen, setSparePartsInventoryOpen] = useState(false);
  // Keep the Testing Device group collapsed until the user opens the repair workflow.
  const [testingDeviceOpen, setTestingDeviceOpen] = useState(false);
  // Keep Administration collapsed until the user needs account or release-note setup.
  const [administrationOpen, setAdministrationOpen] = useState(false);
  // Keep Data Migration collapsed so import/export tools stay grouped and intentional.
  const [dataMigrationOpen, setDataMigrationOpen] = useState(false);
  // Keep Reports collapsed until the user needs report-generation pages.
  const [reportsOpen, setReportsOpen] = useState(false);
  // Persist whether the sidebar stays expanded or only expands while hovered.
  const [sidebarPinned, setSidebarPinned] = useState(() => localStorage.getItem("endivio-sidebar-pinned") === "true");
  // Store the selected repair workflow id when the user opens the checking page.
  const [activeRepairRecordId, setActiveRepairRecordId] = useState(null);
  // Track whether the repair checking page is opened from a queue for viewing only.
  const [repairReadOnly, setRepairReadOnly] = useState(false);
  // Remember where the repair checking page was opened from so Back returns to the right module.
  const [repairBackPage, setRepairBackPage] = useState("myRepairDevice");
  // Persist the selected visual theme so the app keeps the same mode after reload.
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("endivio-theme") || "dark");
  // MUI accepts only light or dark palette modes; pink uses light mode plus CSS theme tokens.
  const muiPaletteMode = themeMode === "dark" ? "dark" : "light";
  // Reuse one token source for every MUI component so contrast changes stay centralized.
  const themeTokens = useMemo(() => getThemeTokens(themeMode), [themeMode]);
  // Store the Supabase Auth session used to protect the application pages.
  const [session, setSession] = useState(null);
  // Store the freshest Supabase Auth user because profile metadata can change after login.
  const [currentUser, setCurrentUser] = useState(null);
  // Store the public application profile used for status and access-right checks.
  const [currentAppUser, setCurrentAppUser] = useState(null);
  // Store login/access messages such as inactive account notifications.
  const [accessMessage, setAccessMessage] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  // Build the MUI theme from the selected mode while keeping every page on one corporate design system.
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: muiPaletteMode,
          primary: { main: themeTokens.primary, contrastText: themeTokens.primaryContrast },
          secondary: { main: "#7c3aed" },
          background: {
            default: themeTokens.background,
            paper: themeTokens.paper,
          },
          text: {
            primary: themeTokens.text,
            secondary: themeTokens.mutedText,
          },
          divider: themeTokens.divider,
          error: { main: "#ef4444" },
          success: { main: "#22c55e" },
          warning: { main: "#f59e0b" },
        },
        typography: {
          fontFamily:
            '"Chakra Petch", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          allVariants: { fontWeight: 400, letterSpacing: 0 },
          button: { fontWeight: 400, letterSpacing: 0, textTransform: "none" },
        },
        shape: { borderRadius: 14 },
        components: {
          // These component defaults give older pages the same reference-inspired card/table/button language.
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: "none",
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 999,
                fontWeight: 400,
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 12,
              },
            },
          },
        },
      }),
    [muiPaletteMode, themeTokens]
  );

  const toggleThemeMode = () => {
    setThemeMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      // Save the theme preference locally because login state and theme are independent.
      localStorage.setItem("endivio-theme", next);
      return next;
    });
  };

  const updateThemeMode = (nextMode) => {
    // Dashboard uses a dropdown, so accept the selected mode directly instead of toggling.
    const normalizedMode = ["light", "dark", "pink"].includes(nextMode) ? nextMode : "dark";
    localStorage.setItem("endivio-theme", normalizedMode);
    setThemeMode(normalizedMode);
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

      try {
        // Retrieve the current Supabase session before deciding whether to show login or the app.
        const { data } = await withTimeout(supabase.auth.getSession(), "Supabase session check timed out");
        // Fetch the user from Supabase Auth so display_name changes are not stuck on the cached session.
        const { data: userData } = data.session
          ? await withTimeout(supabase.auth.getUser(), "Supabase user lookup timed out")
          : { data: { user: null } };
        const profile = userData.user
          ? await withTimeout(
              loadAppUserProfile(userData.user, data.session?.user?.email),
              "Application profile lookup timed out"
            )
          : null;

        if (profile?.is_active === false) {
          // Inactive users are signed out immediately so they cannot access protected modules.
          await supabase.auth.signOut();
          if (mounted) {
            setAccessMessage("Your account is inactive. Please contact the administrator.");
            setSession(null);
            setCurrentUser(null);
            setCurrentAppUser(null);
            setIsAuthLoading(false);
          }
          return;
        }

        if (mounted) {
          setSession(data.session || null);
          setCurrentUser(userData.user || data.session?.user || null);
          setCurrentAppUser(profile);
          setIsAuthLoading(false);
        }
      } catch (error) {
        // Never leave first-time visitors stuck on the loading screen when Supabase is slow or unreachable.
        console.warn("Initial authentication load failed:", error.message);
        if (mounted) {
          setSession(null);
          setCurrentUser(null);
          setCurrentAppUser(null);
          setIsAuthLoading(false);
        }
      }
    }

    loadSession();
    // Keep the UI in sync when Supabase signs the user in or out.
    const { data: authListener } = supabase?.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        // Refresh the user object after auth changes so dashboard/sidebar display metadata updates.
        const { data: userData } = nextSession
          ? await withTimeout(supabase.auth.getUser(), "Supabase auth listener user lookup timed out")
          : { data: { user: null } };
        const profile = userData.user ? await loadAppUserProfile(userData.user, nextSession?.user?.email) : null;

        if (profile?.is_active === false) {
          // Block inactive accounts even when a session still exists in local storage.
          await supabase.auth.signOut();
          setAccessMessage("Your account is inactive. Please contact the administrator.");
          setSession(null);
          setCurrentUser(null);
          setCurrentAppUser(null);
          setIsAuthLoading(false);
          return;
        }

        setAccessMessage("");
        setSession(nextSession);
        setCurrentUser(userData.user || nextSession?.user || null);
        setCurrentAppUser(profile);
        setIsAuthLoading(false);
      } catch (error) {
        // Auth listener failures should not lock the entire app on the loading indicator.
        console.warn("Authentication listener failed:", error.message);
        setSession(nextSession || null);
        setCurrentUser(nextSession?.user || null);
        setCurrentAppUser(null);
        setIsAuthLoading(false);
      }
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
    setCurrentAppUser(null);
    setActivePage("dashboard");
  };

  const currentUserEmail = currentUser?.email || session?.user?.email || "";
  // Normalize access rights so missing keys stay visible until an admin turns them off.
  const currentAccessRights = useMemo(
    () => normalizeAccessRights(currentAppUser?.access_rights),
    [currentAppUser?.access_rights]
  );
  // Build one consistent display name for headers, sidebars, sign-offs, and workflow actions.
  const currentUserDisplayName = currentAppUser?.display_name || getUserDisplayName(currentUser || session?.user, currentUserEmail);
  const hasAccess = useCallback((pageKey) => currentAccessRights[pageKey] !== false, [currentAccessRights]);
  const repairManagementVisible = ["deviceInventoryRecords", "ongoingTesting", "archivedRecords", "auditTrail"].some(hasAccess);
  const sparePartsInventoryVisible = ["deviceMonitoringSpareParts"].some(hasAccess);
  const testingDeviceVisible = ["newRepairDevice", "ongoingSupportTesting", "ongoingSeniorTesting", "myRepairDevice", "allRepairDevice", "doneRepairDevice"].some(hasAccess);
  const administrationVisible = ["users", "ConfigurationsPage", "emailConfiguration", "releaseNotes"].some(hasAccess);
  const dataMigrationVisible = ["dataMigrationDeviceInventory", "dataMigrationRepairManagement"].some(hasAccess);
  const reportsVisible = ["reportsDeviceInventory", "reportsRepairManagement", "reportsAdministration"].some(hasAccess);
  // Render the first allowed page when a user's rights no longer include the selected module.
  const guardedPageKey = activePage === "repairDeviceCheck" ? repairBackPage : activePage;
  const visiblePage = session && currentAppUser && !hasAccess(guardedPageKey)
    ? getFirstAccessiblePage(currentAccessRights)
    : activePage;
  const toggleSidebarPinned = () => {
    // Keep the user's sidebar width preference after browser refresh.
    setSidebarPinned((current) => {
      const nextValue = !current;
      localStorage.setItem("endivio-sidebar-pinned", String(nextValue));
      return nextValue;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isAuthLoading ? (
        <Box sx={{ alignItems: "center", bgcolor: "background.default", display: "flex", justifyContent: "center", minHeight: "100svh" }}>
          <CircularProgress />
        </Box>
      ) : !session ? (
        <Box sx={{ minHeight: "100svh" }}>
          {accessMessage ? (
            <Alert severity="warning" sx={{ borderRadius: 0 }}>
              {accessMessage}
            </Alert>
          ) : null}
          <LoginPage mode={themeMode} onLogin={setSession} onToggleMode={toggleThemeMode} />
        </Box>
      ) : (
      <Box sx={{ bgcolor: "background.default", minHeight: "100svh", overflowX: "hidden" }}>
      <Box
        sx={{
          bgcolor: "background.default",
          display: "flex",
          minHeight: "100svh",
          overflow: "visible",
          position: "relative",
          zIndex: 1,
        }}
      >
      <Box
        className={`app-sidebar ${sidebarPinned ? "is-pinned" : ""}`}
        component="aside"
        sx={{
          bgcolor: "#111418",
          borderRight: "1px solid rgba(255,255,255,0.10)",
          bottom: 0,
          color: "#f8fafc",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          flex: sidebarPinned ? "0 0 245px" : "0 0 64px",
          left: 0,
          position: "fixed",
          top: 0,
          width: sidebarPinned ? 245 : 64,
          height: "100svh",
          overflow: "hidden",
          p: 1,
          transition: "width 160ms ease, flex-basis 160ms ease",
          zIndex: 20,
          "&:hover": {
            flexBasis: "245px",
            width: 245,
          },
        }}
      >
        <Box className="sidebar-brand" sx={{ alignItems: "center", display: "flex", gap: 1, minHeight: 42, px: 1.25 }}>
          <Typography className="sidebar-label" variant="caption" sx={{ color: "rgba(255,255,255,0.72) !important", display: "block", fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>
            Endivio
          </Typography>
          <IconButton
            className="sidebar-pin-button"
            onClick={toggleSidebarPinned}
            size="small"
            title={sidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            sx={{
              border: "1px solid rgba(32,208,196,0.35)",
              color: "#20d0c4 !important",
              height: 28,
              ml: "auto",
              width: 28,
            }}
          >
            {sidebarPinned ? <PushPinRoundedIcon fontSize="inherit" /> : <PushPinOutlinedIcon fontSize="inherit" />}
          </IconButton>
        </Box>

        <Box
          className="sidebar-scroll-area"
          component="nav"
          sx={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowX: "hidden",
            overflowY: "auto",
            pr: 0.25,
          }}
        >
        {hasAccess("dashboard") ? (
          <SidebarItem
            active={visiblePage === "dashboard"}
            icon={<HomeRoundedIcon fontSize="small" />}
            label="Dashboard"
            onClick={() => setActivePage("dashboard")}
          />
        ) : null}

        {sparePartsInventoryVisible ? (
          <SidebarGroup
            icon={<Inventory2RoundedIcon fontSize="small" />}
            label="Device Inventory"
            open={sparePartsInventoryOpen}
            onClick={() => setSparePartsInventoryOpen((current) => !current)}
          />
        ) : null}

        {sparePartsInventoryOpen && sparePartsInventoryVisible ? (
          <Stack>
            {hasAccess("deviceMonitoringSpareParts") ? (
              <SidebarItem
                active={visiblePage === "deviceMonitoringSpareParts"}
                child
                icon={<Inventory2RoundedIcon fontSize="small" />}
                label="Device Monitoring (Spare Parts)"
                onClick={() => setActivePage("deviceMonitoringSpareParts")}
              />
            ) : null}
          </Stack>
        ) : null}

        {repairManagementVisible ? (
          <SidebarGroup
            icon={<Inventory2RoundedIcon fontSize="small" />}
            label="Repair Management"
            open={deviceInventoryOpen}
            onClick={() => setDeviceInventoryOpen((current) => !current)}
          />
        ) : null}

        {deviceInventoryOpen && repairManagementVisible ? (
          <Stack>
            {hasAccess("deviceInventoryRecords") ? (
              <SidebarItem
                active={visiblePage === "deviceInventoryRecords"}
                child
                icon={<Inventory2RoundedIcon fontSize="small" />}
                label="Repair Records"
                onClick={() => setActivePage("deviceInventoryRecords")}
              />
            ) : null}
            {hasAccess("ongoingTesting") ? (
              <SidebarItem
                active={visiblePage === "ongoingTesting"}
                child
                icon={<AssessmentRoundedIcon fontSize="small" />}
                label="Repair Tracking"
                onClick={() => setActivePage("ongoingTesting")}
              />
            ) : null}
            {hasAccess("archivedRecords") ? (
              <SidebarItem
                active={visiblePage === "archivedRecords"}
                child
                icon={<ArchiveRoundedIcon fontSize="small" />}
                label="Archived Records"
                onClick={() => setActivePage("archivedRecords")}
              />
            ) : null}
          </Stack>
        ) : null}

        {testingDeviceVisible ? (
          <SidebarGroup
            icon={<BuildCircleRoundedIcon fontSize="small" />}
            label="Testing Device"
            open={testingDeviceOpen}
            onClick={() => setTestingDeviceOpen((current) => !current)}
          />
        ) : null}

        {testingDeviceOpen && testingDeviceVisible ? (
          <Stack>
            {hasAccess("newRepairDevice") ? (
              <SidebarItem
                active={visiblePage === "newRepairDevice"}
                child
                icon={<BuildCircleRoundedIcon fontSize="small" />}
                label="New Repair Device"
                onClick={() => setActivePage("newRepairDevice")}
              />
            ) : null}
            {hasAccess("ongoingSupportTesting") ? (
              <SidebarItem
                active={visiblePage === "ongoingSupportTesting" || (visiblePage === "repairDeviceCheck" && repairBackPage === "ongoingSupportTesting")}
                child
                icon={<AssessmentRoundedIcon fontSize="small" />}
                label="Ongoing Support Testing"
                onClick={() => setActivePage("ongoingSupportTesting")}
              />
            ) : null}
            {hasAccess("ongoingSeniorTesting") ? (
              <SidebarItem
                active={visiblePage === "ongoingSeniorTesting" || (visiblePage === "repairDeviceCheck" && repairBackPage === "ongoingSeniorTesting")}
                child
                icon={<AssessmentRoundedIcon fontSize="small" />}
                label="Ongoing Senior Testing"
                onClick={() => setActivePage("ongoingSeniorTesting")}
              />
            ) : null}
            {hasAccess("myRepairDevice") ? (
              <SidebarItem
                active={visiblePage === "myRepairDevice" || (visiblePage === "repairDeviceCheck" && repairBackPage === "myRepairDevice")}
                child
                icon={<AssessmentRoundedIcon fontSize="small" />}
                label="My Repair/Testing Device"
                onClick={() => setActivePage("myRepairDevice")}
              />
            ) : null}
            {hasAccess("allRepairDevice") ? (
              <SidebarItem
                active={visiblePage === "allRepairDevice" || (visiblePage === "repairDeviceCheck" && repairBackPage === "allRepairDevice")}
                child
                icon={<AssessmentRoundedIcon fontSize="small" />}
                label="All Repair Device"
                onClick={() => setActivePage("allRepairDevice")}
              />
            ) : null}
            {hasAccess("doneRepairDevice") ? (
              <SidebarItem
                active={visiblePage === "doneRepairDevice"}
                child
                icon={<ArchiveRoundedIcon fontSize="small" />}
                label="Done Repair Device"
                onClick={() => setActivePage("doneRepairDevice")}
              />
            ) : null}
          </Stack>
        ) : null}

        {reportsVisible ? (
          <SidebarGroup
            icon={<AssessmentRoundedIcon fontSize="small" />}
            label="Reports"
            open={reportsOpen}
            onClick={() => setReportsOpen((current) => !current)}
          />
        ) : null}

        {reportsOpen && reportsVisible ? (
          <Stack>
            {hasAccess("reportsDeviceInventory") ? (
              <SidebarItem
                active={visiblePage === "reportsDeviceInventory"}
                child
                icon={<Inventory2RoundedIcon fontSize="small" />}
                label="Device Inventory"
                onClick={() => setActivePage("reportsDeviceInventory")}
              />
            ) : null}
            {hasAccess("reportsRepairManagement") ? (
              <SidebarItem
                active={visiblePage === "reportsRepairManagement"}
                child
                icon={<AssessmentRoundedIcon fontSize="small" />}
                label="Repair Management"
                onClick={() => setActivePage("reportsRepairManagement")}
              />
            ) : null}
            {hasAccess("reportsAdministration") ? (
              <SidebarItem
                active={visiblePage === "reportsAdministration"}
                child
                icon={<AdminPanelSettingsRoundedIcon fontSize="small" />}
                label="Audit Trail"
                onClick={() => setActivePage("reportsAdministration")}
              />
            ) : null}
          </Stack>
        ) : null}

        {dataMigrationVisible ? (
          <SidebarGroup
            icon={<StorageRoundedIcon fontSize="small" />}
            label="Data Migration"
            open={dataMigrationOpen}
            onClick={() => setDataMigrationOpen((current) => !current)}
          />
        ) : null}

        {dataMigrationOpen && dataMigrationVisible ? (
          <Stack>
            {hasAccess("dataMigrationDeviceInventory") ? (
              <SidebarItem
                active={visiblePage === "dataMigrationDeviceInventory"}
                child
                icon={<Inventory2RoundedIcon fontSize="small" />}
                label="Device Inventory"
                onClick={() => setActivePage("dataMigrationDeviceInventory")}
              />
            ) : null}
            {hasAccess("dataMigrationRepairManagement") ? (
              <SidebarItem
                active={visiblePage === "dataMigrationRepairManagement"}
                child
                icon={<Inventory2RoundedIcon fontSize="small" />}
                label="Repair Management"
                onClick={() => setActivePage("dataMigrationRepairManagement")}
              />
            ) : null}
          </Stack>
        ) : null}

        {administrationVisible ? (
          <SidebarGroup
            icon={<AdminPanelSettingsRoundedIcon fontSize="small" />}
            label="Administration"
            open={administrationOpen}
            onClick={() => setAdministrationOpen((current) => !current)}
          />
        ) : null}

        {administrationOpen && administrationVisible ? (
          <Stack>
            {hasAccess("users") ? (
              <SidebarItem
                active={visiblePage === "users"}
                child
                icon={<PersonRoundedIcon fontSize="small" />}
                label="User"
                onClick={() => setActivePage("users")}
              />
            ) : null}
            {hasAccess("ConfigurationsPage") ? (
              <SidebarItem
                active={visiblePage === "ConfigurationsPage"}
                child
                icon={<SettingsRoundedIcon fontSize="small" />}
                label="Configurations"
                onClick={() => setActivePage("ConfigurationsPage")}
              />
            ) : null}
            {hasAccess("emailConfiguration") ? (
              <SidebarItem
                active={visiblePage === "emailConfiguration"}
                child
                icon={<MarkEmailReadRoundedIcon fontSize="small" />}
                label="Email Configuration"
                onClick={() => setActivePage("emailConfiguration")}
              />
            ) : null}
            
            {hasAccess("auditTrail") ? (
              <SidebarItem
                active={visiblePage === "auditTrail"}
                child
                icon={<HistoryRoundedIcon fontSize="small" />}
                label="Audit Trail"
                onClick={() => setActivePage("auditTrail")}
              />
            ) : null}

            {hasAccess("releaseNotes") ? (
              <SidebarItem
                active={visiblePage === "releaseNotes"}
                child
                icon={<ArticleRoundedIcon fontSize="small" />}
                label="Release Notes"
                onClick={() => setActivePage("releaseNotes")}
              />
            ) : null}
          </Stack>
        ) : null}
        </Box>

        <Box className="sidebar-user-panel" sx={{ mt: "auto", p: 1.25 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", mb: 1.25 }} />
          <Typography className="sidebar-label" variant="caption" sx={{ color: "#9fb0bf", display: "block", mb: 0.5 }}>
            Signed in as
          </Typography>
          <Typography className="sidebar-label" variant="body2" fontWeight={800} noWrap sx={{ color: "#ffffff", mb: 1 }}>
            {currentUserDisplayName}
          </Typography>
          <Button
            className="sidebar-logout-button"
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
            <span className="sidebar-label">Logout</span>
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, ml: { md: sidebarPinned ? "245px" : "64px" }, minHeight: "100svh", minWidth: 0, overflow: "visible", transition: "margin-left 160ms ease" }}>
        <Box sx={{ minHeight: "100%", minWidth: 0 }}>
        {/* Render only the selected module so inactive pages do not keep unnecessary UI state mounted. */}
        {visiblePage === "dashboard" && hasAccess("dashboard") ? (
          <DashboardPage mode={themeMode} onChangeMode={updateThemeMode} onToggleMode={toggleThemeMode} userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} />
        ) : null}
        {visiblePage === "deviceInventoryRecords" && hasAccess("deviceInventoryRecords") ? <DeviceManagementPage /> : null}
        {visiblePage === "ongoingTesting" && hasAccess("ongoingTesting") ? <OngoingTestingPage /> : null}
        {visiblePage === "deviceMonitoringSpareParts" && hasAccess("deviceMonitoringSpareParts") ? <DeviceMonitoringSparePartsPage /> : null}
        {visiblePage === "dataMigrationDeviceInventory" && hasAccess("dataMigrationDeviceInventory") ? <DataMigrationPage mode="deviceInventory" /> : null}
        {visiblePage === "dataMigrationRepairManagement" && hasAccess("dataMigrationRepairManagement") ? <DataMigrationPage mode="repairManagement" /> : null}
        {visiblePage === "reportsDeviceInventory" && hasAccess("reportsDeviceInventory") ? <ReportsPage mode="deviceInventory" /> : null}
        {visiblePage === "reportsRepairManagement" && hasAccess("reportsRepairManagement") ? <ReportsPage mode="repairManagement" /> : null}
        {visiblePage === "reportsAdministration" && hasAccess("reportsAdministration") ? <ReportsPage mode="administration" /> : null}
        {visiblePage === "ConfigurationsPage" && hasAccess("ConfigurationsPage") ? <ConfigurationsPage /> : null}
        {visiblePage === "emailConfiguration" && hasAccess("emailConfiguration") ? <EmailConfigurationPage /> : null}
        {visiblePage === "archivedRecords" && hasAccess("archivedRecords") ? <ArchivedRecordsPage /> : null}
        {visiblePage === "auditTrail" && hasAccess("auditTrail") ? <AuditTrailPage /> : null}
        {visiblePage === "newRepairDevice" && hasAccess("newRepairDevice") ? <RepairDeviceWorkflowPage mode="new" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("newRepairDevice"); setActivePage("repairDeviceCheck"); }} /> : null}
        {visiblePage === "myRepairDevice" && hasAccess("myRepairDevice") ? <RepairDeviceWorkflowPage mode="my" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = false) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("myRepairDevice"); setActivePage("repairDeviceCheck"); }} /> : null}
        {visiblePage === "allRepairDevice" && hasAccess("allRepairDevice") ? <RepairDeviceWorkflowPage mode="all" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("allRepairDevice"); setActivePage("repairDeviceCheck"); }} /> : null}
        {visiblePage === "ongoingSupportTesting" && hasAccess("ongoingSupportTesting") ? <RepairDeviceWorkflowPage mode="support" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("ongoingSupportTesting"); setActivePage("repairDeviceCheck"); }} /> : null}
        {visiblePage === "ongoingSeniorTesting" && hasAccess("ongoingSeniorTesting") ? <RepairDeviceWorkflowPage mode="senior" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("ongoingSeniorTesting"); setActivePage("repairDeviceCheck"); }} /> : null}
        {visiblePage === "doneRepairDevice" && hasAccess("doneRepairDevice") ? <RepairDeviceWorkflowPage mode="done" userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onOpenRecord={(id, readOnly = true) => { setActiveRepairRecordId(id); setRepairReadOnly(readOnly); setRepairBackPage("doneRepairDevice"); setActivePage("repairDeviceCheck"); }} /> : null}
        {visiblePage === "repairDeviceCheck" && activeRepairRecordId ? <RepairDeviceCheckPage readOnly={repairReadOnly} recordId={activeRepairRecordId} userDisplayName={currentUserDisplayName} userEmail={currentUserEmail} onBack={() => setActivePage(repairBackPage)} /> : null}
        {visiblePage === "users" && hasAccess("users") ? <UserManagementPage currentUserEmail={currentUserEmail} onCurrentUserUpdated={(updatedUser) => { setCurrentAppUser(updatedUser); if (updatedUser.is_active === false) handleLogout(); }} /> : null}
        {visiblePage === "releaseNotes" && hasAccess("releaseNotes") ? (
          <ReleaseNotesPage
            canCreateReleaseNotes={hasAccess("releaseNotesCreate")}
            userDisplayName={currentUserDisplayName}
            userEmail={currentUserEmail}
          />
        ) : null}
        {visiblePage === "testing" ? <DeviceTestingPage /> : null}
        </Box>
      </Box>
      </Box>
      </Box>
      )}
    </ThemeProvider>
  );
}

function SidebarItem({ active, child = false, icon, label, onClick }) {
  return (
    <Box
      className={`sidebar-nav-item ${active ? "is-active" : ""}`}
      onClick={onClick}
      sx={{
        alignItems: "center",
        bgcolor: active ? "rgba(32,208,196,0.10)" : "transparent",
        border: "1px solid transparent",
        borderLeft: active ? "2px solid #20d0c4" : "2px solid transparent",
        borderRadius: 0,
        color: active ? "#ffffff" : "#dbe7ef",
        cursor: "pointer",
        display: "grid",
        gap: 0.75,
        gridTemplateColumns: "22px 1fr",
        minHeight: 40,
        mb: 0.4,
        pl: child ? 3 : 1.25,
        pr: 1,
        py: 0.6,
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.07)",
          color: "#ffffff",
        },
      }}
    >
      {icon}
      <Typography className="sidebar-label" variant="body2" fontWeight={active ? 800 : 600} noWrap sx={{ color: "inherit !important", fontSize: 12.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

function SidebarGroup({ icon, label, onClick, open }) {
  return (
    <Box
      className={`sidebar-nav-group ${open ? "is-open" : ""}`}
      onClick={onClick}
      sx={{
        alignItems: "center",
        bgcolor: open ? "rgba(32,208,196,0.08)" : "transparent",
        border: "1px solid transparent",
        borderRadius: 0,
        color: "#20d0c4",
        cursor: "pointer",
        display: "grid",
        gap: 0.75,
        gridTemplateColumns: "22px 22px 1fr",
        minHeight: 40,
        mb: 0.4,
        pl: 1.25,
        pr: 1,
        py: 0.6,
      }}
    >
      <Box className="sidebar-chevron">
        {open ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
      </Box>
      {icon}
      <Typography className="sidebar-label" variant="body2" fontWeight={800} noWrap sx={{ color: "inherit !important", fontSize: 12.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

function withTimeout(promise, message, timeoutMs = 8000) {
  // Guard startup Supabase calls so a slow first request cannot keep the app on the loading screen forever.
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function normalizeAppUser(profile, fallbackProfile) {
  // Convert nullable database values into the shape the app shell expects.
  return {
    access_rights: normalizeAccessRights(profile?.access_rights || fallbackProfile?.access_rights),
    display_name: profile?.display_name || fallbackProfile?.display_name || "",
    email: profile?.email || fallbackProfile?.email || "",
    id: profile?.id || fallbackProfile?.id || "",
    is_active: profile?.is_active !== false,
  };
}

async function loadAppUserProfile(user, fallbackEmail = "") {
  const email = user?.email || fallbackEmail || "";
  const fallbackProfile = {
    access_rights: DEFAULT_ACCESS_RIGHTS,
    display_name: getUserDisplayName(user, email),
    email,
    id: user?.id || email,
    is_active: true,
  };

  if (!supabase || !user?.id) {
    return fallbackProfile;
  }

  // Read the public profile used by Administration > User for status and rights.
  const { data, error } = await supabase
    .from("app_users")
    .select("id, display_name, email, is_active, access_rights")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Existing deployments may not have the Administration tables yet; keep login usable until SQL is installed.
    console.warn("App user profile unavailable:", error.message);
    return fallbackProfile;
  }

  if (data) {
    return normalizeAppUser(data, fallbackProfile);
  }

  // First login creates a manageable profile so admins can edit display name and access rights later.
  const { data: inserted, error: insertError } = await supabase
    .from("app_users")
    .upsert(
      {
        access_rights: DEFAULT_ACCESS_RIGHTS,
        display_name: fallbackProfile.display_name,
        email,
        id: user.id,
        is_active: true,
      },
      { onConflict: "id" }
    )
    .select("id, display_name, email, is_active, access_rights")
    .single();

  if (insertError) {
    console.warn("App user profile insert failed:", insertError.message);
    return fallbackProfile;
  }

  return normalizeAppUser(inserted, fallbackProfile);
}

function getFirstAccessiblePage(accessRights) {
  // Keep a user on the first visible page if an admin removes access to the current module.
  const normalizedRights = normalizeAccessRights(accessRights);
  const orderedPages = [
    "dashboard",
    "deviceInventoryRecords",
    "ongoingTesting",
    "archivedRecords",
    "auditTrail",
    "deviceMonitoringSpareParts",
    "dataMigrationDeviceInventory",
    "dataMigrationRepairManagement",
    "reportsDeviceInventory",
    "reportsRepairManagement",
    "reportsAdministration",
    "newRepairDevice",
    "ongoingSupportTesting",
    "ongoingSeniorTesting",
    "myRepairDevice",
    "allRepairDevice",
    "doneRepairDevice",
    "users",
    "ConfigurationsPage",
    "releaseNotes",
  ];
  return orderedPages.find((pageKey) => normalizedRights[pageKey] !== false) || "dashboard";
}

export default App;
