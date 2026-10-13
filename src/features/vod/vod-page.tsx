import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { CalendarIcon, ClockIcon, HourglassIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatClock } from '@/features/player/lib/live-edge'
import { ChannelByline } from '@/features/channels/components/channel-byline'
import { HlsPlayer } from '@/features/player/components/hls-player'
import { useVod } from '@/features/streams/hooks/use-streams'
import { clearProgress, loadProgress, saveProgress } from '@/features/vod/lib/progress'
import { isApiError } from '@/lib/api-error'
import { daysUntil, formatDate } from '@/lib/format'

const SAVE_EVERY_SEC = 10

type Start = { at: number; run: number } | null

/** Saves the position every few seconds of playback and when the page is left. */
function useProgressSaver(vodId: string) {
  const last = useRef({ time: 0, duration: 0, savedAt: -Infinity })

  const flush = useCallback(() => {
    const { time, duration } = last.current
    if (time > 0) saveProgress(vodId, time, duration)
  }, [vodId])

  useEffect(() => {
    window.addEventListener('pagehide', flush)

    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return useCallback(
    (time: number, duration: number) => {
      const l = last.current
      l.time = time
      l.duration = duration
      if (Math.abs(time - l.savedAt) >= SAVE_EVERY_SEC || (duration > 0 && time >= duration - 1)) {
        l.savedAt = time
        saveProgress(vodId, time, duration)
      }
    },
    [vodId],
  )
}

/** /vod/:vodId — replay of an ended broadcast (UC-A06), resume in this browser (UC-A07 local). */
export function VodPage() {
  const { vodId = '' } = useParams()
  const { t } = useTranslation(['vod', 'common'])
  const { data: vod, error, isPending } = useVod(vodId)
  const [resumeAt] = useState(() => loadProgress(vodId))
  // null until the viewer answers the resume prompt (or immediately when there is nothing to resume).
  const [start, setStart] = useState<Start>(() => (resumeAt === null ? { at: 0, run: 0 } : null))
  const onTime = useProgressSaver(vodId)

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-4 md:p-6">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    )
  }

  if (error || !vod) {
    const gone = isApiError(error) && error.status === 404

    return (
      <section className="grid place-items-center px-4 py-24 text-center" data-testid="vod-gone">
        <div className="flex max-w-md flex-col items-center gap-3">
          <h1 className="font-heading text-headline-md">{gone ? t('gone') : t('loadFailed')}</h1>
          {gone && <p className="text-muted-foreground">{t('goneBody')}</p>}
          <Button asChild variant="secondary" className="mt-2">
            <Link to="/">{t('backHome')}</Link>
          </Button>
        </div>
      </section>
    )
  }

  const days = daysUntil(vod.expiresAt)
  const restart = () => {
    clearProgress(vod.id)
    setStart((s) => ({ at: 0, run: (s?.run ?? 0) + 1 }))
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-4 md:p-6">
      {start ? (
        <HlsPlayer
          key={start.run}
          src={vod.manifestUrl}
          mode="vod"
          startAt={start.at || undefined}
          onTimeUpdate={onTime}
          endedLabel={t('finished')}
          endedSlot={
            <Button onClick={restart}>
              <RotateCcwIcon />
              {t('watchAgain')}
            </Button>
          }
        />
      ) : (
        <div
          className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-black bg-cover bg-center"
          style={vod.thumbnailUrl ? { backgroundImage: `url(${vod.thumbnailUrl})` } : undefined}
          data-testid="vod-resume"
        >
          <div className="absolute inset-0 bg-black/70" aria-hidden />
          <div role="dialog" aria-labelledby="resume-title" className="relative flex max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center">
            <h2 id="resume-title" className="font-heading text-headline-sm">
              {t('resumeTitle', { time: formatClock(resumeAt ?? 0) })}
            </h2>
            <p className="text-body-sm text-muted-foreground">{t('resumeBody')}</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button onClick={() => setStart({ at: resumeAt ?? 0, run: 0 })} autoFocus>
                <PlayIcon />
                {t('resume')}
              </Button>
              <Button variant="secondary" onClick={restart}>
                <RotateCcwIcon />
                {t('startOver')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <ChannelByline channel={vod.channel} size="lg" showHandle />
        <h1 className="font-heading text-headline-md break-words" title={vod.title}>
          {vod.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-muted-foreground">
          <Badge variant="secondary">{t('replayBadge')}</Badge>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-4" aria-hidden />
            {t('streamedOn', { date: formatDate(vod.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) })}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <ClockIcon className="size-4" aria-hidden />
            {t('duration', { time: formatClock(vod.durationSec) })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HourglassIcon className="size-4" aria-hidden />
            {days > 0 ? t('expiresIn', { count: days }) : t('expiresToday')}
          </span>
        </div>
      </div>
    </div>
  )
}
