import { Chip } from "@mui/material";
import { getWorkflowStatusColor, getWorkflowStatusDisplayName } from "../src/lib/repairWorkflow.js";

export function WorkflowStatusChip({ value }) {
  // Keep status color consistent in every repair workflow module.
  const color = getWorkflowStatusColor(value);
  // Convert legacy workflow stage names to the current user-facing labels.
  const label = getWorkflowStatusDisplayName(value);
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: `${color}22`,
        color,
        fontSize: 11,
        fontWeight: 400,
        height: 22,
        "& .MuiChip-label": {
          fontSize: "11px !important",
          fontWeight: 400,
          px: 1,
        },
      }}
    />
  );
}

export function PackageChip({ value }) {
  // Use the same package style colors as inventory/testing tables.
  if (!value) return <>-</>;
  const color = value === "With Box" || value === "Box" ? "#bae6fd" : value === "Plastic" ? "#fde68a" : "#fecaca";
  return (
    <Chip
      label={value}
      size="small"
      sx={{
        bgcolor: color,
        fontSize: 11,
        fontWeight: 400,
        height: 22,
        "& .MuiChip-label": {
          fontSize: "11px !important",
          fontWeight: 400,
          px: 1,
        },
      }}
    />
  );
}
