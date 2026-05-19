import { describe, it, expect, vi } from "vitest";
import { HttpError, ok } from "../../src/utils/http.js";

describe("HttpError", () => {
  it("should store status and message", () => {
    const error = new HttpError(404, "not found");
    expect(error.status).toBe(404);
    expect(error.message).toBe("not found");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("ok", () => {
  it("should call res.json with data wrapper", () => {
    const res = { json: vi.fn() } as any;
    ok(res, { id: "1" });
    expect(res.json).toHaveBeenCalledWith({ data: { id: "1" } });
  });
});
