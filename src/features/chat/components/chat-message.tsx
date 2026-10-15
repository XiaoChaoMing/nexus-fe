import { memo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BanIcon, CircleAlertIcon, ClockIcon, RotateCwIcon } from 'lucide-react'
import { ChatBadgeIcon } from '@/features/chat/components/chat-badge'
import { usernameColor, visibleBadges } from '@/features/chat/lib/appearance'
import { MessageActionsSheet, MessageMenuButton } from '@/features/chat/components/mod/message-menu'
import { anchorOf, useOptionalChatMod } from '@/features/chat/components/mod/context'
import { mentionsUser, type ChatItem, type Delivery, type Notice } from '@/features/chat/lib/chat-state'
import type { BlockedReason } from '@/features/chat/lib/errors'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import type { ChatMessage, Fragment } from '@/features/chat/types'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * BR05/BR06: fragments become React text and <img> nodes — never HTML — and URLs stay plain text. Every
 * `@mention` is Electric Pulse bold (the row tint is only for mentions of the viewer).
 */
export function Fragments({ fragments }: { fragments: readonly Fragment[] }) {
  return (
    <>
      {fragments.map((f, i) => {
        if (f.type === 'emote') {
          return (
            <img
              key={i}
              src={f.emote.imageUrl}
              alt={f.emote.code}
              title={f.emote.code}
              loading="lazy"
              draggable={false}
              className="mx-0.5 inline-block size-7 align-middle motion-reduce:animate-none"
            />
          )
        }
        if (f.type === 'mention') {
          return (
            <span key={i} className="font-bold text-primary">
              {f.text}
            </span>
          )
        }

        return <span key={i}>{f.text}</span>
      })}
    </>
  )
}

type LineProps = {
  item: ChatItem
  myId: string | null
  myUsername: string | null
  onRetry: (clientMsgId: string) => void
}

/** Touch: a 400 ms press shows the send time and the actions sheet (desktop: hover + "⋯"), design 03e. */
function useLongPress(onLong: () => void) {
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const clear = () => window.clearTimeout(timer.current)

  return {
    shown,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return
        clear()
        timer.current = window.setTimeout(() => {
          setShown((s) => !s)
          onLong()
        }, 400)
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
  }
}

type LineState = { message: ChatMessage; delivery: Delivery; clientMsgId: string | null; blockedReason?: BlockedReason }

