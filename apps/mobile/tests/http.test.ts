import assert from "node:assert/strict";
import { mobileApi } from "../src/services/http";

const originalFetch = globalThis.fetch;

const mockFetch = (response: { ok: boolean; text: string }) => {
  globalThis.fetch = (async () => ({
    ok: response.ok,
    text: async () => response.text
  })) as typeof fetch;
};

const main = async () => {
  try {
    mockFetch({ ok: false, text: "<html>Bad gateway</html>" });

    await assert.rejects(
      () => mobileApi("/broken"),
      (error) => error instanceof Error && error.message === "<html>Bad gateway</html>"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
};

main();
