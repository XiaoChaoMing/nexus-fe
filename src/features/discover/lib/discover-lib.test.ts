import { describe, expect, it } from 'vitest'
import type { Category } from '@/features/categories/types'
import { countdown, upcomingPhase } from '@/features/watch/lib/upcoming'
import { compactCountIn } from '@/lib/compact-number'
import { addTag, browseSearch, categoryIdsOf, hasFilters, parseBrowseParams } from './browse-params'

describe('browse URL params', () => {
  it('parses and normalizes', () => {
    const p = parseBrowseParams(new URLSearchParams('group=games&view=categories&sort=newest&lang=en&tags=lol,LOL, fps,,'))
    expect(p).toEqual({ group: 'GAMES', view: 'categories', sort: 'newest', language: 'en', tags: ['lol', 'fps'] })
    expect(parseBrowseParams(new URLSearchParams('group=nope&lang=fr'))).toEqual({ group: null, view: 'live', sort: 'viewers', language: null, tags: [] })
  })

  it('leaves defaults out of the URL and round-trips', () => {
    const p = parseBrowseParams(new URLSearchParams(''))
    expect(browseSearch(p)).toBe('')
    const q = addTag({ ...p, view: 'categories', group: 'ESPORTS' }, 'lol')
    expect(q.view).toBe('live') // a tag filters live channels
    expect(browseSearch(q)).toBe('?group=ESPORTS&tags=lol')
    expect(parseBrowseParams(new URLSearchParams(browseSearch(q).slice(1)))).toEqual(q)
    expect(hasFilters(q)).toBe(true)
    expect(addTag(q, 'LOL')).toBe(q)
  })

  it('caps tags at five', () => {
    let p = parseBrowseParams(new URLSearchParams(''))
    for (const t of ['a', 'b', 'c', 'd', 'e', 'f']) p = addTag(p, t)
    expect(p.tags).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('maps a group pill to its category ids', () => {
    const cat = (id: string, group: Category['group']): Category => ({ id, slug: id, name: id, group, posterUrl: null, tags: [], position: 0, viewerCount: null })
    const list = [cat('lol', 'GAMES'), cat('vcs', 'ESPORTS'), cat('val', 'GAMES')]
    expect(categoryIdsOf(list, 'GAMES')).toEqual(['lol', 'val'])
    expect(categoryIdsOf(list, null)).toBeNull()
    expect(categoryIdsOf(undefined, 'MUSIC')).toEqual([])
  })
})

describe('upcoming countdown', () => {
  const start = Date.parse('2026-10-14T13:00:00Z')

  it('counts hours, minutes and seconds with a cyan last minute', () => {
    expect(countdown(start, start - (3600 + 24 * 60 + 5) * 1000)).toEqual({ text: '01:24:05', soon: false, done: false })
    expect(countdown(start, start - 45_000)).toEqual({ text: '00:00:45', soon: true, done: false })
    expect(countdown(start, start - 26 * 3600_000).text).toBe('26:00:00')
    expect(countdown(start, start + 5000)).toEqual({ text: '00:00:00', soon: false, done: true })
    expect(countdown(start, start - 1).text).toBe('00:00:01') // never shows 0 before the start
  })

  it('derives the stage variant', () => {
    expect(upcomingPhase({ status: 'SCHEDULED', scheduledStartAt: '2026-10-14T13:00:00Z' }, start - 1000)).toBe('countdown')
    expect(upcomingPhase({ status: 'SCHEDULED', scheduledStartAt: '2026-10-14T13:00:00Z' }, start)).toBe('waiting')
    expect(upcomingPhase({ status: 'SCHEDULED', scheduledStartAt: null }, start)).toBe('waiting')
    expect(upcomingPhase({ status: 'CANCELLED' }, start)).toBe('cancelled')
    expect(upcomingPhase({ status: 'LIVE' }, start)).toBe('none')
  })
})

describe('compact counts', () => {
  it('uses the Vietnamese short style', () => {
    expect(['860', '1,2K', '12,4K', '182,4K', '1K', '1,2M'].join('|')).toBe(
      [860, 1250, 12_480, 182_400, 1000, 1_234_567].map((n) => compactCountIn('vi-VN', n)).join('|'),
    )
    expect(compactCountIn('en-US', 1250)).toBe('1.2K')
    expect(compactCountIn('vi-VN', -3)).toBe('0')
  })
})
