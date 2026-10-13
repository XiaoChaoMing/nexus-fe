import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArchiveXIcon, CalendarIcon, CircleCheckBigIcon, ClockIcon, HourglassIcon, HouseIcon, PlayIcon, RadioTowerIcon, RotateCcwIcon, RotateCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { FollowButton } from '@/features/channels/components/follow-button'
import { channelName } from '@/features/channels/lib/channel-display'
import { SectionHeader } from '@/features/home/components/section-header'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { StreamGrid } from '@/features/home/live-grid'
import { HlsPlayer } from '@/features/player/components/hls-player'
import { PlayerActions, PlayerMessage } from '@/features/player/components/player-message'
import { formatTimecode } from '@/features/player/lib/live-edge'
import { usePlayback } from '@/features/streams/hooks/use-playback'
import { useChannelProfile, useLiveStreams, useVod } from '@/features/streams/hooks/use-streams'
import type { Vod } from '@/features/streams/types'
import { useWatchProgress } from '@/features/vod/hooks/use-watch-progress'
import { loadProgress, resumePosition } from '@/features/vod/lib/progress'
import { isApiError } from '@/lib/api-error'
import { daysUntil, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

/** "Hết hạn sau N ngày" turns amber this close to expiry. */
const EXPIRY_WARNING_DAYS = 3

/** null until the viewer answers the resume prompt (or right away when there is nothing to resume). */
type Start = { at: number; run: number } | null

/** "Đang trực tiếp": a way onward from a replay; hidden when nobody is live. */
function LiveNow() {
  const { t } = useTranslation('vod')
  const { data } = useLiveStreams()
  const items = data?.items ?? []

  if (items.length === 0) return null

  return (
    <section aria-labelledby="vod-live-now" className="flex flex-col gap-4 px-4 md:px-0">
      <SectionHeader id="vod-live-now" icon={<RadioTowerIcon className="size-5.5 text-live" aria-hidden />} title={t('liveNow')} />
      <StreamGrid items={items.slice(0, 4)} />
    </section>
  )
}

function VodFrame({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="grid aspect-video max-md:aspect-auto max-md:min-h-60 place-items-center overflow-y-auto bg-surface py-4 md:rounded-panel md:border" data-testid={testId}>
      {children}
    </div>
  )
}

function HomeLink({ primary = false }: { primary?: boolean }) {
  const { t } = useTranslation('vod')

  return (
    <Button asChild variant={primary ? 'default' : 'secondary'} className={primary ? undefined : 'font-medium'}>
      <Link to="/">
        <HouseIcon />
        {t('backHome')}
      </Link>
    </Button>
  )
}

/** 08 · VOD — Hỏi xem tiếp: picture dimmed, prompt card with the watched share; Enter = "Xem tiếp". */
function ResumePrompt({ vod, at, onResume, onRestart }: { vod: Vod; at: number; onResume: () => void; onRestart: () => void }) {
  const { t } = useTranslation('vod')
  const pct = vod.durationSec > 0 ? Math.min(100, (at / vod.durationSec) * 100) : 0

  return (
    <div className="relative grid aspect-video max-md:aspect-auto max-md:min-h-60 grid-cols-1 place-items-center overflow-hidden bg-black px-4 md:rounded-panel md:border" data-testid="vod-resume">
      <Thumbnail src={vod.thumbnailUrl} className="absolute inset-0 size-full" eager />
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div role="dialog" aria-labelledby="resume-title" aria-describedby="resume-body" className="relative flex w-full max-w-95 flex-col gap-4 rounded-xl border bg-surface p-4 md:p-5">
        <div className="flex flex-col gap-1">
          <h2 id="resume-title" className="font-heading text-headline-sm text-foreground md:text-headline-md">
            {t('resumeTitle', { time: formatTimecode(at) })}
          </h2>
          <p id="resume-body" className="text-body-md text-muted-foreground">
            {t('resumeBody')}
          </p>
        </div>
        <div className="h-1 rounded-full bg-border" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onResume} autoFocus className="max-md:h-11">
            <PlayIcon className="fill-current" />
            {t('resume')}
          </Button>
          <Button variant="secondary" className="font-medium max-md:h-11" onClick={onRestart}>
            <RotateCcwIcon />
            {t('startOver')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function InfoColumn({ vod, className }: { vod: Vod; className?: string }) {
  const { t } = useTranslation('vod')
  const { data: profile } = useChannelProfile(vod.channel?.handle)
  const days = daysUntil(vod.expiresAt)
  const name = channelName(vod.channel)

  return (
    <section className={cn('flex flex-col gap-5 border-b p-4 md:rounded-panel md:border md:bg-surface md:p-5', className)} aria-label={t('info')}>
      {vod.channel && (
        <>
          <div className="flex items-center gap-3">
            <ChannelAvatar channel={vod.channel} size="lg" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body-lg font-semibold text-foreground" data-testid="channel-name">
                {name}
              </span>
              {profile && (
                <span className={cn('text-label-sm font-normal', profile.isLive ? 'text-live' : 'text-subtle-foreground')}>
                  {profile.isLive ? t('channelLive') : t('channelOffline')}
                </span>
              )}
            </div>
          </div>
          <FollowButton channel={vod.channel} className="h-11 w-full" />
          <div className="h-px bg-border" aria-hidden />
        </>
      )}
      <div className="flex flex-col gap-2.5">
        <span className="w-fit rounded-control bg-cyan/15 px-2 py-0.75 text-[11px] font-bold tracking-wide text-cyan-soft uppercase">{t('replayBadge')}</span>
        <h1 className="font-heading text-headline-md break-words text-foreground" title={vod.title}>
          {vod.title}
        </h1>
      </div>
      <ul className="flex flex-col gap-2.5 text-body-md text-muted-foreground">
        <li className="flex items-center gap-2">
          <CalendarIcon className="size-4.5 shrink-0" aria-hidden />
          {t('streamedOn', { date: formatDate(vod.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' }) })}
        </li>
        <li className="flex items-center gap-2 tabular-nums">
          <ClockIcon className="size-4.5 shrink-0" aria-hidden />
          {t('duration', { time: formatTimecode(vod.durationSec) })}
        </li>
        <li className={cn('flex items-center gap-2', days <= EXPIRY_WARNING_DAYS && 'text-warning')}>
          <HourglassIcon className="size-4.5 shrink-0" aria-hidden />
          {days > 0 ? t('expiresIn', { count: days }) : t('expiresToday')}
        </li>
      </ul>
    </section>
  )
}

/** The replay itself: resume prompt → player → "Bạn đã xem hết"; one instance per VOD and account. */
function VodWatch({ vod }: { vod: Vod }) {
  const { t } = useTranslation('vod')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const [resumeAt] = useState(() => (signedIn ? resumePosition(vod.viewer?.positionSec, vod.durationSec) : loadProgress(vod.id)))
  const [start, setStart] = useState<Start>(() => (resumeAt === null ? { at: 0, run: 0 } : null))
  const [theater, setTheater] = useState(false)
  const setUiTheater = useUiStore((s) => s.setTheater)
  const progress = useWatchProgress(vod.id, vod.durationSec)
  const playback = usePlayback('vod', vod.id)
  const decision = playback.decision

  useEffect(() => {
    setUiTheater(theater)
  }, [theater, setUiTheater])
  useEffect(() => () => setUiTheater(false), [setUiTheater])

  const restart = () => {
    progress.restart()
    setStart((s) => ({ at: 0, run: (s?.run ?? 0) + 1 }))
  }

  // The 18+ gate comes before the resume question (03b flow: gate → loading → playing).
  const gated = decision?.kind === 'mature'

  return (
    <div className="flex flex-col gap-8">
      <div className={cn('flex flex-col md:gap-6', !theater && 'xl:flex-row')}>
        <div className="min-w-0 flex-1 bg-black max-md:sticky max-md:top-0 max-md:z-20 md:bg-transparent">
          {start || gated ? (
            <HlsPlayer
              key={start?.run ?? -1}
              src={start && decision?.kind === 'ready' ? decision.manifestUrl : null}
              mode="vod"
              startAt={start?.at || undefined}
              session={{
                matureBlocked: gated,
                failed: playback.failed || decision?.kind === 'unavailable',
                onAcceptMature: playback.acknowledge,
                onRetry: playback.retry,
              }}
              theater={theater}
              onTheaterChange={setTheater}
              onTimeUpdate={progress.onTime}
              onPause={progress.onPause}
              heading={{ title: vod.title, subtitle: channelName(vod.channel) ?? undefined }}
              className="max-md:rounded-none max-md:border-0"
              endedContent={
                <PlayerMessage icon={<CircleCheckBigIcon />} title={t('finished')} description={vod.title}>
                  <PlayerActions>
                    <Button onClick={restart}>
                      <RotateCcwIcon />
                      {t('watchAgain')}
                    </Button>
                    <HomeLink />
                  </PlayerActions>
                </PlayerMessage>
              }
            />
          ) : (
            <ResumePrompt vod={vod} at={resumeAt ?? 0} onResume={() => setStart({ at: resumeAt ?? 0, run: 0 })} onRestart={restart} />
          )}
        </div>
        <InfoColumn vod={vod} className={cn(!theater && 'xl:w-80 xl:shrink-0 xl:self-start')} />
      </div>
      <LiveNow />
    </div>
  )
}

/** /vod/:vodId — 08 · Trang xem lại (UC-A06): playing, resume prompt, watched to the end, gone. */
export function VodPage() {
  const { vodId = '' } = useParams()
  const { t } = useTranslation('vod')
  const { data: vod, error, isPending, refetch } = useVod(vodId)
  const viewer = useAuthStore((s) => s.user?.id ?? 'guest')

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 md:p-4 xl:flex-row xl:p-6" aria-busy>
        <Skeleton className="aspect-video min-w-0 flex-1 rounded-none md:rounded-panel" />
        <Skeleton className="mx-4 h-80 md:mx-0 xl:w-80 xl:rounded-panel" />
      </div>
    )
  }

  if (error || !vod) {
    const gone = isApiError(error) && error.status === 404

    return (
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 md:p-4 xl:p-6">
        <VodFrame testId="vod-gone">
          <PlayerMessage icon={<ArchiveXIcon />} title={<span role="heading" aria-level={1}>{gone ? t('gone') : t('loadFailed')}</span>} description={gone ? t('goneBody') : undefined}>
            {gone ? (
              <HomeLink primary />
            ) : (
              <PlayerActions>
                <Button onClick={() => void refetch()}>
                  <RotateCwIcon />
                  {t('retry')}
                </Button>
                <HomeLink />
              </PlayerActions>
            )}
          </PlayerMessage>
        </VodFrame>
        <LiveNow />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] md:p-4 xl:p-6">
      <VodWatch key={`${vod.id}:${viewer}`} vod={vod} />
    </div>
  )
}
