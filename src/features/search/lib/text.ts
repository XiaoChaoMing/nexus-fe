/**
 * Client-side text matching for search UI. The server does the real diacritics-insensitive search (unaccent);
 * the client only needs it to bold the matched part ("lien minh" → **Liên Minh** Huyền Thoại) and to filter
 * small local lists (category picker).
 */

export const SEARCH_MIN = 2
export const SEARCH_MAX = 100

/** Folds one character: lower case, no diacritics, "đ" → "d". Every Vietnamese letter folds to one char. */
function foldChar(c: string): string {
  const lower = c.toLowerCase()
  if (lower === 'đ') return 'd'

  return lower.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function fold(text: string): string {
  return [...text.normalize('NFC')].map(foldChar).join('')
}

/** Trimmed query, or null when the server would refuse it (2–100 characters, TSD S5). */
export function searchQuery(raw: string): string | null {
  const q = raw.trim().replace(/\s+/g, ' ')
  const len = [...q].length

  return len >= SEARCH_MIN && len <= SEARCH_MAX ? q : null
}

export type Segment = { text: string; match: boolean }

/**
 * Splits `title` into matched / plain parts for `query`: the whole query when it occurs, else each word of it.
 * Positions are found on the folded text and mapped back to the original characters.
 */
export function highlight(title: string, query: string): Segment[] {
  const chars = [...title.normalize('NFC')]
  // folded index → original char index (each original char yields 0..n folded chars)
  const map: number[] = []
  let folded = ''
  chars.forEach((c, i) => {
    const f = foldChar(c)
    for (let k = 0; k < f.length; k++) map.push(i)
    folded += f
  })
  const q = fold(query.trim())
  if (!q) return [{ text: title, match: false }]

  const marked = new Array<boolean>(chars.length).fill(false)
  const mark = (needle: string) => {
    let found = false
    let from = 0
    while (needle) {
      const at = folded.indexOf(needle, from)
      if (at < 0) break
      found = true
      for (let k = at; k < at + needle.length; k++) {
        const orig = map[k]
        if (orig !== undefined) marked[orig] = true
      }
      from = at + needle.length
    }

    return found
  }
  if (!mark(q)) for (const word of q.split(/\s+/)) if (word.length >= 1) mark(word)

  const out: Segment[] = []
  chars.forEach((c, i) => {
    const match = marked[i] ?? false
    const last = out[out.length - 1]
    if (last && last.match === match) last.text += c
    else out.push({ text: c, match })
  })

  return out
}

/** Diacritics-insensitive "contains every word" test for local filtering. */
export function matchesQuery(text: string, query: string): boolean {
  const hay = fold(text)

  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
}
