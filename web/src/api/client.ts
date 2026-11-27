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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  let data: { error?: string; fields?: Record<string, string> } = {};
  let parsed = true;
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    // 网关或代理可能返回 HTML 错误页，按服务不可用处理
    parsed = false;
  }
  const loggingIn = path === '/api/session' && method === 'POST';
  if (response.status === 401 && !loggingIn) {
    onUnauthorized();
  }
  if (!response.ok) {
    const fallback = parsed ? '请求没有完成' : '服务暂时不可用，请稍后再试';
    throw new ApiError(response.status, data.error || fallback, parsed ? data.fields : undefined);
  }
  if (!parsed) throw new ApiError(response.status, '服务暂时不可用，请稍后再试');
  return data as T;
}
