import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BanIcon, ClockIcon, LockIcon, LogInIcon, SendHorizontalIcon, SmileIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useResendVerification } from '@/features/account/hooks/use-resend-verification'
import { FollowButton } from '@/features/channels/components/follow-button'
import { EmotePicker } from '@/features/chat/components/emote-picker'
import { usernameColor } from '@/features/chat/lib/appearance'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import { canAddLine, charCount, checkDraft, completeMention, insertToken, lineCount, mentionAt, showCounter, suggestMentions, type Chatter } from '@/features/chat/lib/compose'
import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import type { ChatLock, ComposerView, InputNotice } from '@/features/chat/lib/errors'
import { isTypingTarget } from '@/features/player/lib/shortcut-target'
import type { ChannelSummary } from '@/features/streams/types'
import { useNow } from '@/hooks/use-now'
import { formatDate } from '@/lib/format'
import { timeLeft } from '@/features/moderation/lib/duration'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

/** Last `chatFocusRequest` served: a request is honoured once, by whichever input is (or becomes) usable. */
let handledFocusRequest = 0

/** Notices that do not count down hide after this long (Components GĐ3 · Chat). */
const NOTICE_HIDE_MS = 6000

/** BR30: the reason sending is closed, written in the input itself (§9B table, brief C2). */
function usePlaceholder(view: ComposerView, now: number): string {
  const { t } = useTranslation('chat')
  const { duration } = useModeText()
  const { t: tm } = useTranslation('moderation')
  const left = (until: string) => {
    const l = timeLeft(until, now)

    return !l ? '' : 'clock' in l ? l.clock : tm('duration.day', { count: l.days })
  }

  switch (view.kind) {
    case 'ready':
      return t('input.placeholder')
    case 'guest':
      return t('input.guest')
    case 'offline':
      return t(`input.${view.reason}`)
    case 'locked':
      return lockText(view.lock, t, duration, left)
  }
}

type T = ReturnType<typeof useTranslation<'chat'>>['t']

function lockText(lock: ChatLock, t: T, duration: (min: number) => string, left: (until: string) => string): string {
  switch (lock.kind) {
    case 'followers':
      return lock.requiredMin ? t('input.followers', { duration: duration(lock.requiredMin) }) : t('input.followersAny')
    case 'timeout':
      // "Bạn bị tạm khóa chat đến 21:30 · còn 9:41", counting down every second (design 03f cell 2).
      return lock.until ? t('input.timeoutLeft', { time: formatDate(lock.until, { hour: '2-digit', minute: '2-digit' }), left: left(lock.until) }) : t('input.timeoutNoEnd')
    default:
      return t(`input.${lock.kind}`)
  }
}

