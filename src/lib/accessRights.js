// Central list of modules used by Administration > User access-right checkboxes and sidebar visibility.
export const ACCESS_RIGHT_OPTIONS = [
  { key: "dashboard", label: "Dashboard", group: "General" },
  { key: "deviceInventoryRecords", label: "Inventory Records", group: "Device Inventory" },
  { key: "ongoingTesting", label: "Ongoing Testing", group: "Device Inventory" },
  { key: "ConfigurationsPage", label: "Configurations", group: "Device Inventory" },
  { key: "archivedRecords", label: "Archived Records", group: "Device Inventory" },
  { key: "auditTrail", label: "Audit Trail", group: "Device Inventory" },
  { key: "newRepairDevice", label: "New Repair Device", group: "Testing Device" },
  { key: "ongoingSupportTesting", label: "Ongoing Support Testing", group: "Testing Device" },
  { key: "ongoingSeniorTesting", label: "Ongoing Senior Testing", group: "Testing Device" },
  { key: "myRepairDevice", label: "My Repair/Testing Device", group: "Testing Device" },
  { key: "allRepairDevice", label: "All Repair Device", group: "Testing Device" },
  { key: "doneRepairDevice", label: "Done Repair Device", group: "Testing Device" },
  { key: "users", label: "User", group: "Administration" },
  { key: "releaseNotesCreate", label: "Create Release Notes", group: "Administration", defaultAccess: false },
  { key: "releaseNotes", label: "Release Notes", group: "Administration" },
];

// Default access keeps existing users able to use the app until an admin limits their rights.
export const DEFAULT_ACCESS_RIGHTS = ACCESS_RIGHT_OPTIONS.reduce((rights, option) => {
  rights[option.key] = option.defaultAccess !== false;
  return rights;
}, {});

// Normalize database JSON so missing module keys default to visible instead of locking users out.
export function normalizeAccessRights(value) {
  return {
    ...DEFAULT_ACCESS_RIGHTS,
    ...(value && typeof value === "object" ? value : {}),
  };
}
