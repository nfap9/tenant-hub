import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/screens/bills/BillsScreen.tsx"), "utf8");
const selectorSource = readFileSync(join(process.cwd(), "src/components/RoomBillSelector.tsx"), "utf8");

assert.ok(source.includes('visible={activeLayer === "payment"}'), "payment should use a standalone drawer from the list toolbar");
assert.ok(source.includes('<Text style={styles.smallButtonText}>登记收款</Text>'), "monthly list toolbar should show payment as a compact action");
assert.equal(source.includes('<Text style={styles.buttonText}>登记收款</Text>'), false, "payment action should not occupy a full-width primary button");
assert.ok(source.includes("RoomBillSelector"), "bill and meter drawers should use the shared room selector");
assert.ok(selectorSource.includes("搜索公寓或房号"), "room selector should use one fuzzy search box");
assert.ok(selectorSource.includes("<TaskSheet"), "room selector should open a second-level drawer");
assert.equal(selectorSource.includes("展开"), false, "room selector should not expand inline");
assert.equal(selectorSource.includes("收起"), false, "room selector should not collapse inline");
assert.equal(selectorSource.includes("apartmentDropdownOpen"), false, "room selector should not keep a separate apartment dropdown");
assert.equal(selectorSource.includes("roomBillDropdownOpen"), false, "room selector should not keep a separate room-bill dropdown");
assert.ok(source.includes("该房间暂无待收账单"), "payment drawer should explain when the selected room has no receivable bills");
assert.ok(source.includes("选择收款账单"), "payment drawer should show bills after room selection");
assert.ok(source.includes("[loaded, pendingAction, paymentBills, roomById]"), "home payment quick action should wait for payment bill choices before opening");
assert.ok(source.includes('visible={activeLayer === "monthlyDetail" && !!selectedMonthlyBill}'), "monthly detail drawer should remain the payment context");
assert.ok(source.includes("<Text style={styles.buttonText}>确认收款</Text>"), "monthly detail drawer should expose payment submission");
assert.ok(source.includes("selectedMonthlyBill.status !== \"PAID\" && selectedMonthlyBill.status !== \"VOID\""), "payment form should only show for unsettled monthly bills");
