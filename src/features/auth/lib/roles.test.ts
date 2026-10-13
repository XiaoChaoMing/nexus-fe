import { describe, expect, it } from 'vitest'
import type { Me, User } from '@/features/auth/types'
import { goLiveTarget, hasRole, isAdmin, isCreator, meFromUser, normalizeMe, unreadBadge } from './roles'

const user: User = {
  id: 'u1',
  username: 'minh',
  displayName: 'Minh',
  email: 'm@example.com',
  emailVerified: true,
  globalRole: 'USER',
  createdAt: '2026-10-13T00:00:00Z',
}

describe('meFromUser', () => {
  it('derives roles from the session user', () => {
    expect(meFromUser(user).roles).toEqual(['VIEWER'])
    expect(meFromUser({ ...user, isCreator: true, channelId: 'c1' }).roles).toEqual(['VIEWER', 'CREATOR'])
    expect(meFromUser({ ...user, globalRole: 'ADMIN' }).roles).toEqual(['VIEWER', 'ADMIN'])
    expect(meFromUser({ ...user, channelId: 'c1' }).isCreator).toBe(true)
  })
})

describe('normalizeMe', () => {
  it('keeps a full /v1/me payload', () => {
    const raw: Me = {
      user,
      roles: ['VIEWER', 'CREATOR', 'ADMIN'],
      isCreator: true,
      channelId: 'c1',
      unreadNotifications: 3,
      preferences: { sidebarCollapsed: true, matureVisible: false },
    }
    const me = normalizeMe(raw)
    expect(me.roles).toEqual(['VIEWER', 'CREATOR', 'ADMIN'])
    expect(me.user.channelId).toBe('c1')
    expect(me.preferences.sidebarCollapsed).toBe(true)
  })

  it('fills missing fields and always includes VIEWER', () => {
    const me = normalizeMe({ user: { ...user, globalRole: 'ADMIN' }, roles: ['ADMIN'] })
    expect(me.roles).toEqual(['VIEWER', 'ADMIN'])
    expect(me.unreadNotifications).toBe(0)
    expect(me.preferences).toEqual({ sidebarCollapsed: false, matureVisible: false })
    expect(normalizeMe({ user }).roles).toEqual(['VIEWER'])
  })
})

describe('role helpers', () => {
  const viewer = meFromUser(user)
  const creator = normalizeMe({ user, roles: ['VIEWER', 'CREATOR'], isCreator: true, channelId: 'c1' })
  const admin = normalizeMe({ user: { ...user, globalRole: 'ADMIN' }, roles: ['VIEWER', 'ADMIN'] })

  it('answers role questions', () => {
    expect(isCreator(creator)).toBe(true)
    expect(isCreator(viewer)).toBe(false)
    expect(isCreator(null)).toBe(false)
    expect(isAdmin(admin)).toBe(true)
    expect(isAdmin(creator)).toBe(false)
    expect(hasRole(viewer, 'VIEWER')).toBe(true)
  })

  it('routes "Phát trực tiếp" by role (NXL-C BR28)', () => {
    expect(goLiveTarget(null)).toBe('login')
    expect(goLiveTarget(viewer)).toBe('/creator/apply')
    expect(goLiveTarget(creator)).toBe('/studio/stream')
  })

  it('formats the bell badge', () => {
    expect(unreadBadge(0)).toBeNull()
    expect(unreadBadge(-1)).toBeNull()
    expect(unreadBadge(7)).toBe('7')
    expect(unreadBadge(100)).toBe('99+')
  })
})
