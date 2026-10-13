import { describe, expect, it } from 'vitest'
import { clearProgress, loadProgress, saveProgress, type Store } from './progress'

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
