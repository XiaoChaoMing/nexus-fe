import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronRightIcon, CircleStopIcon, ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useEndStream } from '@/features/streams/hooks/use-streams'
import { ChannelByline } from '@/features/channels/components/channel-byline'
import type { ChannelSummary, StudioStream } from '@/features/streams/types'
import { elapsedSince } from '@/lib/format'
import { cn } from '@/lib/utils'

type StudioHeaderProps = {
  current: StudioStream | null
  /** The creator's channel; null for older stream-svc responses. */
  channel?: ChannelSummary | null
  now: number
  /** Called after the creator ends the broadcast (drives the "stop OBS" notice). */
  onEnded: () => void
}

function StatusBadge({ current, now }: { current: StudioStream | null; now: number }) {
  const { t } = useTranslation()
  const tone = !current ? 'neutral' : current.status === 'LIVE' ? 'live' : 'warning'
  const label = !current ? t('status.offline') : current.status === 'LIVE' ? t('status.live') : t('status.interrupted')

  return (
    <span
      data-testid="studio-status"
      className={cn(
        'inline-flex h-7 items-center gap-2 rounded-control px-2.5 text-label-sm font-bold uppercase',
        tone === 'live' && 'bg-live/15 text-live',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'neutral' && 'bg-card text-muted-foreground',
      )}
    >
      <span className={cn('size-2 rounded-full', tone === 'live' ? 'bg-live' : tone === 'warning' ? 'bg-warning' : 'bg-subtle-foreground')} aria-hidden />
      <span>{label}</span>
      {current && (
        <>
          <span className={cn('h-3 w-px', tone === 'live' ? 'bg-live/30' : 'bg-warning/30')} aria-hidden />
          <span className="font-mono font-semibold text-foreground tabular-nums">{elapsedSince(current.startedAt, now)}</span>
        </>
      )}
    </span>
  )
}

/** Breadcrumb, title, broadcast state and the page-level actions (UC-G05 end). */
export function StudioHeader({ current, channel, now, onEnded }: StudioHeaderProps) {
  const { t } = useTranslation(['studio', 'common'])
  const end = useEndStream()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="flex flex-col gap-1.5">
        <nav aria-label={t('common:nav.breadcrumb')} className="flex items-center gap-1.5 text-label-sm font-semibold uppercase">
          <span className="text-subtle-foreground">{t('breadcrumb.studio')}</span>
          <ChevronRightIcon className="size-3.5 text-subtle-foreground" aria-hidden />
          <span className="text-primary">{t('nav.stream')}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className="font-heading text-[28px] leading-tight font-bold">{t('title')}</h1>
          <StatusBadge current={current} now={now} />
        </div>
        <ChannelByline channel={channel} size="sm" live={current?.status === 'LIVE'} showHandle className="pt-1" />
      </div>

      {current && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="secondary">
            <Link to={`/live/${current.streamId}`} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
              {t('header.watch')}
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            <CircleStopIcon />
            {t('header.end')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={t('header.endConfirmTitle')}
        confirmLabel={t('header.endConfirm')}
        danger
        loading={end.isPending}
        onConfirm={() =>
          end.mutate(undefined, {
            onSuccess: onEnded,
            onSettled: () => setConfirm(false),
          })
        }
        onClose={() => setConfirm(false)}
      >
        {t('header.endConfirmBody')}
        {end.isError && <span className="mt-2 block text-destructive">{t('header.endFailed')}</span>}
      </ConfirmDialog>
    </div>
  )
}
