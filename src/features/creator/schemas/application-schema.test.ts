import { describe, expect, it } from 'vitest'
import { ageOn, applicationSchema, isFutureDate, parseIsoDate } from './application-schema'
import { isCtaDismissed, dismissCta, CTA_DISMISS_DAYS } from '../lib/cta-dismiss'

const today = new Date(2026, 9, 13) // 13 Oct 2026, local time

describe('dates', () => {
  it('parses real calendar dates only', () => {
    expect(parseIsoDate('2000-02-29')).toEqual({ y: 2000, m: 2, d: 29 })
    expect(parseIsoDate('2001-02-29')).toBeNull()
    expect(parseIsoDate('13/10/2000')).toBeNull()
  })

  it('computes age on a day', () => {
    expect(ageOn('2008-10-13', today)).toBe(18)
    expect(ageOn('2008-10-14', today)).toBe(17)
    expect(isFutureDate('2026-10-14', today)).toBe(true)
    expect(isFutureDate('2026-10-13', today)).toBe(false)
  })
})

describe('applicationSchema', () => {
  const schema = applicationSchema(today)
  const ok = { legalName: 'Nguyễn Văn A', birthDate: '2000-01-31', note: '', acceptCreatorTerms: true }

  it('accepts a valid application', () => {
    expect(schema.safeParse(ok).success).toBe(true)
  })

  it.each([
    [{ legalName: 'A' }, 'legalName', 'creator:validation.legalName'],
    [{ birthDate: '2026-12-01' }, 'birthDate', 'creator:validation.birthFuture'],
    [{ birthDate: '2010-01-01' }, 'birthDate', 'creator:validation.underage'],
    [{ birthDate: 'x' }, 'birthDate', 'creator:validation.birthDate'],
    [{ note: 'x'.repeat(501) }, 'note', 'creator:validation.note'],
    [{ acceptCreatorTerms: false }, 'acceptCreatorTerms', 'creator:validation.terms'],
  ])('rejects %j', (patch, path, message) => {
    const r = schema.safeParse({ ...ok, ...patch })
    expect(r.success).toBe(false)
    expect(r.error?.issues.find((i) => i.path.join('.') === path)?.message).toBe(message)
  })
})

describe('Creator CTA dismissal', () => {
  it('hides for 30 days on this device', () => {
    const data = new Map<string, string>()
    const s = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    expect(isCtaDismissed(s, 0)).toBe(false)
    dismissCta(s, 1000)
    expect(isCtaDismissed(s, 1000 + (CTA_DISMISS_DAYS - 1) * 86_400_000)).toBe(true)
    expect(isCtaDismissed(s, 1000 + CTA_DISMISS_DAYS * 86_400_000)).toBe(false)
  })
})
