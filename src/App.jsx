import {
  Box,
  Stack,
  Typography,
} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useState } from "react";
import "./App.css";
import ClientStatusPage from "../pages/ClientStatusPage";
import DeviceManagementPage from "../pages/InventoryRecordsPage";
import DeviceTestingPage from "../pages/DeviceTestingPage";
import OngoingTestingPage from "../pages/OngoingTestingPage";

function App() {
  const [activePage, setActivePage] = useState("deviceInventoryRecords");
  const [deviceInventoryOpen, setDeviceInventoryOpen] = useState(true);

  return (
    <Box sx={{ display: "flex", minHeight: "100svh", bgcolor: "#f6f8fb" }}>
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
              active={activePage === "clientStatusSetup"}
              child
              icon={<SettingsRoundedIcon fontSize="small" />}
              label="Client & Status Setup"
              onClick={() => setActivePage("clientStatusSetup")}
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
        {activePage === "deviceInventoryRecords" ? <DeviceManagementPage /> : null}
        {activePage === "ongoingTesting" ? <OngoingTestingPage /> : null}
        {activePage === "clientStatusSetup" ? <ClientStatusPage /> : null}
        {activePage === "testing" ? <DeviceTestingPage /> : null}
        {activePage === "dashboard" ? (
          <Box sx={{ p: 4 }}>
            <Typography variant="h5" component="h1" fontWeight={900}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Select a module from the sidebar.
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
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
