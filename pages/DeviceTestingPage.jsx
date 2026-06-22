// Device Testing is a small manual testing surface kept separate from the repair workflow modules.
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import DeviceInfo from "../components/DeviceInfo";
import TestChecklist from "../components/TestChecklist";
import ApprovalSection from "../components/ApprovalSection";
import { tests } from "../components/testScripts";
import { supabase } from "../src/lib/supabase.js";

const initialDeviceInfo = {
  // Default empty values for the device information form.
  cstNumber: "",
  clientId: "",
  clientName: "",
  clientCode: "",
  arrivalDate: "",
  deviceSerialNumber: "",
  deviceType: "",
  algorithm: "",
  pinWidth: "",
  previousPinWidth: "",
  remarks: "",
};

const initialApproval = {
  // Default empty values for the approval/sign-off form.
  testedBy: "",
  checkedBySenior: "",
  checkedBySupervisor: "",
  additionalComments: "",
};

export default function DeviceTestingPage() {
  // Store all device information entered in the left panel.
  const [deviceInfo, setDeviceInfo] = useState(initialDeviceInfo);
  // Store active clients loaded from Supabase for the client dropdown.
  const [clients, setClients] = useState([]);
  // Create one result row for every test script in the checklist.
  const [testResults, setTestResults] = useState(
    tests.map(() => ({
      status: "",
      remarks: "",
    }))
  );
  // Store approval names and comments entered in the right panel.
  const [approval, setApproval] = useState(initialApproval);

  const completedCount = useMemo(
    // Count tests marked Yes so the PDF can show the pass summary.
    () => testResults.filter((result) => result.status === "Yes").length,
    [testResults]
  );

  useEffect(() => {
    let ignore = false;

    async function loadClients() {
      if (!supabase) {
        return;
      }

      // Load active clients so the report can capture both client name and client code.
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, client_code")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (!ignore && !error) {
        setClients(data || []);
      }
    }

    loadClients();

    return () => {
      ignore = true;
    };
  }, []);

  const handleDeviceInfoChange = (field, value) => {
    // Update one device information field while keeping the rest of the form intact.
    setDeviceInfo((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleClientChange = (client) => {
    // Store client id, display name, and code together when a client is selected.
    setDeviceInfo((current) => ({
      ...current,
      clientId: client?.id || "",
      clientName: client?.name || "",
      clientCode: client?.client_code || "",
    }));
  };

  const handleApprovalChange = (field, value) => {
    // Update one approval field while keeping other sign-off values intact.
    setApproval((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleDownloadPdf = () => {
    // Create a new PDF report using A4 portrait layout.
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const generatedAt = new Date().toLocaleString();
    const serialNumber = deviceInfo.deviceSerialNumber.trim();
    // Use the device serial number as the PDF filename when available.
    const fileName = `${sanitizeFileName(serialNumber) || "device-testing-report"}.pdf`;

    // Add PDF metadata so the generated file is easier to identify.
    doc.setProperties({
      title: `Device Testing Report - ${serialNumber || "Untitled"}`,
      subject: "Device testing report",
    });

    // Render the PDF title and generation summary.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Device Testing Report", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Generated: ${generatedAt}`, 14, 25);
    doc.text(`Status: ${completedCount}/${tests.length} tests passed`, 14, 31);

    // Render device information as the first table in the PDF.
    autoTable(doc, {
      startY: 39,
      head: [["Device Information", ""]],
      body: [
        ["CST Number", valueOrBlank(deviceInfo.cstNumber)],
        ["Client Name", valueOrBlank(deviceInfo.clientName)],
        ["Client Code", valueOrBlank(deviceInfo.clientCode)],
        ["Arrival Date", valueOrBlank(deviceInfo.arrivalDate)],
        ["Device Serial Number", valueOrBlank(deviceInfo.deviceSerialNumber)],
        ["Device Type", valueOrBlank(deviceInfo.deviceType)],
        ["Algorithm", valueOrBlank(deviceInfo.algorithm)],
        ["Pin Width", valueOrBlank(deviceInfo.pinWidth)],
        ["Previous Pin Width", valueOrBlank(deviceInfo.previousPinWidth)],
        ["Remarks", valueOrBlank(deviceInfo.remarks)],
      ],
      theme: "grid",
      headStyles: { fillColor: [31, 95, 153], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 52 },
        1: { cellWidth: 130 },
      },
    });

    // Render all checklist rows so the PDF captures every encoded test result.
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["#", "Test Script", "Status", "Remarks"]],
      body: tests.map((test, index) => [
        index + 1,
        test,
        valueOrBlank(testResults[index].status),
        valueOrBlank(testResults[index].remarks),
      ]),
      theme: "grid",
      headStyles: { fillColor: [40, 122, 69], textColor: 255 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { cellWidth: 82 },
        2: { halign: "center", cellWidth: 24 },
        3: { cellWidth: 64 },
      },
    });

    // Render approval/sign-off information as the final report section.
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Approval", ""]],
      body: [
        ["Repair By", valueOrBlank(approval.testedBy)],
        ["Tested By", valueOrBlank(approval.checkedBySenior)],
        ["Senior Tested By", valueOrBlank(approval.checkedBySupervisor)],
        ["Additional Comments", valueOrBlank(approval.additionalComments)],
      ],
      theme: "grid",
      headStyles: { fillColor: [152, 99, 27], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 52 },
        1: { cellWidth: 130 },
      },
    });

    const pageCount = doc.getNumberOfPages();
    // Add page numbers after tables are created because the final page count is known.
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Page ${page} of ${pageCount}`, 180, 290);
    }

    // Download the PDF directly in the browser.
    doc.save(fileName);
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        bgcolor: "background.default",
        color: "text.primary",
        px: { xs: 2, md: 4 },
        py: { xs: 2.5, md: 4 },
        textAlign: "left",
      }}
    >
      <Stack
        className="module-page-header"
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box className="module-page-copy">
          <Chip
            label="JS3000+ Device Testing"
            size="small"
            sx={{
              mb: 1,
              bgcolor: "#e8f2ff",
              color: "#1f5f99",
              fontWeight: 700,
            }}
          />
          <Typography className="module-page-title" variant="h4" component="h1" fontWeight={800}>
            Device Testing Report
          </Typography>
          <Typography className="module-page-description" variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
            Capture device details, validate each test, and collect final review in one place.
          </Typography>
        </Box>

      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(280px, 0.85fr) minmax(420px, 1.5fr) minmax(280px, 0.85fr)",
          },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Paper elevation={0} sx={panelSx}>
          <DeviceInfo
            clients={clients}
            deviceInfo={deviceInfo}
            onChange={handleDeviceInfoChange}
            onClientChange={handleClientChange}
          />
        </Paper>

        <Stack spacing={2}>
          <Paper elevation={0} sx={panelSx}>
            <TestChecklist
              results={testResults}
              onResultsChange={setTestResults}
            />
          </Paper>

          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            justifyContent="center"
          >
            {/* <Button variant="contained" startIcon={<SaveRoundedIcon />}>
              Save
            </Button>
            <Button variant="outlined" startIcon={<PrintRoundedIcon />}>
              Print
            </Button> */}
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleDownloadPdf}
            >
              PDF
            </Button>
          </Stack>
        </Stack>

        <Paper elevation={0} sx={panelSx}>
          <ApprovalSection
            approval={approval}
            onChange={handleApprovalChange}
          />
        </Paper>
      </Box>
    </Box>
  );
}

const panelSx = {
  // Shared panel style keeps the three report sections visually consistent.
  border: "1px solid #dde5ef",
  borderRadius: 2,
  boxShadow: "0 16px 40px rgba(21, 34, 50, 0.08)",
  p: { xs: 2, md: 2.5 },
};

const valueOrBlank = (value) => {
  // PDF tables use a dash when a field is empty so blank values remain visible.
  const text = String(value || "").trim();
  return text || "-";
};

const sanitizeFileName = (value) =>
  // Remove characters that Windows and browsers do not allow in downloaded filenames.
  value
    .trim()
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .slice(0, 80);
