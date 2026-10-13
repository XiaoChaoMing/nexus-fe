import { describe, expect, it } from 'vitest'
import { pathWithoutToken, tokenFromSearch } from './url-token'
import { isValidTimeZone, profileSchema } from '../schemas/profile-schema'
import { channelInitial, channelName } from '@/features/channels/lib/channel-display'
import { suggestedChannels } from '@/app/shell/suggested-channels'
import type { Stream } from '@/features/streams/types'

describe('url token', () => {
  it('reads and strips ?token=', () => {
    expect(tokenFromSearch('?token=abc')).toBe('abc')
    expect(tokenFromSearch('?token=%20')).toBeNull()
    expect(tokenFromSearch('')).toBeNull()
    expect(pathWithoutToken('http://x/verify-email?token=abc')).toBe('/verify-email')
    expect(pathWithoutToken('http://x/reset-password?a=1&token=abc#h')).toBe('/reset-password?a=1#h')
    expect(pathWithoutToken('http://x/verify-email')).toBeNull()
  })
})

describe('profileSchema', () => {
  const schema = profileSchema(new Date(2026, 9, 13))

  it('validates PATCH /v1/me fields', () => {
    expect(schema.safeParse({ displayName: 'Minh', birthDate: '', locale: 'vi', timezone: 'Asia/Ho_Chi_Minh' }).success).toBe(true)
    expect(schema.safeParse({ displayName: ' ', birthDate: '', locale: 'vi', timezone: 'UTC' }).success).toBe(false)
    expect(schema.safeParse({ displayName: 'a', birthDate: '2030-01-01', locale: 'vi', timezone: 'UTC' }).success).toBe(false)
    expect(schema.safeParse({ displayName: 'a', birthDate: '', locale: 'fr', timezone: 'UTC' }).success).toBe(false)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
  })
})

describe('channel display', () => {
  it('falls back gracefully', () => {
    expect(channelInitial({ displayName: 'minh', handle: 'm' })).toBe('M')
    expect(channelInitial({ displayName: '', handle: 'zed' })).toBe('Z')
    expect(channelInitial(null)).toBe('?')
    expect(channelName(null)).toBeNull()
    expect(channelName({ id: '1', handle: 'h', displayName: ' ', avatarUrl: null })).toBe('h')
  })

  it('suggests one entry per live channel, at most 10', () => {
    const base = { title: 't', status: 'LIVE' } as unknown as Stream
    const streams = Array.from({ length: 14 }, (_, i) => ({ ...base, id: `s${i}`, channel: { id: `c${i % 12}`, handle: 'h', displayName: 'n', avatarUrl: null } }))
    const out = suggestedChannels([{ ...base, id: 'old', channel: null }, ...streams])
    expect(out).toHaveLength(10)
    expect(out[0].id).toBe('old')
    expect(new Set(out.map((s) => s.channel?.id ?? s.id)).size).toBe(10)
  })
})
