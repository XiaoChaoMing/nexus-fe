import type { ChatBadge } from '@/features/chat/types'

/** BR15: Streamer > Moderator > VIP > Subscriber (tier) > Verified; at most 3 per message. */
// Subscriber tiers share a slot (the integer part); the highest tier sorts first within it.
const BADGE_RANK: Record<ChatBadge, number> = { STREAMER: 0, MODERATOR: 1, VIP: 2, SUB_T3: 3, SUB_T2: 3.1, SUB_T1: 3.2, VERIFIED: 4 }
export const MAX_BADGES = 3

export function visibleBadges(badges: readonly ChatBadge[]): ChatBadge[] {
  const seen = new Set<number>()
  const sorted = [...badges].sort((a, b) => BADGE_RANK[a] - BADGE_RANK[b])
  const out: ChatBadge[] = []
  for (const b of sorted) {
    const slot = Math.floor(BADGE_RANK[b])
    if (seen.has(slot)) continue
    seen.add(slot)
    out.push(b)
    if (out.length === MAX_BADGES) break
  }

  return out
}

/**
 * BR16: the 12 username colours of chat-svc (`entity/author.go`, same FNV-1a pick by user id), each ≥ 4.5:1 on
 * the chat column (`surface` #18181B) and on `card` (#202024).
 */
export const USERNAME_PALETTE = [
  '#FF8A8A',
  '#FFA94D',
  '#FFD43B',
  '#A9E34B',
  '#69DB7C',
  '#63E6BE',
  '#66D9E8',
  '#74C0FC',
  '#91A7FF',
  '#B197FC',
  '#E599F7',
  '#FAA2C1',
] as const

/** FNV-1a 32 over the UTF-8 bytes of the user id: the same pick as chat-svc's `ColorOf`. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (const byte of new TextEncoder().encode(s)) {
    h ^= byte
    h = Math.imul(h, 0x01000193)
  }

  return h >>> 0
}

/** The colour of a user: the server's when it is one of the palette's, else derived from the id. */
export function usernameColor(userId: string, serverColor?: string | null): string {
  const upper = serverColor?.toUpperCase()
  if (upper && (USERNAME_PALETTE as readonly string[]).includes(upper)) return upper

  return USERNAME_PALETTE[hash(userId) % USERNAME_PALETTE.length]
}

function channel(c: number): number {
  const v = c / 255

  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)

  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio of two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)

  return (hi + 0.05) / (lo + 0.05)
}
