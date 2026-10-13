import { CircleCheckIcon, CircleDashedIcon, EyeIcon, LoaderCircleIcon, VideoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HlsPlayer } from '@/features/player/components/hls-player'
import type { StudioStream } from '@/features/streams/types'
import { cn } from '@/lib/utils'

type PreviewPanelProps = {
  current: StudioStream | null
  hasKey: boolean
  settingsSaved: boolean
}

type CheckState = 'done' | 'todo' | 'waiting'

const CHECK = {
  done: { icon: CircleCheckIcon, box: 'bg-success/15', fg: 'text-success' },
  todo: { icon: CircleDashedIcon, box: 'bg-card', fg: 'text-muted-foreground' },
  waiting: { icon: LoaderCircleIcon, box: 'bg-warning/15', fg: 'animate-spin text-warning' },
} as const

function ChecklistItem({ state, children }: { state: CheckState; children: ReactNode }) {
  const { icon: Icon, box, fg } = CHECK[state]

  return (
    <li className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-label-md', box)}>
      <Icon className={cn('size-4', fg)} aria-hidden />
      <span className="text-foreground">{children}</span>
    </li>
  )
}

/** Live preview from the HLS output (a few seconds behind OBS), or a readiness checklist while offline. */
export function PreviewPanel({ current, hasKey, settingsSaved }: PreviewPanelProps) {
  const { t } = useTranslation('studio')

  if (current) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-black">
        <HlsPlayer key={current.streamId} src={current.manifestUrl} mode="live" streamStatus={current.status} compact autoPlay />
        <div className="pointer-events-none absolute top-3.5 left-3.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-control bg-black/70 px-2 py-0.5 text-body-sm text-muted-foreground">
            <EyeIcon className="size-3.5" aria-hidden />
            {t('preview.label')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background p-8 text-center">
      <span className="grid size-18 place-items-center rounded-full bg-primary/12 text-primary" aria-hidden>
        <VideoIcon className="size-8" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-heading text-headline-sm text-foreground">{t('preview.emptyTitle')}</p>
        <p className="text-body-md text-muted-foreground">{t('preview.emptyBody')}</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2.5 pt-2" aria-label={t('preview.checklist')}>
        <ChecklistItem state={hasKey ? 'done' : 'todo'}>{hasKey ? t('preview.hasKey') : t('preview.noKey')}</ChecklistItem>
        <ChecklistItem state={settingsSaved ? 'done' : 'todo'}>{settingsSaved ? t('preview.settingsSaved') : t('preview.settingsNotSaved')}</ChecklistItem>
        <ChecklistItem state="waiting">{t('preview.waitingObs')}</ChecklistItem>
      </ul>
    </div>
  )
}
