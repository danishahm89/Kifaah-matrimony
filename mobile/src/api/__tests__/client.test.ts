import { API_BASE_URL, ApiError, authApi } from '../client';
import { useAuthStore } from '../../store/authStore';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ token: 'expired-token', refreshToken: 'refresh-abc', user: null, hydrated: true });
});

describe('API client — 401 refresh-and-retry (CONTRACT.md §7 refresh-token handling)', () => {
  it('refreshes once, retries the original request, and persists the new token pair', async () => {
    const fetchMock = jest
      .fn()
      // 1. original request — access token has expired server-side
      .mockResolvedValueOnce(jsonResponse(401, { error: 'token_expired' }))
      // 2. POST /api/auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { token: 'new-token', refreshToken: 'new-refresh' }))
      // 3. retried original request, now with the new token
      .mockResolvedValueOnce(jsonResponse(200, { user: { id: 'u1' }, profile: null, subscription: null }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await authApi.me();

    expect(result).toEqual({ user: { id: 'u1' }, profile: null, subscription: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/api/auth/refresh`);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refreshToken: 'refresh-abc' });

    const retryHeaders = fetchMock.mock.calls[2][1].headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-token');

    expect(useAuthStore.getState().token).toBe('new-token');
    expect(useAuthStore.getState().refreshToken).toBe('new-refresh');
  });

  it('retries at most once — a second 401 (after a successful refresh) is thrown, not retried forever', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'token_expired' })) // original
      .mockResolvedValueOnce(jsonResponse(200, { token: 'new-token', refreshToken: 'new-refresh' })) // refresh
      .mockResolvedValueOnce(jsonResponse(401, { error: 'still_unauthorized' })); // retry also 401s
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(authApi.me()).rejects.toMatchObject({ status: 401 });
    // Exactly 3 calls: original + refresh + one retry — no second refresh attempt or loop.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears the session and gives up when the refresh call itself fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'token_expired' })) // original
      .mockResolvedValueOnce(jsonResponse(401, { error: 'invalid_refresh_token' })); // refresh rejected
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(authApi.me()).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('dedups concurrent 401s onto one shared refresh call instead of a refresh storm', async () => {
    const fetchMock = jest.fn((url: string, opts?: RequestInit) => {
      if (url === `${API_BASE_URL}/api/auth/refresh`) {
        return Promise.resolve(jsonResponse(200, { token: 'new-token', refreshToken: 'new-refresh' }));
      }
      const headers = (opts?.headers ?? {}) as Record<string, string>;
      if (headers.Authorization === 'Bearer new-token') {
        return Promise.resolve(jsonResponse(200, { user: { id: 'u1' }, profile: null, subscription: null }));
      }
      return Promise.resolve(jsonResponse(401, { error: 'token_expired' }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const [a, b] = await Promise.all([authApi.me(), authApi.me()]);

    expect(a).toEqual({ user: { id: 'u1' }, profile: null, subscription: null });
    expect(b).toEqual(a);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === `${API_BASE_URL}/api/auth/refresh`);
    expect(refreshCalls).toHaveLength(1);
    expect(useAuthStore.getState().token).toBe('new-token');
  });

  it('does not attempt a refresh for an unauthenticated call (no token, e.g. otp/send)', async () => {
    useAuthStore.setState({ token: null, refreshToken: null, user: null, hydrated: true });
    const fetchMock = jest.fn().mockResolvedValueOnce(jsonResponse(401, { error: 'rate_limited' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(authApi.sendOtp('+919812345678')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
