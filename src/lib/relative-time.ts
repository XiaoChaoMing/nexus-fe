/** Locale-pure formatters (the UI wrappers in `format.ts` pass the current locale). */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
]

/** "2 giờ trước" / "2 hours ago"; under a minute counts as one minute ago. */
export function relativeTimeIn(locale: string, iso: string | null, now = Date.now()): string {
  if (!iso) return ''
  const sec = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  for (const [unit, size] of UNITS) {
    if (sec >= size) return rtf.format(-Math.floor(sec / size), unit)
  }

  return rtf.format(-1, 'minute')
}

/** "vi" → "Tiếng Việt" (in Vietnamese UI), "en" → "English"; unknown codes come back unchanged. */
export function languageNameIn(locale: string, code: string): string {
  if (!code) return ''
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code)
    if (!name || name === code) return code

    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
  } catch {
    return code
  }
}
