import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { HandIcon, ZapIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatLine } from '@/features/chat/components/chat-message'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import { useBlockedIds, useMuted } from '@/features/moderation/hooks/use-blocks'

const SKELETON_LINE2 = ['w-45', 'w-30', 'w-45', 'w-30', 'w-45', 'w-30']

/** Chat/Message/Skeleton × 6 (03c · Đang tải). */
function ListSkeleton() {
  const { t } = useTranslation('chat')

  return (
    <div className="flex flex-col gap-0.5" aria-busy aria-label={t('loading')}>
      {SKELETON_LINE2.map((w, i) => (
        <div key={i} className="flex flex-col gap-1.75 p-2">
          <div className="flex items-center gap-1.25">
            <Skeleton className="h-3 w-4 rounded-sm bg-card" />
            <Skeleton className="h-3 w-21 rounded-sm bg-card" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-sm bg-card" />
          <Skeleton className={`h-2.5 rounded-sm bg-card ${w}`} />
        </div>
      ))}
    </div>
  )
}

/** 03c · Phòng trống. */
function EmptyRoom() {
  const { t } = useTranslation('chat')

  return (
    <div className="grid h-full place-items-center p-4" data-testid="chat-empty">
      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-xl border bg-card text-muted-foreground">
          <HandIcon className="size-7" aria-hidden />
        </span>
        <p className="text-body-lg leading-5.5 font-semibold text-foreground">{t('emptyTitle')}</p>
        <p className="text-body-md text-muted-foreground">{t('emptyBody')}</p>
      </div>
    </div>
  )
}

/**
 * The message list (NXL-B §9A, B4): virtualized (only visible lines in the DOM, ≤ 150 kept), sticks to the
 * newest line until the reader scrolls up (AF03), then holds new lines in a buffer behind "Có tin mới ↓".
 * `role="log"` without live announcements (AC a11y): announcements go through the panel's polite region.
 */
export function MessageList({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('chat')
  const { state, setPaused, retry, me } = room
  const blocked = useBlockedIds()
  const { ids: muted } = useMuted()
  const myIdForFilter = me?.id ?? null
  // Blocked (account) and hidden (this tab) people disappear from the list, old lines included (design 03f).
  const items = useMemo(
    () =>
      blocked.size === 0 && muted.size === 0
        ? state.items
        : state.items.filter((i) => i.kind !== 'message' || i.message.user.id === myIdForFilter || (!blocked.has(i.message.user.id) && !muted.has(i.message.user.id))),
    [state.items, blocked, muted, myIdForFilter],
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(state.paused)
  const lastTop = useRef(0)
  useEffect(() => {
    pausedRef.current = state.paused
  }, [state.paused])

  const stickToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el && !pausedRef.current) el.scrollTop = el.scrollHeight
  }, [])

  // The list gets shorter when a banner or the mode bar appears: keep the newest line in view.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => stickToBottom())
    ro.observe(el)

    return () => ro.disconnect()
  }, [stickToBottom])

  // Not compiled by React Compiler (the project does not use it); the virtualizer re-renders this component itself.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 50,
    overscan: 12,
    getItemKey: (i) => items[i]?.key ?? i,
  })
  const totalSize = virtualizer.getTotalSize()

  // New lines, and lines measured taller than estimated, push the bottom down: follow it while auto-scrolling.
  useLayoutEffect(() => {
    stickToBottom()
  }, [items, totalSize, state.paused, stickToBottom])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const movedUp = el.scrollTop < lastTop.current - 1
    lastTop.current = el.scrollTop
    // The ref changes at once: the layout effect of the render this scroll causes must not snap back down.
    if (distance <= CHAT_LIMITS.pauseThresholdPx) {
      if (pausedRef.current) {
        pausedRef.current = false
        setPaused(false)
      }
    } else if (movedUp && !pausedRef.current) {
      // Only the reader scrolling up pauses; content growing under us does not.
      pausedRef.current = true
      setPaused(true)
    }
  }

  const jumpToLatest = () => {
    pausedRef.current = false
    setPaused(false)
    requestAnimationFrame(stickToBottom)
  }

  const myId = me?.id ?? null
  const myUsername = me?.username ?? null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {state.sampling && (
        <p className="flex shrink-0 items-center gap-1.5 bg-background px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground" data-testid="chat-sampling">
          <ZapIcon className="size-3.5 fill-warning text-warning" aria-hidden />
          {t('sampling')}
        </p>
      )}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        aria-label={t('list')}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        data-testid="chat-list"
      >
        {state.phase === 'loading' && items.length === 0 ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <EmptyRoom />
        ) : (
          <div className="relative w-full" style={{ height: totalSize }}>
            {virtualizer.getVirtualItems().map((v) => {
              const item = items[v.index]
              if (!item) return null

              return (
                <div key={v.key} data-index={v.index} ref={virtualizer.measureElement} className="absolute top-0 left-0 w-full pb-0.5" style={{ transform: `translateY(${v.start}px)` }}>
                  <ChatLine item={item} myId={myId} myUsername={myUsername} onRetry={retry} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {state.paused && state.unseen > 0 && (
        <button
          type="button"
          onClick={jumpToLatest}
          aria-label={t('newMessagesCount', { count: state.unseen })}
          className="absolute bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center rounded-full bg-primary px-3.5 py-1.75 text-body-sm font-semibold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-md:h-11"
          data-testid="chat-new-pill"
        >
          {t('newMessages')}
        </button>
      )}
    </div>
  )
}
