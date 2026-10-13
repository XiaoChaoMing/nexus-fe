import { useCallback, useState } from 'react'

function read(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)

    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

/** A boolean UI preference remembered in this browser (e.g. the collapsed chat column). */
export function useLocalFlag(key: string, fallback = false): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => read(key, fallback))

  const set = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // storage blocked: remembered for this page only
      }
    },
    [key],
  )

  return [value, set]
}
