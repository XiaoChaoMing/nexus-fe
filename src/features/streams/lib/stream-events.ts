import type { ScheduledStatus, StreamDetail, StreamStatus } from '@/features/streams/types'

/** `stream:{streamId}` (TSD GĐ3 §5.1): snapshot and events merged into the cached `Stream`. */

type Rec = Record<string, unknown>

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

type AnyStatus = StreamStatus | ScheduledStatus
type Stream = StreamDetail

const STATUSES: readonly AnyStatus[] = ['LIVE', 'INTERRUPTED', 'ENDED', 'SCHEDULED', 'CANCELLED']
const END_REASONS = ['creator', 'ingest_timeout', 'admin_takedown'] as const

function status(v: unknown): AnyStatus | null {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v) ? (v as AnyStatus) : null
}

function count(v: unknown): number | null | undefined {
  if (v === null) return null

  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined
}

function withStatus<S extends Stream>(s: S, next: AnyStatus, data: Rec, now: number): S {
  // A moved broadcast comes back as SCHEDULED with its new start (TSD GĐ4 §5.4).
  if (next === 'SCHEDULED') {
    const at = typeof data.scheduledStartAt === 'string' && data.scheduledStartAt ? data.scheduledStartAt : s.scheduledStartAt

    return { ...s, status: next, scheduledStartAt: at }
  }
  if (next === 'LIVE' && s.status === 'SCHEDULED') return { ...s, status: next, startedAt: s.startedAt ?? new Date(now).toISOString() }
  if (next !== 'ENDED') return { ...s, status: next }
  const reason = (END_REASONS as readonly unknown[]).includes(data.endReason) ? (data.endReason as Stream['endReason']) : s.endReason

  return { ...s, status: next, endedAt: s.endedAt ?? new Date(now).toISOString(), endReason: reason }
}

/** `subscribed.snapshot` = `{status, viewerCount}`. */
export function applyStreamSnapshot<S extends Stream>(s: S, snapshot: unknown, now = Date.now()): S {
  if (!isRec(snapshot)) return s
  const next = status(snapshot.status)
  const viewers = count(snapshot.viewerCount)
  let out = next && next !== s.status ? withStatus(s, next, snapshot, now) : s
  if (viewers !== undefined && viewers !== out.viewerCount) out = { ...out, viewerCount: viewers }

  return out
}

/** One event; returns the same object when nothing changed. */
export function applyStreamEvent<S extends Stream>(s: S, type: string, data: unknown, now = Date.now()): S {
  const d = isRec(data) ? data : {}
  switch (type) {
    case 'status_changed': {
      const next = status(d.status)
      if (next === 'SCHEDULED' && s.status === 'SCHEDULED') return withStatus(s, next, d, now)

      return next && next !== s.status ? withStatus(s, next, d, now) : s
    }
    case 'viewer_count': {
      const viewers = count(d.count)

      return viewers === undefined || viewers === s.viewerCount ? s : { ...s, viewerCount: viewers }
    }
    case 'title_changed': {
      const title = typeof d.title === 'string' && d.title ? d.title : s.title
      const tags = Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string') : s.tags

      return title === s.title && tags === s.tags ? s : { ...s, title, tags }
    }
    case 'vod_ready':
      return typeof d.vodId === 'string' && d.vodId && d.vodId !== s.vodId ? { ...s, vodId: d.vodId } : s
    default:
      return s
  }
}
