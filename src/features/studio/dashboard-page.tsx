import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CalendarDaysIcon, RadioIcon, RefreshCwIcon, RadioTowerIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWhenText } from '@/features/channels/hooks/use-schedule-text'
import { Segmented } from '@/features/discover/components/filter-select'
import { EmptyPanel, InlineError } from '@/features/discover/components/list-states'
import { ViewerCount } from '@/features/streams/components/viewer-count'
import { NotCreatorYet } from '@/features/studio/components/not-creator'
import { useChannelStats, useDashboard, useSchedules } from '@/features/studio/hooks/use-studio-data'
import { StudioPageHeader } from '@/features/studio/studio-layout'
import type { DashboardStream, StatsRange } from '@/features/studio/types'
import { useNow } from '@/hooks/use-now'
import { errorCode } from '@/lib/api-error'
import { elapsedSince, formatDate, formatDuration, formatNumber } from '@/lib/format'

/** Stat Tile: label, big number, optional note (no charts in GĐ4). */
function StatTile({ label, value, note, loading }: { label: string; value: string; note?: string; loading?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-panel border bg-surface p-4" data-testid="stat-tile">
      <span className="text-label-sm font-medium text-muted-foreground">{label}</span>
      {loading ? <Skeleton className="h-8 w-20" /> : <span className="font-heading text-[28px] leading-9 font-bold text-foreground tabular-nums">{value}</span>}
      {note && !loading && <span className="text-label-sm font-normal text-subtle-foreground">{note}</span>}
    </div>
  )
}

function endReasonKey(r: DashboardStream['endReason']) {
  return r === 'ingest_timeout' ? 'dashboard.recent.endTimeout' : r === 'admin_takedown' ? 'dashboard.recent.endAdmin' : 'dashboard.recent.endCreator'
}

function VodCell({ s }: { s: DashboardStream }) {
  const { t } = useTranslation('studio')
  if (!s.vodId) return <span className="text-subtle-foreground">—</span>
  if (s.vodVisibility === 'HIDDEN') return <span className="rounded-control bg-warning/15 px-2 py-0.5 text-label-sm font-semibold text-warning">{t('dashboard.recent.hidden')}</span>

  return (
    <Link to={`/vod/${s.vodId}`} className="text-primary hover:underline">
      {t('dashboard.recent.watch')}
    </Link>
  )
}

