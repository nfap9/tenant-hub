import { resolveApiBaseUrl } from '../src/constants/config';

describe('config', () => {
  it('should resolve API base URL from env', () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: 'https://api.example.com/v1' })).toBe(
      'https://api.example.com/v1',
    );
  });

  it('should prefer explicit env over fallback', () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: 'https://explicit.example.com' })).toBe(
      'https://explicit.example.com',
    );
  });
});
