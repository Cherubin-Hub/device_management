export function validateRepairRecordForm(form) {
  const errors = [];
  if (!form.clientId || !form.clientCode) errors.push("Client Code is required.");
  if (!String(form.snNumber || "").trim()) errors.push("SN Number is required.");
  if (!String(form.deviceType || "").trim()) errors.push("Device Type is required.");
  return errors;
}

export function validateEmailTemplateForm(form) {
  const errors = [];
  if (!String(form.toEmail || "").trim()) errors.push("To is required for automatic email sending.");
  if (!String(form.subject || "").trim()) errors.push("Subject is required.");
  if (!String(form.body || "").trim()) errors.push("Body is required.");
  return errors;
}
