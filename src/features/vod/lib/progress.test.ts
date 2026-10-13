import { describe, expect, it } from 'vitest'
import { clearAllProgress, clearProgress, loadProgress, localProgressEntries, resumePosition, saveProgress, type Store } from './progress'

function memory(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>()

  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('VOD progress', () => {
  it('saves and restores the position in whole seconds', () => {
    const s = memory()
    saveProgress('v1', 125.7, 3600, s)
    expect(loadProgress('v1', s)).toBe(125)
    expect(loadProgress('other', s)).toBeNull()
  })

  it('ignores the first seconds and forgets a finished VOD', () => {
    const s = memory()
    saveProgress('v1', 3, 3600, s)
    expect(loadProgress('v1', s)).toBeNull()

    saveProgress('v1', 600, 3600, s)
    saveProgress('v1', 3595, 3600, s)
    expect(s.data.size).toBe(0)
    expect(loadProgress('v1', s)).toBeNull()
  })

  it('survives garbage and missing storage', () => {
    const s = memory()
    s.setItem('nxl.vod.v1', '{not json')
    expect(loadProgress('v1', s)).toBeNull()
    expect(loadProgress('v1', null)).toBeNull()
    expect(() => saveProgress('v1', 100, 200, null)).not.toThrow()
  })

  it('clears on request', () => {
    const s = memory()
    saveProgress('v1', 100, 3600, s)
    clearProgress('v1', s)
    expect(loadProgress('v1', s)).toBeNull()
  })
})

describe('resume position and local entries', () => {
  it('offers resume only between 5 s and 10 s before the end', () => {
    expect(resumePosition(4.9, 600)).toBeNull()
    expect(resumePosition(192.6, 600)).toBe(192)
    expect(resumePosition(591, 600)).toBeNull()
    expect(resumePosition(null, 600)).toBeNull()
    expect(resumePosition(100, 0)).toBe(100)
  })

  it('lists resumable entries and clears them all', () => {
    const data = new Map<string, string>()
    const s = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() {
        return data.size
      },
    }
    saveProgress('v1', 125, 3600, s)
    saveProgress('v2', 40, 100, s)
    data.set('nxl.player', '{}')
    data.set('nxl.vod.v3', '{"t":2,"d":100}')
    expect(localProgressEntries(s)).toEqual([
      { vodId: 'v1', positionSec: 125 },
      { vodId: 'v2', positionSec: 40 },
    ])
    clearAllProgress(s)
    expect([...data.keys()]).toEqual(['nxl.player'])
  })
})
