import { describe, it, expect } from "vitest";
import { toCsv } from "../../src/services/csv.js";

describe("csv", () => {
  it("should not quote plain CSV values", () => {
    expect(
      toCsv([
        ["billId", "租客", "失败原因"],
        ["bill-1", "张三", "缺少读数"]
      ])
    ).toBe("billId,租客,失败原因\nbill-1,张三,缺少读数");
  });

  it("should escape CSV values with commas, quotes, or newlines", () => {
    expect(
      toCsv([
        ["billId", "租客", "失败原因"],
        ["bill-2", "李,四", "他说\"缺少\n读数\""]
      ])
    ).toBe('billId,租客,失败原因\nbill-2,"李,四","他说""缺少\n读数"""');
  });
});
