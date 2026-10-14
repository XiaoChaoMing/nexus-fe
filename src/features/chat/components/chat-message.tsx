import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheckIcon, GemIcon, RotateCcwIcon, ShieldIcon, StarIcon, VideoIcon, type LucideIcon } from 'lucide-react'
import { usernameColor, visibleBadges } from '@/features/chat/lib/appearance'
import { mentionsUser, type ChatItem, type Notice } from '@/features/chat/lib/chat-state'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import type { ChatBadge, ChatMessage, Fragment } from '@/features/chat/types'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const BADGE_ICON: Record<ChatBadge, { icon: LucideIcon; className: string }> = {
  STREAMER: { icon: VideoIcon, className: 'bg-primary/15 text-primary' },
  MODERATOR: { icon: ShieldIcon, className: 'bg-success/15 text-success' },
  VIP: { icon: GemIcon, className: 'bg-cyan/15 text-cyan-soft' },
  SUB_T1: { icon: StarIcon, className: 'bg-warning/15 text-warning' },
  SUB_T2: { icon: StarIcon, className: 'bg-warning/15 text-warning' },
  SUB_T3: { icon: StarIcon, className: 'bg-warning/15 text-warning' },
  VERIFIED: { icon: BadgeCheckIcon, className: 'bg-accent text-muted-foreground' },
}

/** Chat/Badge: a 16 px icon with its name for screen readers and on hover (BR15). */
export function ChatBadgeIcon({ badge }: { badge: ChatBadge }) {
  const { t } = useTranslation('chat')
  const { icon: Icon, className } = BADGE_ICON[badge]
  const label = t(`badge.${badge}`)
  const tier = badge.startsWith('SUB_T') ? badge.slice(-1) : null

  return (
    <span role="img" aria-label={label} title={label} className={cn('relative inline-grid size-4 shrink-0 place-items-center rounded-sm align-[-3px]', className)}>
      <Icon className="size-3" aria-hidden />
      {tier && <span className="absolute -right-0.5 -bottom-0.5 text-[8px] leading-none font-bold" aria-hidden>{tier}</span>}
    </span>
  )
}

/**
 * BR05/BR06: fragments become React text and <img> nodes — never HTML — and URLs stay plain text.
 */
export function Fragments({ fragments, myId, myUsername }: { fragments: readonly Fragment[]; myId: string | null; myUsername: string | null }) {
  const me = myUsername?.toLowerCase()

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
              className="mx-px inline-block size-7 align-middle motion-reduce:animate-none"
            />
          )
        }
        if (f.type === 'mention') {
          const own = (myId !== null && f.userId === myId) || (me !== undefined && f.text.replace(/^@/, '').toLowerCase() === me)

          return (
            <span key={i} className={cn('font-bold', own ? 'text-primary' : 'text-foreground')}>
              {f.text}
            </span>
          )
        }

        return <span key={i}>{f.text}</span>
      })}
    </>
  )
}

function Time({ iso }: { iso: string }) {
  if (!iso || Number.isNaN(Date.parse(iso))) return null

  // §8 #5 (Q8): only on hover or keyboard focus, never inline by default.
  return (
    <time
      dateTime={iso}
      className="mr-1.5 hidden text-[11px] text-subtle-foreground tabular-nums group-hover/line:inline group-focus-within/line:inline"
    >
      {formatDate(iso, { hour: '2-digit', minute: '2-digit' })}
    </time>
  )
}

type LineProps = {
  item: ChatItem
  myId: string | null
  myUsername: string | null
  onRetry: (clientMsgId: string) => void
}

function MessageLine({ message, delivery, clientMsgId, myId, myUsername, onRetry }: { message: ChatMessage; delivery: string; clientMsgId: string | null } & Omit<LineProps, 'item'>) {
  const { t } = useTranslation('chat')
  const mentioned = message.user.id !== myId && mentionsUser(message, myId, myUsername)
  const failed = delivery === 'FAILED'

  if (message.type === 'SYSTEM') return <NoticeLine>{message.body}</NoticeLine>

  return (
    <div
      className={cn(
        'group/line rounded-control border-l-2 border-transparent px-2 py-1 text-body-sm break-words text-foreground',
        mentioned && 'border-primary bg-primary/8',
        delivery === 'PENDING' && 'opacity-60',
        failed && 'border-destructive',
      )}
      data-testid="chat-message"
      data-delivery={delivery}
    >
      <Time iso={message.createdAt} />
      {visibleBadges(message.user.badges).map((b) => (
        <span key={b} className="mr-1">
          <ChatBadgeIcon badge={b} />
        </span>
      ))}
      <span className="font-semibold" style={{ color: usernameColor(message.user.id, message.user.color) }} data-testid="chat-username">
        {message.user.displayName}
      </span>
      <span className="text-muted-foreground">: </span>
      {message.deleted ? (
        <span className="text-subtle-foreground italic">{t('deleted')}</span>
      ) : (
        <span className="whitespace-pre-line" data-testid="chat-body">
          <Fragments fragments={message.fragments} myId={myId} myUsername={myUsername} />
        </span>
      )}
      {delivery === 'PENDING' && <span className="sr-only"> ({t('pending')})</span>}
      {failed && clientMsgId && (
        <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
          <span className="text-label-sm text-destructive">{t('failed')}</span>
          <button
            type="button"
            onClick={() => onRetry(clientMsgId)}
            className="inline-flex min-h-6 items-center gap-1 rounded-control px-1.5 text-label-sm font-semibold text-primary outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring max-md:min-h-11"
          >
            <RotateCcwIcon className="size-3.5" aria-hidden />
            {t('resend')}
          </button>
        </span>
      )}
    </div>
  )
}

function NoticeLine({ children }: { children: ReactNode }) {
  // BR21: lightly set apart (muted, italic), never louder than messages.
  return <p className="px-2 py-1 text-body-sm text-muted-foreground italic">{children}</p>
}

function NoticeText({ notice }: { notice: Notice }) {
  const modeText = useModeText()

  return <NoticeLine>{notice.type === 'text' ? notice.text : modeText.changes(notice.mode, notice.previous).join(' · ')}</NoticeLine>
}

/** "Có thể bạn đã bỏ lỡ một số tin" after a resync (AF09). */
function Divider() {
  const { t } = useTranslation('chat')

  return (
    <div className="flex items-center gap-2 px-2 py-2 text-label-sm text-subtle-foreground" role="separator" data-testid="chat-missed">
      <span className="h-px flex-1 bg-border" aria-hidden />
      {t('missed')}
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}

/** One line of the list: a message (Chat/Message), a system notice or the "missed" divider. */
export const ChatLine = memo(function ChatLine({ item, myId, myUsername, onRetry }: LineProps) {
  if (item.kind === 'divider') return <Divider />
  if (item.kind === 'notice') return <NoticeText notice={item.notice} />

  return <MessageLine message={item.message} delivery={item.delivery} clientMsgId={item.clientMsgId} myId={myId} myUsername={myUsername} onRetry={onRetry} />
})
