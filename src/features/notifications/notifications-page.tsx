import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeftIcon, BellOffIcon, CheckCheckIcon, InboxIcon, SettingsIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { GroupedNotifications, NotificationSkeleton } from '@/features/notifications/components/notification-list'
import { useNotificationActions, useNotificationList } from '@/features/notifications/hooks/use-notifications'
import type { NotificationFilter } from '@/features/notifications/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'

/**
 * /notifications (23 · Thông báo): "Tất cả" / "Chưa đọc" (`?tab=unread`), grouped by age in a 720 px column,
 * infinite scroll, read all, per-item read / delete. Realtime items arrive through the shared cache.
 */
export function NotificationsPage() {
  const { t } = useTranslation('notifications')
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const filter: NotificationFilter = sp.get('tab') === 'unread' ? 'unread' : 'all'
  const list = useNotificationList(filter)
  const { markAllRead } = useNotificationActions()
  const now = useNow(60_000)
  const desktop = useMediaQuery(MEDIA.md)
  const items = list.data?.pages.flatMap((p) => p.items) ?? []

  const settings = (
    <Link
      to="/settings/notifications"
      aria-label={t('openSettings')}
      title={t('openSettings')}
      className="grid size-10 shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-md:size-11"
    >
      <SettingsIcon className="size-5" aria-hidden />
    </Link>
  )

  return (
    <div className="mx-auto flex w-full max-w-180 flex-col gap-4 pb-12 md:px-4 md:pt-8" data-testid="notifications-page">
      <div className="flex items-center gap-2 max-md:sticky max-md:top-0 max-md:z-10 max-md:h-14 max-md:border-b max-md:bg-background max-md:px-2">
        {!desktop && (
          <button type="button" onClick={() => navigate(-1)} aria-label={t('back')} className="grid size-11 place-items-center rounded-lg text-foreground hover:bg-accent">
            <ArrowLeftIcon className="size-5" aria-hidden />
          </button>
        )}
        <h1 className="flex-1 font-heading text-[28px] leading-9 font-bold text-foreground max-md:text-lg">{t('title')}</h1>
        <button
          type="button"
          onClick={() => markAllRead.mutate(new Date().toISOString())}
          disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg p-2 text-label-md text-primary outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 max-md:min-h-11"
        >
          <span className="max-md:sr-only">{t('markAllRead')}</span>
          <CheckCheckIcon className="size-4 max-md:size-5" aria-hidden />
        </button>
        {settings}
      </div>

      <div className="px-4 md:px-0">
        <Tabs value={filter} onValueChange={(v) => setSp(v === 'unread' ? new URLSearchParams({ tab: 'unread' }) : new URLSearchParams(), { replace: true })}>
          <TabsList aria-label={t('tabs.label')}>
            <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
            <TabsTrigger value="unread">{t('tabs.unread')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-2 md:px-0">
        {list.isPending ? (
          <NotificationSkeleton rows={6} />
        ) : list.isError ? (
          <ErrorPanel icon={BellOffIcon} title={t('loadFailed')} onRetry={() => void list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyPanel icon={InboxIcon} title={filter === 'unread' ? t('empty.unread') : t('empty.all')} testId="notifications-empty" />
        ) : (
          <>
            <GroupedNotifications items={items} now={now} large={!desktop} />
            <LoadMore hasMore={list.hasNextPage} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
          </>
        )}
      </div>
    </div>
  )
}
