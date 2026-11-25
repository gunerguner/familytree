export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export async function api<T>(path: string, init: RequestInit & { form?: boolean } = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    headers.set('X-Familytree', '1');
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, '网络中断，请再试一次');
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: string; fields?: Record<string, string> }) : {};
  const loggingIn = path === '/api/session' && method === 'POST';
  if (response.status === 401 && !loggingIn) {
    onUnauthorized();
  }
  if (!response.ok) {
    throw new ApiError(response.status, data.error || '请求没有完成', data.fields);
  }
  return data as T;
}
