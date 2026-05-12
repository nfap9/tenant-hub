import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("mobile interaction layering", () => {
  const mobileRoot = join(process.cwd(), "src");

  it("should use drawers or pages for form tasks, not bottom sheets", () => {
    const businessScreens = [
      "screens/apartments/ApartmentsScreen.tsx",
      "screens/bills/BillsScreen.tsx",
      "screens/rooms/RoomsScreen.tsx",
      "screens/settings/PlanPurchaseSubPage.tsx"
    ];

    for (const screen of businessScreens) {
      const source = readFileSync(join(mobileRoot, screen), "utf8");
      expect(source).not.toContain('variant="bottom"');
    }
  });

  it("should use TaskSheet drawers instead of raw Modal in RoomsScreen", () => {
    const roomsSource = readFileSync(join(mobileRoot, "screens/rooms/RoomsScreen.tsx"), "utf8");
    expect(roomsSource).not.toContain("<Modal");
  });
});
