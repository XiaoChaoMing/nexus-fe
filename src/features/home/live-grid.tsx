import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { channelName } from '@/features/channels/lib/channel-display'
import { useLiveStreams } from '@/features/streams/hooks/use-streams'
import type { Stream } from '@/features/streams/types'
import { elapsedSince } from '@/lib/format'

/** Thumbnails are rewritten every 30 s with the same key; a per-minute query string beats the cache. */
function thumbSrc(url: string, now: number) {
  return `${url}?t=${Math.floor(now / 60_000)}`
}

function StreamCard({ s, now }: { s: Stream; now: number }) {
  const { t } = useTranslation()
  const [broken, setBroken] = useState(false)

  return (
    <Link to={`/live/${s.id}`} className="group flex flex-col gap-2" data-testid="stream-card">
      <div className="relative aspect-video overflow-hidden rounded-card bg-surface-1">
        {!broken && (
          <img
            src={thumbSrc(s.thumbnailUrl, now)}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        )}
        <div className="absolute left-2 top-2">
          {s.status === 'LIVE' ? <Badge variant="live">{t('status.live')}</Badge> : <Badge variant="warning">{t('status.interrupted')}</Badge>}
        </div>
        <span className="absolute bottom-2 left-2 rounded-control bg-deep/80 px-1.5 py-0.5 text-xs tabular-nums text-fg">
          {elapsedSince(s.startedAt, now)}
        </span>
      </div>
      <div className="flex min-w-0 gap-2.5">
        {s.channel && <ChannelAvatar channel={s.channel} className="mt-0.5" />}
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg group-hover:text-primary">{s.title}</p>
          {channelName(s.channel) && (
            <p className="truncate text-sm text-fg-secondary" data-testid="card-channel">
              {channelName(s.channel)}
            </p>
          )}
          {s.tags.length > 0 && <p className="truncate text-xs text-fg-muted">{s.tags.join(' · ')}</p>}
        </div>
      </div>
    </Link>
  )
}

export function LiveGrid({ heading }: { heading?: string } = {}) {
  const { t } = useTranslation('home')
  const { data, isPending, isError } = useLiveStreams()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)

    return () => window.clearInterval(id)
  }, [])

  return (
    <section aria-labelledby="live-heading" className="px-4 py-6">
      <h2 id="live-heading" className="mb-4 text-lg font-semibold">
        {heading ?? t('live.heading')}
      </h2>
      {isPending && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-card bg-surface-1" />
          ))}
        </div>
      )}
      {isError && <p className="text-fg-secondary">{t('live.loadFailed')}</p>}
      {data && data.items.length === 0 && (
        <p className="rounded-panel border border-dashed border-border p-8 text-center text-fg-secondary">{t('live.empty')}</p>
      )}
      {data && data.items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {data.items.map((s) => (
            <StreamCard key={s.id} s={s} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}
