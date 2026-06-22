const outlookMailHelperUrl = "http://127.0.0.1:57991/send";
const outlookHelperToken = "endivio-outlook-helper-v1";

export async function sendWithOutlookHelper(payload) {
  const response = await fetch(outlookMailHelperUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Endivio-Outlook-Token": outlookHelperToken,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.ok === false) {
    throw new Error(result.error || "Outlook mail helper failed to send the email.");
  }

  return result;
}

export function openMailDraft(payload) {
  window.location.href = buildMailDraftHref(payload);
}

export function buildMailDraftHref(payload) {
  const params = [
    payload.cc ? `cc=${encodeMailtoValue(payload.cc)}` : "",
    payload.subject ? `subject=${encodeMailtoValue(payload.subject)}` : "",
    payload.body ? `body=${encodeMailtoValue(payload.body)}` : "",
  ].filter(Boolean);

  return `mailto:${encodeMailRecipients(payload.to)}${params.length ? `?${params.join("&")}` : ""}`;
}

function encodeMailtoValue(value) {
  return encodeURIComponent(value || "").replace(/%0A/g, "%0D%0A");
}

function encodeMailRecipients(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join(",");
}
