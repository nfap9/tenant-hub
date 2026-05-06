import assert from "node:assert/strict";
import { homeQuickActions } from "../src/navigation/homeQuickActions";

const meterAction = homeQuickActions.find((action) => action.key === "meter");
const paymentAction = homeQuickActions.find((action) => action.key === "payment");
const leaseAction = homeQuickActions.find((action) => action.key === "lease");

assert.ok(meterAction, "home quick actions should include a meter action");
assert.equal(meterAction.title, "抄表");
assert.equal(meterAction.icon, "表");
assert.equal("detail" in meterAction, false);
assert.equal(meterAction.intent.tab, "bills");
assert.equal(meterAction.intent.billsTab, "meter");

assert.ok(paymentAction, "home quick actions should include a payment action");
assert.equal(paymentAction.title, "登记收款");
assert.equal(paymentAction.icon, "收");
assert.equal(paymentAction.intent.tab, "bills");
assert.equal(paymentAction.intent.billsTab, "monthly");
assert.equal(paymentAction.intent.billsAction, "payment");

assert.ok(leaseAction, "home quick actions should include a lease action");
assert.equal(leaseAction.title, "签约入住");
assert.equal(leaseAction.icon, "签");
assert.equal(leaseAction.intent.tab, "rooms");
assert.equal(leaseAction.intent.roomsAction, "lease");