/** Chat/Inline Notice above the input: amber for waits, red for refusals; × closes it. */
function InlineNotice({ id, notice, now, onClose }: { id: string; notice: InputNotice; now: number; onClose: () => void }) {
  const { t } = useTranslation('chat')
  const wait = notice.kind === 'slow' || notice.kind === 'rateLimited'
  const text = wait
    ? t(`error.${notice.kind}`, { count: Math.max(1, Math.ceil((notice.untilMs - now) / 1000)) })
    : notice.kind === 'contentBlocked' && notice.reason === 'LINK'
      ? t('error.contentBlockedLink')
      : t(`error.${notice.kind}`)
  const Icon = wait ? ClockIcon : BanIcon

  return (
    <div id={id} role="status" className={cn('flex items-start gap-2 rounded-r-control border-l-2 bg-card py-2 pr-2 pl-2.5', wait ? 'border-warning' : 'border-destructive')} data-testid="chat-notice">
      <Icon className={cn('mt-px size-4 shrink-0', wait ? 'text-warning' : 'text-destructive')} aria-hidden />
      <p className="min-w-0 flex-1 text-[12.5px] leading-4.5 text-foreground">{text}</p>
      <button type="button" onClick={onClose} aria-label={t('input.closeNotice')} className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:size-8">
        <XIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

/** A hint about the draft itself (too long, too many lines, why it cannot be sent now). */
function DraftHint({ id, children, warn }: { id: string; children: string; warn: boolean }) {
  return (
    <p id={id} role="status" className={cn('rounded-r-control border-l-2 bg-card py-2 pr-2 pl-2.5 text-[12.5px] leading-4.5 text-foreground', warn ? 'border-warning' : 'border-border')} data-testid="chat-notice">
      {children}
    </p>
  )
}

function ResendEmail() {
  const { t } = useTranslation('chat')
  const { resend, isPending, lockedFor } = useResendVerification()

  return (
    <Button variant="secondary" size="sm" className="h-8 shrink-0 font-medium" onClick={resend} loading={isPending} disabled={lockedFor > 0}>
      {t('input.resendEmail')}
    </Button>
  )
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2)

  return letters.toUpperCase()
}

/** Chat/Mention Suggest: "Người vừa chat", ≤ 5 names in their colours, ↑↓ / Enter / Esc. */
function MentionList({ id, people, active, large, onPick }: { id: string; people: Chatter[]; active: number; large: boolean; onPick: (c: Chatter) => void }) {
  const { t } = useTranslation('chat')

  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 flex flex-col gap-0.5 rounded-lg border bg-popover p-1.5" data-testid="mention-suggest">
      <p className="px-2 pt-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">{t('mention.title')}</p>
      <ul id={id} role="listbox" aria-label={t('mention.label')} className="flex flex-col gap-0.5">
        {people.map((c, i) => (
          <li
            key={c.id}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === active}
            // mousedown keeps the focus in the input.
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(c)
            }}
            className={cn('flex cursor-pointer items-center gap-2 rounded-control px-2', large ? 'h-11' : 'h-9', i === active && 'bg-accent')}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-avatar text-[10px] font-semibold text-primary" aria-hidden>
              {initials(c.displayName || c.username)}
            </span>
            <span className="truncate text-body-sm font-semibold" style={{ color: usernameColor(c.id) }}>
              {c.username}
            </span>
            {i === active && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground" aria-hidden>Enter ↵</span>}
          </li>
        ))}
      </ul>
      <p className="px-2 text-[11px] leading-4.5 text-muted-foreground" aria-hidden>
        {t('mention.hint')}
      </p>
    </div>
  )
}

type InputProps = {
  room: ChatRoom
  channel: ChannelSummary | null | undefined
  /** Chat/Mode Bar, shown between the notice and the input. */
  modeBar: ReactNode
  /** Mobile/tablet settings button left of the input (Streamer/Mod). */
  leading?: ReactNode
  /** Tablet/mobile tab: 44 px targets. */
  inTab?: boolean
}

/**
 * Input/Chat (NXL-B §9B, brief C0): Enter sends, Shift+Enter adds a line (≤ 3), counter from 400/500, emote
 * picker, @mention suggestions, slow-mode countdown on the send button, reasons as placeholders. Guests get a
 * button that opens the login modal (AF10). `/` focuses it; player shortcuts are off while typing (BR29).
 */
