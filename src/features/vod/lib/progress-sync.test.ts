import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { createSaveThrottle, mergeLocalProgress } from './progress-sync'

describe('save throttle', () => {
  it('saves once there is something to resume, then every 15 s', () => {
    const th = createSaveThrottle(15_000)
    expect(th.due(3, 0)).toBe(false)
    expect(th.due(5.4, 1000)).toBe(true)
    th.mark(5.4, 1000)
    expect(th.due(6, 5000)).toBe(false)
    expect(th.due(20, 15_999)).toBe(false)
    expect(th.due(20, 16_000)).toBe(true)
  })

  it('never sends the same second twice', () => {
    const th = createSaveThrottle(15_000)
    th.mark(42.2, 0)
    expect(th.due(42.9, 60_000)).toBe(false)
    expect(th.unchanged(42.7)).toBe(true)
    expect(th.unchanged(43)).toBe(false)
  })
})

describe('merge local progress at sign-in', () => {
  it('pushes each entry with keepFurther and clears what the server took', async () => {
    const puts: string[] = []
    const cleared: string[] = []
    const result = await mergeLocalProgress(
      [
        { vodId: 'a', positionSec: 120 },
        { vodId: 'gone', positionSec: 30 },
        { vodId: 'offline', positionSec: 60 },
        { vodId: 'b', positionSec: 300 },
      ],
      async (id, pos) => {
        puts.push(`${id}:${pos}`)
        if (id === 'gone') throw new ApiError(404, 'NOT_FOUND', 'gone')
        if (id === 'offline') throw new ApiError(0, 'NETWORK_ERROR', 'down')
      },
      (id) => cleared.push(id),
    )
    expect(puts).toEqual(['a:120', 'gone:30', 'offline:60', 'b:300'])
    expect(cleared).toEqual(['a', 'gone', 'b'])
    expect(result).toEqual(['a', 'gone', 'b'])
  })
})
