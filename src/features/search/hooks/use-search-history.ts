import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { searchApi } from '@/features/search/api'
import { mergeHistory, pushHistory, readGuestHistory, removeHistory, writeGuestHistory } from '@/features/search/lib/history'
import type { HistoryEntry } from '@/features/search/types'

/** "Xóa tất cả" can be undone this long (15a, ô 6). */
const UNDO_MS = 5000

const historyKey = (viewer: string) => ['me', 'search-history', viewer] as const

/**
 * Recent searches: the account's server list (G4-Q8) or this browser's for guests. Entries a guest made are
 * uploaded once after sign-in (shown merged meanwhile), then forgotten locally.
 */
export function useSearchHistory() {
  const { t } = useTranslation('search')
  const qc = useQueryClient()
  const viewer = useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))
  const [local, setLocal] = useState<HistoryEntry[]>(() => readGuestHistory())
  const [hidden, setHidden] = useState(false)
  const pendingClear = useRef<number | null>(null)

  const server = useQuery({
    queryKey: historyKey(viewer ?? 'guest'),
    queryFn: () => searchApi.history(),
    enabled: viewer !== null,
    select: (d) => d?.items ?? [],
    staleTime: 60_000,
  })

  // Sign-in: upload what the guest searched (oldest first so the newest ends on top), then drop the local copy.
  useEffect(() => {
    if (!viewer || local.length === 0) return
    const entries = [...local].reverse()
    let cancelled = false
    void (async () => {
      for (const e of entries) {
        if (cancelled) return
        await searchApi.addHistory(e.query).catch(() => undefined)
      }
      if (cancelled) return
      writeGuestHistory([])
      setLocal([])
      void qc.invalidateQueries({ queryKey: historyKey(viewer) })
    })()

    return () => {
      cancelled = true
    }
    // Runs when the account changes; `local` is read once for that account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer])

  useEffect(
    () => () => {
      if (pendingClear.current !== null) window.clearTimeout(pendingClear.current)
    },
    [],
  )

  const items = hidden ? [] : viewer ? mergeHistory(server.data ?? [], local) : local

  const add = useCallback(
    (query: string) => {
      if (viewer) {
        qc.setQueryData<{ items: HistoryEntry[] }>(historyKey(viewer), (d) => ({ items: pushHistory(d?.items ?? [], query) }))
        void searchApi
          .addHistory(query)
          .then(() => qc.invalidateQueries({ queryKey: historyKey(viewer) }))
          .catch(() => undefined)

        return
      }
      setLocal((l) => {
        const next = pushHistory(l, query)
        writeGuestHistory(next)

        return next
      })
    },
    [viewer, qc],
  )

  const remove = useCallback(
    (entry: HistoryEntry) => {
      if (viewer && !entry.id.startsWith('local-')) {
        qc.setQueryData<{ items: HistoryEntry[] }>(historyKey(viewer), (d) => ({ items: removeHistory(d?.items ?? [], entry.id) }))
        void searchApi.removeHistory(entry.id).catch(() => qc.invalidateQueries({ queryKey: historyKey(viewer) }))

        return
      }
      setLocal((l) => {
        const next = removeHistory(l, entry.id)
        writeGuestHistory(next)

        return next
      })
    },
    [viewer, qc],
  )

  /** Hides the list at once; the deletion happens when the undo toast expires. */
  const clearAll = useCallback(() => {
    setHidden(true)
    const commit = () => {
      pendingClear.current = null
      setHidden(false)
      writeGuestHistory([])
      setLocal([])
      if (viewer) {
        qc.setQueryData(historyKey(viewer), { items: [] })
        void searchApi.clearHistory().catch(() => qc.invalidateQueries({ queryKey: historyKey(viewer) }))
      }
    }
    pendingClear.current = window.setTimeout(commit, UNDO_MS)
    toast(t('historyCleared'), {
      duration: UNDO_MS,
      action: {
        label: t('undo'),
        onClick: () => {
          if (pendingClear.current !== null) window.clearTimeout(pendingClear.current)
          pendingClear.current = null
          setHidden(false)
        },
      },
    })
  }, [viewer, qc, t])

  return { items, add, remove, clearAll }
}
