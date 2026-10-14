import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { chatApi } from '@/features/chat/api/chat-api'
import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import type { Emote } from '@/features/chat/types'

const RECENT_KEY = 'nxl.recentEmotes'

/** Global emotes (GĐ3 has no channel emotes); rarely change, so cached for the session. */
export function useEmotes() {
  const query = useQuery({ queryKey: ['chat', 'emotes'], queryFn: chatApi.emotes, staleTime: Infinity, retry: 1 })
  const emotes = useMemo(() => query.data ?? [], [query.data])
  const byCode = useMemo(() => new Map(emotes.map((e) => [e.code, e] as const)), [emotes])

  return { emotes, byCode, isPending: query.isPending, isError: query.isError }
}

function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]')

    return Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string').slice(0, CHAT_LIMITS.recentEmotes) : []
  } catch {
    return []
  }
}

/** AF01 "Gần đây": the last emotes picked in this browser (≤ 20). */
export function useRecentEmotes(emotes: readonly Emote[]) {
  const [codes, setCodes] = useState(readRecent)
  const recent = useMemo(() => codes.map((c) => emotes.find((e) => e.code === c)).filter((e): e is Emote => Boolean(e)), [codes, emotes])

  const remember = useCallback((code: string) => {
    setCodes((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, CHAT_LIMITS.recentEmotes)
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        // storage blocked: remembered for this page only
      }

      return next
    })
  }, [])

  return { recent, remember }
}
