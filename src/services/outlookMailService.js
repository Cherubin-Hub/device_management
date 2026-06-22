// Outlook mail service first tries the local helper and can build a mailto draft fallback.
const outlookMailHelperUrl = "http://127.0.0.1:57991/send";
const outlookHelperToken = "endivio-outlook-helper-v1";

export async function sendWithOutlookHelper(payload) {
  // Browser code cannot control Outlook directly, so it calls the local helper running on the user's PC.
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
  // Manual encoding avoids URLSearchParams converting spaces to plus signs in Outlook drafts.
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
  // Outlook accepts comma-separated recipients; users may configure either comma or semicolon lists.
  return String(value || "")
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join(",");
}
