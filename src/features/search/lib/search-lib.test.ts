import { describe, expect, it } from 'vitest'
import type { HistoryEntry } from '@/features/search/types'
import { mergeHistory, pushHistory, readGuestHistory, removeHistory, writeGuestHistory } from './history'
import { fold, highlight, matchesQuery, searchQuery } from './text'

const entry = (id: string, query: string, createdAt: string): HistoryEntry => ({ id, query, createdAt })

describe('search history', () => {
  it('puts the newest first, de-duplicated without case, at most ten', () => {
    let list: HistoryEntry[] = []
    for (let i = 0; i < 12; i++) list = pushHistory(list, `q${i}`, 1000 + i)
    expect(list).toHaveLength(10)
    expect(list[0]?.query).toBe('q11')
    list = pushHistory(list, 'Q5', 5000)
    expect(list[0]?.query).toBe('Q5')
    expect(list.filter((e) => e.query.toLowerCase() === 'q5')).toHaveLength(1)
    expect(pushHistory(list, '   ', 6000)).toBe(list)
    expect(removeHistory(list, list[0]?.id ?? '')).toHaveLength(9)
  })

  it('merges guest entries into the account list by date', () => {
    const server = [entry('1', 'valorant', '2026-10-14T10:00:00Z'), entry('2', 'kaelen', '2026-10-13T10:00:00Z')]
    const local = [entry('l1', 'Valorant', '2026-10-14T11:00:00Z'), entry('l2', 'lien minh', '2026-10-14T09:00:00Z')]
    expect(mergeHistory(server, local).map((e) => e.query)).toEqual(['valorant', 'lien minh', 'kaelen'])
    expect(mergeHistory(server, local, 2)).toHaveLength(2)
  })

  it('stores the guest list and survives broken storage', () => {
    const mem = new Map<string, string>()
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
    writeGuestHistory([entry('a', 'x', '2026-10-14T00:00:00Z')], s)
    expect(readGuestHistory(s)).toHaveLength(1)
    mem.set('nxl.searchHistory', '{bad')
    expect(readGuestHistory(s)).toEqual([])
    writeGuestHistory([], s)
    expect(mem.size).toBe(0)
  })
})

describe('search text', () => {
  it('folds Vietnamese diacritics and đ', () => {
    expect(fold('Liên Minh Huyền Thoại')).toBe('lien minh huyen thoai')
    expect(fold('Đấu Trường')).toBe('dau truong')
    expect(fold('Liên')).toBe('lien') // NFD input
  })

  it('accepts 2–100 characters after trimming', () => {
    expect(searchQuery('  lien   minh ')).toBe('lien minh')
    expect(searchQuery('a')).toBeNull()
    expect(searchQuery('x'.repeat(101))).toBeNull()
  })

  it('bolds the diacritics-insensitive match', () => {
    expect(highlight('Liên Minh Huyền Thoại', 'lien minh')).toEqual([
      { text: 'Liên Minh', match: true },
      { text: ' Huyền Thoại', match: false },
    ])
    expect(highlight('Huyền Thoại Liên Minh', 'minh huyen').filter((s) => s.match).map((s) => s.text)).toEqual(['Huyền', 'Minh'])
    expect(highlight('Valorant', '')).toEqual([{ text: 'Valorant', match: false }])
  })

  it('filters local lists by every word', () => {
    expect(matchesQuery('Liên Quân Mobile', 'lien mob')).toBe(true)
    expect(matchesQuery('Liên Quân Mobile', 'minh')).toBe(false)
  })
})
