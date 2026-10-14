import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { ConnectionStatus, TopicListener } from '@/lib/realtime/client'
import { realtime } from '@/lib/realtime/realtime'

/** State of the app-wide connection, for banners and the chat input. */
export function useRealtimeStatus(): ConnectionStatus {
  const subscribe = useCallback((notify: () => void) => realtime().onStatus(notify), [])

  return useSyncExternalStore(subscribe, () => realtime().status, () => 'idle')
}

/**
 * Listens to a topic while mounted (`null` = none). The latest callbacks are used without resubscribing, so
 * callers may pass inline functions.
 */
export function useRealtimeTopic(topic: string | null, listener: TopicListener) {
  const ref = useRef(listener)
  useEffect(() => {
    ref.current = listener
  })

  useEffect(() => {
    if (!topic) return

    return realtime().subscribe(topic, {
      onSubscribed: (snapshot, info) => ref.current.onSubscribed?.(snapshot, info),
      onEvent: (ev) => ref.current.onEvent?.(ev),
      onResync: () => ref.current.onResync?.(),
      onError: (err) => ref.current.onError?.(err),
    })
  }, [topic])
}
