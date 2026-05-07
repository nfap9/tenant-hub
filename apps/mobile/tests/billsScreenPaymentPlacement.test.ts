import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/screens/bills/BillsScreen.tsx"), "utf8");

assert.ok(source.includes('visible={activeLayer === "payment"}'), "payment should use a standalone drawer from the list toolbar");
assert.ok(source.includes('<Text style={styles.smallButtonText}>登记收款</Text>'), "monthly list toolbar should show payment as a compact action");
assert.equal(source.includes('<Text style={styles.buttonText}>登记收款</Text>'), false, "payment action should not occupy a full-width primary button");
assert.ok(source.includes("选择公寓"), "payment drawer should offer apartment selection first");
assert.ok(source.includes("选择房间账单"), "payment drawer should offer room bill selection second");
assert.ok(source.includes("搜索公寓"), "apartment dropdown should support search");
assert.ok(source.includes("搜索房号或租客"), "room bill dropdown should support search");
assert.ok(source.includes("apartmentDropdownOpen"), "apartment choices should be hidden behind a dropdown");
assert.ok(source.includes("roomBillDropdownOpen"), "room bill choices should be hidden behind a dropdown");
assert.ok(source.includes("[loaded, pendingAction, paymentBills, roomById]"), "home payment quick action should wait for payment bill choices before opening");
assert.ok(source.includes('visible={activeLayer === "monthlyDetail" && !!selectedMonthlyBill}'), "monthly detail drawer should remain the payment context");
assert.ok(source.includes("<Text style={styles.buttonText}>确认收款</Text>"), "monthly detail drawer should expose payment submission");
assert.ok(source.includes("selectedMonthlyBill.status !== \"PAID\" && selectedMonthlyBill.status !== \"VOID\""), "payment form should only show for unsettled monthly bills");
