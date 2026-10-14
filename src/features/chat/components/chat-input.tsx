import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SendHorizontalIcon, SmileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useResendVerification } from '@/features/account/hooks/use-resend-verification'
import { FollowButton } from '@/features/channels/components/follow-button'
import { EmotePicker } from '@/features/chat/components/emote-picker'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import { useModeText } from '@/features/chat/hooks/use-mode-text'
import { canAddLine, charCount, checkDraft, completeMention, insertToken, mentionAt, showCounter, suggestMentions, type Chatter } from '@/features/chat/lib/compose'
import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import type { ChatLock, ComposerView, InputNotice } from '@/features/chat/lib/errors'
import { isTypingTarget } from '@/features/player/lib/shortcut-target'
import type { ChannelSummary } from '@/features/streams/types'
import { useNow } from '@/hooks/use-now'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

/** Last `chatFocusRequest` served: a request is honoured once, by whichever input is (or becomes) usable. */
let handledFocusRequest = 0

/** BR30: the reason sending is closed, written in the input itself (§9B table, brief C2). */
function usePlaceholder(view: ComposerView): string {
  const { t } = useTranslation('chat')
  const { duration } = useModeText()

  switch (view.kind) {
    case 'ready':
      return t('input.placeholder')
    case 'guest':
      return t('input.guest')
    case 'offline':
      return t(`input.${view.reason}`)
    case 'locked':
      return lockText(view.lock, t, duration)
  }
}

type T = ReturnType<typeof useTranslation<'chat'>>['t']

function lockText(lock: ChatLock, t: T, duration: (min: number) => string): string {
  switch (lock.kind) {
    case 'followers':
      return lock.requiredMin ? t('input.followers', { duration: duration(lock.requiredMin) }) : t('input.followersAny')
    case 'timeout':
      return lock.until ? t('input.timeout', { time: formatDate(lock.until, { hour: '2-digit', minute: '2-digit' }) }) : t('input.timeoutNoEnd')
    default:
      return t(`input.${lock.kind}`)
  }
}

function NoticeText({ notice, now }: { notice: InputNotice; now: number }) {
  const { t } = useTranslation('chat')
  if (notice.kind === 'slow' || notice.kind === 'rateLimited') {
    const count = Math.max(1, Math.ceil((notice.untilMs - now) / 1000))

    return <>{t(`error.${notice.kind}`, { count })}</>
  }

  return <>{t(`error.${notice.kind}`)}</>
}

function ResendEmail() {
  const { t } = useTranslation('chat')
  const { resend, isPending, lockedFor } = useResendVerification()

  return (
    <Button variant="link" size="sm" className="h-auto px-0" onClick={resend} loading={isPending} disabled={lockedFor > 0}>
      {t('input.resendEmail')}
    </Button>
  )
}

function MentionList({ id, people, active, onPick }: { id: string; people: Chatter[]; active: number; onPick: (c: Chatter) => void }) {
  const { t } = useTranslation('chat')

  return (
    <ul id={id} role="listbox" aria-label={t('mention.label')} className="absolute inset-x-0 bottom-full z-20 mb-1 overflow-hidden rounded-lg border bg-popover p-1" data-testid="mention-suggest">
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
          className={cn('flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-body-sm max-md:min-h-11', i === active ? 'bg-accent text-foreground' : 'text-muted-foreground')}
        >
          <span className="font-semibold text-foreground">{c.displayName}</span>
          {c.displayName !== c.username && <span className="text-subtle-foreground">@{c.username}</span>}
        </li>
      ))}
    </ul>
  )
}

/**
 * Input/Chat (NXL-B §9B, brief C0): Enter sends, Shift+Enter adds a line (≤ 3), counter from 400/500, emote
 * picker, @mention suggestions, slow-mode countdown on the send button, reasons as placeholders. Guests get a
 * button that opens the login modal (AF10). `/` focuses it; player shortcuts are off while typing (BR29).
 */
