import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChannelByline } from '@/features/channels/components/channel-byline'
import { FollowButton } from '@/features/channels/components/follow-button'
import { HlsPlayer } from '@/features/player/components/hls-player'
import { useStream } from '@/features/streams/hooks/use-streams'
import { isApiError } from '@/lib/api-error'
import { elapsedSince } from '@/lib/format'

/** media-svc publishes the VOD within seconds; after this long none is coming (nothing was recorded). */
const VOD_WAIT_MS = 2 * 60_000

function EndedActions({ vodId, endedAt, now }: { vodId: string | null; endedAt: string | null; now: number }) {
  const { t } = useTranslation('watch')

  if (vodId) {
    return (
      <Link to={`/vod/${vodId}`} className="inline-flex h-10 items-center rounded-button bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">
        {t('replay')}
      </Link>
    )
  }

  if (endedAt && now - new Date(endedAt).getTime() > VOD_WAIT_MS) {
    return <p className="text-fg-secondary">{t('noReplay')}</p>
  }

  return <p className="text-fg-secondary">{t('replayProcessing')}</p>
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)

    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}

export function LivePage() {
  const { t } = useTranslation(['watch', 'common'])
  const { streamId = '' } = useParams()
  const { data: stream, error, isPending } = useStream(streamId)
  const [theater, setTheater] = useState(false)
  const [copied, setCopied] = useState(false)
  const now = useNow(1000)

  if (isPending) {
    return <div className="m-4 aspect-video max-w-6xl animate-pulse rounded-panel bg-surface-1" />
  }

  if (error || !stream) {
    const notFound = isApiError(error) && error.status === 404

    return (
      <section className="grid place-items-center px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">{notFound ? t('notFound') : t('loadFailed')}</h1>
        <Link to="/" className="mt-4 text-primary hover:underline">
          {t('common:actions.backHome')}
        </Link>
      </section>
    )
  }

  // Opened after the broadcast ended: no player, go straight to the replay.
  const endedOnArrival = stream.status === 'ENDED'

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: nothing else to do
    }
  }

  return (
    <div className={`mx-auto flex w-full flex-col gap-4 p-4 lg:flex-row ${theater ? 'max-w-none' : 'max-w-[1600px]'}`}>
      <div className="min-w-0 flex-1">
        {endedOnArrival ? (
          <div className="grid aspect-video place-items-center rounded-panel bg-surface-1 p-6 text-center" data-testid="ended-screen">
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg font-semibold">{t('ended')}</p>
              <EndedActions vodId={stream.vodId} endedAt={stream.endedAt} now={now} />
            </div>
          </div>
        ) : (
          <HlsPlayer
            src={stream.manifestUrl}
            mode="live"
            streamStatus={stream.status}
            matureScope={stream.isMature ? stream.channelId : undefined}
            theater={theater}
            onTheaterChange={setTheater}
            endedSlot={<EndedActions vodId={stream.vodId} endedAt={stream.endedAt} now={now} />}
          />
        )}

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <ChannelByline channel={stream.channel} size="lg" live={stream.status === 'LIVE'} showHandle />
            <h1 className="truncate text-lg font-semibold" title={stream.title}>
              {stream.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-fg-secondary">
              {stream.status === 'LIVE' && <Badge variant="live">{t('common:status.live')}</Badge>}
              {stream.status === 'INTERRUPTED' && <Badge variant="warning">{t('common:status.interrupted')}</Badge>}
              {stream.status === 'ENDED' && <Badge variant="secondary">{t('common:status.ended')}</Badge>}
              {stream.status !== 'ENDED' && <span className="tabular-nums">{t('common:elapsed', { time: elapsedSince(stream.startedAt, now) })}</span>}
              {stream.isMature && <Badge variant="warning">18+</Badge>}
              {stream.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FollowButton channel={stream.channel} />
            <button type="button" onClick={share} className="h-9 rounded-button border border-border px-3 text-sm font-semibold hover:border-primary hover:text-primary">
              {copied ? t('common:actions.linkCopied') : t('common:actions.share')}
            </button>
          </div>
        </div>
      </div>

      {!theater && (
        <aside className="flex min-h-48 w-full shrink-0 flex-col rounded-panel border border-border bg-base lg:w-[340px]" aria-label={t('chat.title')}>
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t('chat.title')}</div>
          <div className="grid flex-1 place-items-center p-6 text-center text-fg-muted">{t('chat.comingSoon')}</div>
        </aside>
      )}
    </div>
  )
}
