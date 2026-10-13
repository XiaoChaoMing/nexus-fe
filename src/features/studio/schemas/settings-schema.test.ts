import { describe, expect, it } from 'vitest'
import { addTags, parseTags, settingsSchema } from './settings-schema'

describe('settingsSchema', () => {
  it('accepts valid settings', () => {
    expect(settingsSchema.safeParse({ title: 'Rank game', tags: ['lol'], language: 'vi', isMature: false }).success).toBe(true)
  })

  it('rejects empty or long titles and too many tags', () => {
    expect(settingsSchema.safeParse({ title: '  ', tags: [], language: 'vi', isMature: false }).success).toBe(false)
    expect(settingsSchema.safeParse({ title: 'x'.repeat(141), tags: [], language: 'vi', isMature: false }).success).toBe(false)
    expect(settingsSchema.safeParse({ title: 'ok', tags: Array.from({ length: 11 }, (_, i) => `t${i}`), language: 'vi', isMature: false }).success).toBe(false)
    expect(settingsSchema.safeParse({ title: 'ok', tags: ['x'.repeat(26)], language: 'vi', isMature: false }).success).toBe(false)
  })

  it('parses comma separated tags', () => {
    expect(parseTags('lol, Valorant ,LOL,, ')).toEqual(['lol', 'Valorant'])
  })

  it('appends typed tags without duplicates', () => {
    expect(addTags(['lol'], 'Valorant, LOL , rank')).toEqual(['lol', 'Valorant', 'rank'])
    expect(addTags(['lol'], '  ')).toEqual(['lol'])
  })
})
