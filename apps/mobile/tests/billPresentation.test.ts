import { getMonthlyBillCardSummary, sortMonthlyBillsForList } from "../src/screens/bills/billPresentation";
import type { MonthlyBill } from "../src/types";

describe("bill presentation", () => {
  const bill: MonthlyBill = {
    id: "monthly-1",
    organizationId: "org-1",
    leaseId: "lease-1",
    tenantName: "张三",
    tenantPhone: "13800000000",
    billingDate: "2026-05-01T00:00:00.000Z",
    dueDate: "2026-05-06T00:00:00.000Z",
    status: "PARTIAL_PAID",
    totalAmount: "1280.5",
    paidAmount: "300",
    lease: {
      id: "lease-1",
      organizationId: "org-1",
      roomId: "room-1",
      tenantName: "张三",
      tenantPhone: "13800000000",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-12-31T00:00:00.000Z",
      billingCycle: "MONTHLY",
      rentAmount: "1000",
      depositAmount: "1000",
      waterUnitPrice: "5",
      powerUnitPrice: "1",
      dueDay: 1,
      graceDays: 5,
      status: "ACTIVE",
      autoRenew: false,
      room: {
        id: "room-1",
        apartmentId: "apartment-1",
        roomNo: "A-301",
        layout: "一室",
        facilities: [],
        status: "OCCUPIED"
      }
    },
    bills: [
      {
        id: "bill-1",
        organizationId: "org-1",
        leaseId: "lease-1",
        monthlyBillId: "monthly-1",
        mode: "PREPAID",
        billingDate: "2026-05-01T00:00:00.000Z",
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-05-31T00:00:00.000Z",
        dueDate: "2026-05-06T00:00:00.000Z",
        status: "UNPAID",
        totalAmount: "1000",
        paidAmount: "0",
        items: [{ id: "item-1", billId: "bill-1", type: "RENT", name: "租金", amount: "1000", status: "UNPAID" }]
      }
    ],
    payments: [{ id: "payment-1", monthlyBillId: "monthly-1", amount: "300", paidAt: "2026-05-02T00:00:00.000Z", method: "现金" }]
  };

  it("should summarize monthly bill card", () => {
    expect(getMonthlyBillCardSummary(bill)).toEqual({
      title: "张三 · 2026-05-01",
      meta: "A-301 · 到期 2026-05-06",
      totalAmount: 1280.5,
      paidAmount: 300,
      remainingAmount: 980.5,
      detailCountText: "1 项账单 · 1 笔收款"
    });
  });

  const billWith = (id: string, status: MonthlyBill["status"], dueDate: string, billingDate = dueDate): MonthlyBill => ({
    ...bill,
    id,
    status,
    dueDate,
    billingDate,
    tenantName: id
  });

  it("should sort monthly bills for list", () => {
    const sorted = sortMonthlyBillsForList([
      billWith("paid", "PAID", "2026-05-01T00:00:00.000Z"),
      billWith("partial-later", "PARTIAL_PAID", "2026-05-10T00:00:00.000Z"),
      billWith("failed", "FAILED", "2026-05-03T00:00:00.000Z"),
      billWith("unpaid-earlier", "UNPAID", "2026-05-02T00:00:00.000Z"),
      billWith("void", "VOID", "2026-04-01T00:00:00.000Z"),
      billWith("billing", "BILLING", "2026-05-04T00:00:00.000Z")
    ]);
    expect(sorted.map((item) => item.id)).toEqual([
      "unpaid-earlier", "partial-later", "billing", "failed", "paid", "void"
    ]);
  });
});
