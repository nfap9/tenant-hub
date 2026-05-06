import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mobileRoot = join(process.cwd(), "src");

const businessScreens = [
  "screens/apartments/ApartmentsScreen.tsx",
  "screens/bills/BillsScreen.tsx",
  "screens/rooms/RoomsScreen.tsx",
  "screens/settings/PlanPurchaseSubPage.tsx"
];

for (const screen of businessScreens) {
  const source = readFileSync(join(mobileRoot, screen), "utf8");
  assert.equal(source.includes('variant="bottom"'), false, `${screen} should use drawers or pages for form tasks, not bottom sheets`);
}

const roomsSource = readFileSync(join(mobileRoot, "screens/rooms/RoomsScreen.tsx"), "utf8");
assert.equal(roomsSource.includes("<Modal"), false, "RoomsScreen form tasks should use TaskSheet drawers instead of raw Modal");
