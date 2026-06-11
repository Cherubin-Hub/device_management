export function getWorkflowStatusColor(value) {
  // Map each workflow stage to a professional status color.
  if (value === "Repair By" || value === "For Testing") return "#2563eb";
  // Purple means the task is in the tested stage.
  if (value === "Tested By" || value === "Test By" || value === "Checked By (Senior)") return "#7c3aed";
  // Teal means the task is in the senior tested stage.
  if (value === "Senior Tested By" || value === "Senior Test By" || value === "Checked By (Supervisor)") return "#0f766e";
  // Green means the repair workflow is fully completed.
  if (value === "Done Repair Device") return "#16a34a";
  // Gray is the safe fallback for imported or unknown statuses.
  return "#64748b";
}

export function getWorkflowStatusDisplayName(value) {
  // Show the new user-facing stage name for older rows saved with the previous label.
  if (value === "For Testing") return "Repair By";
  // Show Tested By for older intermediate labels.
  if (value === "Test By" || value === "Checked By (Senior)") return "Tested By";
  // Show Senior Tested By for older final-review labels.
  if (value === "Senior Test By" || value === "Checked By (Supervisor)") return "Senior Tested By";
  // Keep current labels unchanged.
  return value || "-";
}

export function getRecordLabel(record) {
  // Prefer serial number because it is the strongest device identifier.
  return record?.sn_number || record?.ticket_number || record?.cst_number || record?.client_code || "Untitled repair";
}

export function getUserDisplayName(user, fallbackEmail = "") {
  // Prefer Supabase profile metadata when the login provider supplies a full name.
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  // Use the user's email from Supabase Auth when metadata name is not available.
  const email = user?.email || fallbackEmail || "";
  // Use the part before @ as a readable fallback instead of showing a blank name.
  const emailName = email.includes("@") ? email.split("@")[0] : email;
  // Return the best available display name.
  return metadataName || emailName || "User";
}
