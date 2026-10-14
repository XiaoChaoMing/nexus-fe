import { memo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheckIcon, CircleAlertIcon, ClockIcon, GemIcon, RotateCwIcon, SparklesIcon, StarIcon, SwordsIcon, VideoIcon, type LucideIcon } from 'lucide-react'
import { usernameColor, visibleBadges } from '@/features/chat/lib/appearance'
import { mentionsUser, type ChatItem, type Notice } from '@/features/chat/lib/chat-state'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import type { ChatBadge, ChatMessage, Fragment } from '@/features/chat/types'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Chat/Badge (Components GĐ3 · Chat): 16 px, radius 4, filled; Verified is the bare icon. */
const BADGE_ICON: Record<ChatBadge, { icon: LucideIcon; className: string; iconClass?: string }> = {
  STREAMER: { icon: VideoIcon, className: 'bg-live text-white' },
  MODERATOR: { icon: SwordsIcon, className: 'bg-success text-primary-foreground' },
  VIP: { icon: GemIcon, className: 'bg-warning text-primary-foreground' },
  SUB_T1: { icon: StarIcon, className: 'bg-primary/12 text-primary' },
  SUB_T2: { icon: StarIcon, className: 'bg-primary text-primary-foreground' },
  SUB_T3: { icon: SparklesIcon, className: 'bg-primary text-primary-foreground' },
  VERIFIED: { icon: BadgeCheckIcon, className: 'text-cyan', iconClass: 'size-4' },
}

/** Chat/Badge: icon only, its name as tooltip and for screen readers (BR15). */
export function ChatBadgeIcon({ badge }: { badge: ChatBadge }) {
  const { t } = useTranslation('chat')
  const { icon: Icon, className, iconClass } = BADGE_ICON[badge]
  const label = t(`badge.${badge}`)

  return (
    <span role="img" aria-label={label} title={label} className={cn('grid size-4 shrink-0 place-items-center rounded-sm', className)}>
      <Icon className={iconClass ?? 'size-3'} strokeWidth={2.5} aria-hidden />
    </span>
  )
}

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

/** Touch: a 500 ms press shows the send time (desktop: hover), Components GĐ3 · Chat. */
function useLongPress() {
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const clear = () => window.clearTimeout(timer.current)

  return {
    shown,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return
        clear()
        timer.current = window.setTimeout(() => setShown((s) => !s), 500)
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
  }
}

function MessageLine({ message, delivery, clientMsgId, myId, myUsername, onRetry }: { message: ChatMessage; delivery: string; clientMsgId: string | null } & Omit<LineProps, 'item'>) {
  const { t } = useTranslation('chat')
  const press = useLongPress()
  const mentioned = message.user.id !== myId && mentionsUser(message, myId, myUsername)
  const failed = delivery === 'FAILED'
  const time = message.createdAt && !Number.isNaN(Date.parse(message.createdAt)) ? formatDate(message.createdAt, { hour: '2-digit', minute: '2-digit' }) : null

  if (message.type === 'SYSTEM') return <NoticeLine>{message.body}</NoticeLine>

  return (
    <div
      {...press.handlers}
      className={cn(
        'group/line flex flex-col gap-0.5 rounded-control px-2 py-1.5 hover:bg-accent',
        (mentioned || failed) && 'rounded-l-none border-l-2',
        mentioned && 'border-primary bg-primary/8',
        failed && 'border-destructive',
        press.shown && 'bg-accent',
        delivery === 'PENDING' && 'opacity-60',
      )}
      data-testid="chat-message"
      data-delivery={delivery}
    >
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
        <span className="truncate text-body-sm font-semibold" style={{ color: usernameColor(message.user.id, message.user.color) }} data-testid="chat-username">
          {message.user.displayName}
        </span>
      </div>
      {message.deleted ? (
        <p className="text-body-sm leading-4.75 text-muted-foreground italic">{t('deleted')}</p>
      ) : (
        <p className="text-body-sm leading-4.75 break-words whitespace-pre-line text-foreground" data-testid="chat-body">
          <Fragments fragments={message.fragments} />
        </p>
      )}
      {delivery === 'PENDING' && <span className="sr-only">{t('pending')}</span>}
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

  return <MessageLine message={item.message} delivery={item.delivery} clientMsgId={item.clientMsgId} myId={myId} myUsername={myUsername} onRetry={onRetry} />
})
