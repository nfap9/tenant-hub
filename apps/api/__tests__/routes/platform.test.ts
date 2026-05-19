import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../config/prisma.js";

describe("GET /api/platform/info", () => {
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: "platform_info" } });
  });

  it("returns defaults when platform_info is not set", async () => {
    const res = await request(app).get("/api/platform/info");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { name: "Tenant Hub", logoUrl: "", contactPhone: "" }
    });
  });

  it("returns saved platform info when set", async () => {
    await prisma.systemSetting.create({
      data: {
        key: "platform_info",
        value: { name: "安居管家", logoUrl: "https://example.com/logo.png", contactPhone: "400-123-4567" },
        description: "平台基础信息"
      }
    });

    const res = await request(app).get("/api/platform/info");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { name: "安居管家", logoUrl: "https://example.com/logo.png", contactPhone: "400-123-4567" }
    });
  });

  it("falls back to defaults for missing fields", async () => {
    await prisma.systemSetting.create({
      data: {
        key: "platform_info",
        value: { logoUrl: "https://example.com/logo.png" },
        description: "平台基础信息"
      }
    });

    const res = await request(app).get("/api/platform/info");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { name: "Tenant Hub", logoUrl: "https://example.com/logo.png", contactPhone: "" }
    });
  });
});
