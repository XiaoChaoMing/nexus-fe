import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EyeOffIcon, HistoryIcon } from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useCategoryMap } from '@/features/categories/api'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { channelName } from '@/features/channels/lib/channel-display'
import { thumbSrc } from '@/features/home/lib/featured'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { StreamStatusBadge, TagChip } from '@/features/streams/components/stream-meta'
import { ViewerCount } from '@/features/streams/components/viewer-count'
import type { Stream } from '@/features/streams/types'
import { languageName } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  stream: Stream
  now: number
  className?: string
  /** The broadcast ended after the list loaded: the card keeps its place, dimmed (K1, Card/Stream/Ended). */
  ended?: boolean
  /** Tags become filters (Khám phá); elsewhere they are plain chips. */
  onTag?: (tag: string) => void
}

/** 18+ thumbnails are blurred for guests and accounts that have not turned on mature content. */
function useBlurMature(mature: boolean): boolean {
  const visible = useAuthStore((s) => s.status === 'authenticated' && s.me?.preferences.matureVisible === true)

  return mature && !visible
}

/**
 * Card/Stream: 16:9 thumbnail with the live badge and viewers, avatar, title, channel, category link and two tags.
 * The whole card opens the stream (a stretched link), while the category and tags keep their own targets.
 */
export function StreamCard({ stream: s, now, className, ended = false, onTag }: Props) {
  const { t } = useTranslation(['discover', 'common'])
  const name = channelName(s.channel)
  const category = useCategoryMap().get(s.category?.id ?? '')
  const blur = useBlurMature(s.isMature)
  const chips = [...(s.language ? [{ label: languageName(s.language), tag: null }] : []), ...s.tags.map((tag) => ({ label: tag, tag }))].slice(0, 2)

  return (
    <article className={cn('group relative flex min-w-0 flex-col gap-2.5 rounded-lg', ended && 'opacity-50', className)} data-testid="stream-card">
      <span className="relative block aspect-video overflow-hidden rounded-lg group-has-[a[data-main]:focus-visible]:outline-2 group-has-[a[data-main]:focus-visible]:outline-offset-2 group-has-[a[data-main]:focus-visible]:outline-ring">
        <Thumbnail src={thumbSrc(s.thumbnailUrl, now)} className={cn('size-full transition-transform duration-300 group-hover:scale-[1.02]', blur && 'scale-110 blur-xl')} />
        {ended ? (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-control bg-overlay px-2 py-0.75 text-[11px] font-bold text-white">
            <HistoryIcon className="size-3" aria-hidden />
            {t('discover:card.ended')}
          </span>
        ) : (
          <span className="absolute top-2 left-2 flex items-center gap-1.5">
            <StreamStatusBadge status={s.status} />
            {s.isMature && <span className="rounded-control bg-warning/15 px-2 py-0.75 text-[11px] font-bold text-warning">{t('common:status.mature')}</span>}
          </span>
        )}
        {blur && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-label-sm text-foreground" aria-hidden>
            <EyeOffIcon className="size-5" />
            {t('discover:card.matureContent')}
          </span>
        )}
        {!ended && <ViewerCount count={s.viewerCount} variant="overlay" className="absolute bottom-2 left-2" />}
      </span>
      <span className="flex min-w-0 gap-2.5">
        <ChannelAvatar channel={s.channel} size="md" className="mt-0.5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.75">
          <Link
            to={`/live/${s.id}`}
            data-main
            className="truncate text-[15px] leading-5 font-semibold text-foreground outline-none group-hover:text-primary after:absolute after:inset-0 after:rounded-lg"
            title={s.title}
          >
            {s.title}
          </Link>
          {name && (
            <span className="truncate text-body-sm text-muted-foreground" data-testid="card-channel">
              {name}
            </span>
          )}
          {category && (
            <Link to={`/browse/${category.slug}`} className="relative z-10 w-fit max-w-full truncate rounded-sm text-body-sm font-medium text-primary hover:underline" data-testid="card-category">
              {category.name}
            </Link>
          )}
          {chips.length > 0 && (
            <span className="relative z-10 flex flex-nowrap gap-1.5 overflow-hidden pt-1">
              {chips.map((c, i) =>
                c.tag && onTag ? (
                  <button key={`${c.label}-${i}`} type="button" onClick={() => onTag(c.tag as string)} className="max-w-full truncate rounded-sm bg-accent px-2 py-0.5 text-label-sm font-normal text-muted-foreground hover:text-foreground">
                    {c.label}
                  </button>
                ) : (
                  <TagChip key={`${c.label}-${i}`}>{c.label}</TagChip>
                ),
              )}
            </span>
          )}
        </span>
      </span>
    </article>
  )
}
