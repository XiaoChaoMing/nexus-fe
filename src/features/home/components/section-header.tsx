import type { ReactNode } from 'react'
import { Link } from 'react-router'

/** Home section title: optional leading icon/dot, title (20 → 18 on mobile), optional count chip and "Xem tất cả". */
export function SectionHeader({ id, icon, title, count, more }: { id: string; icon?: ReactNode; title: string; count?: string; more?: { to: string; label: string } }) {
  return (
    <div className="flex items-center gap-2 md:gap-2.5">
      {icon}
      <h2 id={id} className="font-heading text-lg leading-6 font-semibold tracking-tight text-foreground md:text-xl">
        {title}
      </h2>
      {count && <span className="rounded-control bg-card px-2 py-0.5 text-label-sm font-normal text-subtle-foreground">{count}</span>}
      {more && (
        <Link to={more.to} className="ml-auto rounded-control text-label-md text-primary hover:underline">
          {more.label}
        </Link>
      )}
    </div>
  )
}
