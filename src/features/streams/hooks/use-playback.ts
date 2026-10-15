import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { errorCode } from '@/lib/api-error'
import { streamsApi, type PlaybackKind } from '@/features/streams/api/streams-api'
import { anonId, rememberAnonId } from '@/features/streams/lib/anon-id'
import { acknowledgesAutomatically, playbackDecision, playbackRequest, type PlaybackDecision } from '@/features/streams/lib/playback'

export type PlaybackState = {
  /** undefined while the session is being opened. */
  decision: PlaybackDecision | undefined
  failed: boolean
  retry: () => void
  /** The viewer confirmed the 18+ gate: open the session again with the acknowledgement. */
  acknowledge: () => void
  /** The signed manifest URL expired (403): open a new session once per URL; false when already tried. */
  renew: () => boolean
  /** API error code of a refused session (`CHANNEL_SUSPENDED`…), '' otherwise. */
  errorCode: string
}

/**
 * Opens a playback session (TSD GĐ2 S1) and turns it into what the player needs: a manifest URL or the 18+
 * gate. Signed-in viewers who allow mature content in their preferences skip the gate.
 */
export function usePlayback(kind: PlaybackKind, id: string, enabled = true): PlaybackState {
  const viewer = useAuthStore((s) => s.user?.id ?? null)
  const matureVisible = useAuthStore((s) => s.me?.preferences.matureVisible)
  const signedIn = viewer !== null
  const [acknowledged, setAcknowledged] = useState(false)
  const acknowledge = acknowledged || acknowledgesAutomatically(signedIn, matureVisible)

  const query = useQuery({
    queryKey: ['playback', kind, id, viewer ?? 'guest', acknowledge],
    queryFn: async () => {
      const p = await streamsApi.openPlayback(kind, id, playbackRequest({ signedIn, acknowledge, anonId: () => anonId() }))
      if (p?.anonId) rememberAnonId(p.anonId)

      return p
    },
    enabled: enabled && Boolean(id),
    // A session is opened once per visit; never refetched in the background.
    staleTime: Infinity,
    gcTime: 0,
  })

  const { refetch } = query
  const currentUrl = query.data?.manifestUrl ?? null
  const renewedFor = useRef<string | null>(null)
  const renew = useCallback(() => {
    if (!currentUrl || renewedFor.current === currentUrl) return false
    renewedFor.current = currentUrl
    void refetch()

    return true
  }, [currentUrl, refetch])

  return {
    decision: query.data ? playbackDecision(query.data) : undefined,
    failed: query.isError,
    retry: useCallback(() => void refetch(), [refetch]),
    acknowledge: useCallback(() => setAcknowledged(true), []),
    renew,
    errorCode: errorCode(query.error),
  }
}
