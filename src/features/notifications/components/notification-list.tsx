import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CheckIcon, EllipsisIcon, Trash2Icon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificationLead, NotificationSentence } from '@/features/notifications/components/notification-text'
import { useNotificationActions } from '@/features/notifications/hooks/use-notifications'
import { groupByAge, type AgeGroup } from '@/features/notifications/lib/center'
import type { AppNotification } from '@/features/notifications/types'
import { formatDate, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type ItemProps = {
  n: AppNotification
  now: number
  /** Called after the item opened its page (the popover closes). */
  onOpen?: () => void
  /** Mobile page: taller rows (≥ 64 px). */
  large?: boolean
}

/**
 * Notification/Item: lead, sentence (names bold), relative time (absolute on hover), unread tint + dot, ⋯ with
 * "Đánh dấu đã đọc" / "Xóa". Opening an item reads it and goes to its page; items without a page only get read.
 */
export function NotificationItem({ n, now, onOpen, large = false }: ItemProps) {
  const { t } = useTranslation('notifications')
  const navigate = useNavigate()
  const { markRead, remove } = useNotificationActions()
  const absolute = formatDate(n.updatedAt, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })

  const open = () => {
    if (!n.read) markRead.mutate(n)
    if (n.link) {
      onOpen?.()
      navigate(n.link)
    }
  }

  return (
    <li
      className={cn('group/item relative flex items-start gap-1 rounded-lg hover:bg-accent', !n.read && 'bg-primary/6', large && 'min-h-16')}
      data-testid="notification-item"
      data-read={n.read}
      data-type={n.payload.type}
    >
      <button
        type="button"
        onClick={open}
        className={cn(
          'flex min-w-0 flex-1 items-start gap-3 rounded-lg p-3 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          !n.link && n.read && 'cursor-default',
        )}
      >
        <NotificationLead n={n} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <NotificationSentence n={n} />
          <time dateTime={n.updatedAt} title={absolute} className="text-label-sm font-normal text-muted-foreground">
            {relativeTime(n.updatedAt, now)}
          </time>
        </span>
        {!n.read && <span className="sr-only">{t('unreadMark')}</span>}
      </button>
      <div className="flex h-16 w-8 shrink-0 flex-col items-center justify-center pr-2">
        {!n.read && <span className="size-2 rounded-full bg-primary group-focus-within/item:hidden group-hover/item:hidden" aria-hidden data-testid="notification-unread-dot" />}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('options')}
              className={cn(
                'grid size-6 place-items-center rounded-control bg-card text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:grid max-md:size-9',
                n.read ? 'md:hidden md:group-hover/item:grid md:group-focus-within/item:grid' : 'hidden group-focus-within/item:grid group-hover/item:grid max-md:grid',
              )}
            >
              <EllipsisIcon className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-50">
            {!n.read && (
              <DropdownMenuItem onSelect={() => markRead.mutate(n)}>
                <CheckIcon />
                {t('markRead')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() =>
                remove.mutate(n, {
                  onSuccess: () => toast.success(t('deleted')),
                  onError: () => toast.error(t('actionFailed')),
                })
              }
            >
              <Trash2Icon />
              {t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

const GROUP_KEY: Record<AgeGroup, `groups.${AgeGroup}`> = { today: 'groups.today', yesterday: 'groups.yesterday', week: 'groups.week', older: 'groups.older' }

/** Items grouped Hôm nay / Hôm qua / 7 ngày qua / Cũ hơn (labels in caps). */
export function GroupedNotifications({ items, now, onOpen, large, compact = false }: { items: AppNotification[]; now: number; onOpen?: () => void; large?: boolean; compact?: boolean }) {
  const { t } = useTranslation('notifications')

  return (
    <div className="flex flex-col" aria-label={t('list')} role="region">
      {groupByAge(items, now).map(({ group, items: groupItems }) => (
        <section key={group} aria-label={t(GROUP_KEY[group])}>
          <h3 className={cn('text-[11px] font-semibold tracking-wide text-subtle-foreground uppercase', compact ? 'px-2.5 pt-2.5 pb-1' : 'px-3 pt-4 pb-1.5')}>{t(GROUP_KEY[group])}</h3>
          <ul className="flex flex-col gap-0.5">
            {groupItems.map((n) => (
              <NotificationItem key={n.id} n={n} now={now} onOpen={onOpen} large={large} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function NotificationSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-3 p-3">
          <Skeleton className="size-10 shrink-0 rounded-full bg-card" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-3 w-4/5 rounded-sm bg-card" />
            <Skeleton className="h-2.5 w-20 rounded-sm bg-card" />
          </div>
        </div>
      ))}
    </div>
  )
}
