import test from "node:test";
import assert from "node:assert/strict";
import { validateEmailTemplateForm, validateRepairRecordForm } from "../src/lib/validation.js";

test("validates required repair record fields", () => {
  assert.deepEqual(validateRepairRecordForm({}), [
    "Client Code is required.",
    "SN Number is required.",
    "Device Type is required.",
  ]);

  assert.deepEqual(
    validateRepairRecordForm({ clientId: 1, clientCode: "ABC", snNumber: "SN-1", deviceType: "T10K" }),
    []
  );
});

test("validates required email template fields", () => {
  assert.deepEqual(validateEmailTemplateForm({}), [
    "To is required for automatic email sending.",
    "Subject is required.",
    "Body is required.",
  ]);

  assert.deepEqual(
    validateEmailTemplateForm({ toEmail: "ops@example.com", subject: "Register #SN", body: "Please register #SN" }),
    []
  );
});
