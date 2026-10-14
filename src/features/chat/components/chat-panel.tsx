import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangleIcon, PanelRightCloseIcon, PanelRightOpenIcon, WifiOffIcon } from 'lucide-react'
import { Banner, BannerAction } from '@/components/ui/banner'
import { Spinner } from '@/components/ui/spinner'
import { ChatInput } from '@/features/chat/components/chat-input'
import { ChatSettings } from '@/features/chat/components/chat-settings'
import { MessageList } from '@/features/chat/components/message-list'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import { canManageChat } from '@/features/chat/lib/errors'
import type { ChannelSummary } from '@/features/streams/types'
import { cn } from '@/lib/utils'

/** Chat/Mode Bar: a thin strip above the input listing the active modes (brief C0). */
function ModeBar({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('chat')
  const { chips } = useModeText()
  const mode = room.state.room?.mode
  const items = mode ? chips(mode) : []
  if (items.length === 0) return null

  return (
    <ul aria-label={t('mode.bar')} className="flex shrink-0 flex-wrap items-center gap-1.5 border-t px-3 pt-2" data-testid="chat-mode-bar">
      {items.map((label) => (
        <li key={label} className="rounded-sm bg-accent px-2 py-0.5 text-label-sm font-normal text-muted-foreground">
          {label}
        </li>
      ))}
    </ul>
  )
}

/** One banner over the list: kill switch, connection lost or gave up, chat unavailable (brief C2, E01/E02/E18). */
function ConnectionBanner({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('chat')
  const { connection, state } = room

  if (state.lock?.kind === 'disabled') {
    return (
      <Banner variant="warning" icon={<AlertTriangleIcon aria-hidden />} className="min-h-10 px-3 py-2 text-body-sm" data-testid="chat-banner">
        {t('banner.disabled')}
      </Banner>
    )
  }
  if (connection === 'reconnecting') {
    return (
      <Banner icon={<Spinner className="size-4" />} className="min-h-10 px-3 py-2 text-body-sm" data-testid="chat-banner">
        {t('banner.reconnecting')}
      </Banner>
    )
  }
  if (connection === 'failed' || (state.phase === 'error' && connection !== 'open')) {
    return (
      <Banner
        variant="warning"
        icon={<WifiOffIcon aria-hidden />}
        className="min-h-10 px-3 py-2 text-body-sm"
        action={<BannerAction onClick={room.reconnect}>{t('banner.retry')}</BannerAction>}
        data-testid="chat-banner"
      >
        {connection === 'failed' ? t('banner.failed') : t('banner.unavailable')}
      </Banner>
    )
  }
  if (connection === 'unavailable') {
    return (
      <Banner variant="warning" icon={<WifiOffIcon aria-hidden />} className="min-h-10 px-3 py-2 text-body-sm" data-testid="chat-banner">
        {typeof WebSocket === 'undefined' ? t('banner.unsupported') : t('banner.unavailable')}
      </Banner>
    )
  }

  return null
}

/** Throttled polite announcements (AC a11y): connection changes, input locks and mentions of the viewer. */
function Announcer({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('chat')
  const [text, setText] = useState('')
  const lastAt = useRef(0)
  const mentions = useRef(room.state.mentions)
  const { connection, state } = room

  const say = (next: string) => {
    const now = Date.now()
    if (now - lastAt.current < 3000) return
    lastAt.current = now
    setText(next)
  }

  useEffect(() => {
    if (connection === 'reconnecting') say(t('banner.reconnecting'))
    if (connection === 'failed') say(t('banner.failed'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection])

  useEffect(() => {
    if (state.mentions === mentions.current) return
    mentions.current = state.mentions
    say(t('newMentions'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mentions])

  return (
    <div className="sr-only" aria-live="polite" aria-atomic>
      {text}
    </div>
  )
}

type PanelProps = {
  room: ChatRoom
  channel: ChannelSummary | null | undefined
  /** Tabs (tablet/mobile) have no column header: the settings button sits in a small toolbar. */
  toolbar?: boolean
  className?: string
}

/** The chat body shared by the desktop column and the tablet/mobile tab. */
export function ChatPanel({ room, channel, toolbar = false, className }: PanelProps) {
  const mode = room.state.room?.mode
  const manage = canManageChat(room.state.me?.role) && mode

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)} data-testid="chat-panel" id="chat">
      {toolbar && manage && (
        <div className="flex shrink-0 justify-end px-2 pt-1">
          <ChatSettings channelId={room.channelId} mode={mode} />
        </div>
      )}
      <ConnectionBanner room={room} />
      <MessageList room={room} />
      <ModeBar room={room} />
      <ChatInput room={room} channel={channel} />
      <Announcer room={room} />
    </div>
  )
}

/** Desktop chat column (340 px): header "Chat", settings (Streamer/Mod) and collapse (AF04). */
export function ChatColumn({ room, channel, onCollapse }: { room: ChatRoom; channel: ChannelSummary | null | undefined; onCollapse: () => void }) {
  const { t } = useTranslation('chat')
  const mode = room.state.room?.mode

  return (
    <aside
      aria-labelledby="chat-title"
      data-testid="chat-column"
      className="sticky top-21 flex h-[calc(100dvh-7.5rem)] min-h-120 w-85 shrink-0 flex-col rounded-panel border bg-surface"
    >
      <div className="flex h-13 shrink-0 items-center justify-between gap-1 border-b pr-2 pl-4">
        <h2 id="chat-title" className="text-body-lg font-semibold text-foreground">
          {t('title')}
        </h2>
        <div className="flex items-center gap-0.5">
          {canManageChat(room.state.me?.role) && mode && <ChatSettings channelId={room.channelId} mode={mode} />}
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t('collapse')}
            title={t('collapse')}
            className="grid size-9 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <PanelRightCloseIcon className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <ChatPanel room={room} channel={channel} />
    </aside>
  )
}

/** Collapsed chat: a 44 px "Mở chat" button; a dot when someone mentioned the viewer meanwhile (AF04). */
export function ChatRail({ onExpand, mentioned }: { onExpand: () => void; mentioned: boolean }) {
  const { t } = useTranslation('chat')
  const label = mentioned ? `${t('expand')} · ${t('newMentions')}` : t('expand')

  return (
    <div className="sticky top-21 w-11 shrink-0 self-start">
      <button
        type="button"
        onClick={onExpand}
        aria-label={label}
        title={label}
        data-testid="chat-expand"
        className="relative grid size-11 place-items-center rounded-lg border bg-surface text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <PanelRightOpenIcon className="size-5" aria-hidden />
        {mentioned && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" aria-hidden />}
      </button>
    </div>
  )
}
