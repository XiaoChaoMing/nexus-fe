import { ApiError, NETWORK_ERROR, parseRetryAfter } from '@/lib/api-error'

type AuthHooks = {
  getAccessToken: () => string | null
  /** Returns true when a new access token was obtained. */
  refresh: () => Promise<boolean>
}

let authHooks: AuthHooks = {
  getAccessToken: () => null,
  refresh: async () => false,
}

/** Called once by the auth feature so the HTTP layer does not depend on it. */
export function configureAuth(hooks: AuthHooks) {
  authHooks = hooks
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Attach the access token and retry once after a refresh on 401. */
  auth?: boolean
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Lets the request outlive the page (saving the watch position on pagehide). */
  keepalive?: boolean
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const token = opts.auth ? authHooks.getAccessToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      // Same-origin cookie carries the refresh token (HttpOnly, Path=/v1/auth).
      credentials: 'same-origin',
      signal: opts.signal,
      keepalive: opts.keepalive,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, NETWORK_ERROR, 'network error')
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 202) {
    // 202 may carry a body or not; nothing the client needs either way.
    return undefined as T
  }

  const payload: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error
    const details = error?.details && typeof error.details === 'object' ? error.details : {}
    const code = error?.code ?? (res.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR')
    const retryAfter = res.status === 429 ? parseRetryAfter(details, res.headers.get('Retry-After')) : null

    throw new ApiError(res.status, code, error?.message ?? res.statusText, details, retryAfter)
  }

  return (payload as { data: T } | null)?.data as T
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts)

  if (res.status === 401 && opts.auth && (await authHooks.refresh())) {
    res = await send(path, opts)
  }

  return parse<T>(res)
}
