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

vi.mock("../config/prisma.js", () => {
  const tx = {
    systemSetting: { findUnique: vi.fn(async () => null) },
    apartment: {
      count: vi.fn(),
      create: vi.fn(async ({ data }) => ({ id: "apartment-1", ...data }))
    },
    room: { findMany: vi.fn(), createMany: vi.fn() },
    $executeRaw: vi.fn()
  };

  return {
    prisma: {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      systemSetting: { findUnique: vi.fn(async () => null) },
      apartment: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn()
      },
      room: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        createMany: vi.fn()
      },
      lease: {
        count: vi.fn()
      },
      apartmentExpense: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
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
      },
      __tx: tx
    }
  };
});

import { app } from "../app.js";
import { prisma } from "../config/prisma.js";

const authToken = jwt.sign({ id: "user-1", phone: "13800138000", username: "测试用户" }, "test-jwt-secret-123456789");

describe("apartments routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "ACTIVE",
      role: { permissions: ["*"] }
    });
    ((prisma as any).__tx.systemSetting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  describe("POST /api/apartments", () => {
    it("should not persist utility unit prices on apartments", async () => {
      const res = await request(app)
        .post("/api/apartments")
        .set("Authorization", `Bearer ${authToken}`)
        .set("x-organization-id", "org-1")
        .send({
          name: "阳光公寓",
          location: "城南",
          floors: 6,
          waterUnitPrice: 4,
          powerUnitPrice: 1.2
        });

      expect(res.status).toBe(200);
      expect((prisma as any).__tx.apartment.create).toHaveBeenCalledWith({
        data: {
          name: "阳光公寓",
          location: "城南",
          floors: 6,
          organizationId: "org-1"
        }
      });
    });
  });
});
