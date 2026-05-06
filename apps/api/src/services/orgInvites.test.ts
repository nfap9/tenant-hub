import assert from "node:assert/strict";
import { assertInviteJoinable, buildInviteExpiry, normalizeInviteCode } from "./orgInvites.js";

const now = new Date("2026-05-05T12:00:00.000Z");

assert.equal(normalizeInviteCode(" abcd-1234 "), "ABCD1234", "invite code should ignore spaces and dashes");

assert.equal(
  buildInviteExpiry(now, 24).toISOString(),
  "2026-05-06T12:00:00.000Z",
  "invite expiry should be based on requested hours"
);

assert.doesNotThrow(() =>
  assertInviteJoinable({
    invite: { expiresAt: new Date("2026-05-05T12:01:00.000Z"), usedCount: 0, maxUses: 1, organization: { status: "ACTIVE" } },
    now
  })
);

assert.throws(
  () =>
    assertInviteJoinable({
      invite: { expiresAt: new Date("2026-05-05T11:59:59.000Z"), usedCount: 0, maxUses: 1, organization: { status: "ACTIVE" } },
      now
    }),
  /邀请码已过期/,
  "expired invites should be rejected"
);

assert.throws(
  () =>
    assertInviteJoinable({
      invite: { expiresAt: new Date("2026-05-05T12:01:00.000Z"), usedCount: 1, maxUses: 1, organization: { status: "ACTIVE" } },
      now
    }),
  /邀请码已被使用/,
  "used invites should be rejected"
);

assert.throws(
  () =>
    assertInviteJoinable({
      invite: { expiresAt: new Date("2026-05-05T12:01:00.000Z"), usedCount: 0, maxUses: 1, organization: { status: "SUSPENDED" } },
      now
    }),
  /组织不可加入/,
  "inactive organizations should be rejected"
);

console.info("org invite tests passed");
