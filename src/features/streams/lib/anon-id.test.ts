import { beforeEach, describe, expect, it } from 'vitest'
import { ANON_ID_KEY, anonId, isAnonId, rememberAnonId, resetAnonIdMemory } from './anon-id'

function memory() {
  const data = new Map<string, string>()

  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

const broken = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('guest anon id', () => {
  beforeEach(resetAnonIdMemory)

  it('creates a UUID once and keeps returning it', () => {
    const s = memory()
    const first = anonId(s)
    expect(isAnonId(first)).toBe(true)
    expect(s.data.get(ANON_ID_KEY)).toBe(first)
    resetAnonIdMemory()
    expect(anonId(s)).toBe(first)
  })

  it('replaces a corrupted value', () => {
    const s = memory()
    s.setItem(ANON_ID_KEY, 'not-a-uuid')
    const id = anonId(s)
    expect(isAnonId(id)).toBe(true)
    expect(s.data.get(ANON_ID_KEY)).toBe(id)
  })

  it('adopts the id the server returned', () => {
    const s = memory()
    const server = '3f2a1b4c-1d2e-4f50-8a6b-7c8d9e0f1a2b'
    rememberAnonId(server, s)
    expect(anonId(s)).toBe(server)
    rememberAnonId('garbage', s)
    expect(anonId(s)).toBe(server)
  })

  it('keeps a stable id in memory when storage throws', () => {
    const a = anonId(broken)
    expect(isAnonId(a)).toBe(true)
    expect(anonId(broken)).toBe(a)
    expect(anonId(null)).toBe(a)
  })
})
