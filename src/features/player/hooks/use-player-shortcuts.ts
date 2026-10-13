import { useEffect } from 'react'
import { ignoresPlayerShortcut } from '@/features/player/lib/shortcut-target'

export type ShortcutHandlers = {
  togglePlay: () => void
  toggleMute: () => void
  toggleFullscreen: () => void
  toggleTheater?: () => void
  seekBy: (deltaSec: number) => void
  volumeBy: (delta: number) => void
  escape: () => void
}

const SEEK = 10
const VOLUME = 0.1


/** UC-A08: Space/K, M, F, T, ←/→, ↑/↓, Esc — ignored while typing or inside another dialog/menu. */
export function usePlayerShortcuts(enabled: boolean, h: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (ignoresPlayerShortcut(target)) return
      // Space on a focused button presses that button (a11y), it does not toggle playback.
      if (e.key === ' ' && target?.closest('button, a, [role="slider"]')) return

      const actions: Record<string, () => void> = {
        ' ': h.togglePlay,
        k: h.togglePlay,
        m: h.toggleMute,
        f: h.toggleFullscreen,
        t: () => h.toggleTheater?.(),
        ArrowLeft: () => h.seekBy(-SEEK),
        ArrowRight: () => h.seekBy(SEEK),
        ArrowUp: () => h.volumeBy(VOLUME),
        ArrowDown: () => h.volumeBy(-VOLUME),
        Escape: h.escape,
      }

      const action = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key]
      if (!action) return

      // Space would also scroll the page / press the focused button.
      e.preventDefault()
      action()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, h])
}
