import { describe, it, expect, vi } from "vitest";
import { sendSms } from "./smsService.js";

describe("sms service", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should throw when URL is not configured", async () => {
    await expect(
      sendSms({ targets: "13800000000", code: "123456", config: { url: "", method: "POST" } })
    ).rejects.toThrow("短信服务 URL 未配置");
  });

  it("should replace template variables in URL", async () => {
    const mockFetch = vi.fn(async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    await sendSms({
      targets: "13800000000",
      code: "123456",
      name: "TenantHub",
      number: 5,
      config: { url: "https://sms.example.com/send?code={{code}}&phone={{targets}}", method: "GET" }
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toBe("https://sms.example.com/send?code=123456&phone=13800000000");
  });

  it("should send POST request with JSON body by default", async () => {
    const mockFetch = vi.fn(async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    await sendSms({
      targets: "13800000000",
      code: "123456",
      config: {
        url: "https://sms.example.com/send",
        method: "POST",
        params: { code: "{{code}}", phone: "{{targets}}" }
      }
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.headers?.["Content-Type"]).toBe("application/json");
    expect(options.body).toBe(JSON.stringify({ code: "123456", phone: "13800000000" }));
  });

  it("should replace variables in headers", async () => {
    const mockFetch = vi.fn(async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    await sendSms({
      targets: "13800000000",
      code: "123456",
      config: {
        url: "https://sms.example.com/send",
        method: "POST",
        headers: { Authorization: "Bearer {{code}}", "X-App": "{{name}}" }
      }
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers?.Authorization).toBe("Bearer 123456");
    expect(options.headers?.["X-App"]).toBe("TenantHub");
  });

  it("should join multiple targets with comma", async () => {
    const mockFetch = vi.fn(async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    await sendSms({
      targets: ["13800000000", "13900000000"],
      code: "123456",
      config: { url: "https://sms.example.com/send?phone={{targets}}", method: "GET" }
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("phone=13800000000,13900000000");
  });

  it("should throw on non-ok response", async () => {
    const mockFetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => "Server Error" })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    await expect(
      sendSms({ targets: "13800000000", code: "123456", config: { url: "https://sms.example.com/send", method: "POST" } })
    ).rejects.toThrow("短信发送失败: 500 Server Error");
  });

  it("should append query params for GET requests", async () => {
    const mockFetch = vi.fn(async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    await sendSms({
      targets: "13800000000",
      code: "123456",
      config: {
        url: "https://sms.example.com/send?existing=1",
        method: "GET",
        params: { code: "{{code}}" }
      }
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toBe("https://sms.example.com/send?existing=1&code=123456");
  });
});
