import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { HouseIcon, LoaderCircleIcon, PlayIcon, TvMinimalIcon } from 'lucide-react'
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
