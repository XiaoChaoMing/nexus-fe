import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/stores/auth-store'
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

  return {
    decision: query.data ? playbackDecision(query.data) : undefined,
    failed: query.isError,
    retry: useCallback(() => void refetch(), [refetch]),
    acknowledge: useCallback(() => setAcknowledged(true), []),
  }
}
