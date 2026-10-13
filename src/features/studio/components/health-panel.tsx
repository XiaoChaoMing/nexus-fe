import { ChartColumnIcon, CircleCheckIcon, ClapperboardIcon, ClockIcon, CloudUploadIcon, HeartPulseIcon, TimerIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Health, StudioStream } from '@/features/streams/types'
import { useHealthHistory } from '@/features/studio/hooks/use-health-history'
import { droppedDeltas, HEALTH_STALE_MS, healthWarnings, TARGET_BITRATE_KBPS } from '@/features/studio/lib/health'
import { elapsedSince, formatDate, formatNumber } from '@/lib/format'
import { useMessage } from '@/i18n/messages'
import { cn } from '@/lib/utils'

const GRACE_SEC = 60
const RESTART_COOLDOWN_MS = 30_000

type MetricProps = {
  label: string
  value: string | null
  unit: string
  /** Bar heights as 0..1 of the chart. */
  bars: number[]
  barClass: string
  note: string
}

function Metric({ label, value, unit, bars, barClass, note }: MetricProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-card p-3.5">
      <span className="text-label-sm text-subtle-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={cn('font-heading text-2xl font-bold tabular-nums', value === null ? 'text-subtle-foreground' : 'text-foreground')}>{value ?? '—'}</span>
        {value !== null && <span className="text-body-sm text-subtle-foreground">{unit}</span>}
      </span>
      {bars.length > 0 ? (
        <div className="flex h-20 items-end gap-1 border-b pt-2.5" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className={cn('min-h-0.5 flex-1 rounded-t-[2px]', barClass)} style={{ height: `${Math.round(Math.min(1, Math.max(0, h)) * 100)}%` }} />
          ))}
        </div>
      ) : (
        <div className="grid h-20 place-items-center rounded-control bg-background text-subtle-foreground" aria-hidden>
          <ChartColumnIcon className="size-5" />
        </div>
      )}
      <span className="truncate text-body-sm text-muted-foreground">{note}</span>
    </div>
  )
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
      <div className="flex flex-col">
        <span className="text-label-sm font-normal text-subtle-foreground">{label}</span>
        <span className="text-[13px] font-semibold text-foreground tabular-nums">{children}</span>
      </div>
    </div>
  )
}

function metrics(t: TFunction<['studio', 'common']>, history: Health[], latest: Health | null): MetricProps[] {
  const drops = droppedDeltas(history)
  const maxFps = Math.max(30, ...history.map((h) => h.fps))
  const maxSpeed = Math.max(1.2, ...history.map((h) => h.speed))
  const maxDrop = Math.max(10, ...drops)

  return [
    {
      label: t('health.bitrate'),
      value: latest ? formatNumber(Math.round(latest.bitrateKbps)) : null,
      unit: 'kbps',
      bars: history.map((h) => h.bitrateKbps / TARGET_BITRATE_KBPS),
      barClass: 'bg-primary',
      note: latest ? t('health.bitrateTarget', { target: TARGET_BITRATE_KBPS }) : t('health.noData'),
    },
    {
      label: t('health.fps'),
      value: latest ? latest.fps.toFixed(0) : null,
      unit: 'fps',
      bars: history.map((h) => h.fps / maxFps),
      barClass: 'bg-cyan',
      note: latest ? t('health.fpsNote') : t('health.noData'),
    },
    {
      label: t('health.speed'),
      value: latest ? latest.speed.toFixed(2) : null,
      unit: 'x',
      bars: history.map((h) => h.speed / maxSpeed),
      barClass: 'bg-success',
      note: !latest ? t('health.noData') : latest.speed >= 0.99 ? t('health.speedOk') : t('health.speedSlow'),
    },
    {
      label: t('health.dropped'),
      value: latest ? String(latest.droppedFrames) : null,
      unit: t('health.droppedUnit'),
      bars: drops.map((d) => d / maxDrop),
      barClass: 'bg-subtle-foreground',
      note: !latest ? t('health.noData') : latest.droppedFrames === 0 ? t('health.droppedNone') : t('health.droppedTotal'),
    },
  ]
}

