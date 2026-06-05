import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useState } from "react";
import "./App.css";
import DeviceTestingPage from "../pages/DeviceTestingPage";
import InventoryPage from "../pages/InventoryPage";
import ClientStatusPage from "../pages/ClientStatusPage";

function App() {
  const [activePage, setActivePage] = useState("inventory");

  return (
    <Box sx={{ display: "flex", minHeight: "100svh", bgcolor: "#f6f8fb" }}>
      <Box
        component="aside"
        sx={{
          bgcolor: "#ffffff",
          borderRight: "1px solid #dde5ef",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          gap: 2,
          p: 2,
          position: "sticky",
          top: 0,
          width: 292,
          height: "100svh",
          overflowY: "auto",
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={900}>
            Device Management
          </Typography>
        </Box>

        <List disablePadding sx={{ display: "grid", gap: 0.75 }}>
          <SidebarNavItem
            active={activePage === "inventory"}
            icon={<Inventory2RoundedIcon fontSize="small" />}
            label="Inventory"
            onClick={() => setActivePage("inventory")}
          />
          <SidebarNavItem
            active={activePage === "testing"}
            icon={<AssignmentTurnedInRoundedIcon fontSize="small" />}
            label="Testing Report"
            onClick={() => setActivePage("testing")}
          />
          <SidebarNavItem
            active={activePage === "configurations"}
            icon={<SettingsRoundedIcon fontSize="small" />}
            label="Configurations"
            onClick={() => setActivePage("configurations")}
          />
        </List>


      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {activePage === "inventory" ? (
          <InventoryPage />
        ) : activePage === "testing" ? (
          <DeviceTestingPage />
        ) : (
          <ClientStatusPage />
        )}
      </Box>
    </Box>
  );
}

function SidebarNavItem({ active, icon, label, onClick }) {
  return (
    <ListItemButton
      onClick={onClick}
      selected={active}
      sx={{
        borderRadius: 1.5,
        gap: 1,
        "&.Mui-selected": {
          bgcolor: "#e8f2ff",
          color: "#1f5f99",
          fontWeight: 800,
        },
      }}
    >
      {icon}
      <ListItemText
        primary={label}
        primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 800 : 700 }}
      />
    </ListItemButton>
  );
}

export default App;
