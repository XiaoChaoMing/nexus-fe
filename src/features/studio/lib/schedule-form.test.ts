import { describe, expect, it } from 'vitest'
import type { Schedule } from '@/features/studio/types'
import { changesTiming, emptyScheduleForm, firstMatchingDate, fromSchedule, inputOf, parseRrule, previewOccurrences, scheduleState, toScheduleInput, validateScheduleForm, type ScheduleFormValues } from './schedule-form'
import { gmtLabel, zonedToUtc } from '@/lib/timezone'

const VN = 'Asia/Ho_Chi_Minh'
const now = Date.parse('2026-10-14T05:00:00Z')

const form = (over: Partial<ScheduleFormValues> = {}): ScheduleFormValues => ({
  title: 'Leo rank',
  categoryId: null,
  date: '2026-10-17',
  time: '20:00',
  durationMin: 120,
  repeat: 'none',
  days: [],
  timezone: VN,
  ...over,
})

describe('schedule form → API payload', () => {
  it('converts a one-off local time to UTC', () => {
    expect(toScheduleInput(form())).toEqual({ title: 'Leo rank', categoryId: null, startAt: '2026-10-17T13:00:00.000Z', durationMin: 120, rrule: null, timezone: VN })
  })

  it('builds a weekly rule in weekday order and starts on the first listed day', () => {
    // 2026-10-17 is a Saturday; the series starts on Monday the 19th.
    const input = toScheduleInput(form({ repeat: 'weekly', days: ['WE', 'MO'] }))
    expect(input.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE')
    expect(input.startAt).toBe('2026-10-19T13:00:00.000Z')
    expect(firstMatchingDate('2026-10-17', ['SA'])).toBe('2026-10-17')
  })

  it('respects other zones (AC-D19: Tokyo vs Vietnam)', () => {
    expect(toScheduleInput(form({ timezone: 'Asia/Tokyo' })).startAt).toBe('2026-10-17T11:00:00.000Z')
    expect(gmtLabel(now, VN)).toBe('GMT+7')
  })

  it('handles a DST day in New York', () => {
    // 2026-11-01: clocks go back at 02:00 EDT → EST.
    expect(new Date(zonedToUtc('2026-11-01', '20:00', 'America/New_York')).toISOString()).toBe('2026-11-02T01:00:00.000Z')
    expect(new Date(zonedToUtc('2026-10-31', '20:00', 'America/New_York')).toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })

  it('round-trips an existing schedule', () => {
    const s: Schedule = {
      id: 's1', title: 'Leo rank', category: { id: 'c1', slug: 'valorant', name: 'Valorant' }, startAt: '2026-10-19T13:00:00Z',
      durationMin: 90, rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10', timezone: VN, status: 'ACTIVE', parentId: null,
      nextOccurrences: [{ occurrenceAt: '2026-10-19T13:00:00Z', reminderCount: 2, streamId: null }], createdAt: '', updatedAt: '',
    }
    const values = fromSchedule(s)
    expect(values).toMatchObject({ date: '2026-10-19', time: '20:00', repeat: 'weekly', days: ['MO', 'WE'], categoryId: 'c1', durationMin: 90 })
    expect(changesTiming(inputOf(s), toScheduleInput({ ...values, title: 'Đổi tên' }))).toBe(true) // COUNT is dropped by the form
    expect(changesTiming(inputOf({ ...s, rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' }), toScheduleInput({ ...values, title: 'Đổi tên' }))).toBe(false)
    expect(changesTiming(inputOf(s), toScheduleInput({ ...values, time: '21:00' }))).toBe(true)
    expect(scheduleState(s, now)).toBe('active')
    expect(scheduleState({ ...s, status: 'CANCELLED' }, now)).toBe('cancelled')
    expect(scheduleState(s, Date.parse('2027-01-01T00:00:00Z'))).toBe('ended')
  })

  it('parses only the weekly subset', () => {
    expect(parseRrule('FREQ=WEEKLY;BYDAY=FR,MO')).toEqual({ days: ['MO', 'FR'], count: null, until: null })
    expect(parseRrule('FREQ=DAILY')).toBeNull()
    expect(parseRrule('FREQ=WEEKLY')).toBeNull()
    expect(parseRrule(null)).toBeNull()
  })
})

describe('schedule form validation', () => {
  it('accepts a valid form and defaults to tomorrow evening', () => {
    expect(validateScheduleForm(form(), now)).toEqual({})
    expect(emptyScheduleForm(now, VN)).toMatchObject({ date: '2026-10-15', time: '20:00', durationMin: 120, repeat: 'none' })
  })

  it('reports the server rules per field', () => {
    expect(validateScheduleForm(form({ title: '  ' }), now).title).toBe('LENGTH')
    expect(validateScheduleForm(form({ title: 'x'.repeat(141) }), now).title).toBe('LENGTH')
    expect(validateScheduleForm(form({ date: '2026-10-14', time: '11:00' }), now).date).toBe('MIN')
    expect(validateScheduleForm(form({ date: '2027-02-01' }), now).date).toBe('MAX')
    expect(validateScheduleForm(form({ durationMin: 10 }), now).durationMin).toBe('MIN')
    expect(validateScheduleForm(form({ repeat: 'weekly', days: [] }), now).days).toBe('REQUIRED')
    expect(validateScheduleForm(form({ date: '' }), now).date).toBe('REQUIRED')
  })

  it('previews the next five broadcasts', () => {
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    expect(previewOccurrences(form({ repeat: 'weekly', days: ['MO', 'WE'] })).map(iso)).toEqual(['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28', '2026-11-02'])
    expect(previewOccurrences(form()).length).toBe(1)
    expect(previewOccurrences(form({ repeat: 'weekly', days: [] }))).toEqual([])
  })
})