export function ChatInput({ room, channel }: { room: ChatRoom; channel: ChannelSummary | null | undefined }) {
  const { t } = useTranslation('chat')
  const { view, state } = room
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const placeholder = usePlaceholder(view)
  const listId = useId()
  const helpId = useId()
  const focusRequest = useUiStore((s) => s.chatFocusRequest)
  const notice = state.notice
  const ticking = (notice && 'untilMs' in notice) || (view.kind === 'ready' && view.cooldownSec > 0)
  const now = useNow(ticking ? 500 : 60_000)

  const enabled = view.kind === 'ready'
  const mention = enabled ? mentionAt(draft, caret) : null
  const suggestions = mention && mention.start !== dismissedAt ? suggestMentions(room.chatters, mention.query) : []
  const open = suggestions.length > 0
  const tooLong = charCount(draft) > CHAT_LIMITS.maxChars
  const canSend = enabled && view.cooldownSec === 0 && checkDraft(draft).ok

  // A refused message comes back to an empty input (BR26), never over what is being typed.
  const [returnSeen, setReturnSeen] = useState(room.returned?.nonce ?? null)
  if (room.returned && room.returned.nonce !== returnSeen) {
    setReturnSeen(room.returned.nonce)
    if (!draft) setDraft(room.returned.body)
  }

  // A countdown notice disappears when its time is up.
  useEffect(() => {
    if (notice && 'untilMs' in notice && notice.untilMs <= now) room.clearNotice()
  }, [notice, now, room])

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

  if (view.kind === 'guest') {
    return (
      <div className="shrink-0 p-3 pt-2">
        <button
          type="button"
          onClick={() => room.send('')}
          className="flex h-10 w-full items-center rounded-lg border bg-surface px-3 text-left text-body-sm text-subtle-foreground outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-md:h-11"
          data-testid="chat-guest-input"
        >
          {t('input.guest')}
        </button>
      </div>
    )
  }

  const lock = view.kind === 'locked' ? view.lock : null
  const cooldown = view.kind === 'ready' ? view.cooldownSec : 0
  const helper = notice ? (
    <NoticeText notice={notice} now={now} />
  ) : tooLong ? (
    t('input.tooLong', { max: CHAT_LIMITS.maxChars })
  ) : !enabled && draft ? (
    placeholder
  ) : null

  return (
    <div className="shrink-0 p-3 pt-2">
      {helper && (
        <p id={helpId} role="status" className={cn('pb-1.5 text-label-sm font-normal', notice || tooLong ? 'text-warning' : 'text-muted-foreground')} data-testid="chat-notice">
          {helper}
        </p>
      )}
      <div className="relative">
        {open && <MentionList id={listId} people={suggestions} active={Math.min(active, suggestions.length - 1)} onPick={pickMention} />}
        <div
          className={cn(
            'flex items-end gap-1.5 rounded-lg border bg-surface py-1 pr-1 pl-3 focus-within:border-ring',
            !enabled && 'opacity-80',
          )}
        >
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
            placeholder={placeholder}
            aria-label={t('input.label')}
            aria-describedby={helper ? helpId : undefined}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? `${listId}-${Math.min(active, suggestions.length - 1)}` : undefined}
            rows={1}
            className="field-sizing-content max-h-[4.5rem] min-h-8 flex-1 resize-none bg-transparent py-1.5 text-body-sm text-foreground outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed"
            data-testid="chat-input"
          />
          <EmotePicker
            disabled={!enabled}
            onPick={(code) => apply(insertToken(draft, ref.current?.selectionStart ?? draft.length, code))}
            onClose={() => ref.current?.focus()}
            trigger={
              <button
                type="button"
                aria-label={t('input.emotes')}
                title={t('input.emotes')}
                className="grid size-8 shrink-0 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 max-md:size-11"
              >
                <SmileIcon className="size-5" aria-hidden />
              </button>
            }
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label={cooldown > 0 ? t('input.sendIn', { count: cooldown }) : t('input.send')}
            title={cooldown > 0 ? t('input.sendIn', { count: cooldown }) : t('input.send')}
            className="grid size-8 shrink-0 place-items-center rounded-control bg-primary text-label-md font-bold text-primary-foreground tabular-nums outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:bg-accent disabled:text-muted-foreground max-md:size-11"
            data-testid="chat-send"
          >
            {cooldown > 0 ? cooldown : <SendHorizontalIcon className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      {(showCounter(draft) || lock?.kind === 'followers' || lock?.kind === 'emailUnverified') && (
        <div className="flex items-center justify-between gap-2 pt-1.5">
          <span>
            {lock?.kind === 'followers' && <FollowButton channel={channel} className="h-8 px-3 text-label-sm max-md:h-11" />}
            {lock?.kind === 'emailUnverified' && <ResendEmail />}
          </span>
          {showCounter(draft) && (
            <span className={cn('text-label-sm font-normal tabular-nums', tooLong ? 'text-destructive' : 'text-subtle-foreground')} aria-live="polite" data-testid="chat-counter">
              {charCount(draft)}/{CHAT_LIMITS.maxChars}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
