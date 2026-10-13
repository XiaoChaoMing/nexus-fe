import type { ReactNode } from 'react'

/** Home section title: optional leading icon/dot, title (20 → 18 on mobile), optional count chip. */
export function SectionHeader({ id, icon, title, count }: { id: string; icon?: ReactNode; title: string; count?: string }) {
  return (
    <div className="flex items-center gap-2 md:gap-2.5">
      {icon}
      <h2 id={id} className="font-heading text-lg leading-6 font-semibold tracking-tight text-foreground md:text-xl">
        {title}
      </h2>
      {count && <span className="rounded-control bg-card px-2 py-0.5 text-label-sm font-normal text-subtle-foreground">{count}</span>}
    </div>
  )
}
