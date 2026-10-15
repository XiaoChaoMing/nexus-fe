import type { ChatBadge, ChatRole } from '@/features/chat/types'
import type { UserCard } from '@/features/moderation/types'

/**
 * Who sees which moderation tool (TSD GĐ5 §6.1, design brief C1/C2). Tools a viewer may not use are not
 * rendered at all; the server still decides (403 → the UI hides the tools).
 */

export type MessageAction = 'delete' | 'timeout' | 'ban' | 'pin' | 'unpin' | 'report' | 'block' | 'unblock' | 'mute' | 'unmute'

export type MessageMenuInput = {
  signedIn: boolean
  /** `snapshot.me.canModerate` (owner, Moderator, Admin). */
  canModerate: boolean
  myRole: ChatRole | undefined
  isOwn: boolean
  isSystem: boolean
  deleted: boolean
  pinned: boolean
  authorBadges: readonly ChatBadge[]
  muted: boolean
  blocked: boolean
}

const isOwnerRole = (role: ChatRole | undefined) => role === 'STREAMER'

/** Timeout / ban: never the owner (accounts are locked by Admins instead), Moderators only by an Admin. */
export function canRestrict(myRole: ChatRole | undefined, authorBadges: readonly ChatBadge[]): boolean {
  if (authorBadges.includes('STREAMER')) return false
  if (authorBadges.includes('MODERATOR')) return myRole === 'ADMIN'

  return true
}

/** Delete: the owner's lines only by the owner or an Admin, another Moderator's by the owner or an Admin. */
export function canDelete(myRole: ChatRole | undefined, authorBadges: readonly ChatBadge[], isOwn: boolean): boolean {
  if (isOwn) return true
  if (authorBadges.includes('STREAMER') || authorBadges.includes('MODERATOR')) return isOwnerRole(myRole) || myRole === 'ADMIN'

  return true
}

/** Items of Menu/Chat Message, in display order; a separator goes before the first personal item. */
export function messageMenu(i: MessageMenuInput): { mod: MessageAction[]; personal: MessageAction[] } {
  if (i.isSystem) return { mod: [], personal: [] }
  const mod: MessageAction[] = []
  if (i.canModerate) {
    if (!i.deleted && canDelete(i.myRole, i.authorBadges, i.isOwn)) mod.push('delete')
    if (!i.isOwn && canRestrict(i.myRole, i.authorBadges)) mod.push('timeout', 'ban')
    if (!i.deleted) mod.push(i.pinned ? 'unpin' : 'pin')
  }
  // Your own lines: nothing personal applies (no reporting or hiding yourself).
  if (i.isOwn) return { mod, personal: [] }
  const personal: MessageAction[] = ['report']
  if (!i.canModerate) {
    personal.push(i.blocked ? 'unblock' : 'block')
    personal.push(i.muted ? 'unmute' : 'mute')
  }

  return { mod, personal }
}

export type CardAction = 'timeout' | 'ban' | 'untimeout' | 'unban' | 'report' | 'block' | 'unblock' | 'mute' | 'unmute' | 'makeMod' | 'makeVip' | 'removeMod' | 'removeVip'

export type CardInput = {
  card: Pick<UserCard, 'role' | 'restriction'>
  canModerate: boolean
  myRole: ChatRole | undefined
  isSelf: boolean
  blocked: boolean
  muted: boolean
  /** A running timeout that has reached its end no longer counts. */
  now: number
}

/** Rows of Chat/User Card by permission (design 03g cells 1–8). */
export function cardActions({ card, canModerate, myRole, isSelf, blocked, muted, now }: CardInput): { primary: CardAction[]; roles: CardAction[]; secondary: CardAction[] } {
  if (isSelf) return { primary: [], roles: [], secondary: [] }
  const block: CardAction = blocked ? 'unblock' : 'block'
  const mute: CardAction = muted ? 'unmute' : 'mute'
  if (!canModerate) return { primary: ['report', block], roles: [], secondary: [mute] }

  const roles: CardAction[] = []
  if (isOwnerRole(myRole) || myRole === 'ADMIN') {
    if (card.role === 'MODERATOR') roles.push('removeMod')
    else if (card.role === 'VIP') roles.push('makeMod', 'removeVip')
    else if (card.role !== 'OWNER') roles.push('makeMod', 'makeVip')
  }
  const protectedTarget = card.role === 'OWNER' || (card.role === 'MODERATOR' && myRole !== 'ADMIN')
  if (protectedTarget) return { primary: ['report'], roles, secondary: [block, mute] }

  const r = card.restriction
  const timedOut = r?.type === 'TIMEOUT' && (r.until === null || Date.parse(r.until) > now)
  if (r?.type === 'BAN') return { primary: ['unban'], roles, secondary: ['report', block, mute] }
  if (timedOut) return { primary: ['untimeout', 'ban'], roles, secondary: ['report', block, mute] }

  return { primary: ['timeout', 'ban', 'report'], roles, secondary: [block, mute] }
}
