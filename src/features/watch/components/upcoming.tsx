import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CalendarDaysIcon, CalendarXIcon, Loader2Icon, MessageSquareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { FollowButton } from '@/features/channels/components/follow-button'
import { ReminderButton } from '@/features/channels/components/schedule-card'
import { useDurationText, useWhenText } from '@/features/channels/hooks/use-schedule-text'
import { ShareButton } from '@/features/channels/components/share-button'
import { channelName } from '@/features/channels/lib/channel-display'
import { profilePath } from '@/features/channels/lib/handle'
import type { Occurrence } from '@/features/channels/types'
import { useChannelProfile } from '@/features/streams/hooks/use-streams'
import type { StreamDetail } from '@/features/streams/types'
import { countdown, upcomingPhase } from '@/features/watch/lib/upcoming'
import { cn } from '@/lib/utils'

type StageProps = { stream: StreamDetail; occurrence: Occurrence | null; now: number }

/**
 * Player area of 05 · Sắp diễn ra: blurred channel banner, "SẮP DIỄN RA", countdown (cyan in the last minute),
 * "Hôm nay · 20:00" and "Đặt nhắc"; at zero "Đang chờ streamer bắt đầu…"; or "Buổi phát đã bị hủy".
 */
export function UpcomingStage({ stream: s, occurrence, now }: StageProps) {
  const { t } = useTranslation('watch')
  const when = useWhenText()
  const profile = useChannelProfile(s.channel?.handle)
  const phase = upcomingPhase(s, now)
  const target = s.scheduledStartAt ? Date.parse(s.scheduledStartAt) : now
  const cd = countdown(target, now)
  const banner = profile.data?.bannerUrl ?? null

  return (
    <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface md:rounded-panel md:border" data-testid="upcoming-stage" data-phase={phase}>
      {banner && <img src={banner} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-xl" aria-hidden />}
      <span className="absolute top-3 left-3 rounded-control bg-cyan px-2 py-0.75 text-[11px] font-bold tracking-wide text-cyan-foreground uppercase">{t('upcoming.badge')}</span>

      {phase === 'cancelled' ? (
        <div className="relative flex max-w-md flex-col items-center gap-3 px-4 text-center" role="status" data-testid="upcoming-cancelled">
          <CalendarXIcon className="size-8 text-muted-foreground" aria-hidden />
          <h2 className="font-heading text-headline-sm text-foreground">{t('upcoming.cancelledTitle')}</h2>
          <p className="text-body-md text-muted-foreground">{t('upcoming.cancelledBody')}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {s.channel && (
              <Button asChild>
                <Link to={`${profilePath(s.channel.handle)}?tab=schedule`}>
                  <CalendarDaysIcon />
                  {t('upcoming.otherSchedule')}
                </Link>
              </Button>
            )}
            <FollowButton channel={s.channel} />
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-3 px-4 text-center">
          {phase === 'waiting' ? (
            <p className="flex items-center gap-2 rounded-lg bg-overlay px-5 py-3 text-body-lg font-medium text-foreground" role="status" data-testid="upcoming-waiting">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              {t('upcoming.waiting')}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-lg bg-overlay px-5 py-3" role="timer" aria-live="off" data-testid="upcoming-countdown">
              <span className={cn('text-label-sm font-medium', cd.soon ? 'text-cyan' : 'text-muted-foreground')}>{t('upcoming.startsIn')}</span>
              <span className={cn('font-heading text-[28px] leading-9 font-semibold tabular-nums md:text-[40px] md:leading-12', cd.soon ? 'text-cyan' : 'text-foreground')}>{cd.text}</span>
            </div>
          )}
          {s.scheduledStartAt && <span className="text-body-md text-foreground">{when(s.scheduledStartAt, now)}</span>}
          {phase === 'countdown' && s.scheduleId && s.scheduledStartAt && (
            <ReminderButton
              primary
              occurrence={{ scheduleId: s.scheduleId, occurrenceAt: occurrence?.occurrenceAt ?? s.scheduledStartAt, title: s.title }}
              channelId={s.channelId}
              seed={occurrence?.reminded}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Card under the stage: channel, "SẮP DIỄN RA", title, "Valorant · Dự kiến 2 giờ · Hôm nay 20:00", Follow + Share. */
export function UpcomingInfo({ stream: s, occurrence, now }: StageProps) {
  const { t } = useTranslation(['watch', 'common'])
  const duration = useDurationText()
  const when = useWhenText()
  const name = channelName(s.channel)
  const meta = [occurrence?.category?.name, occurrence ? t('watch:upcoming.expected', { value: duration(occurrence.durationMin) }) : null, s.scheduledStartAt ? when(s.scheduledStartAt, now) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="flex flex-col gap-3 px-4 py-3 md:rounded-panel md:border md:bg-surface md:p-5" aria-label={t('watch:channelInfo')}>
      <div className="flex items-center gap-3 md:gap-4">
        {s.channel && <ChannelAvatar channel={s.channel} size="lg" className="md:size-16" />}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {name && (
              <Link to={profilePath(s.channel?.handle ?? '')} className="truncate font-heading text-lg font-bold text-foreground hover:underline md:text-headline-md" data-testid="channel-name">
                {name}
              </Link>
            )}
            <span className="shrink-0 rounded-control bg-cyan/15 px-2 py-0.5 text-[11px] font-bold text-cyan uppercase">{t('watch:upcoming.badge')}</span>
          </div>
          <h1 className="text-body-lg font-medium break-words text-foreground">{s.title}</h1>
          {meta && <p className="text-label-sm font-normal text-muted-foreground">{meta}</p>}
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <FollowButton channel={s.channel} />
          <ShareButton />
        </div>
      </div>
      <div className="md:hidden">
        <FollowButton channel={s.channel} block />
      </div>
    </section>
  )
}

/** Chat column / tab while the broadcast has not started: "Chat mở khi buổi phát bắt đầu", input locked. */
export function ChatNotOpen({ column = false }: { column?: boolean }) {
  const { t } = useTranslation('watch')

  return (
    <aside
      className={cn('flex flex-col', column ? 'sticky top-20 h-[calc(100dvh-6.5rem)] w-85 shrink-0 rounded-panel border bg-surface' : 'h-full min-h-80')}
      aria-label={t('upcoming.chat')}
      data-testid="chat-not-open"
    >
      {column && <h2 className="border-b px-4 py-3 text-label-md font-semibold">{t('upcoming.chat')}</h2>}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <MessageSquareIcon className="size-7 text-muted-foreground" aria-hidden />
        <p className="text-body-md font-medium text-foreground">{t('upcoming.chatClosedTitle')}</p>
      </div>
      <div className="border-t p-3">
        <input disabled placeholder={t('upcoming.chatClosedInput')} aria-label={t('upcoming.chatClosedInput')} className="h-10 w-full rounded-lg border bg-background px-3 text-body-md placeholder:text-subtle-foreground disabled:cursor-not-allowed" />
      </div>
    </aside>
  )
}
