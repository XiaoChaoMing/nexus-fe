import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { channelsApi } from '@/features/channels/api/channels-api'
import { applyFollowOp, type FollowOp, type FollowView } from '@/features/channels/lib/follow-state'
import type { ChannelProfileFull, NotifyLevel } from '@/features/channels/types'
import { errorCode } from '@/lib/api-error'

/**
 * Follow state lives in its own cache entry per (viewer, channel), so every Follow button of a channel (header,
 * live page, Following list, search) shows the same thing; the profile's follower count follows it.
 */
export type FollowCacheValue = { following: boolean; notifyLevel: NotifyLevel | null }

export const followKeys = {
  state: (viewer: string, channelId: string) => ['follow', viewer, channelId] as const,
  /** Lists that change when the viewer follows or unfollows. */
  lists: ['me', 'following'] as const,
}

/** Applies `op` to the follow entry and to the follower count of any cached profile of the channel. */
export function applyFollowToCache(qc: QueryClient, viewer: string, channelId: string, op: FollowOp) {
  const key = followKeys.state(viewer, channelId)
  const before = qc.getQueryData<FollowCacheValue>(key) ?? { following: false, notifyLevel: null }
  const view: FollowView = { ...before, followerCount: null }
  const after = applyFollowOp(view, op)
  if (after === view) return
  qc.setQueryData<FollowCacheValue>(key, { following: after.following, notifyLevel: after.notifyLevel })
  if (before.following === after.following) return
  const delta = after.following ? 1 : -1
  qc.setQueriesData<ChannelProfileFull>({ queryKey: ['channels'] }, (p) =>
    p && p.id === channelId
      ? {
          ...p,
          followerCount: Math.max(0, p.followerCount + delta),
          viewer: p.viewer ? { ...p.viewer, following: after.following, notifyLevel: after.notifyLevel } : p.viewer,
        }
      : p,
  )
}

/** Snapshot to roll back to when the request fails. */
export function snapshotFollow(qc: QueryClient, viewer: string, channelId: string) {
  const key = followKeys.state(viewer, channelId)
  const state = qc.getQueryData<FollowCacheValue>(key)
  const profiles = qc.getQueriesData<ChannelProfileFull>({ queryKey: ['channels'] }).filter(([, p]) => p?.id === channelId)

  return () => {
    qc.setQueryData(key, state)
    for (const [k, p] of profiles) qc.setQueryData(k, p)
  }
}

/** Follow started by a guest and finished after sign-in (pending action): no button is waiting on it. */
export async function followAfterSignIn(qc: QueryClient, viewer: string, channelId: string) {
  const rollback = snapshotFollow(qc, viewer, channelId)
  applyFollowToCache(qc, viewer, channelId, { type: 'follow' })
  try {
    const s = await channelsApi.follow(channelId)
    qc.setQueryData<FollowCacheValue>(followKeys.state(viewer, channelId), { following: s.following, notifyLevel: s.notifyLevel })
    toast.success(i18n.t('channel:follow.followed'))
  } catch (err) {
    rollback()
    toast.error(errorCode(err) === 'CANNOT_FOLLOW_SELF' ? i18n.t('channel:follow.self') : i18n.t('channel:follow.failed'))
  } finally {
    void qc.invalidateQueries({ queryKey: followKeys.lists })
    void qc.invalidateQueries({ queryKey: ['channels'] })
  }
}
