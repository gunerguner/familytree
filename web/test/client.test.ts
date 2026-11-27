import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setUnauthorizedHandler } from '../src/api/client';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('parses a JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { ok: 1 })));
    await expect(api('/api/tree')).resolves.toEqual({ ok: 1 });
  });

  it('sends the mutation header and JSON content type', async () => {
    const fetchMock = vi.fn(async (_path: string, _init?: RequestInit) => jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    await api('/api/persons', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const [path, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/persons');
    expect(requestInit.method).toBe('POST');
    expect(new Headers(requestInit.headers).get('X-Familytree')).toBe('1');
    expect(new Headers(requestInit.headers).get('Content-Type')).toBe('application/json');
  });

  it('throws field errors from a 400 response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(400, { error: '不行', fields: { name: '必填' } })));
    await expect(api('/api/persons')).rejects.toMatchObject({
      status: 400,
      message: '不行',
      fields: { name: '必填' },
    });
  });

  it('maps a non-JSON gateway error to a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })));
    const error = (await api('/api/tree').catch((reason: unknown) => reason)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('服务暂时不可用，请稍后再试');
  });

  it('notifies the unauthorized handler on 401', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { error: '请先登录' })));
    await expect(api('/api/tree')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('wraps a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('failed to fetch');
    }));
    const error = (await api('/api/tree').catch((reason: unknown) => reason)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toBe('网络中断，请再试一次');
  });
});
