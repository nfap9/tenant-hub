import assert from "node:assert/strict";
import { isTokenStaleForPasswordChange } from "./auth.js";

assert.equal(
  isTokenStaleForPasswordChange(new Date("2026-05-07T10:00:00.000Z"), null),
  false,
  "tokens should remain valid when the user has never changed password"
);

assert.equal(
  isTokenStaleForPasswordChange(new Date("2026-05-07T10:00:00.000Z"), new Date("2026-05-07T10:00:02.000Z")),
  true,
  "tokens issued before a password change should be stale"
);

assert.equal(
  isTokenStaleForPasswordChange(new Date("2026-05-07T10:00:00.000Z"), new Date("2026-05-07T10:00:00.500Z")),
  false,
  "same-second tokens should tolerate JWT iat second precision"
);

console.info("auth middleware tests passed");
