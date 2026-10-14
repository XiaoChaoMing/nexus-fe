import type { NotifyLevel } from '@/features/channels/types'

/** What a Follow button shows: the viewer's follow and bell, plus the follower count when the page has it. */
export type FollowView = {
  following: boolean
  notifyLevel: NotifyLevel | null
  followerCount: number | null
}

export type FollowOp = { type: 'follow' } | { type: 'unfollow' } | { type: 'setLevel'; level: NotifyLevel }

/** Default bell of a new follow (NXL-D BR-D19). */
export const DEFAULT_NOTIFY_LEVEL: NotifyLevel = 'ALL'

/**
 * Optimistic result of an operation (NXL-D §3.7: the button changes at once). Returns the same object when the
 * operation changes nothing, so a repeated click neither moves the count nor sends a second request.
 */
export function applyFollowOp(view: FollowView, op: FollowOp): FollowView {
  const count = (delta: number) => (view.followerCount === null ? null : Math.max(0, view.followerCount + delta))
  switch (op.type) {
    case 'follow':
      return view.following ? view : { following: true, notifyLevel: DEFAULT_NOTIFY_LEVEL, followerCount: count(1) }
    case 'unfollow':
      return view.following ? { following: false, notifyLevel: null, followerCount: count(-1) } : view
    case 'setLevel':
      return view.following && view.notifyLevel !== op.level ? { ...view, notifyLevel: op.level } : view
  }
}

/** Server answer wins over the optimistic guess, except for the count the server does not return. */
export function settleFollow(view: FollowView, server: { following: boolean; notifyLevel: NotifyLevel | null }): FollowView {
  if (view.following === server.following && view.notifyLevel === server.notifyLevel) return view

  return { ...view, following: server.following, notifyLevel: server.following ? (server.notifyLevel ?? DEFAULT_NOTIFY_LEVEL) : null }
}

/** Bell icon per level (Components GĐ4): active / plain / crossed out. */
export function bellKind(level: NotifyLevel | null): 'active' | 'plain' | 'off' {
  if (level === 'OFF') return 'off'

  return level === 'LIVE_ONLY' ? 'plain' : 'active'
}
