import { homeQuickActions } from "../src/navigation/homeQuickActions";

describe("home quick actions", () => {
  it("should include meter action", () => {
    const meterAction = homeQuickActions.find((action) => action.key === "meter");
    expect(meterAction).toBeDefined();
    expect(meterAction!.title).toBe("抄表");
    expect(meterAction!.icon).toBe("speedometer-outline");
    expect(meterAction!.intent.tab).toBe("bills");
    expect(meterAction!.intent.billsTab).toBe("pending");
  });

  it("should include payment action", () => {
    const paymentAction = homeQuickActions.find((action) => action.key === "payment");
    expect(paymentAction).toBeDefined();
    expect(paymentAction!.title).toBe("登记收款");
    expect(paymentAction!.icon).toBe("cash-outline");
    expect(paymentAction!.intent.tab).toBe("bills");
    expect(paymentAction!.intent.billsTab).toBe("unpaid");
    expect(paymentAction!.intent.billsAction).toBe("payment");
  });

  it("should include lease action", () => {
    const leaseAction = homeQuickActions.find((action) => action.key === "lease");
    expect(leaseAction).toBeDefined();
    expect(leaseAction!.title).toBe("签约入住");
    expect(leaseAction!.icon).toBe("create-outline");
    expect(leaseAction!.intent.tab).toBe("rooms");
    expect(leaseAction!.intent.roomsAction).toBe("lease");
  });
});
