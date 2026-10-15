import { Trans, useTranslation } from 'react-i18next'
import { BadgeCheckIcon, FileXIcon, FlagIcon, ShieldAlertIcon, ShieldCheckIcon, VideoOffIcon, type LucideIcon } from 'lucide-react'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { usernameColor } from '@/features/chat/lib/appearance'
import { sentenceOf } from '@/features/notifications/lib/sentence'
import type { AppNotification, PersonRef } from '@/features/notifications/types'
import { cn } from '@/lib/utils'

/** The sentence with bold names (`<b>` → <strong>), as React text — never HTML from the server. */
export function NotificationSentence({ n, className }: { n: AppNotification; className?: string }) {
  const { t } = useTranslation('notifications')
  const { key, values } = sentenceOf(n, { channel: t('item.aChannel'), person: t('item.someone') })

  return (
    <p className={cn('text-body-md leading-5 break-words text-foreground', className)}>
      <Trans t={t} i18nKey={key} values={values} count={typeof values.count === 'number' ? values.count : undefined} components={{ b: <strong className="font-semibold" /> }} />
    </p>
  )
}

function Initials({ person }: { person: PersonRef | null }) {
  const name = person?.displayName || person?.username || '?'
  const letters = name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?'

  return (
    <span className="grid size-10 place-items-center rounded-full bg-avatar text-body-md font-semibold" style={{ color: usernameColor(person?.id ?? name) }} aria-hidden>
      {letters}
    </span>
  )
}

function IconBox({ icon: Icon, tone }: { icon: LucideIcon; tone: 'primary' | 'cyan' | 'danger' | 'warning' }) {
  return (
    <span
      className={cn(
        'grid size-10 place-items-center rounded-lg',
        tone === 'primary' && 'bg-primary/12 text-primary',
        tone === 'cyan' && 'bg-cyan/15 text-cyan-soft',
        tone === 'danger' && 'bg-destructive/15 text-destructive',
        tone === 'warning' && 'bg-warning/15 text-warning',
      )}
      aria-hidden
    >
      <Icon className="size-5" />
    </span>
  )
}

/** Notification/Item lead: channel picture (+ live dot), the person's initials, or a system icon box. */
export function NotificationLead({ n, ring = 'ring-surface' }: { n: AppNotification; ring?: string }) {
  const p = n.payload
  switch (p.type) {
    case 'CREATOR_LIVE':
      return (
        <span className="relative inline-flex size-10 shrink-0">
          <ChannelAvatar channel={p.channel} size="lg" className="size-10 outline outline-border" />
          <span className={cn('absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-live ring-2', ring)} aria-hidden />
        </span>
      )
    case 'STREAM_STARTING':
    case 'SCHEDULE':
      return <ChannelAvatar channel={p.channel} size="lg" className="size-10 shrink-0 outline outline-border" />
    case 'MENTION':
      return <Initials person={p.lastSender} />
    case 'NEW_FOLLOWER':
      return <Initials person={p.lastFollower} />
    case 'CREATOR_APPLICATION':
      return <IconBox icon={p.result === 'APPROVED' ? BadgeCheckIcon : FileXIcon} tone="primary" />
    case 'REPORT_RESULT':
      return <IconBox icon={FlagIcon} tone="cyan" />
    case 'SYSTEM':
      if (p.kind === 'CHANNEL_RESTORED') return <IconBox icon={ShieldCheckIcon} tone="warning" />

      return <IconBox icon={p.kind === 'STREAM_TAKEDOWN' ? VideoOffIcon : ShieldAlertIcon} tone="danger" />
    default:
      return <IconBox icon={FlagIcon} tone="cyan" />
  }
}
