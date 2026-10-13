import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { viewerApi } from '@/features/streams/api/streams-api'
import { clearProgress, saveProgress } from '@/features/vod/lib/progress'
import { createSaveThrottle } from '@/features/vod/lib/progress-sync'

export type WatchProgress = {
  /** Feed every player time update. */
  onTime: (time: number, duration: number) => void
  /** Pause: save right away. */
  onPause: () => void
  /** "Xem từ đầu" / "Xem lại từ đầu": the saved position becomes 0. */
  restart: () => void
}

/**
 * Saves the VOD position: to the account when signed in (`PUT /v1/me/watch-progress`, every 15 s while playing,
 * on pause and when the page is hidden or left, with `keepalive` so the request survives the unload), to this
 * browser for guests.
 */
export function useWatchProgress(vodId: string, durationSec: number): WatchProgress {
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const last = useRef({ time: 0, duration: durationSec, playing: false })
  const throttle = useMemo(() => createSaveThrottle(), [])

  const write = useCallback(
    (time: number, duration: number, keepalive: boolean) => {
      throttle.mark(time, Date.now())
      if (!signedIn) {
        saveProgress(vodId, time, duration)

        return
      }
      const limit = duration > 0 ? duration : time
      const positionSec = Math.max(0, Math.min(Math.floor(time), Math.floor(limit)))
      viewerApi.saveProgress(vodId, { positionSec }, { keepalive }).catch(() => {
        // Best effort: the next save (15 s, pause, leave) tries again.
      })
    },
    [signedIn, vodId, throttle],
  )

  const flush = useCallback(
    (keepalive: boolean) => {
      const { time, duration } = last.current
      if (time <= 0 || throttle.unchanged(time)) return
      write(time, duration, keepalive)
    },
    [write, throttle],
  )

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true)
    }
    const onPageHide = () => flush(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      // Leaving the page inside the app (route change).
      flush(true)
    }
  }, [flush])

  return {
    onTime: useCallback(
      (time: number, duration: number) => {
        last.current = { time, duration: duration || last.current.duration, playing: true }
        if (throttle.due(time, Date.now())) write(time, last.current.duration, false)
      },
      [throttle, write],
    ),
    onPause: useCallback(() => flush(false), [flush]),
    restart: useCallback(() => {
      last.current = { ...last.current, time: 0 }
      if (signedIn) {
        throttle.mark(0, Date.now())
        viewerApi.saveProgress(vodId, { positionSec: 0 }).catch(() => undefined)
      } else {
        clearProgress(vodId)
      }
    }, [signedIn, vodId, throttle]),
  }
}
