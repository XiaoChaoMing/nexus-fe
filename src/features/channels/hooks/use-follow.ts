import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { channelsApi } from '@/features/channels/api/channels-api'
import { applyFollowToCache, followKeys, snapshotFollow, type FollowCacheValue } from '@/features/channels/lib/follow-cache'
import type { FollowOp } from '@/features/channels/lib/follow-state'
import type { NotifyLevel } from '@/features/channels/types'
import { errorCode } from '@/lib/api-error'

/** Show the spinner only when a request takes longer than this (Components GĐ4 annotation). */
const SPINNER_DELAY_MS = 300

export type FollowTarget = { id: string; handle: string }

/**
 * Follow state of a channel for the signed-in viewer, with optimistic follow / bell / unfollow (rolled back with a
 * toast on failure). `seed` is what the page already knows (profile `viewer`, a Following row), so no request is
 * needed; otherwise the profile is read once.
 */
export function useFollow(channel: FollowTarget, seed?: FollowCacheValue | null) {
  const { t } = useTranslation('channel')
  const qc = useQueryClient()
  const viewer = useAuthStore((s) => s.user?.id ?? null)
  const [busy, setBusy] = useState(false)

  const query = useQuery({
    queryKey: followKeys.state(viewer ?? 'guest', channel.id),
    queryFn: async (): Promise<FollowCacheValue> => {
      const p = await channelsApi.profile(channel.handle)

      return { following: p.viewer?.following ?? false, notifyLevel: p.viewer?.notifyLevel ?? null }
    },
    enabled: viewer !== null && Boolean(channel.id && channel.handle),
    initialData: seed ?? undefined,
    staleTime: 60_000,
  })

  const run = useCallback(
    async (op: FollowOp) => {
      if (!viewer) return
      const rollback = snapshotFollow(qc, viewer, channel.id)
      applyFollowToCache(qc, viewer, channel.id, op)
      const timer = window.setTimeout(() => setBusy(true), SPINNER_DELAY_MS)
      try {
        if (op.type === 'unfollow') {
          await channelsApi.unfollow(channel.id)
        } else {
          const s = op.type === 'follow' ? await channelsApi.follow(channel.id) : await channelsApi.setNotifyLevel(channel.id, op.level)
          qc.setQueryData<FollowCacheValue>(followKeys.state(viewer, channel.id), { following: s.following, notifyLevel: s.notifyLevel })
        }
        void qc.invalidateQueries({ queryKey: followKeys.lists })
      } catch (err) {
        rollback()
        const code = errorCode(err)
        if (code === 'CANNOT_FOLLOW_SELF') toast.error(t('follow.self'))
        else toast.error(op.type === 'follow' ? t('follow.failed') : op.type === 'unfollow' ? t('follow.unfollowFailed') : t('follow.levelFailed'))
      } finally {
        window.clearTimeout(timer)
        setBusy(false)
      }
    },
    [qc, viewer, channel.id, t],
  )

  return {
    following: query.data?.following ?? false,
    notifyLevel: query.data?.notifyLevel ?? null,
    known: query.data !== undefined,
    busy,
    follow: useCallback(() => void run({ type: 'follow' }), [run]),
    unfollow: useCallback(() => void run({ type: 'unfollow' }), [run]),
    setLevel: useCallback((level: NotifyLevel) => void run({ type: 'setLevel', level }), [run]),
  }
}
