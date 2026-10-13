import type { Playback } from '@/features/streams/types'

export const ANON_HEADER = 'X-NXL-Anon-Id'

/** What the player should do with a playback session response. */
export type PlaybackDecision =
  | { kind: 'mature' }
  | { kind: 'ready'; manifestUrl: string }
  /** No manifest and no gate: the server could not open playback (shown as an error). */
  | { kind: 'unavailable' }

export function playbackDecision(p: Playback): PlaybackDecision {
  if (p.mature.required && !p.mature.acknowledged) return { kind: 'mature' }
  if (p.manifestUrl) return { kind: 'ready', manifestUrl: p.manifestUrl }

  return { kind: 'unavailable' }
}

/**
 * The account opted in to mature content (`preferences.matureVisible`, GĐ1 settings): acknowledge on the
 * first call instead of showing the gate. Guests always confirm themselves.
 */
export function acknowledgesAutomatically(signedIn: boolean, matureVisible: boolean | undefined): boolean {
  return signedIn && matureVisible === true
}

export type PlaybackRequest = {
  body: { acknowledgeMature?: true }
  headers: Record<string, string>
}

/** Guests identify with the browser's anon id; accounts with their Bearer token only. */
export function playbackRequest({ signedIn, acknowledge, anonId }: { signedIn: boolean; acknowledge: boolean; anonId: () => string }): PlaybackRequest {
  return {
    body: acknowledge ? { acknowledgeMature: true } : {},
    headers: signedIn ? {} : { [ANON_HEADER]: anonId() },
  }
}
