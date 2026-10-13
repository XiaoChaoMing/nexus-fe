import { useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTimecode } from '@/features/player/lib/live-edge'
import { usePlayer } from '@/features/player/stores/player-store'
import type { PlayerMode } from '@/features/player/hooks/use-hls'

type Props = {
  mode: PlayerMode
  onSeek: (time: number) => void
}

/**
 * Live (DVR): the bar spans from the start of the broadcast to the live edge, so viewers can rewind to
 * any moment but never past "live". VOD: 0 → duration.
 */
export function SeekBar({ mode, onSeek }: Props) {
  const { t } = useTranslation('player')
  const currentTime = usePlayer((s) => s.currentTime)
  const duration = usePlayer((s) => s.duration)
  const seekStart = usePlayer((s) => s.seekStart)
  const liveSync = usePlayer((s) => s.liveSync)
  const [hover, setHover] = useState<number | null>(null)

  const start = mode === 'live' ? seekStart : 0
  const end = mode === 'live' ? (liveSync ?? currentTime) : duration
  const span = Math.max(end - start, 0.001)
  const pct = Math.min(100, Math.max(0, ((currentTime - start) / span) * 100))

  const timeAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()

    return start + ((e.clientX - r.left) / r.width) * span
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={t('seek')}
      aria-valuemin={0}
      aria-valuemax={Math.round(span)}
      aria-valuenow={Math.round(currentTime - start)}
      aria-valuetext={mode === 'live' ? `−${formatTimecode(Math.max(0, end - currentTime))}` : `${formatTimecode(currentTime)} / ${formatTimecode(duration)}`}
      className="group relative h-4 cursor-pointer touch-none rounded-sm"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onSeek(timeAt(e))
      }}
      onPointerMove={(e) => {
        setHover(timeAt(e))
        if (e.buttons === 1) onSeek(timeAt(e))
      }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          onSeek(currentTime + (e.key === 'ArrowLeft' ? -5 : 5))
        }
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25 transition-[height] group-hover:h-1.5">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${pct}%` }} />
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-control border bg-card px-2 py-1 text-label-sm font-semibold text-foreground tabular-nums"
          style={{ left: `${Math.min(100, Math.max(0, ((hover - start) / span) * 100))}%` }}
        >
          {mode === 'live' ? `−${formatTimecode(Math.max(0, end - hover))}` : formatTimecode(hover)}
        </div>
      )}
    </div>
  )
}
