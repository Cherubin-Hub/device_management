import test from "node:test";
import assert from "node:assert/strict";
import { buildMailDraftHref } from "../src/services/outlookMailService.js";

test("builds mailto draft URL without plus signs for spaces", () => {
  const href = buildMailDraftHref({
    to: "ops@example.com; support@example.com",
    cc: "lead@example.com",
    subject: "Register Device - SN 1",
    body: "Hi,\nPlease register device SN 1.",
  });

  assert.equal(
    href,
    "mailto:ops%40example.com,support%40example.com?cc=lead%40example.com&subject=Register%20Device%20-%20SN%201&body=Hi%2C%0D%0APlease%20register%20device%20SN%201."
  );
  assert.equal(href.includes("+"), false);
});
