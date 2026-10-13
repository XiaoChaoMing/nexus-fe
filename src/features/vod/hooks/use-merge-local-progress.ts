import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { viewerApi } from '@/features/streams/api/streams-api'
import { clearProgress, localProgressEntries } from '@/features/vod/lib/progress'
import { mergeLocalProgress } from '@/features/vod/lib/progress-sync'

const mergedFor = new Set<string>()

/** G2-Q4: when an account signs in, the positions this browser kept as a guest move to the account, once. */
export function useMergeLocalProgress() {
  const userId = useAuthStore((s) => (s.status === 'authenticated' ? s.user?.id : undefined))
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId || mergedFor.has(userId)) return
    mergedFor.add(userId)
    const entries = localProgressEntries()
    if (entries.length === 0) return

    void mergeLocalProgress(entries, (vodId, positionSec) => viewerApi.saveProgress(vodId, { positionSec, keepFurther: true }), clearProgress).then(
      (cleared) => {
        if (cleared.length === 0) return
        void queryClient.invalidateQueries({ queryKey: ['me', 'continue-watching'] })
        void queryClient.invalidateQueries({ queryKey: ['vods'] })
      },
    )
  }, [userId, queryClient])
}
