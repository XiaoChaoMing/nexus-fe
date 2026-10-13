import { describe, expect, it } from 'vitest'
import { languageNameIn, relativeTimeIn } from './relative-time'

const now = Date.parse('2026-10-14T12:00:00Z')

describe('relative time', () => {
  it('rounds down to the largest unit', () => {
    expect(relativeTimeIn('en-US', '2026-10-14T10:00:00Z', now)).toBe('2 hours ago')
    expect(relativeTimeIn('en-US', '2026-10-14T11:15:00Z', now)).toBe('45 minutes ago')
    expect(relativeTimeIn('en-US', '2026-10-14T11:59:40Z', now)).toBe('1 minute ago')
    expect(relativeTimeIn('en-US', '2026-10-11T12:00:00Z', now)).toBe('3 days ago')
    expect(relativeTimeIn('vi-VN', '2026-10-14T10:00:00Z', now)).toBe('2 giờ trước')
    expect(relativeTimeIn('en-US', null, now)).toBe('')
  })

  it('names languages in the UI language', () => {
    expect(languageNameIn('vi-VN', 'vi')).toBe('Tiếng Việt')
    expect(languageNameIn('en-US', 'vi')).toBe('Vietnamese')
    expect(languageNameIn('en-US', 'en')).toBe('English')
    expect(languageNameIn('en-US', '')).toBe('')
  })
})
