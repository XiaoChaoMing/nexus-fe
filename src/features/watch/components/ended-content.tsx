import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CompassIcon, HouseIcon, LoaderCircleIcon, PlayIcon, TriangleAlertIcon, TvMinimalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlayerActions, PlayerMessage } from '@/features/player/components/player-message'
import type { Stream } from '@/features/streams/types'
import { OtherLive } from '@/features/watch/components/other-live'
import { replayState } from '@/features/watch/lib/replay'

function HomeButton({ primary = false }: { primary?: boolean }) {
  const { t } = useTranslation('common')

  return (
    <Button asChild variant={primary ? 'default' : 'secondary'} className={primary ? undefined : 'font-medium'}>
      <Link to="/">
        <HouseIcon />
        {t('actions.backHome')}
      </Link>
    </Button>
  )
}

/**
 * 03b states 6–8: the broadcast ended — with a replay ("Xem lại"), while the replay is processed, or without
 * one; other live channels below. Switches from 7 to 6 by itself when the stream poll brings the VOD id.
 */
export function LiveEndedContent({ stream, now }: { stream: Stream; now: number }) {
  const { t } = useTranslation('watch')
  const replay = replayState(stream, now)

  // GĐ5: taken down by an Admin (or the channel suspended) — no replay, no reason (design 03b "Đã bị gỡ").
  if (stream.endReason === 'admin_takedown') {
    return (
      <div data-testid="taken-down" className="contents">
        <PlayerMessage icon={<TriangleAlertIcon className="text-warning" />} title={t('takenDown')} className="[&>span:first-child]:border-warning [&>span:first-child]:bg-warning/15" />
      </div>
    )
  }

  return (
    <PlayerMessage icon={<TvMinimalIcon />} title={t('ended')} description={replay === 'none' ? t('noReplay') : undefined}>
      {replay === 'ready' && stream.vodId && (
        <PlayerActions>
          <Button asChild>
            <Link to={`/vod/${stream.vodId}`}>
              <PlayIcon className="fill-current" />
              {t('replay')}
            </Link>
          </Button>
          <HomeButton />
        </PlayerActions>
      )}
      {replay === 'processing' && (
        <span className="flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2.5 text-label-md text-foreground" role="status">
          <LoaderCircleIcon className="size-4.5 animate-spin text-muted-foreground" aria-hidden />
          {t('replayProcessing')}
        </span>
      )}
      {replay === 'none' && <HomeButton />}
      <OtherLive excludeId={stream.id} />
    </PlayerMessage>
  )
}

/**
 * 03 · Phòng Live — Không còn khả dụng: a taken-down broadcast or a suspended channel opened later. No reason, no
 * chat; other live channels below.
 */
export function LiveUnavailable({ excludeId }: { excludeId: string }) {
  const { t } = useTranslation(['watch', 'common'])

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-10 md:p-6" data-testid="live-unavailable">
      <div className="flex flex-col items-center gap-4 rounded-panel border bg-surface px-4 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-xl border bg-card text-muted-foreground" aria-hidden>
          <TvMinimalIcon className="size-7" />
        </span>
        <h1 className="font-heading text-headline-md text-foreground">{t('unavailable')}</h1>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button asChild>
            <Link to="/">
              <HouseIcon />
              {t('common:actions.backHome')}
            </Link>
          </Button>
          <Button asChild variant="secondary" className="font-medium">
            <Link to="/browse">
              <CompassIcon />
              {t('browse')}
            </Link>
          </Button>
        </div>
      </div>
      <OtherLive excludeId={excludeId} />
    </div>
  )
}
