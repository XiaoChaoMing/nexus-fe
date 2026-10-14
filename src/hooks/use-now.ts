import { useEffect, useState } from 'react'

/**
 * Current time, refreshed every `intervalMs` (relative labels, "processing" timeouts, countdowns). Switching to
 * another interval takes a fresh reading right away, so a countdown that starts ticking never shows a stale time.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, intervalMs)

    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [intervalMs])

  return now
}
