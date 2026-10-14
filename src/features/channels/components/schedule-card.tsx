import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BellIcon, CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useReminder } from '@/features/channels/hooks/use-reminder'
import { useDurationText, useWhenText } from '@/features/channels/hooks/use-schedule-text'
import { dayLabel } from '@/features/channels/lib/schedule-days'
import type { Occurrence } from '@/features/channels/types'
import { formatDate } from '@/lib/format'
import { browserTimeZone } from '@/lib/timezone'
import { cn } from '@/lib/utils'

/** "Đặt nhắc" / "Đã đặt nhắc" toggle; guests get the login modal with the reminder remembered. */
export function ReminderButton({ occurrence: o, channelId, seed, block = false, primary = false, className }: {
  occurrence: Pick<Occurrence, 'scheduleId' | 'occurrenceAt' | 'title'>
  channelId?: string
  seed?: boolean | null
  block?: boolean
  /** Primary style on the Upcoming stage (frame 05). */
  primary?: boolean
  className?: string
}) {
  const { t } = useTranslation('channel')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const gated = useGatedAction()
  const r = useReminder({ scheduleId: o.scheduleId, occurrenceAt: o.occurrenceAt, channelId }, seed)

  if (signedIn && r.reminded) {
    return (
      <Button variant={primary ? 'secondary' : 'ghost'} className={cn('text-primary hover:text-primary max-md:h-11', block && 'w-full', className)} onClick={r.toggle} aria-pressed data-testid="remind-button">
        <CheckIcon />
        {t('schedule.reminded')}
      </Button>
    )
  }

  return (
    <Button
      variant={primary ? 'default' : 'secondary'}
      className={cn('max-md:h-11', block && 'w-full', className)}
      aria-pressed={false}
      aria-label={t('schedule.remindLabel', { title: o.title })}
      data-testid="remind-button"
      onClick={() =>
        signedIn ? r.toggle() : gated({ type: 'remind', params: { scheduleId: o.scheduleId, occurrenceAt: o.occurrenceAt }, context: 'remind' })
      }
    >
      <BellIcon />
      {t('schedule.remind')}
    </Button>
  )
}

/**
 * Card/Schedule: date block, when, title, category, "Dự kiến 2 giờ", reminder. Today's broadcasts are cyan.
 * `compact`: mobile layout with a full-width 44 px button.
 */
export function ScheduleCard({ occurrence: o, channelId, now, compact = false }: { occurrence: Occurrence; channelId: string; now: number; compact?: boolean }) {
  const { t } = useTranslation('channel')
  const duration = useDurationText()
  const when = useWhenText()
  const ms = Date.parse(o.occurrenceAt)
  const today = dayLabel(ms, now, browserTimeZone()).kind === 'today'
  const weekday = today ? t('schedule.todayShort') : formatDate(o.occurrenceAt, { weekday: 'short' }).toLocaleUpperCase()
  const date = formatDate(o.occurrenceAt, { day: '2-digit', month: '2-digit' })
  const time = formatDate(o.occurrenceAt, { hour: '2-digit', minute: '2-digit' })

  const block = (
    <span className={cn('flex shrink-0 flex-col items-center justify-center rounded-control', compact ? 'h-15 w-14' : 'h-17 w-16', today ? 'bg-cyan/15 text-cyan' : 'bg-card')}>
      <span className={cn('text-[10.5px] font-bold', !today && 'text-muted-foreground')}>{weekday}</span>
      <span className={cn('font-bold', compact ? 'text-base' : 'text-lg', !today && 'text-foreground')}>{date}</span>
      <span className={cn('text-[11.5px] font-semibold', !today && 'text-muted-foreground')}>{time}</span>
    </span>
  )
  const title = o.streamId ? (
    <Link to={`/live/${o.streamId}`} className="truncate text-[15px] font-semibold text-foreground hover:text-primary">
      {o.title}
    </Link>
  ) : (
    <span className="truncate text-[15px] font-semibold text-foreground">{o.title}</span>
  )
  const info = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className={cn('text-label-sm font-semibold', today ? 'text-cyan' : 'text-muted-foreground')}>{when(o.occurrenceAt, now)}</span>
      {title}
      <span className="flex flex-wrap items-center gap-2 text-label-sm font-normal text-muted-foreground">
        {o.category && (
          <Link to={`/browse/${o.category.slug}`} className="rounded-sm bg-accent px-2 py-0.5 hover:text-foreground">
            {o.category.name}
          </Link>
        )}
        <span>{t('schedule.expected', { value: duration(o.durationMin) })}</span>
      </span>
    </span>
  )

  if (compact) {
    return (
      <div className={cn('flex flex-col gap-3 rounded-lg border bg-surface p-3', today && 'border-cyan')} data-testid="schedule-card">
        <div className="flex items-center gap-3">
          {block}
          {info}
        </div>
        <ReminderButton occurrence={o} channelId={channelId} seed={o.reminded} block />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3.5 rounded-lg border bg-surface p-3', today && 'border-cyan')} data-testid="schedule-card">
      {block}
      {info}
      <ReminderButton occurrence={o} channelId={channelId} seed={o.reminded} />
    </div>
  )
}
