import { mobileApi } from "../src/services/http";

describe("http service", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should throw with response text on non-ok responses", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      text: async () => "<html>Bad gateway</html>"
    })) as unknown as typeof fetch;

    await expect(mobileApi("/broken")).rejects.toThrow("<html>Bad gateway</html>");
  });
});
