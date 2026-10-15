import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { XIcon } from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { isKnownNotification, notificationKeys, setUnreadCount, upsertNotification } from '@/features/notifications/hooks/use-notifications'
import { minutesUntil, shouldToast } from '@/features/notifications/lib/center'
import { parseCount, parseNotification } from '@/features/notifications/lib/parse'
import type { AppNotification } from '@/features/notifications/types'
import { useRealtimeTopic } from '@/lib/realtime'

/** Toast/Live hides after this long; sonner pauses it while hovered or focused. */
const LIVE_TOAST_MS = 8000

function LiveToast({ n, onWatch, onClose }: { n: AppNotification; onWatch: () => void; onClose: () => void }) {
  const { t } = useTranslation('notifications')
  const p = n.payload
  if (p.type !== 'CREATOR_LIVE' && p.type !== 'STREAM_STARTING') return null
  const channel = p.channel?.displayName || p.channel?.handle || t('item.aChannel')
  const live = p.type === 'CREATOR_LIVE'

  return (
    <div role="status" className="flex w-[min(360px,calc(100vw-2rem))] items-center gap-3 rounded-lg border bg-card py-3 pr-2 pl-3" data-testid="live-toast">
      <span className="relative inline-flex size-10 shrink-0">
        <ChannelAvatar channel={p.channel} size="lg" className="size-10 outline outline-border" />
        {live && <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-live ring-2 ring-card" aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body-md font-normal text-foreground">
          {live ? (
            <Trans t={t} i18nKey="toast.live" values={{ channel }} components={{ b: <strong className="font-semibold" /> }} />
          ) : (
            <Trans t={t} i18nKey="toast.starting" values={{ channel }} count={minutesUntil(p.occurrenceAt, n.createdAt)} components={{ b: <strong className="font-semibold" /> }} />
          )}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">{p.title}</span>
      </span>
      {n.link && (
        <button
          type="button"
          onClick={onWatch}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t('toast.watch')}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('toast.close')}
        className="grid size-7 shrink-0 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <XIcon className="size-4.5" aria-hidden />
      </button>
    </div>
  )
}

/**
 * The signed-in account's `user:{userId}` topic (NXL-E §13.3): `notification` frames are upserted into the cached
 * lists by id and may raise a live toast; `unread_count` sets the bell. A new subscription (reconnect, resync)
 * asks REST again for what was missed.
 */
export function NotificationCenter() {
  const userId = useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const lastToastAt = useRef<number | null>(null)
  const toasted = useRef(new Set<string>())
  const pathRef = useRef(pathname)
  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  const showToast = (n: AppNotification) => {
    lastToastAt.current = Date.now()
    toasted.current.add(n.id)
    const desktop = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches
    toast.custom(
      (id) => (
        <LiveToast
          n={n}
          onWatch={() => {
            toast.dismiss(id)
            if (n.link) navigate(n.link)
          }}
          onClose={() => toast.dismiss(id)}
        />
      ),
      { id: `live-${n.id}`, duration: LIVE_TOAST_MS, position: desktop ? 'bottom-right' : 'top-center', unstyled: true },
    )
  }

  useRealtimeTopic(userId ? `user:${userId}` : null, {
    onSubscribed: (_snapshot, info) => {
      if (userId && !info.resumed) void qc.invalidateQueries({ queryKey: notificationKeys.unread(userId) })
    },
    onResync: () => {
      if (userId) void qc.invalidateQueries({ queryKey: notificationKeys.root(userId) })
    },
    onEvent: (ev) => {
      if (!userId) return
      if (ev.type === 'unread_count') {
        setUnreadCount(qc, userId, parseCount(ev.data))

        return
      }
      if (ev.type !== 'notification') return
      const n = parseNotification(ev.data)
      if (!n) return
      const known = toasted.current.has(n.id) || isKnownNotification(qc, userId, n.id)
      upsertNotification(qc, userId, n)
      if (shouldToast({ n, now: Date.now(), lastToastAt: lastToastAt.current, pathname: pathRef.current, known })) showToast(n)
    },
  })

  return null
}
