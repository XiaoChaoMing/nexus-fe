import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BellIcon, RotateCwIcon, SettingsIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { unreadBadge } from '@/features/auth/lib/roles'
import { GroupedNotifications, NotificationSkeleton } from '@/features/notifications/components/notification-list'
import { useNotificationActions, useNotificationList, useUnreadCount } from '@/features/notifications/hooks/use-notifications'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/utils'

/** Popover list: the first page of "Tất cả". */
const POPOVER_LIMIT = 20

function BellIconWithCount({ count, error }: { count: number; error: boolean }) {
  const badge = error ? null : unreadBadge(count)

  return (
    <>
      <BellIcon className="size-5.5" aria-hidden />
      {badge && (
        <span
          className="absolute top-0.5 right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-live px-1.25 text-[11px] leading-none font-semibold text-white tabular-nums outline-2 outline-surface"
          aria-hidden
          data-testid="bell-count"
        >
          {badge}
        </span>
      )}
    </>
  )
}

function PopoverBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('notifications')
  const list = useNotificationList('all', { limit: POPOVER_LIMIT })
  const { markAllRead } = useNotificationActions()
  const now = useNow(60_000)
  const items = list.data?.pages[0]?.items ?? []

  return (
    <div className="flex max-h-120 flex-col" data-testid="notification-popover">
      <div className="flex h-13 shrink-0 items-center gap-2 border-b pr-2 pl-4">
        <h2 className="flex-1 text-body-lg font-semibold text-foreground">{t('title')}</h2>
        <Link
          to="/settings/notifications"
          onClick={onClose}
          aria-label={t('openSettings')}
          title={t('openSettings')}
          className="grid size-9 place-items-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <SettingsIcon className="size-5" aria-hidden />
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1">
        {list.isPending ? (
          <NotificationSkeleton />
        ) : list.isError ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center" role="alert">
            <p className="text-body-md text-foreground">{t('loadFailed')}</p>
            <button type="button" onClick={() => void list.refetch()} className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-label-md font-semibold text-primary hover:bg-accent">
              <RotateCwIcon className="size-4" aria-hidden />
              {t('retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-body-md text-muted-foreground" data-testid="notifications-empty">
            {t('empty.all')}
          </p>
        ) : (
          <GroupedNotifications items={items} now={now} onOpen={onClose} compact />
        )}
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between border-t px-4">
        <button
          type="button"
          onClick={() => markAllRead.mutate(new Date().toISOString())}
          disabled={items.length === 0}
          className="rounded-control text-label-md font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {t('markAllRead')}
        </button>
        <Link to="/notifications" onClick={onClose} className="rounded-control text-label-md font-semibold text-primary outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          {t('seeAll')}
        </Link>
      </div>
    </div>
  )
}

/**
 * Notification/Bell on the Top Nav: unread count from notification-svc (realtime `unread_count`), 99+, no
 * number when the service is down. Desktop opens the popover; phones go straight to /notifications.
 */
export function NotificationBell() {
  const { t } = useTranslation('notifications')
  const unread = useUnreadCount()
  const [open, setOpen] = useState(false)
  const desktop = useMediaQuery(MEDIA.md)
  const count = unread.data ?? 0
  const label = count > 0 && !unread.isError ? t('bell.labelCount', { count }) : t('bell.label')
  const button = 'relative grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:size-11'

  if (!desktop) {
    return (
      <Link to="/notifications" aria-label={label} className={button} data-testid="notification-bell">
        <BellIconWithCount count={count} error={unread.isError} />
      </Link>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className={cn(button, open && 'bg-accent text-foreground')} data-testid="notification-bell">
          <BellIconWithCount count={count} error={unread.isError} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-95 overflow-hidden rounded-xl border bg-surface p-0">
        {open && <PopoverBody onClose={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  )
}
