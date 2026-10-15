import { minutesUntil } from '@/features/notifications/lib/center'
import type { AppNotification, ChannelRef, PersonRef } from '@/features/notifications/types'
import { formatDate } from '@/lib/format'

type ItemKey =
  | 'item.creatorLive'
  | 'item.streamStarting'
  | 'item.scheduleCancelled'
  | 'item.scheduleMoved'
  | 'item.scheduleSeries'
  | 'item.scheduleCreated'
  | 'item.mention'
  | 'item.mentionGrouped'
  | 'item.follower'
  | 'item.followerGrouped'
  | 'item.creatorApproved'
  | 'item.creatorRejected'
  | 'item.creatorRejectedNoReason'
  | 'item.reportResolved'
  | 'item.reportDismissed'
  | 'item.channelSuspended'
  | 'item.channelRestored'
  | 'item.streamTakedown'
  | 'item.streamTakedownNoTitle'
  | 'item.unknown'

export type Sentence = { key: ItemKey; values: Record<string, string | number> }

const hm = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' })
/** "21:00, Thứ 7 18/10" */
const movedWhen = (iso: string) => `${hm(iso)}, ${formatDate(iso, { weekday: 'short', day: '2-digit', month: '2-digit' })}`
/** "Thứ 6, 17/10 · 20:00" */
const createdWhen = (iso: string) => `${formatDate(iso, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${hm(iso)}`

/** NXL-E §7.4: the sentence of each type, built from its payload (bold names, plain titles). */
export function sentenceOf(n: AppNotification, fallbacks: { channel: string; person: string }): Sentence {
  const ch = (c: ChannelRef | null) => c?.displayName || c?.handle || fallbacks.channel
  const who = (p: PersonRef | null) => p?.displayName || p?.username || fallbacks.person
  const p = n.payload
  switch (p.type) {
    case 'CREATOR_LIVE':
      return { key: 'item.creatorLive', values: { channel: ch(p.channel), title: p.title } }
    case 'STREAM_STARTING':
      return { key: 'item.streamStarting', values: { channel: ch(p.channel), title: p.title, count: minutesUntil(p.occurrenceAt, n.createdAt) } }
    case 'SCHEDULE':
      switch (p.reason) {
        case 'CANCELLED':
          return { key: 'item.scheduleCancelled', values: { channel: ch(p.channel), title: p.title, time: p.occurrenceAt ? hm(p.occurrenceAt) : '' } }
        case 'MOVED':
          return { key: 'item.scheduleMoved', values: { channel: ch(p.channel), title: p.title, when: p.newOccurrenceAt ? movedWhen(p.newOccurrenceAt) : '' } }
        case 'CREATED':
          return { key: 'item.scheduleCreated', values: { channel: ch(p.channel), title: p.title, when: p.occurrenceAt ? createdWhen(p.occurrenceAt) : '' } }
        default:
          return { key: 'item.scheduleSeries', values: { title: p.title } }
      }
    case 'MENTION': {
      const values = { sender: who(p.lastSender), channel: ch(p.channel), excerpt: p.excerpt }

      return n.groupCount > 1 ? { key: 'item.mentionGrouped', values: { ...values, count: n.groupCount } } : { key: 'item.mention', values }
    }
    case 'NEW_FOLLOWER':
      return n.groupCount > 1
        ? { key: 'item.followerGrouped', values: { name: who(p.lastFollower), count: n.groupCount - 1 } }
        : { key: 'item.follower', values: { name: who(p.lastFollower) } }
    case 'CREATOR_APPLICATION':
      if (p.result === 'APPROVED') return { key: 'item.creatorApproved', values: {} }

      return p.reason ? { key: 'item.creatorRejected', values: { reason: p.reason } } : { key: 'item.creatorRejectedNoReason', values: {} }
    case 'REPORT_RESULT':
      return { key: p.result === 'DISMISSED' ? 'item.reportDismissed' : 'item.reportResolved', values: {} }
    case 'SYSTEM':
      if (p.kind === 'CHANNEL_SUSPENDED') return { key: 'item.channelSuspended', values: { reason: p.reason } }
      if (p.kind === 'CHANNEL_RESTORED') return { key: 'item.channelRestored', values: {} }

      return p.title ? { key: 'item.streamTakedown', values: { title: p.title } } : { key: 'item.streamTakedownNoTitle', values: {} }
    default:
      return { key: 'item.unknown', values: {} }
  }
}
