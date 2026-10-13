import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Player/Spinner: 48px track at 20% white with an Electric Pulse arc. */
export function PlayerSpinner({ className }: { className?: string }) {
  return <span className={cn('block size-12 animate-spin rounded-full border-4 border-white/20 border-t-primary', className)} aria-hidden />
}

type PlayerMessageProps = {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** 0–2 buttons, then anything else (e.g. other live channels). */
  children?: ReactNode
  titleId?: string
  className?: string
}

/**
 * Player/Overlay content: 56px icon tile, title (Plus Jakarta 20/28), description (Inter 14/20) and actions,
 * centred in the 16:9 frame. The caller provides the backdrop.
 */
export function PlayerMessage({ icon, title, description, children, titleId, className }: PlayerMessageProps) {
  return (
    <div className={cn('flex max-w-full flex-col items-center gap-3 px-4 text-center sm:gap-4', className)}>
      {icon && (
        <span className="grid size-12 place-items-center rounded-xl border bg-card text-foreground sm:size-14 [&_svg]:size-6 sm:[&_svg]:size-7" aria-hidden>
          {icon}
        </span>
      )}
      <div className="flex max-w-[480px] flex-col items-center gap-1.5">
        <p id={titleId} className="font-heading text-headline-sm text-foreground sm:text-headline-md">
          {title}
        </p>
        {description && <p className="text-body-sm text-muted-foreground sm:text-body-md">{description}</p>}
      </div>
      {children && <div className="flex flex-col items-center gap-2 pt-1 sm:pt-2">{children}</div>}
    </div>
  )
}

/** Primary + Secondary pair under a player message. */
export function PlayerActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-3">{children}</div>
}
