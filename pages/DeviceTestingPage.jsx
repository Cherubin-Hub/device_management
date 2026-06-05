import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import DeviceInfo from "../components/DeviceInfo";
import TestChecklist from "../components/TestChecklist";
import ApprovalSection from "../components/ApprovalSection";
import { tests } from "../components/testScripts";

const initialDeviceInfo = {
  cstNumber: "",
  clientName: "",
  arrivalDate: "",
  deviceSerialNumber: "",
  deviceType: "",
  algorithm: "",
  pinWidth: "",
  previousPinWidth: "",
  remarks: "",
};

const initialApproval = {
  testedBy: "",
  checkedBySenior: "",
  checkedBySupervisor: "",
  additionalComments: "",
};

export default function DeviceTestingPage() {
  const [deviceInfo, setDeviceInfo] = useState(initialDeviceInfo);
  const [testResults, setTestResults] = useState(
    tests.map(() => ({
      status: "",
      remarks: "",
    }))
  );
  const [approval, setApproval] = useState(initialApproval);

  const completedCount = useMemo(
    () => testResults.filter((result) => result.status === "Yes").length,
    [testResults]
  );

  const handleDeviceInfoChange = (field, value) => {
    setDeviceInfo((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleApprovalChange = (field, value) => {
    setApproval((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const generatedAt = new Date().toLocaleString();
    const serialNumber = deviceInfo.deviceSerialNumber.trim();
    const fileName = `${sanitizeFileName(serialNumber) || "device-testing-report"}.pdf`;

    doc.setProperties({
      title: `Device Testing Report - ${serialNumber || "Untitled"}`,
      subject: "Device testing report",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Device Testing Report", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Generated: ${generatedAt}`, 14, 25);
    doc.text(`Status: ${completedCount}/${tests.length} tests passed`, 14, 31);

    autoTable(doc, {
      startY: 39,
      head: [["Device Information", ""]],
      body: [
        ["CST Number", valueOrBlank(deviceInfo.cstNumber)],
        ["Client Name", valueOrBlank(deviceInfo.clientName)],
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

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Approval", ""]],
      body: [
        ["Tested By", valueOrBlank(approval.testedBy)],
        ["Checked By (Senior)", valueOrBlank(approval.checkedBySenior)],
        ["Checked By (Supervisor)", valueOrBlank(approval.checkedBySupervisor)],
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
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Page ${page} of ${pageCount}`, 180, 290);
    }

    doc.save(fileName);
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        bgcolor: "#f6f8fb",
        color: "#172033",
        px: { xs: 2, md: 4 },
        py: { xs: 2.5, md: 4 },
        textAlign: "left",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
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
          <Typography variant="h4" component="h1" fontWeight={800}>
            Device Testing Report
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
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
            deviceInfo={deviceInfo}
            onChange={handleDeviceInfoChange}
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
  border: "1px solid #dde5ef",
  borderRadius: 2,
  boxShadow: "0 16px 40px rgba(21, 34, 50, 0.08)",
  p: { xs: 2, md: 2.5 },
};

const valueOrBlank = (value) => {
  const text = String(value || "").trim();
  return text || "-";
};

const sanitizeFileName = (value) =>
  value
    .trim()
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .slice(0, 80);
