import assert from "node:assert/strict";
import { parseEnv } from "./env.js";

assert.throws(
  () =>
    parseEnv({
      DATABASE_URL: "postgresql://localhost/db",
      NODE_ENV: "production"
    }),
  /JWT_SECRET/,
  "production should require an explicit JWT secret"
);

assert.throws(
  () =>
    parseEnv({
      DATABASE_URL: "postgresql://localhost/db",
      NODE_ENV: "production",
      JWT_SECRET: "tenant-hub-dev-secret"
    }),
  /JWT_SECRET/,
  "production should reject the development JWT secret"
);

assert.equal(
  parseEnv({
    DATABASE_URL: "postgresql://localhost/db",
    NODE_ENV: "development"
  }).JWT_SECRET,
  "tenant-hub-dev-secret",
  "development may use the local JWT fallback"
);

console.info("env tests passed");