function RecentStreams({ items }: { items: DashboardStream[] }) {
  const { t } = useTranslation('studio')

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-body-sm">
          <thead className="text-label-sm text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 font-medium">{t('dashboard.recent.colTitle')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('dashboard.recent.colDate')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('dashboard.recent.colDuration')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('dashboard.recent.colEnd')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('dashboard.recent.colPeak')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('dashboard.recent.colVod')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.streamId} className="h-14 border-b last:border-0 hover:bg-accent">
                <td className="max-w-80 truncate px-3 font-medium text-foreground">{s.title}</td>
                <td className="px-3 text-muted-foreground">{formatDate(s.startedAt, { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="px-3 text-muted-foreground tabular-nums">{formatDuration(s.durationSec)}</td>
                <td className="px-3 text-muted-foreground">{t(endReasonKey(s.endReason))}</td>
                <td className="px-3 text-muted-foreground tabular-nums">{s.peakViewers === null ? '—' : formatNumber(s.peakViewers)}</td>
                <td className="px-3">
                  <VodCell s={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {items.map((s) => (
          <li key={s.streamId} className="flex flex-col gap-1 rounded-lg border p-3 text-body-sm">
            <span className="truncate font-medium text-foreground">{s.title}</span>
            <span className="text-muted-foreground">
              {formatDate(s.startedAt, { dateStyle: 'short', timeStyle: 'short' })} · {formatDuration(s.durationSec)} · {t(endReasonKey(s.endReason))}
            </span>
            <VodCell s={s} />
          </li>
        ))}
      </ul>
    </>
  )
}

/** /studio — 16 · Studio Tổng quan: status card, four stat tiles (7 / 28 days), recent streams, upcoming. */
export function StudioDashboardPage() {
  const { t } = useTranslation('studio')
  const qc = useQueryClient()
  const [range, setRange] = useState<StatsRange>('7d')
  const dashboard = useDashboard(range)
  const stats = useChannelStats(range)
  const { active } = useSchedules()
  const now = useNow(1000)
  const when = useWhenText()
  const notCreator = errorCode(dashboard.error) === 'NOT_CREATOR' || errorCode(stats.error) === 'NOT_CREATOR'
  const days = range === '7d' ? 7 : 28

  if (notCreator) {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <StudioPageHeader title={t('dashboard.title')} />
        <NotCreatorYet />
      </div>
    )
  }

  const d = dashboard.data
  const upcoming = (active.data ?? [])
    .flatMap((s) => s.nextOccurrences.map((o) => ({ ...o, title: s.title, scheduleId: s.id })))
    .filter((o) => Date.parse(o.occurrenceAt) > now)
    .sort((a, b) => a.occurrenceAt.localeCompare(b.occurrenceAt))
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 md:pb-8" data-testid="studio-dashboard">
      <StudioPageHeader
        title={t('dashboard.title')}
        actions={
          <Button variant="secondary" onClick={() => void qc.invalidateQueries({ queryKey: ['studio'] })}>
            <RefreshCwIcon />
            {t('dashboard.refresh')}
          </Button>
        }
      />

      {dashboard.isError && !d ? (
        <InlineError label={t('dashboard.failed')} onRetry={() => void dashboard.refetch()} />
      ) : !d ? (
        <Skeleton className="h-28 rounded-panel" />
      ) : d.current ? (
        <section className="flex flex-wrap items-center gap-4 rounded-panel border border-live/40 bg-surface p-5" data-testid="dashboard-live">
          <span className="inline-flex items-center gap-1.5 rounded-control bg-live px-2 py-0.75 text-[11px] font-bold text-white uppercase">{t('dashboard.live')}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-body-lg font-semibold">{d.current.title}</span>
            <span className="flex items-center gap-3 text-body-sm text-muted-foreground">
              {elapsedSince(d.current.startedAt, now)}
              <ViewerCount count={d.current.viewerCount} />
            </span>
          </div>
          <Button asChild>
            <Link to="/studio/stream">
              <RadioIcon />
              {t('dashboard.openManager')}
            </Link>
          </Button>
        </section>
      ) : (
        <section className="flex flex-wrap items-center gap-4 rounded-panel border bg-surface p-5" data-testid="dashboard-offline">
          <span className="rounded-control bg-card px-2 py-0.75 text-[11px] font-bold text-muted-foreground uppercase">{t('dashboard.offline')}</span>
          <span className="min-w-0 flex-1 text-body-md text-muted-foreground">
            {upcoming[0] ? t('dashboard.nextUp', { title: upcoming[0].title, when: when(upcoming[0].occurrenceAt, now) }) : t('dashboard.noUpcoming')}
          </span>
          <Button asChild>
            <Link to="/studio/stream">
              <RadioTowerIcon />
              {t('dashboard.goLive')}
            </Link>
          </Button>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <Segmented
          label={t('dashboard.range.label')}
          value={range}
          onChange={setRange}
          options={[
            { value: '7d', label: t('dashboard.range.7d') },
            { value: '28d', label: t('dashboard.range.28d') },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label={t('dashboard.stats.streams')} value={formatNumber(d?.stats.streamCount ?? 0)} loading={!d && !dashboard.isError} />
        <StatTile
          label={t('dashboard.stats.hours')}
          value={t('dashboard.stats.hoursValue', { value: formatNumber(Math.round((d?.stats.liveSeconds ?? 0) / 360) / 10) })}
          loading={!d && !dashboard.isError}
        />
        <StatTile
          label={t('dashboard.stats.vods')}
          value={formatNumber((d?.stats.vodReadyPublic ?? 0) + (d?.stats.vodReadyHidden ?? 0))}
          note={t('dashboard.stats.vodsSplit', { public: d?.stats.vodReadyPublic ?? 0, hidden: d?.stats.vodReadyHidden ?? 0 })}
          loading={!d && !dashboard.isError}
        />
        {stats.isError && !stats.data ? (
          <InlineError label={t('dashboard.failed')} onRetry={() => void stats.refetch()} className="p-3" />
        ) : (
          <StatTile
            label={t('dashboard.stats.followers')}
            value={formatNumber(stats.data?.followerCount ?? 0)}
            note={t('dashboard.stats.newFollowers', { value: formatNumber(stats.data?.newFollowers ?? 0), days })}
            loading={!stats.data}
          />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="recent-title" className="flex flex-col gap-3 rounded-panel border bg-surface p-4 md:p-5">
          <h2 id="recent-title" className="font-heading text-headline-sm">
            {t('dashboard.recent.title')}
          </h2>
          {dashboard.isError && !d ? (
            <InlineError label={t('dashboard.failed')} onRetry={() => void dashboard.refetch()} />
          ) : !d ? (
            <Skeleton className="h-40" />
          ) : d.recentStreams.length === 0 ? (
            <EmptyPanel icon={RadioTowerIcon} title={t('dashboard.recent.emptyTitle')} className="border-0">
              <Button asChild>
                <Link to="/studio/stream">{t('dashboard.goLive')}</Link>
              </Button>
            </EmptyPanel>
          ) : (
            <RecentStreams items={d.recentStreams} />
          )}
        </section>

        <section aria-labelledby="upcoming-title" className="flex flex-col gap-3 rounded-panel border bg-surface p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-title" className="font-heading text-headline-sm">
              {t('dashboard.upcoming.title')}
            </h2>
            <Link to="/studio/schedule" className="text-label-md text-primary hover:underline">
              {t('dashboard.upcoming.manage')}
            </Link>
          </div>
          {active.isError && !active.data ? (
            <InlineError label={t('dashboard.failed')} onRetry={() => void active.refetch()} />
          ) : active.isPending ? (
            <Skeleton className="h-24" />
          ) : upcoming.length === 0 ? (
            <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
              <CalendarDaysIcon className="size-4" aria-hidden />
              {t('dashboard.noUpcoming')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((o) => (
                <li key={`${o.scheduleId}-${o.occurrenceAt}`} className="flex flex-col gap-0.5 rounded-lg border p-3">
                  <span className="text-label-sm font-semibold text-muted-foreground">{when(o.occurrenceAt, now)}</span>
                  <span className="truncate text-body-md font-medium">{o.title}</span>
                  <span className="text-label-sm font-normal text-subtle-foreground">{t('dashboard.upcoming.reminders', { count: o.reminderCount })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
