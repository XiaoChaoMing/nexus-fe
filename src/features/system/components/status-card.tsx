import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'neutral'

const TONE: Record<Tone, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/15 text-destructive',
  neutral: 'bg-card text-muted-foreground',
}

/**
 * The 480–520 px result card of frames 12 and 25: a tinted 56 px icon disc, a bold title, an optional line and
 * the actions. Used for locked accounts and e-mail unsubscribe results.
 */
export function StatusCard({ icon, tone, title, children, actions, className, testId }: { icon: ReactNode; tone: Tone; title: string; children?: ReactNode; actions?: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={cn('flex w-full max-w-130 flex-col items-center gap-4 rounded-xl border bg-surface p-8 text-center max-md:p-6', className)} data-testid={testId} role="status">
      <span className={cn('grid size-14 place-items-center rounded-full [&_svg]:size-7', TONE[tone])} aria-hidden>
        {icon}
      </span>
      <h1 className="text-headline-md leading-6.75 font-bold text-foreground">{title}</h1>
      {children && <div className="text-body-md text-muted-foreground">{children}</div>}
      {actions && <div className="flex w-full flex-wrap justify-center gap-2 max-md:[&>*]:h-12 max-md:[&>*]:w-full">{actions}</div>}
    </section>
  )
}
