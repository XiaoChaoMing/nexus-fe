import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { ChevronDownIcon, ChevronUpIcon, PinIcon } from 'lucide-react'
import { ChatBadgeIcon } from '@/features/chat/components/chat-badge'
import { Fragments } from '@/features/chat/components/chat-message'
import { useOptionalChatMod } from '@/features/chat/components/mod/context'
import type { ChatRoom } from '@/features/chat/hooks/use-chat-room'
import { usernameColor, visibleBadges } from '@/features/chat/lib/appearance'
import { cn } from '@/lib/utils'

/** Pinned messages a viewer hid in this tab ("Ẩn"), per room; a new pin shows again. */
const usePinnedHidden = create<{ hidden: Record<string, string>; hide: (streamId: string, id: string) => void; show: (streamId: string) => void }>()((set) => ({
  hidden: {},
  hide: (streamId, id) => set((s) => ({ hidden: { ...s.hidden, [streamId]: id } })),
  show: (streamId) =>
    set((s) => {
      const next = { ...s.hidden }
      delete next[streamId]

      return { hidden: next }
    }),
}))

function useHiddenPin(room: ChatRoom): boolean {
  const pinned = room.state.room?.pinned
  const hiddenId = usePinnedHidden((s) => s.hidden[room.streamId])

  return Boolean(pinned && hiddenId === pinned.id)
}

/**
 * Chat/Pinned Bar under the chat header: one line collapsed, up to four expanded; moderators get "Bỏ ghim",
 * viewers "Ẩn" (this tab only). Changes in place for everyone through `pin` / `unpin`.
 */
export function PinnedBar({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('moderation')
  const ctx = useOptionalChatMod()
  const [expanded, setExpanded] = useState(false)
  const hide = usePinnedHidden((s) => s.hide)
  const hidden = useHiddenPin(room)
  const pinned = room.state.room?.pinned
  if (!pinned || hidden) return null
  const canUnpin = ctx?.canModerate ?? false

  return (
    <section aria-label={t('pinned.label')} className="flex shrink-0 items-start gap-2 border-b bg-card py-2 pr-1.5 pl-3" data-testid="pinned-bar">
      <PinIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.25">
          {visibleBadges(pinned.user.badges).map((b) => (
            <ChatBadgeIcon key={b} badge={b} />
          ))}
          <span className="truncate text-label-sm font-semibold" style={{ color: usernameColor(pinned.user.id, pinned.user.color) }}>
            {pinned.user.displayName}
          </span>
        </span>
        <p className={cn('text-[13px] leading-4.5 break-words text-foreground', expanded ? 'line-clamp-4' : 'truncate')} data-testid="pinned-body">
          <Fragments fragments={pinned.fragments} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? t('pinned.collapse') : t('pinned.expand')}
          aria-expanded={expanded}
          className="grid size-7 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:size-11"
        >
          {expanded ? <ChevronUpIcon className="size-4.5" aria-hidden /> : <ChevronDownIcon className="size-4.5" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => (canUnpin ? void ctx?.mod.unpin() : hide(room.streamId, pinned.id))}
          className="h-7 rounded-control px-2 text-label-sm font-semibold text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:h-11"
          data-testid={canUnpin ? 'pinned-unpin' : 'pinned-hide'}
        >
          {canUnpin ? t('pinned.unpin') : t('pinned.hide')}
        </button>
      </div>
    </section>
  )
}

/** "Hiện tin ghim" on the chat header after a viewer hid the pinned message. */
export function ShowPinnedButton({ room }: { room: ChatRoom }) {
  const { t } = useTranslation('moderation')
  const show = usePinnedHidden((s) => s.show)
  const hidden = useHiddenPin(room)
  if (!hidden) return null

  return (
    <button
      type="button"
      onClick={() => show(room.streamId)}
      className="inline-flex h-7 items-center gap-1 rounded-control bg-primary/12 px-2 text-label-sm font-semibold text-primary outline-none hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <PinIcon className="size-3.5" aria-hidden />
      {t('pinned.show')}
    </button>
  )
}
