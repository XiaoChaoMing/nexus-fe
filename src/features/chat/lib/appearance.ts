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
 * BR16: 12 fixed username colours, each ≥ 4.5:1 on the chat column (`surface` #18181B) and on `card`
 * (#202024). No crimson (Live/error) and no Electric Pulse green (mentions).
 */
export const USERNAME_PALETTE = [
  '#FB923C',
  '#FBBF24',
  '#A3E635',
  '#2DD4BF',
  '#22D3EE',
  '#38BDF8',
  '#60A5FA',
  '#818CF8',
  '#A78BFA',
  '#C084FC',
  '#E879F9',
  '#F472B6',
] as const

/** FNV-1a: a stable, well spread hash of the user id. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
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
