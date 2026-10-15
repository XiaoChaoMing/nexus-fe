import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ClockIcon, HeartIcon, LockIcon, PanelRightCloseIcon, PanelRightOpenIcon, SettingsIcon, StarIcon, MessageSquareOffIcon, WifiOffIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { ChatInput } from '@/features/chat/components/chat-input'
import { ChatSettings } from '@/features/chat/components/chat-settings'
import { MessageList } from '@/features/chat/components/message-list'
import { ChatModProvider } from '@/features/chat/components/mod/mod-context'
import { PinnedBar, ShowPinnedButton } from '@/features/chat/components/mod/pinned-bar'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import { canManageChat } from '@/features/chat/lib/errors'
import type { ChannelSummary } from '@/features/streams/types'
import { cn } from '@/lib/utils'

const MODE_ICON = { slow: ClockIcon, followers: HeartIcon, subs: StarIcon } as const

/** Chat/Mode Bar: the active modes above the input, hidden when none is on (Components GĐ3 · Chat). */
function ModeBar({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('chat')
  const { items } = useModeText()
  const mode = room.state.room?.mode
  const list = mode ? items(mode) : []
  if (list.length === 0) return null

  return (
    <ul aria-label={t('mode.bar')} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-control bg-background px-3 py-1.5" data-testid="chat-mode-bar">
      {list.map(({ kind, label }) => {
        const Icon = MODE_ICON[kind]

        return (
          <li key={kind} className="flex items-center gap-1.25 text-label-sm text-muted-foreground">
            <Icon className="size-3.5" aria-hidden />
            {label}
          </li>
        )
      })}
    </ul>
  )
}

/** Chat/Reconnect Banner style: amber tint, amber hairline under it. */
function ChatBanner({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-warning bg-warning/15 px-3 py-2.5 text-body-sm font-medium text-foreground" role="status" data-testid="chat-banner">
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}

/** One banner under the header: kill switch, reconnecting, gave up, unavailable (03c, E01/E02/E18). */
function ConnectionBanner({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('chat')
  const { connection, state } = room
  const retry = (
    <button type="button" onClick={room.reconnect} className="rounded-control px-2 py-1 text-label-md font-semibold text-primary outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring max-md:min-h-11">
      {t('banner.retry')}
    </button>
  )

  if (connection === 'locked') {
    return <ChatBanner icon={<LockIcon className="size-5 text-warning" aria-hidden />}>{t('banner.accountLocked')}</ChatBanner>
  }
  if (state.lock?.kind === 'disabled') {
    return <ChatBanner icon={<MessageSquareOffIcon className="size-5 text-warning" aria-hidden />}>{t('banner.disabled')}</ChatBanner>
  }
  if (connection === 'reconnecting') {
    return <ChatBanner icon={<Spinner className="size-4 text-warning" />}>{t('banner.reconnecting')}</ChatBanner>
  }
  if (connection === 'failed' || (state.phase === 'error' && connection !== 'open')) {
    return (
      <ChatBanner icon={<WifiOffIcon className="size-4 text-warning" aria-hidden />} action={retry}>
        {connection === 'failed' ? t('banner.failed') : t('banner.unavailable')}
      </ChatBanner>
    )
  }
  if (connection === 'unavailable') {
    return (
      <ChatBanner icon={<WifiOffIcon className="size-4 text-warning" aria-hidden />}>
        {typeof WebSocket === 'undefined' ? t('banner.unsupported') : t('banner.unavailable')}
      </ChatBanner>
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
  /** Tablet/mobile tab: no column header, so the settings button sits left of the input (03d mobile). */
  inTab?: boolean
  className?: string
}

/** The chat body shared by the desktop column and the tablet/mobile tab. */
export function ChatPanel({ room, channel, inTab = false, className }: PanelProps) {
  const mode = room.state.room?.mode
  const manage = canManageChat(room.state.me?.role) && mode

  return (
    <ChatModProvider room={room}>
    <div className={cn('flex min-h-0 flex-1 flex-col', className)} data-testid="chat-panel" id="chat">
      {inTab && <ShowPinnedRow room={room} />}
      <PinnedBar room={room} />
      <ConnectionBanner room={room} />
      <MessageList room={room} />
      <ChatInput
        room={room}
        channel={channel}
        modeBar={<ModeBar room={room} />}
        inTab={inTab}
        leading={inTab && manage ? <ChatSettings channelId={room.channelId} mode={mode} trigger={<SettingsTrigger large />} /> : null}
      />
      <Announcer room={room} />
    </div>
    </ChatModProvider>
  )
}

/** Tablet/mobile tab has no header: "Hiện tin ghim" sits on its own row. */
function ShowPinnedRow({ room }: { room: ChatRoom }) {
  return (
    <div className="flex justify-end px-2 pt-1 empty:hidden">
      <ShowPinnedButton room={room} />
    </div>
  )
}

/** Gear of Chat/Header (36 px), or the 44 px button left of the input on mobile. */
export function SettingsTrigger({ large = false, ...props }: { large?: boolean } & React.ComponentProps<'button'>) {
  const { t } = useTranslation('chat')

  return (
    <button
      type="button"
      aria-label={t('settings.open')}
      title={t('settings.open')}
      data-testid="chat-settings"
      {...props}
      className={cn(
        'grid shrink-0 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        large ? 'size-11 rounded-lg bg-accent text-foreground' : 'size-9',
      )}
    >
      <SettingsIcon className={large ? 'size-5.5' : 'size-5'} aria-hidden />
    </button>
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
          <ShowPinnedButton room={room} />
          {canManageChat(room.state.me?.role) && mode && <ChatSettings channelId={room.channelId} mode={mode} trigger={<SettingsTrigger />} />}
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

/** "Chuyển tới chat" (AC a11y): a skip link that moves the keyboard focus into the chat. */
export function SkipToChat() {
  const { t } = useTranslation('chat')

  return (
    <a
      href="#chat"
      onClick={(e) => {
        const target = document.querySelector<HTMLElement>('#chat textarea:not(:disabled), #chat [data-testid="chat-guest-input"], #chat [role="log"]')
        if (!target) return
        e.preventDefault()
        target.focus()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-card focus:px-3 focus:py-2 focus:text-foreground"
    >
      {t('skipToChat')}
    </a>
  )
}
