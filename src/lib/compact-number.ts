/**
 * Card counts in the Vietnamese short style of the GĐ4 design: "860", "1,2K", "12,4K", "182,4K", "1,2M" (English
 * uses a dot). One decimal, rounded down so a count is never overstated; ",0" is dropped.
 */
export function compactCountIn(locale: string, value: number): string {
  const n = Math.max(0, Math.floor(value))
  if (n < 1000) return String(n)
  const [unit, size] = n < 1_000_000 ? ['K', 1000] : n < 1_000_000_000 ? ['M', 1_000_000] : ['B', 1_000_000_000]
  const tenths = Math.floor((n / size) * 10) / 10
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 0, useGrouping: false }).format(tenths)

  return `${text}${unit}`
}