type HealthPanelProps = {
  current: StudioStream | null
  now: number
  /** When the creator last ended a broadcast here (ms), for the "stop OBS" notice. */
  endedAt: number | null
}

/** UC-G03–G04: ingest health of the current broadcast, refreshed with the Studio poll. */
export function HealthPanel({ current, now, endedAt }: HealthPanelProps) {
  const { t } = useTranslation(['studio', 'common'])
  const msg = useMessage()
  const fresh = current?.health && now - new Date(current.health.reportedAt).getTime() < HEALTH_STALE_MS ? current.health : null
  const history = useHealthHistory(current?.streamId ?? null, current?.health ?? null)
  const warnings = fresh ? healthWarnings(fresh) : []
  const updatedSec = current?.health ? Math.max(0, Math.round((now - new Date(current.health.reportedAt).getTime()) / 1000)) : null
  const graceLeft = current?.interruptedAt ? Math.max(0, GRACE_SEC - Math.floor((now - new Date(current.interruptedAt).getTime()) / 1000)) : 0
  const justEnded = !current && endedAt !== null && now - endedAt < RESTART_COOLDOWN_MS

  let badge: ReactNode = <span className="rounded-[4px] bg-card px-2 py-0.5 text-label-sm text-muted-foreground">{t('common:status.offline')}</span>
  if (current && !fresh) badge = <span className="rounded-[4px] bg-card px-2 py-0.5 text-label-sm text-muted-foreground">{t('health.waitingData')}</span>
  if (fresh)
    badge =
      warnings.length === 0 ? (
        <span className="inline-flex items-center gap-1 rounded-control bg-success/15 px-2 py-0.5 text-label-sm font-bold text-success">
          <CircleCheckIcon className="size-3.5" aria-hidden />
          {t('health.stable')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-control bg-warning/15 px-2 py-0.5 text-label-sm font-bold text-warning">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          {t('health.attention')}
        </span>
      )

  return (
    <section aria-labelledby="health-heading" data-testid="studio-health" className="flex flex-col gap-4 rounded-xl bg-surface p-5">
      <header className="flex flex-wrap items-center gap-2.5">
        <HeartPulseIcon className="size-5 text-primary" aria-hidden />
        <h2 id="health-heading" className="font-heading text-[16px] font-semibold">
          {t('health.title')}
        </h2>
        {badge}
        {fresh && updatedSec !== null && <span className="ml-auto text-body-sm text-subtle-foreground">{t('health.updated', { count: updatedSec })}</span>}
      </header>

      {current?.status === 'INTERRUPTED' && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-warning/15 p-3 text-body-sm text-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <Trans t={t} i18nKey="health.interrupted" values={{ seconds: graceLeft }} components={{ b: <b className="text-warning tabular-nums" /> }} />
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics(t, fresh ? history : [], fresh).map((m) => (
          <Metric key={m.label} {...m} />
        ))}
      </div>

      {warnings.map((w) => (
        <p key={w.key} className="flex items-start gap-2 text-body-sm text-warning">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {msg(w.key, w.values)}
        </p>
      ))}

      {current ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg bg-background px-3.5 py-3 sm:grid-cols-4">
          <Fact icon={ClockIcon} label={t('health.startedAt')}>
            {current.startedAt ? formatDate(current.startedAt, { timeStyle: 'short', dateStyle: 'short' }) : '—'}
          </Fact>
          <Fact icon={TimerIcon} label={t('health.elapsed')}>
            {elapsedSince(current.startedAt, now)}
          </Fact>
          <Fact icon={CloudUploadIcon} label={t('health.uploadErrors')}>
            {fresh ? fresh.uploadErrors : '—'}
          </Fact>
          <Fact icon={ClapperboardIcon} label={t('health.replay')}>
            {t('health.replayAuto')}
          </Fact>
        </div>
      ) : (
        <p className="rounded-lg bg-background px-3.5 py-3 text-body-sm text-muted-foreground">
          {justEnded ? t('health.justEnded') : t('health.idle')}
        </p>
      )}
    </section>
  )
}
