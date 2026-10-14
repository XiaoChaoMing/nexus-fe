import { describe, expect, it } from 'vitest'
import { channelPatch, type ChannelForm } from './channel-form'

const base: ChannelForm = { displayName: 'Kaelen', handle: 'kaelen', bio: 'Hi', socialLinks: [{ type: 'YOUTUBE', url: 'https://youtube.com/@k' }], matureDefault: false }

describe('channel settings patch', () => {
  it('is empty when nothing changed (no Save bar)', () => {
    expect(channelPatch(base, { ...base, displayName: ' Kaelen ', socialLinks: [...base.socialLinks, { type: 'X', url: '  ' }] })).toEqual({})
  })

  it('sends only the changed fields', () => {
    expect(channelPatch(base, { ...base, handle: 'kaelen_vn', matureDefault: true })).toEqual({ handle: 'kaelen_vn', matureDefault: true })
    expect(channelPatch(base, { ...base, bio: '   ' })).toEqual({ bio: null })
    expect(channelPatch(base, { ...base, socialLinks: [] })).toEqual({ socialLinks: [] })
  })
})
