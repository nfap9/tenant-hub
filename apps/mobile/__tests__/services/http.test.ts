import { mobileApi, mobileText } from '../../src/services/http';

describe('http service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return parsed JSON data on success', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ data: { id: '1' } }),
    })) as unknown as typeof fetch;

    const result = await mobileApi<{ id: string }>('/test');
    expect(result).toEqual({ id: '1' });
  });

  it('should inject Bearer token when provided', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ data: {} }),
    })) as unknown as typeof fetch;
    globalThis.fetch = mockFetch;

    await mobileApi('/test', 'my-token');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer my-token',
        }),
      }),
    );
  });

  it('should throw with response text on non-ok responses', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      text: async () => 'Server Error',
    })) as unknown as typeof fetch;

    await expect(mobileApi('/broken')).rejects.toThrow('Server Error');
  });

  it('should throw generic message when error body is empty', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      text: async () => '',
    })) as unknown as typeof fetch;

    await expect(mobileApi('/broken')).rejects.toThrow('请求失败');
  });

  it('should return plain text for mobileText', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => 'csv,data',
    })) as unknown as typeof fetch;

    const result = await mobileText('/export');
    expect(result).toBe('csv,data');
  });
});
