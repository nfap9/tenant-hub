import { describe, it, expect } from "vitest";
import { parseEnv } from "./env.js";

describe("env config", () => {
  it("should require an explicit JWT secret in production", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgresql://localhost/db",
        NODE_ENV: "production"
      })
    ).toThrow(/JWT_SECRET/);
  });

  it("should reject the development JWT secret in production", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgresql://localhost/db",
        NODE_ENV: "production",
        JWT_SECRET: "tenant-hub-dev-secret"
      })
    ).toThrow(/JWT_SECRET/);
  });

  it("should allow the local JWT fallback in development", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgresql://localhost/db",
        NODE_ENV: "development"
      }).JWT_SECRET
    ).toBe("tenant-hub-dev-secret");
  });
});
