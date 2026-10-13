import { useCallback, useSyncExternalStore } from 'react'

/** Tailwind breakpoints used to switch layouts that cannot be expressed in CSS alone. */
export const MEDIA = {
  md: '(min-width: 768px)',
  xl: '(min-width: 1280px)',
} as const

/** Live `matchMedia` result; false where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)

      return () => mql.removeEventListener('change', notify)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}
