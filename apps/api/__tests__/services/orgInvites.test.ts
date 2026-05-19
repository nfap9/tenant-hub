import { describe, it, expect } from "vitest";
import { assertInviteJoinable, buildInviteExpiry, normalizeInviteCode } from "./orgInvites.js";

describe("org invites", () => {
  const now = new Date("2026-05-05T12:00:00.000Z");

  it("should normalize invite code by ignoring spaces and dashes", () => {
    expect(normalizeInviteCode(" abcd-1234 ")).toBe("ABCD1234");
  });

  it("should build invite expiry based on requested hours", () => {
    expect(buildInviteExpiry(now, 24).toISOString()).toBe("2026-05-06T12:00:00.000Z");
  });

  it("should allow joinable invites", () => {
    expect(() =>
      assertInviteJoinable({
        invite: { expiresAt: new Date("2026-05-05T12:01:00.000Z"), usedCount: 0, maxUses: 1, organization: { status: "ACTIVE" } },
        now
      })
    ).not.toThrow();
  });

  it("should reject expired invites", () => {
    expect(() =>
      assertInviteJoinable({
        invite: { expiresAt: new Date("2026-05-05T11:59:59.000Z"), usedCount: 0, maxUses: 1, organization: { status: "ACTIVE" } },
        now
      })
    ).toThrow(/邀请码已过期/);
  });

  it("should reject used invites", () => {
    expect(() =>
      assertInviteJoinable({
        invite: { expiresAt: new Date("2026-05-05T12:01:00.000Z"), usedCount: 1, maxUses: 1, organization: { status: "ACTIVE" } },
        now
      })
    ).toThrow(/邀请码已被使用/);
  });

  it("should reject inactive organizations", () => {
    expect(() =>
      assertInviteJoinable({
        invite: { expiresAt: new Date("2026-05-05T12:01:00.000Z"), usedCount: 0, maxUses: 1, organization: { status: "SUSPENDED" } },
        now
      })
    ).toThrow(/组织不可加入/);
  });
});
