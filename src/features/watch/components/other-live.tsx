import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { channelName } from '@/features/channels/lib/channel-display'
import { thumbSrc } from '@/features/home/lib/featured'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { StreamStatusBadge } from '@/features/streams/components/stream-meta'
import { useLiveStreams } from '@/features/streams/hooks/use-streams'
import { useNow } from '@/hooks/use-now'

/** "Các kênh đang live khác" under an ended broadcast: up to three, hidden when nobody else is live. */
export function OtherLive({ excludeId }: { excludeId: string }) {
  const { t } = useTranslation('watch')
  const { data } = useLiveStreams()
  const now = useNow(60_000)
  const others = (data?.items ?? []).filter((s) => s.id !== excludeId).slice(0, 3)

  if (others.length === 0) return null

  return (
    <div className="hidden flex-col items-center gap-3 pt-5 md:flex" data-testid="other-live">
      <p className="text-body-sm font-semibold text-muted-foreground">{t('otherLive')}</p>
      <ul className="flex gap-4">
        {others.map((s) => (
          <li key={s.id}>
            <Link to={`/live/${s.id}`} className="group flex w-40 flex-col gap-2 rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <span className="relative block aspect-video overflow-hidden rounded-lg">
                <Thumbnail src={thumbSrc(s.thumbnailUrl, now)} className="size-full" />
                <StreamStatusBadge status={s.status} className="absolute top-1.5 left-1.5" />
              </span>
              <span className="truncate text-body-sm font-medium text-foreground group-hover:text-primary">{channelName(s.channel) ?? s.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
