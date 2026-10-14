import type { ChannelCard, FollowedChannel, SidebarFollowing } from '@/features/channels/types'

/** One channel in the "Kênh đang theo dõi" list. */
export type SidebarEntry = {
  channel: ChannelCard
  stream: { id: string; title: string; categoryId: string | null; viewerCount: number | null } | null
  lastLiveAt: string | null
}

export type SidebarState = { entries: SidebarEntry[]; totalFollowing: number }

function entryOf(f: FollowedChannel): SidebarEntry {
  const s = f.isLive ? f.currentStream : null

  return {
    channel: f.channel,
    stream: s ? { id: s.id, title: s.title, categoryId: s.category?.id ?? null, viewerCount: s.viewerCount } : null,
    lastLiveAt: f.lastLiveAt,
  }
}

/** REST answer (`GET /v1/me/following/sidebar`): live first (server order: by viewers), then offline. */
export function sidebarFromResponse(res: SidebarFollowing): SidebarState {
  return { entries: [...res.live, ...res.offline].map(entryOf), totalFollowing: res.totalFollowing }
}

function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)

/** Index where a live channel with `viewers` goes: after every live one with more viewers (14 · Sidebar, ô 6). */
function liveInsertIndex(entries: SidebarEntry[], viewers: number | null): number {
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    if (!e?.stream) break
    if (viewers !== null && (e.stream.viewerCount ?? -1) < viewers) break
    i++
  }

  return i
}

export type SidebarUpdate = {
  state: SidebarState
  /** The event names a channel the list does not hold (followed elsewhere): reload the list. */
  unknownChannel: boolean
}

/**
 * Applies one `sidebar:{userId}` event (TSD GĐ4 §5.4). A channel going live moves into the live group at its
 * viewer position, one going offline moves to the top of the offline group; viewer counts change in place
 * (the list never reorders on counts alone).
 */
export function applySidebarEvent(state: SidebarState, type: string, data: unknown, now = Date.now()): SidebarUpdate {
  const d = rec(data)
  switch (type) {
    case 'channel_live': {
      const channelId = str(d.channelId)
      const s = rec(d.stream)
      const streamId = str(s.id)
      if (!channelId || !streamId) return { state, unknownChannel: false }
      const at = state.entries.findIndex((e) => e.channel.id === channelId)
      if (at < 0) return { state, unknownChannel: true }
      const current = state.entries[at] as SidebarEntry
      const viewers = num(s.viewerCount)
      const moved: SidebarEntry = {
        ...current,
        stream: { id: streamId, title: str(s.title) ?? current.stream?.title ?? '', categoryId: str(s.categoryId), viewerCount: viewers },
      }
      const rest = state.entries.filter((_, i) => i !== at)
      const idx = liveInsertIndex(rest, viewers)

      return { state: { ...state, entries: [...rest.slice(0, idx), moved, ...rest.slice(idx)] }, unknownChannel: false }
    }
    case 'channel_offline': {
      const channelId = str(d.channelId)
      const at = state.entries.findIndex((e) => e.channel.id === channelId)
      if (at < 0) return { state, unknownChannel: false }
      const current = state.entries[at] as SidebarEntry
      if (!current.stream) return { state, unknownChannel: false }
      const moved: SidebarEntry = { ...current, stream: null, lastLiveAt: str(d.lastLiveAt) ?? new Date(now).toISOString() }
      const rest = state.entries.filter((_, i) => i !== at)
      const firstOffline = rest.findIndex((e) => !e.stream)
      const idx = firstOffline < 0 ? rest.length : firstOffline

      return { state: { ...state, entries: [...rest.slice(0, idx), moved, ...rest.slice(idx)] }, unknownChannel: false }
    }
    case 'viewer_count_batch': {
      const items = Array.isArray(d.items) ? d.items.map(rec) : []
      const counts = new Map<string, number>()
      for (const it of items) {
        const id = str(it.channelId)
        const c = num(it.count)
        if (id && c !== null) counts.set(id, c)
      }
      let changed = false
      const entries = state.entries.map((e) => {
        const c = counts.get(e.channel.id)
        if (c === undefined || !e.stream || e.stream.viewerCount === c) return e
        changed = true

        return { ...e, stream: { ...e.stream, viewerCount: c } }
      })

      return { state: changed ? { ...state, entries } : state, unknownChannel: false }
    }
    default:
      return { state, unknownChannel: false }
  }
}
