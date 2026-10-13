import { AntennaIcon, CircleHelpIcon, CircleStopIcon, CpuIcon, RatioIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type StepId = 'stream' | 'output' | 'video' | 'stop' | 'noVideo'

const STEPS: { id: StepId; icon: LucideIcon; warn?: boolean }[] = [
  { id: 'stream', icon: AntennaIcon },
  { id: 'output', icon: CpuIcon },
  { id: 'video', icon: RatioIcon },
  { id: 'stop', icon: CircleStopIcon, warn: true },
  { id: 'noVideo', icon: CircleHelpIcon },
]

type SpecId = 'encoder' | 'rateControl' | 'bitrate' | 'keyframe' | 'audio' | 'resolution'

// Values are OBS settings and units, the same in every language.
const SPECS: { id: SpecId; value: string; accent?: boolean }[] = [
  { id: 'encoder', value: 'x264 / NVENC H.264' },
  { id: 'rateControl', value: 'CBR' },
  { id: 'bitrate', value: '≤ 6000 kbps' },
  { id: 'keyframe', value: '2 s', accent: true },
  { id: 'audio', value: 'AAC 160 kbps' },
  { id: 'resolution', value: '720p / 1080p · 30 FPS' },
]

/** Static OBS setup that matches the ingest ladder (720p/480p/360p, 2 s GOP). */
export function ObsGuide() {
  const { t } = useTranslation('studio')

  return (
    <section className="flex scroll-mt-20 flex-col gap-4.5 rounded-xl bg-surface p-6" aria-labelledby="obs-heading">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-[2px] bg-primary" aria-hidden />
          <h2 id="obs-heading" className="scroll-mt-20 font-heading text-lg font-semibold">
            {t('guide.title')}
          </h2>
        </div>
        <p className="text-body-sm text-subtle-foreground">{t('guide.subtitle')}</p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map(({ id, icon: Icon, warn }, i) => (
          <li key={id} className="flex flex-col gap-2.5 rounded-lg bg-card p-4">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'grid size-6.5 place-items-center rounded-full text-label-sm font-bold',
                  warn ? 'bg-warning/15 text-warning' : 'bg-primary/12 text-primary',
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <Icon className="size-4 text-subtle-foreground" aria-hidden />
            </div>
            <h3 className="font-heading text-sm font-semibold text-foreground">{t(`guide.steps.${id}.title`)}</h3>
            <p className="text-body-sm leading-[18px] text-muted-foreground">{t(`guide.steps.${id}.body`)}</p>
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {SPECS.map(({ id, value, accent }) => (
          <div key={id} className="flex flex-col gap-1 rounded-lg bg-background px-3 py-2.5">
            <dt className="text-body-sm text-subtle-foreground">{t(`guide.specs.${id}`)}</dt>
            <dd className={cn('font-mono text-[13px] font-semibold', accent ? 'text-primary' : 'text-foreground')}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
