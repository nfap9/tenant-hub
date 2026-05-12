import { describe, it, expect } from "vitest";
import { isTokenStaleForPasswordChange } from "./auth.js";

describe("auth middleware", () => {
  it("should remain valid when the user has never changed password", () => {
    expect(isTokenStaleForPasswordChange(new Date("2026-05-07T10:00:00.000Z"), null)).toBe(false);
  });

  it("should mark tokens issued before a password change as stale", () => {
    expect(isTokenStaleForPasswordChange(new Date("2026-05-07T10:00:00.000Z"), new Date("2026-05-07T10:00:02.000Z"))).toBe(true);
  });

  it("should tolerate JWT iat second precision for same-second tokens", () => {
    expect(isTokenStaleForPasswordChange(new Date("2026-05-07T10:00:00.000Z"), new Date("2026-05-07T10:00:00.500Z"))).toBe(false);
  });
});
