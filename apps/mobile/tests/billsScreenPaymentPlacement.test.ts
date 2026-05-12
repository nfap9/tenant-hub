import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("bills screen payment placement", () => {
  const source = readFileSync(join(process.cwd(), "src/screens/bills/BillsScreen.tsx"), "utf8");
  const selectorSource = readFileSync(join(process.cwd(), "src/components/RoomBillSelector.tsx"), "utf8");

  it("should use a standalone drawer from the list toolbar for payment", () => {
    expect(source).toContain('visible={activeLayer === "payment"}');
  });

  it("should show payment as a compact button action in monthly list toolbar", () => {
    expect(source).toContain('登记收款');
    expect(source).not.toContain('<Text style={styles.smallButtonText}>登记收款</Text>');
    expect(source).not.toContain('<Text style={styles.buttonText}>登记收款</Text>');
  });

  it("should use the shared room selector for bill and meter drawers", () => {
    expect(source).toContain("RoomBillSelector");
  });

  it("should use one fuzzy search box in room selector", () => {
    expect(selectorSource).toContain("搜索公寓或房号");
  });

  it("should open a second-level drawer in room selector", () => {
    expect(selectorSource).toContain("<TaskSheet");
  });

  it("should not expand inline in room selector", () => {
    expect(selectorSource).not.toContain("展开");
    expect(selectorSource).not.toContain("收起");
  });

  it("should not keep a separate apartment dropdown", () => {
    expect(selectorSource).not.toContain("apartmentDropdownOpen");
  });

  it("should not keep a separate room-bill dropdown", () => {
    expect(selectorSource).not.toContain("roomBillDropdownOpen");
  });

  it("should explain when the selected room has no receivable bills", () => {
    expect(source).toContain("该房间暂无待收账单");
  });

  it("should show bills after room selection in payment drawer", () => {
    expect(source).toContain("选择收款账单");
  });

  it("should keep monthly detail drawer in payment context", () => {
    expect(source).toContain('visible={activeLayer === "monthlyDetail" && !!selectedMonthlyBill}');
  });

  it("should expose payment submission in monthly detail drawer", () => {
    expect(source).toContain("确认收款");
  });

  it("should only show payment form for unsettled monthly bills", () => {
    expect(source).toContain('selectedMonthlyBill.status !== "PAID" && selectedMonthlyBill.status !== "VOID"');
  });
});
