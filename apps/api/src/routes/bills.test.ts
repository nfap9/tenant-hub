import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../config/env.js", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-123456789",
    JWT_EXPIRES_IN: "7d",
    NODE_ENV: "test"
  },
  corsOrigins: ["http://localhost:5173"],
  platformAdminPhones: []
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    $transaction: vi.fn(async (promises: Promise<unknown>[]) => {
      for (const p of promises) await p;
    }),
    bill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn()
    },
    monthlyBill: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn()
    },
    billItem: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    payment: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    meterReading: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn()
    },
    room: {
      findFirst: vi.fn()
    },
    lease: {
      findFirst: vi.fn()
    },
    user: {
      findUnique: vi.fn(async () => ({
        id: "user-1",
        phone: "13800138000",
        username: "测试用户",
        passwordChangedAt: null
      }))
    },
    orgMember: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("../services/billing.js", () => ({
  generateCurrentLeaseBills: vi.fn(async () => ({ leaseCount: 2, billIds: ["bill-1"] })),
  generateLeaseBills: vi.fn(async () => ["bill-1"]),
  recordBillPayment: vi.fn(async () => ({ id: "payment-1" })),
  recordMonthlyBillPayment: vi.fn(async () => ({ id: "payment-1" })),
  retryPostpaidBillAndMonthlyBill: vi.fn(async () => ({})),
  refreshBillTotals: vi.fn(async () => {}),
  refreshMonthlyBillTotals: vi.fn(async () => {}),
  tryCreateMonthlyBill: vi.fn(async () => {}),
  calculateUtilityLineAmounts: vi.fn(() => ({ waterAmount: 32, powerAmount: 48 }))
}));

vi.mock("../services/csv.js", () => ({
  toCsv: vi.fn((rows: string[][]) => rows.map((r) => r.join(",")).join("\n"))
}));

vi.mock("../services/utilityImport.js", () => ({
  parseUtilityImportRows: vi.fn(() => [
    { billId: "bill-1", previousWater: 10, currentWater: 18, previousPower: 100, currentPower: 160 }
  ])
}));

import { app } from "../app.js";
import { prisma } from "../config/prisma.js";

const authToken = jwt.sign({ id: "user-1", phone: "13800138000", username: "测试用户" }, "test-jwt-secret-123456789");

describe("bills routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ACTIVE",
      role: { permissions: ["*"] }
    });
  });

  describe("GET /api/bills", () => {
    it("should return bills for organization", async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "bill-1" }]);

      const res = await request(app)
        .get("/api/bills")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: "bill-1" }]);
      expect(prisma.bill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-1" })
        })
      );
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/bills");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/bills/monthly", () => {
    it("should return monthly bills", async () => {
      (prisma.monthlyBill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "mb-1" }]);

      const res = await request(app)
        .get("/api/bills/monthly")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: "mb-1" }]);
    });
  });

  describe("POST /api/bills/generate", () => {
    it("should generate bills for all current leases", async () => {
      const res = await request(app)
        .post("/api/bills/generate")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.leaseCount).toBe(2);
    });

    it("should generate bills for specific lease", async () => {
      (prisma.lease.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "lease-1" });

      const res = await request(app)
        .post("/api/bills/generate")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1")
        .send({ leaseId: "lease-1" });

      expect(res.status).toBe(200);
      expect(res.body.data.billIds).toEqual(["bill-1"]);
    });
  });

  describe("POST /api/bills/:id/payments", () => {
    it("should record a bill payment", async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "bill-1" });

      const res = await request(app)
        .post("/api/bills/bill-1/payments")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1")
        .send({ amount: 100, method: "现金" });

      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/bills/:id", () => {
    it("should delete a bill", async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "bill-1",
        status: "UNPAID",
        monthlyBillId: null,
        items: [],
        payments: []
      });

      const res = await request(app)
        .delete("/api/bills/bill-1")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1");

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it("should reject deleting paid bills", async () => {
      (prisma.bill.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "bill-1",
        status: "PAID",
        monthlyBillId: null,
        items: [],
        payments: []
      });

      const res = await request(app)
        .delete("/api/bills/bill-1")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1");

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/bills/utility/pending-export", () => {
    it("should return CSV export", async () => {
      (prisma.bill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await request(app)
        .get("/api/bills/utility/pending-export")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
    });
  });
});