export function ChatInput({ room, channel, modeBar, leading, inTab = false }: InputProps) {
  const { t } = useTranslation('chat')
  const { view, state } = room
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const helpId = useId()
  const focusRequest = useUiStore((s) => s.chatFocusRequest)
  const notice = state.notice
  const ticking = (notice && 'untilMs' in notice) || (view.kind === 'ready' && view.cooldownSec > 0)
  const timedOut = view.kind === 'locked' && view.lock.kind === 'timeout'
  const now = useNow(ticking || timedOut ? 500 : 60_000)
  const placeholder = usePlaceholder(view, now)

  const enabled = view.kind === 'ready'
  const mention = enabled ? mentionAt(draft, caret) : null
  // Opens on "@" + at least one character (Components GĐ3 · Chat).
  const suggestions = mention && mention.query.length > 0 && mention.start !== dismissedAt ? suggestMentions(room.chatters, mention.query) : []
  const open = suggestions.length > 0
  const tooLong = charCount(draft) > CHAT_LIMITS.maxChars
  const tooManyLines = lineCount(draft) > CHAT_LIMITS.maxLines
  const canSend = enabled && view.cooldownSec === 0 && checkDraft(draft).ok

  // A refused message comes back to an empty input (BR26), never over what is being typed.
  const [returnSeen, setReturnSeen] = useState(room.returned?.nonce ?? null)
  if (room.returned && room.returned.nonce !== returnSeen) {
    setReturnSeen(room.returned.nonce)
    if (!draft) setDraft(room.returned.body)
  }

  // A countdown notice disappears when its time is up; the others after 6 s.
  useEffect(() => {
    if (notice && 'untilMs' in notice && notice.untilMs <= now) room.clearNotice()
  }, [notice, now, room])
  useEffect(() => {
    if (!notice || 'untilMs' in notice) return
    const id = window.setTimeout(room.clearNotice, NOTICE_HIDE_MS)

    return () => window.clearTimeout(id)
  }, [notice, room.clearNotice])

  // "/" focuses the input when not typing elsewhere (BR29); a guest who signed in to chat lands here (AF10).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      if (isTypingTarget(e.target instanceof HTMLElement ? e.target : null)) return
      if (!ref.current || ref.current.disabled) return
      e.preventDefault()
      ref.current.focus()
    }
    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (focusRequest <= handledFocusRequest || !ref.current || ref.current.disabled) return
    ref.current.focus()
    if (document.activeElement === ref.current) handledFocusRequest = focusRequest
  }, [focusRequest, view.kind])

  const apply = (next: { text: string; caret: number }) => {
    setDraft(next.text)
    setCaret(next.caret)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  const pickMention = (c: Chatter) => {
    if (!mention) return
    apply(completeMention(draft, mention, c.username))
    setActive(0)
  }

  const submit = () => {
    if (!canSend) return
    if (room.send(draft)) {
      setDraft('')
      setCaret(0)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setActive((a) => (a + step + suggestions.length) % suggestions.length)

        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        pickMention(suggestions[Math.min(active, suggestions.length - 1)])

        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissedAt(mention?.start ?? null)

        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()

      return
    }
    if (e.key === 'Enter' && e.shiftKey && !canAddLine(draft)) e.preventDefault()
  }

  const footer = (children: ReactNode) => (
    <div className="flex shrink-0 flex-col gap-2 border-t px-3 pt-2 pb-3 max-md:bg-background max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{children}</div>
  )

  if (view.kind === 'guest') {
    return footer(
      <>
        {modeBar}
        <button
          type="button"
          onClick={() => room.send('')}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/12 text-body-md font-semibold text-primary outline-none hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            inTab ? 'h-11' : 'h-10.5',
          )}
          data-testid="chat-guest-input"
        >
          <LogInIcon className="size-4.5" aria-hidden />
          {t('input.guest')}
        </button>
      </>,
    )
  }

  const lock = view.kind === 'locked' ? view.lock : null
  const cooldown = view.kind === 'ready' ? view.cooldownSec : 0
  const counter = showCounter(draft)
  const hint = tooLong
    ? t('input.tooLong', { max: CHAT_LIMITS.maxChars })
    : tooManyLines
      ? t('input.tooManyLines', { max: CHAT_LIMITS.maxLines })
      : !enabled && draft
        ? placeholder
        : null
  const action =
    lock?.kind === 'followers' ? (
      <FollowButton channel={channel} className="h-8 shrink-0 gap-2 px-3 text-body-sm max-md:h-11 [&_svg]:size-4" />
    ) : lock?.kind === 'emailUnverified' ? (
      <ResendEmail />
    ) : null
  const button = inTab ? 'size-11' : 'size-8'

  // Locks are read out once when they change (not every countdown tick): aria-live="polite" (design 03f).
  const lockAnnouncement = lock ? (lock.kind === 'timeout' && lock.until ? t('input.timeout', { time: formatDate(lock.until, { hour: '2-digit', minute: '2-digit' }) }) : lock.kind === 'timeout' ? t('input.timeoutNoEnd') : placeholder) : ''

  return footer(
    <>
      <span className="sr-only" aria-live="polite" data-testid="chat-lock-status">
        {lockAnnouncement}
      </span>
      {notice ? <InlineNotice id={helpId} notice={notice} now={now} onClose={room.clearNotice} /> : hint && <DraftHint id={helpId} warn={tooLong || tooManyLines}>{hint}</DraftHint>}
      {modeBar}
      <div className="flex items-end gap-2">
        {leading}
        <div className="relative min-w-0 flex-1">
          {open && <MentionList id={listId} people={suggestions} active={Math.min(active, suggestions.length - 1)} large={inTab} onPick={pickMention} />}
          <div
            className={cn(
              'flex items-end gap-1 rounded-lg py-1 pr-1 pl-3 outline outline-border',
              enabled ? 'bg-card focus-within:outline-2 focus-within:outline-primary' : 'items-center bg-background',
            )}
          >
            {!enabled && (
              <LockIcon className="size-4 shrink-0 self-center text-muted-foreground" aria-hidden />
            )}
            <textarea
              ref={ref}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setCaret(e.target.selectionStart)
                setActive(0)
                if (notice && !('untilMs' in notice)) room.clearNotice()
              }}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
              onKeyDown={onKeyDown}
              disabled={!enabled}
              maxLength={CHAT_LIMITS.maxChars}
              placeholder={placeholder}
              aria-label={t('input.label')}
              aria-describedby={notice || hint ? helpId : undefined}
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-activedescendant={open ? `${listId}-${Math.min(active, suggestions.length - 1)}` : undefined}
              rows={1}
              className={cn(
                'field-sizing-content max-h-[5.25rem] min-w-0 flex-1 resize-none bg-transparent text-body-sm leading-4.5 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/50',
                inTab ? 'py-3.25' : 'py-1.75',
                !enabled && 'pl-1',
              )}
              data-testid="chat-input"
            />
            {counter && enabled && (
              <span className={cn('shrink-0 px-1 py-2.25 text-[11px] font-semibold tabular-nums', tooLong ? 'text-destructive' : 'text-warning')} aria-live="polite" data-testid="chat-counter">
                {charCount(draft)}/{CHAT_LIMITS.maxChars}
              </span>
            )}
            {action}
            {enabled && (
              <EmotePicker
                disabled={!enabled}
                onPick={(code) => {
                  // The picker stays open (several emotes in a row): insert without moving the focus.
                  const next = insertToken(draft, Math.min(caret, draft.length), code)
                  setDraft(next.text)
                  setCaret(next.caret)
                }}
                onClose={() => {
                  const el = ref.current
                  if (!el) return
                  el.focus()
                  el.setSelectionRange(caret, caret)
                }}
                trigger={
                  <button
                    type="button"
                    aria-label={t('input.emotes')}
                    title={t('input.emotes')}
                    className={cn('grid shrink-0 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring', button)}
                  >
                    <SmileIcon className="size-5" aria-hidden />
                  </button>
                }
              />
            )}
            {!action && (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                aria-label={cooldown > 0 ? t('input.sendIn', { count: cooldown }) : t('input.send')}
                title={cooldown > 0 ? t('input.sendIn', { count: cooldown }) : t('input.send')}
                className={cn(
                  'grid shrink-0 place-items-center rounded-control bg-primary text-body-sm font-bold text-primary-foreground tabular-nums outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:bg-accent disabled:text-muted-foreground',
                  button,
                  !enabled && 'disabled:text-subtle-foreground',
                )}
                data-testid="chat-send"
              >
                {cooldown > 0 ? cooldown : <SendHorizontalIcon className="size-4" aria-hidden />}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
  )
}
