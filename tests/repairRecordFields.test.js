// Covers placeholder replacement used by Repair Records email automation.
import test from "node:test";
import assert from "node:assert/strict";
import { applyRepairRecordTemplate } from "../src/lib/repairRecordFields.js";

test("replaces Repair Records email placeholders", () => {
  const record = {
    clientCode: "ABC",
    company: "Acme Corp",
    cstNumber: "CST-1",
    dateReceived: "2026-06-21",
    deviceType: "FaceID1500",
    snNumber: "SN-9",
    ticketNumber: "T-2",
  };

  const result = applyRepairRecordTemplate(
    "#COMPANY #CLIENT_CODE #SN #SN_NUMBER #CST #TICKET #DEVICE_TYPE #DATE_RECEIVED",
    record,
    (value) => (value ? "6/21/2026" : "-")
  );

  assert.equal(result, "Acme Corp ABC SN-9 SN-9 CST-1 T-2 FaceID1500 6/21/2026");
});
