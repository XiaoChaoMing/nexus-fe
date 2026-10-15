import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { usernameColor } from '@/features/chat/lib/appearance'
import { cn } from '@/lib/utils'

function initialsOf(name: string): string {
  return name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?'
}

/** Avatar/Initials in the username colour (accounts have no picture yet). */
export function UserInitials({ id, name, size = 40 }: { id: string; name: string; size?: 32 | 40 }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full bg-avatar font-semibold', size === 40 ? 'size-10 text-body-md' : 'size-8 text-label-sm')}
      style={{ color: usernameColor(id) }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  )
}

/** List/User Row: avatar 40, name + @username, a muted second line and an action on the right (≥ 56 px on phones). */
export function UserRow({ id, name, username, sub, action, testId }: { id: string; name: string; username: string; sub?: string; action?: ReactNode; testId?: string }) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-b px-3 py-2 last:border-0 max-md:min-h-14" data-testid={testId}>
      <UserInitials id={id} name={name || username} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="truncate text-body-md font-semibold text-foreground">{name || username}</span>
          <span className="truncate text-[13px] text-muted-foreground">@{username}</span>
        </span>
        {sub && <span className="truncate text-label-sm font-normal text-muted-foreground">{sub}</span>}
      </div>
      {action}
    </li>
  )
}

export function UserRowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="flex flex-col rounded-panel border bg-surface px-1" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex h-16 items-center gap-3 px-3">
          <Skeleton className="size-10 rounded-full bg-card" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-40 rounded-sm bg-card" />
            <Skeleton className="h-2.5 w-55 rounded-sm bg-card" />
          </div>
          <Skeleton className="h-9 w-14 rounded-lg bg-card" />
        </li>
      ))}
    </ul>
  )
}

/** Secondary 36 px action of a row ("Gỡ", "Bỏ chặn", "Bỏ cấm"…). */
export function RowButton({ children, onClick, disabled, label, testId }: { children: ReactNode; onClick: () => void; disabled?: boolean; label?: string; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-testid={testId}
      className="h-9 shrink-0 rounded-lg border bg-card px-3.5 text-body-md font-medium whitespace-nowrap text-foreground outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11"
    >
      {children}
    </button>
  )
}
