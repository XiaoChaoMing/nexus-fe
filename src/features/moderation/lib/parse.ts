import { parseBadge } from '@/features/chat/lib/parse'
import type { ChatBadge } from '@/features/chat/types'
import type { ActorRef, Block, BlockedTerm, ChannelRole, ChannelRoleName, ModChannel, Page, Restriction, RestrictionType, UserCard, UserRef } from '@/features/moderation/types'

/** chat-svc / identity payloads are untrusted: broken items are dropped, never thrown. */

type Rec = Record<string, unknown>

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function dateOrNull(v: unknown): string | null {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null
}

function imageUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > 2048) return null
  if (v.startsWith('/') && !v.startsWith('//')) return v

  return /^https?:\/\//i.test(v) ? v : null
}

export function parseUserRef(v: unknown): UserRef | null {
  if (!isRec(v) || !str(v.id)) return null
  const username = str(v.username)

  return { id: str(v.id), username, displayName: str(v.displayName) || username }
}

function actor(v: unknown): ActorRef | null {
  return isRec(v) && str(v.id) ? { id: str(v.id), username: str(v.username) } : null
}

function restrictionType(v: unknown): RestrictionType | null {
  return v === 'BAN' || v === 'TIMEOUT' ? v : null
}

function roleName(v: unknown): ChannelRoleName | null {
  return v === 'MODERATOR' || v === 'VIP' ? v : null
}

function items(v: unknown): unknown[] {
  return isRec(v) && Array.isArray(v.items) ? v.items : []
}

function page<T>(v: unknown, parse: (x: unknown) => T | null): Page<T> {
  return { items: items(v).map(parse).filter((x): x is T => x !== null), nextCursor: isRec(v) ? strOrNull(v.nextCursor) : null }
}

export function parseRestriction(v: unknown): Restriction | null {
  if (!isRec(v)) return null
  const user = parseUserRef(v.user)
  const type = restrictionType(v.type)
  if (!user || !type) return null

  return { user, type, until: dateOrNull(v.until), actor: actor(v.actor), reason: strOrNull(v.reason), createdAt: dateOrNull(v.createdAt) ?? '' }
}

export const parseRestrictions = (v: unknown) => page(v, parseRestriction)

export function parseRole(v: unknown): ChannelRole | null {
  if (!isRec(v)) return null
  const user = parseUserRef(v.user)
  const role = roleName(v.role)
  if (!user || !role) return null

  return { user, role, grantedBy: actor(v.grantedBy), createdAt: dateOrNull(v.createdAt) ?? '' }
}

export const parseRoles = (v: unknown) => page(v, parseRole)

export function parseCard(v: unknown): UserCard | null {
  if (!isRec(v)) return null
  const user = parseUserRef(v.user)
  if (!user) return null
  const r = isRec(v.restriction) ? v.restriction : null
  const type = r ? restrictionType(r.type) : null
  const role = v.role === 'OWNER' ? 'OWNER' : roleName(v.role)

  const badges = Array.isArray(v.badges) ? v.badges.map(parseBadge).filter((b): b is ChatBadge => b !== null) : []

  return {
    user,
    badges: [...new Set(badges)],
    createdAt: dateOrNull(v.createdAt),
    role,
    followedAt: dateOrNull(v.followedAt),
    restriction: r && type ? { type, until: dateOrNull(r.until) } : null,
  }
}

export function parseTerm(v: unknown): BlockedTerm | null {
  if (!isRec(v) || !str(v.id) || !str(v.term)) return null

  return { id: str(v.id), term: str(v.term), createdBy: actor(v.createdBy), createdAt: dateOrNull(v.createdAt) ?? '' }
}

export function parseTerms(v: unknown): { items: BlockedTerm[]; limit: number } {
  const limit = isRec(v) && typeof v.limit === 'number' && v.limit > 0 ? v.limit : 100

  return { items: items(v).map(parseTerm).filter((x): x is BlockedTerm => x !== null), limit }
}


function parseModChannel(v: unknown): ModChannel | null {
  if (!isRec(v) || !isRec(v.channel) || !str(v.channel.id)) return null
  const role = roleName(v.role)
  if (!role) return null
  const c = v.channel
  const handle = str(c.handle)

  return { channel: { id: str(c.id), handle, displayName: str(c.displayName) || handle, avatarUrl: imageUrl(c.avatarUrl), isLive: c.isLive === true }, role }
}

export function parseModChannels(v: unknown): ModChannel[] {
  return items(v).map(parseModChannel).filter((x): x is ModChannel => x !== null)
}

function parseBlock(v: unknown): Block | null {
  if (!isRec(v)) return null
  const user = parseUserRef(v.user)

  return user ? { user, createdAt: dateOrNull(v.createdAt) ?? '' } : null
}

export const parseBlocks = (v: unknown) => page(v, parseBlock)

/** `GET /v1/me/blocks?fields=ids` → `{items: [{userId}]}` (≤ 1000). */
export function parseBlockIds(v: unknown): string[] {
  return items(v)
    .map((i) => (isRec(i) ? str(i.userId) : typeof i === 'string' ? i : ''))
    .concat(isRec(v) && Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === 'string') : [])
    .filter(Boolean)
}
