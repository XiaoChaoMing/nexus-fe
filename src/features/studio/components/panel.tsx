import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PanelProps = {
  id: string
  title: string
  subtitle?: string
  icon: LucideIcon
  /** Badge or status shown at the right of the header. */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** Studio card: Level-1 surface, 12px radius, icon box + title header. */
export function Panel({ id, title, subtitle, icon: Icon, aside, className, children }: PanelProps) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-4 rounded-xl bg-surface p-5', className)}>
      <header className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary" aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 id={id} className="font-heading text-[15px] font-semibold text-foreground">
            {title}
          </h2>
          {subtitle && <p className="text-body-sm text-subtle-foreground">{subtitle}</p>}
        </div>
        {aside && <div className="ml-auto shrink-0">{aside}</div>}
      </header>
      {children}
    </section>
  )
}

type PillTone = 'live' | 'success' | 'warning' | 'neutral'

const PILL_TONES: Record<PillTone, { box: string; dot: string }> = {
  live: { box: 'bg-live/15 text-live', dot: 'bg-live' },
  success: { box: 'bg-success/15 text-success', dot: 'bg-success' },
  warning: { box: 'bg-warning/15 text-warning', dot: 'bg-warning' },
  neutral: { box: 'bg-card text-muted-foreground', dot: 'bg-subtle-foreground' },
}

/** Tinted status chip with a dot ("Đã kết nối", "Chờ tín hiệu"…). */
export function StatusPill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  const t = PILL_TONES[tone]

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-control px-2 py-0.5 text-label-sm font-bold', t.box, className)}>
      <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden />
      {children}
    </span>
  )
}
