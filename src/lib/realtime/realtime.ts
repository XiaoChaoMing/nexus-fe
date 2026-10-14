import { RealtimeClient, type RealtimeAuth, type WebSocketLike } from '@/lib/realtime/client'

/**
 * The app-wide realtime connection. The auth feature plugs in the token source (like `configureAuth` for HTTP),
 * so this layer does not depend on it.
 */

type RealtimeHooks = {
  getAuth: () => RealtimeAuth
  refreshAuth: () => Promise<boolean>
}

let hooks: RealtimeHooks = {
  getAuth: () => ({ token: null }),
  refreshAuth: async () => false,
}

let client: RealtimeClient | null = null

export function configureRealtime(next: RealtimeHooks) {
  hooks = next
}

/**
 * `ws(s)://<host>/v1/ws` on the page's own origin: Vite (dev) and Nginx (deploy) forward it to chat-svc, the same
 * way `/v1` REST goes through one origin. `VITE_WS_URL` overrides it (absolute `ws(s)://…`).
 */
export function realtimeUrl(loc: Pick<Location, 'protocol' | 'host'>, override?: string): string {
  if (override && /^wss?:\/\//.test(override)) return override
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws'

  return `${scheme}://${loc.host}/v1/ws`
}

function createSocket(): ((url: string) => WebSocketLike) | null {
  if (typeof WebSocket === 'undefined') return null

  return (url) => new WebSocket(url) as unknown as WebSocketLike
}

export function realtime(): RealtimeClient {
  if (!client) {
    client = new RealtimeClient({
      url: () => realtimeUrl(window.location, import.meta.env.VITE_WS_URL as string | undefined),
      getAuth: () => hooks.getAuth(),
      refreshAuth: () => hooks.refreshAuth(),
      createSocket: createSocket(),
    })
    if (typeof window !== 'undefined') {
      // NXL-00 §13: reconnect by itself when the network is back.
      window.addEventListener('online', () => client?.retry())
    }
  }

  return client
}
