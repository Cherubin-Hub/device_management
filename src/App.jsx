import {
  Box,
  CssBaseline,
  Stack,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useMemo, useState } from "react";
import "./App.css";
import ConfigurationsPage from "../pages/ConfigurationsPage";
import DashboardPage from "../pages/DashboardPage";
import DeviceManagementPage from "../pages/InventoryRecordsPage";
import DeviceTestingPage from "../pages/DeviceTestingPage";
import OngoingTestingPage from "../pages/OngoingTestingPage";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [deviceInventoryOpen, setDeviceInventoryOpen] = useState(true);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("endivio-theme") || "light");
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
      localStorage.setItem("endivio-theme", next);
      return next;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", minHeight: "100svh", bgcolor: "background.default" }}>
      <Box
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
          </Stack>
        ) : null}

        {/* <SidebarItem
          active={activePage === "testing"}
          icon={<AssessmentRoundedIcon fontSize="small" />}
          label="Testing Report"
          onClick={() => setActivePage("testing")}
        /> */}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {activePage === "dashboard" ? (
          <DashboardPage mode={themeMode} onToggleMode={toggleThemeMode} />
        ) : null}
        {activePage === "deviceInventoryRecords" ? <DeviceManagementPage /> : null}
        {activePage === "ongoingTesting" ? <OngoingTestingPage /> : null}
        {activePage === "ConfigurationsPage" ? <ConfigurationsPage /> : null}
        {activePage === "testing" ? <DeviceTestingPage /> : null}
      </Box>
      </Box>
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
      <Typography variant="body2" fontWeight={active ? 900 : 700} noWrap>
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
      <Typography variant="body2" fontWeight={800} noWrap>
        {label}
      </Typography>
    </Box>
  );
}

export default App;
