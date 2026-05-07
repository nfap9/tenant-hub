import assert from "node:assert/strict";
import { getRoomBillGeneratedLabel } from "../src/screens/rooms/roomBillLabel";

const referenceDate = new Date("2026-05-07T00:00:00.000Z");

assert.equal(getRoomBillGeneratedLabel("2026年5月", referenceDate), "5月账单已出");
assert.equal(getRoomBillGeneratedLabel("2027年1月", referenceDate), "2027年1月账单已出");
assert.equal(getRoomBillGeneratedLabel(undefined, referenceDate), "本月账单已出");
