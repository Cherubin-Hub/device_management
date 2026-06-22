export const REPAIR_RECORD_FIELDS = [
  { key: "company", label: "Company", placeholder: "#COMPANY" },
  { key: "clientCode", label: "Client Code", placeholder: "#CLIENT_CODE" },
  { key: "raisedBy", label: "Raised by", placeholder: "#RAISED_BY" },
  { key: "dateReceived", label: "Date Received", placeholder: "#DATE_RECEIVED", type: "date" },
  { key: "packageStyle", label: "Package Style", placeholder: "#PACKAGE_STYLE" },
  { key: "cstNumber", label: "CST Number", placeholder: "#CST_NUMBER", aliases: ["#CST"] },
  { key: "ticketNumber", label: "Ticket Number", placeholder: "#TICKET_NUMBER", aliases: ["#TICKET"] },
  { key: "snNumber", label: "SN Number", placeholder: "#SN_NUMBER", aliases: ["#SN"] },
  { key: "deviceType", label: "Device Type", placeholder: "#DEVICE_TYPE" },
  { key: "withAdapter", label: "With Adapter", placeholder: "#WITH_ADAPTER" },
  { key: "startRepairingSupport", label: "Start Repairing Support", placeholder: "#START_REPAIRING_SUPPORT", type: "date" },
  { key: "endDateSupport", label: "End Date Support", placeholder: "#END_DATE_SUPPORT", type: "date" },
  { key: "startQa", label: "Start QA", placeholder: "#START_QA", type: "date" },
  { key: "endDateQa", label: "End Date QA", placeholder: "#END_DATE_QA", type: "date" },
  { key: "statusName", label: "Status", placeholder: "#STATUS" },
  { key: "dateDelivered", label: "Date Delivered", placeholder: "#DATE_DELIVERED", type: "date" },
  { key: "giveTo", label: "Give to", placeholder: "#GIVE_TO" },
  { key: "remarks", label: "Remarks", placeholder: "#REMARKS" },
];

export const EMAIL_PLACEHOLDER_OPTIONS = [
  ...REPAIR_RECORD_FIELDS.flatMap((field) => [field.placeholder, ...(field.aliases || [])]),
  "#CLIENT",
];

export function buildRepairRecordPlaceholderMap(item, formatDate) {
  const displayDate = (value) => {
    const formattedDate = formatDate(value);
    return formattedDate === "-" ? "" : formattedDate;
  };

  const values = REPAIR_RECORD_FIELDS.reduce((placeholders, field) => {
    const rawValue = item[field.key] || "";
    const value = field.type === "date" ? displayDate(rawValue) : rawValue;
    placeholders[field.placeholder] = value;
    (field.aliases || []).forEach((alias) => {
      placeholders[alias] = value;
    });
    return placeholders;
  }, {});

  values["#CLIENT"] = item.clientCode || item.clientName || "";
  return values;
}

export function applyRepairRecordTemplate(templateText, item, formatDate) {
  const placeholders = buildRepairRecordPlaceholderMap(item, formatDate);

  return Object.entries(placeholders).reduce(
    (text, [placeholder, value]) => text.replaceAll(placeholder, value),
    templateText || ""
  );
}
