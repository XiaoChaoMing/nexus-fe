import type { SVGProps } from 'react'

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
)
export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
)
export const VolumeIcon = ({ muted, ...p }: SVGProps<SVGSVGElement> & { muted: boolean }) => (
  <svg {...base} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    {muted ? (
      <path d="m16 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    ) : (
      <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    )}
  </svg>
)
export const TheaterIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
  </svg>
)
export const FullscreenIcon = ({ active, ...p }: SVGProps<SVGSVGElement> & { active: boolean }) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
    {active ? (
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    ) : (
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    )}
  </svg>
)
