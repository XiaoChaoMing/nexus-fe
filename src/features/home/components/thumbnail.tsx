import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Stream/VOD picture; falls back to the elevated surface when the image is missing or broken. */
export function Thumbnail({ src, className, eager = false }: { src: string | null | undefined; className?: string; eager?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null)
  const show = src && broken !== src

  return (
    <span className={cn('block bg-card', className)} aria-hidden>
      {show && <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} onError={() => setBroken(src)} className="size-full object-cover" />}
    </span>
  )
}
