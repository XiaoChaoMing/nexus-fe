import { describe, expect, it } from 'vitest'
import { channelInitial, channelInitials, channelName } from './channel-display'

describe('channel display', () => {
  it('builds initials from the display name, else the handle', () => {
    expect(channelInitials({ displayName: 'Kaelen Vanguard', handle: 'kaelen' })).toBe('KV')
    expect(channelInitials({ displayName: 'kaelen  van  guard', handle: 'k' })).toBe('KV')
    expect(channelInitials({ displayName: 'Kaelen Vanguard', handle: 'k' }, 1)).toBe('K')
    expect(channelInitials({ displayName: '', handle: 'creator' })).toBe('C')
    expect(channelInitials(null)).toBe('?')
    expect(channelInitial({ displayName: 'élan', handle: '' })).toBe('É')
  })

  it('names a channel by display name, then handle', () => {
    expect(channelName({ id: '1', handle: 'h', displayName: ' ', avatarUrl: null })).toBe('h')
    expect(channelName(undefined)).toBeNull()
  })
})
