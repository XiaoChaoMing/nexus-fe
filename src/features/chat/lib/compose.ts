import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import type { Fragment } from '@/features/chat/types'

/** What the input does with a draft (the server re-checks everything, BR28). */
export type DraftCheck =
  | { ok: true; body: string }
  | { ok: false; reason: 'empty' | 'tooLong' | 'tooManyLines' }

/** Characters as people count them (an emoji is one), used for the 500 limit and the counter. */
export function charCount(text: string): number {
  return Array.from(text).length
}

export function lineCount(text: string): number {
  return text.split('\n').length
}

/** E04/E05, BR03: trimmed, not empty, ≤ 500 characters, ≤ 3 lines. */
export function checkDraft(draft: string): DraftCheck {
  const body = draft.trim()
  if (!body) return { ok: false, reason: 'empty' }
  if (charCount(body) > CHAT_LIMITS.maxChars) return { ok: false, reason: 'tooLong' }
  if (lineCount(body) > CHAT_LIMITS.maxLines) return { ok: false, reason: 'tooManyLines' }

  return { ok: true, body }
}

/** Shift+Enter adds a line only while the draft has fewer than the allowed lines. */
export function canAddLine(draft: string): boolean {
  return lineCount(draft) < CHAT_LIMITS.maxLines
}

/** §9B: the counter shows from 400 characters. */
export function showCounter(draft: string): boolean {
  return charCount(draft) >= CHAT_LIMITS.counterFrom
}

export type MentionQuery = { start: number; end: number; query: string }

const NAME_CHAR = /[A-Za-z0-9_]/

/**
 * AF02: the `@name` being typed at the caret, if any: `@` at the start or after whitespace, followed by name
 * characters up to the caret.
 */
export function mentionAt(text: string, caret: number): MentionQuery | null {
  let i = caret - 1
  while (i >= 0 && NAME_CHAR.test(text[i])) i -= 1
  if (i < 0 || text[i] !== '@') return null
  if (i > 0 && !/\s/.test(text[i - 1])) return null
  const query = text.slice(i + 1, caret)
  if (query.length > 25) return null

  return { start: i, end: caret, query }
}

export type Chatter = { id: string; username: string; displayName: string }

/** Recent chatters whose username or display name starts with (then contains) the query, case-insensitive. */
export function suggestMentions(chatters: readonly Chatter[], query: string, limit: number = CHAT_LIMITS.mentionSuggestions): Chatter[] {
  const q = query.toLowerCase()
  const prefix: Chatter[] = []
  const contains: Chatter[] = []
  for (const c of chatters) {
    if (!c.username) continue
    const u = c.username.toLowerCase()
    const d = c.displayName.toLowerCase()
    if (u.startsWith(q) || d.startsWith(q)) prefix.push(c)
    else if (q && (u.includes(q) || d.includes(q))) contains.push(c)
  }

  return [...prefix, ...contains].slice(0, limit)
}

export type Edit = { text: string; caret: number }

/** Replaces `[start, end)` with `insert`, keeping one space after it. */
export function replaceRange(text: string, start: number, end: number, insert: string): Edit {
  const after = text.slice(end)
  const sep = after.startsWith(' ') ? '' : ' '
  const next = text.slice(0, start) + insert + sep + after

  return { text: next, caret: start + insert.length + 1 }
}

/** AF01: inserts an emote code at the caret, separated from the words around it. */
export function insertToken(text: string, caret: number, token: string): Edit {
  const before = text.slice(0, caret)
  const pad = before.length > 0 && !/\s$/.test(before) ? ' ' : ''

  return replaceRange(text, caret, caret, pad + token)
}

/** `@username` completed from a suggestion. */
export function completeMention(text: string, m: MentionQuery, username: string): Edit {
  return replaceRange(text, m.start, m.end, `@${username}`)
}

type EmoteRef = { id: string; code: string; imageUrl: string }

/**
 * Fragments for the optimistic copy of our own message, until the server's version replaces it: known emote
 * codes become emotes, `@name` a mention, everything else text (the server is the authority, BR17).
 */
export function localFragments(body: string, emotes: ReadonlyMap<string, EmoteRef>): Fragment[] {
  const out: Fragment[] = []
  let text = ''
  for (const part of body.split(/(\s+)/)) {
    const emote = emotes.get(part)
    const isMention = /^@[A-Za-z0-9_]{1,25}$/.test(part)
    if (!emote && !isMention) {
      text += part
      continue
    }
    if (text) out.push({ type: 'text', text })
    text = ''
    out.push(emote ? { type: 'emote', text: part, emote } : { type: 'mention', text: part, userId: null })
  }
  if (text) out.push({ type: 'text', text })

  return out
}