function MessageLine({ message, delivery, clientMsgId, blockedReason, myId, myUsername, onRetry }: LineState & Omit<LineProps, 'item'>) {
  const { t } = useTranslation('chat')
  const mod = useOptionalChatMod()
  const [sheet, setSheet] = useState(false)
  const lineRef = useRef<HTMLDivElement>(null)
  const press = useLongPress(() => mod && setSheet(true))
  const mentioned = message.user.id !== myId && mentionsUser(message, myId, myUsername)
  const failed = delivery === 'FAILED'
  const blocked = delivery === 'BLOCKED'
  const time = message.createdAt && !Number.isNaN(Date.parse(message.createdAt)) ? formatDate(message.createdAt, { hour: '2-digit', minute: '2-digit' }) : null
  // Optimistic lines have no server id yet: nothing to moderate or report.
  const actionable = mod !== null && delivery === 'DELIVERED' && !message.id.startsWith('local:')

  if (message.type === 'SYSTEM') return <NoticeLine>{message.body}</NoticeLine>

  const name = (
    <span className="truncate text-body-sm font-semibold" style={{ color: usernameColor(message.user.id, message.user.color) }} data-testid="chat-username">
      {message.user.displayName}
    </span>
  )

  return (
    <div
      ref={lineRef}
      {...press.handlers}
      className={cn(
        'group/line flex items-start gap-1.5 rounded-control px-2 py-1.5 hover:bg-accent',
        (mentioned || failed || blocked) && 'rounded-l-none border-l-2',
        mentioned && 'border-primary bg-primary/8',
        (failed || blocked) && 'border-destructive',
        press.shown && 'bg-accent',
        delivery === 'PENDING' && 'opacity-60',
        actionable && 'pr-1',
      )}
      data-testid="chat-message"
      data-delivery={delivery}
      data-message-id={message.id}
      data-user-id={message.user.id}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.25">
          {time && (
            // §8 #5 (Q8): the time only on hover / long press, never inline by default.
            <time dateTime={message.createdAt} className={cn('shrink-0 text-[11px] text-muted-foreground tabular-nums', press.shown ? 'inline' : 'hidden group-hover/line:inline')}>
              {time}
            </time>
          )}
          {message.user.badges.length > 0 && (
            <span className="flex shrink-0 items-center gap-0.75">
              {visibleBadges(message.user.badges).map((b) => (
                <ChatBadgeIcon key={b} badge={b} />
              ))}
            </span>
          )}
          {mod && message.user.username ? (
            <button
              type="button"
              className="min-w-0 truncate rounded-sm text-left underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              onClick={(e) => mod.openCard({ id: message.user.id, username: message.user.username, displayName: message.user.displayName }, anchorOf(e.currentTarget))}
            >
              {name}
            </button>
          ) : (
            name
          )}
        </div>
        {message.deleted ? (
          <p className="text-body-sm leading-4.75 text-muted-foreground italic" data-testid="chat-deleted">
            {t('deleted')}
          </p>
        ) : (
          <p className={cn('text-body-sm leading-4.75 break-words whitespace-pre-line', blocked ? 'text-muted-foreground' : 'text-foreground')} data-testid="chat-body">
            <Fragments fragments={message.fragments} />
          </p>
        )}
        {delivery === 'PENDING' && <span className="sr-only">{t('pending')}</span>}
        {blocked && (
          <p className="flex items-center gap-1.5 pt-0.5 text-label-sm font-normal text-muted-foreground" data-testid="chat-blocked">
            <BanIcon className="size-3.5 text-destructive" aria-hidden />
            {t(blockedReason === 'LINK' ? 'blocked.LINK' : 'blocked.TERM')}
          </p>
        )}
        {failed && clientMsgId && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <CircleAlertIcon className="size-3.5 text-destructive" aria-hidden />
            <span className="text-label-sm font-normal text-muted-foreground">{t('failed')}</span>
            <button
              type="button"
              onClick={() => onRetry(clientMsgId)}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-label-sm font-semibold text-primary outline-none hover:bg-card focus-visible:outline-2 focus-visible:outline-ring max-md:min-h-11"
            >
              <RotateCwIcon className="size-3.5" aria-hidden />
              {t('resend')}
            </button>
          </div>
        )}
      </div>
      {actionable && <MessageMenuButton message={message} className="invisible group-focus-within/line:visible group-hover/line:visible max-md:hidden" />}
      {actionable && sheet && <MessageActionsSheet message={message} anchor={lineRef} onClose={() => setSheet(false)} />}
    </div>
  )
}

/** Chat/Message/System: clock icon, muted italic (BR21). */
function NoticeLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 rounded-control px-2 py-1.5 text-[12.5px] leading-4.5 text-muted-foreground italic">
      <ClockIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

function NoticeText({ notice }: { notice: Notice }) {
  const modeText = useModeText()

  return <NoticeLine>{notice.type === 'text' ? notice.text : modeText.changes(notice.mode, notice.previous).join(' · ')}</NoticeLine>
}

/** Chat/Missed Divider: "Có thể bạn đã bỏ lỡ một số tin" after a resync (AF09). */
function Divider() {
  const { t } = useTranslation('chat')

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-[11.5px] font-semibold text-warning" role="separator" data-testid="chat-missed">
      <span className="h-px flex-1 bg-warning" aria-hidden />
      {t('missed')}
      <span className="h-px flex-1 bg-warning" aria-hidden />
    </div>
  )
}

/** One line of the list: a message (Chat/Message), a system notice or the "missed" divider. */
export const ChatLine = memo(function ChatLine({ item, myId, myUsername, onRetry }: LineProps) {
  if (item.kind === 'divider') return <Divider />
  if (item.kind === 'notice') return <NoticeText notice={item.notice} />

  return (
    <MessageLine
      message={item.message}
      delivery={item.delivery}
      clientMsgId={item.clientMsgId}
      blockedReason={item.blockedReason}
      myId={myId}
      myUsername={myUsername}
      onRetry={onRetry}
    />
  )
})

export { ChatBadgeIcon }
