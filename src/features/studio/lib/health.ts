import type { Health } from '@/features/streams/types'

export const HISTORY_MAX = 16
export const HEALTH_STALE_MS = 20_000
export const TARGET_BITRATE_KBPS = 6000
const SLOW_SPEED = 0.9

/** Appends a report once (reports repeat across polls), keeping the newest `max`. */
export function appendSample(history: Health[], sample: Health | null, max = HISTORY_MAX): Health[] {
  if (!sample || history.at(-1)?.reportedAt === sample.reportedAt) return history

  return [...history, sample].slice(-max)
}

/** Frames dropped between consecutive reports (the ingest counter is cumulative). */
export function droppedDeltas(history: Health[]): number[] {
  return history.map((h, i) => (i === 0 ? 0 : Math.max(0, h.droppedFrames - history[i - 1].droppedFrames)))
}

export type HealthWarning = {
  key: 'studio:health.warnings.slow' | 'studio:health.warnings.bitrate' | 'studio:health.warnings.upload'
  values: Record<string, string | number>
}

/** Problems worth telling the creator about, as message keys ("studio:health.warnings.*"). */
export function healthWarnings(h: Health): HealthWarning[] {
  const out: HealthWarning[] = []
  if (h.speed > 0 && h.speed < SLOW_SPEED) out.push({ key: 'studio:health.warnings.slow', values: { speed: h.speed.toFixed(2) } })
  if (h.bitrateKbps > TARGET_BITRATE_KBPS)
    out.push({ key: 'studio:health.warnings.bitrate', values: { bitrate: Math.round(h.bitrateKbps), target: TARGET_BITRATE_KBPS } })
  if (h.uploadErrors > 0) out.push({ key: 'studio:health.warnings.upload', values: { count: h.uploadErrors } })

  return out
}
