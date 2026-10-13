import type { Me, Role, User } from '@/features/auth/types'

export const DEFAULT_PREFERENCES = { sidebarCollapsed: false, matureVisible: false } as const

/**
 * Shell data derived from the session user when `GET /v1/me` is unavailable (older identity or a failed call):
 * roles follow the TSD rule — always VIEWER, CREATOR with a channel, ADMIN for globalRole ADMIN.
 */
export function meFromUser(user: User): Me {
  const isCreator = Boolean(user.isCreator || user.channelId)
  const roles: Role[] = ['VIEWER']
  if (isCreator) roles.push('CREATOR')
  if (user.globalRole === 'ADMIN') roles.push('ADMIN')

  return {
    user,
    roles,
    isCreator,
    channelId: user.channelId ?? null,
    unreadNotifications: 0,
    preferences: { ...DEFAULT_PREFERENCES },
  }
}

/** Fills fields a partial or older `/v1/me` payload may lack. */
export function normalizeMe(raw: Partial<Me> & { user: User }): Me {
  const fallback = meFromUser(raw.user)
  const isCreator = raw.isCreator ?? fallback.isCreator
  const roles = Array.isArray(raw.roles) && raw.roles.length > 0 ? raw.roles : fallback.roles

  return {
    user: { ...raw.user, isCreator, channelId: raw.channelId ?? raw.user.channelId ?? null },
    roles: roles.includes('VIEWER') ? roles : ['VIEWER', ...roles],
    isCreator,
    channelId: raw.channelId ?? fallback.channelId,
    unreadNotifications: typeof raw.unreadNotifications === 'number' ? raw.unreadNotifications : 0,
    preferences: { ...DEFAULT_PREFERENCES, ...raw.preferences },
  }
}

export function hasRole(me: Me | null, role: Role): boolean {
  return Boolean(me?.roles.includes(role))
}

export function isAdmin(me: Me | null): boolean {
  return hasRole(me, 'ADMIN')
}

export function isCreator(me: Me | null): boolean {
  return Boolean(me && (me.isCreator || me.roles.includes('CREATOR')))
}

export type GoLiveTarget = 'login' | '/creator/apply' | '/studio/stream'

/** NXL-C BR28: Creator → Studio, Viewer → Creator application, Guest → login modal. */
export function goLiveTarget(me: Me | null): GoLiveTarget {
  if (!me) return 'login'

  return isCreator(me) ? '/studio/stream' : '/creator/apply'
}

/** Bell badge text (NXL-C §8.6): nothing for 0, "99+" above 99. */
export function unreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null

  return count > 99 ? '99+' : String(Math.floor(count))
}

/** URL of the separate admin app (never part of this bundle). */
export function adminUrl(): string {
  // `||`: an empty variable in .env means "not set".
  return (import.meta.env.VITE_ADMIN_URL as string | undefined) || 'http://localhost:5174'
}
