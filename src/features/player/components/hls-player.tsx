import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { useHls, type PlayerMode } from '@/features/player/hooks/use-hls'
import { usePlayerShortcuts } from '@/features/player/hooks/use-player-shortcuts'
import { displayState } from '@/features/player/lib/display-state'
import { behindLive, clampLiveSeek, formatBehind, formatClock, isAtLiveEdge } from '@/features/player/lib/live-edge'
import { createPlayerStore, PlayerStoreContext } from '@/features/player/stores/player-store'
import { FullscreenIcon, PauseIcon, PlayIcon, TheaterIcon, VolumeIcon } from '@/features/player/components/icons'
import { PlayerOverlay } from '@/features/player/components/player-overlay'
import { QualityMenu } from '@/features/player/components/quality-menu'
import { SeekBar } from '@/features/player/components/seek-bar'
import type { StreamStatus } from '@/features/streams/types'

const MATURE_KEY = 'nxl.mature'

function matureAccepted(scope: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(MATURE_KEY) ?? '[]') as string[]).includes(scope)
  } catch {
    return false
  }
}

function rememberMature(scope: string) {
  try {
    const list = JSON.parse(localStorage.getItem(MATURE_KEY) ?? '[]') as string[]
    localStorage.setItem(MATURE_KEY, JSON.stringify([...new Set([...list, scope])]))
  } catch {
    // storage unavailable: the viewer confirms again next time
  }
}

export type HlsPlayerProps = {
  src: string | null
  mode: PlayerMode
  /** Live only: status from stream-svc (drives Interrupted / Ended). */
  streamStatus?: StreamStatus
  /** Mature gate scope (channel id); gate shown when set and not yet accepted in this browser. */
  matureScope?: string
  autoPlay?: boolean
  startAt?: number
  /** Studio preview: no theater, no keyboard shortcuts. */
  compact?: boolean
  theater?: boolean
  onTheaterChange?: (on: boolean) => void
  onTimeUpdate?: (time: number, duration: number) => void
  endedSlot?: ReactNode
  /** Heading of the ended overlay (default: the stream ended). */
  endedLabel?: string
  className?: string
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-9 place-items-center rounded-button text-fg hover:bg-white/10">
      {children}
    </button>
  )
}

export function HlsPlayer({
  src,
  mode,
  streamStatus,
  matureScope,
  autoPlay = true,
  startAt,
  compact = false,
  theater = false,
  onTheaterChange,
  onTimeUpdate,
  endedSlot,
  endedLabel,
  className = '',
}: HlsPlayerProps) {
  const { t } = useTranslation('player')
  const store = useMemo(() => createPlayerStore(), [])
  const s = useStore(store)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [matureOk, setMatureOk] = useState(() => !matureScope || matureAccepted(matureScope))
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimer = useRef<number | undefined>(undefined)

  const playable = matureOk
  const hls = useHls({ videoRef, store, src: playable ? src : null, mode, autoPlay, startAt })

  const behind = mode === 'live' ? behindLive(s.liveSync, s.currentTime) : 0
  const atLive = isAtLiveEdge(behind)
  const view = displayState({
    apiStatus: mode === 'live' ? streamStatus : undefined,
    phase: s.phase,
    buffering: s.buffering,
    videoEnded: s.ended,
    atLiveEdge: atLive,
    matureBlocked: !matureOk,
  })
  const finished = mode === 'vod' ? s.ended : view === 'ended'

  useEffect(() => {
    onTimeUpdate?.(s.currentTime, s.duration)
  }, [s.currentTime, s.duration, onTimeUpdate])

  useEffect(() => {
    const onFs = () => store.getState().set({ fullscreen: document.fullscreenElement === frameRef.current })
    document.addEventListener('fullscreenchange', onFs)

    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [store])

  const video = () => videoRef.current

  const seek = useCallback(
    (target: number) => {
      const v = videoRef.current
      if (!v) return
      const st = store.getState()
      v.currentTime = mode === 'live' ? clampLiveSeek(target, st.seekStart, hls.liveSyncPosition()) : Math.min(Math.max(0, target), st.duration || target)
    },
    [store, mode, hls],
  )

  const actions = useMemo(
    () => ({
      togglePlay: () => {
        const v = videoRef.current
        if (!v) return
        if (v.paused) void v.play().catch(() => undefined)
        else v.pause()
      },
      toggleMute: () => {
        const v = videoRef.current
        if (!v) return
        v.muted = !v.muted
        if (!v.muted && v.volume === 0) v.volume = 0.5
        store.getState().set({ autoplayMuted: false })
      },
      toggleFullscreen: () => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void frameRef.current?.requestFullscreen?.()
      },
      toggleTheater: compact ? undefined : () => onTheaterChange?.(!theater),
      seekBy: (d: number) => seek((videoRef.current?.currentTime ?? 0) + d),
      volumeBy: (d: number) => {
        const v = videoRef.current
        if (!v) return
        v.volume = Math.min(1, Math.max(0, v.volume + d))
        if (v.volume > 0) v.muted = false
      },
      escape: () => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else if (theater) onTheaterChange?.(false)
      },
    }),
    [store, compact, theater, onTheaterChange, seek],
  )

  usePlayerShortcuts(!compact && matureOk, actions)

  const goLive = () => {
    const live = hls.liveSyncPosition()
    const v = video()
    if (v && live !== null) {
      v.currentTime = live
      if (v.paused) void v.play().catch(() => undefined)
    }
  }

  const showControls = () => {
    setControlsVisible(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3000)
  }

  const controlsShown = controlsVisible || s.paused || view !== 'live'

  return (
    <PlayerStoreContext.Provider value={store}>
      <div
        ref={frameRef}
        data-testid="player"
        data-state={view}
        data-behind={Math.round(behind)}
        className={`group/player relative aspect-video w-full overflow-hidden bg-black ${s.fullscreen ? '' : 'rounded-panel'} ${className}`}
        onMouseMove={showControls}
        onMouseLeave={() => setControlsVisible(false)}
      >
        <video
          ref={videoRef}
          className="size-full"
          playsInline
          onClick={actions.togglePlay}
          onDoubleClick={actions.toggleFullscreen}
        />

        <PlayerOverlay
          state={finished ? 'ended' : view}
          onRetry={hls.retry}
          onAcceptMature={() => {
            if (matureScope) rememberMature(matureScope)
            setMatureOk(true)
          }}
          endedSlot={endedSlot}
          endedLabel={endedLabel}
        />

        {s.autoplayMuted && s.muted && view === 'live' && (
          <button
            type="button"
            onClick={actions.toggleMute}
            className="absolute left-3 top-3 rounded-button bg-deep/80 px-3 py-1.5 text-xs font-semibold text-fg hover:bg-deep"
          >
            🔇 {t('tapToUnmute')}
          </button>
        )}

        {matureOk && !finished && view !== 'error' && (
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 transition-opacity ${
              controlsShown ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <SeekBar mode={mode} onSeek={seek} />
            <div className="mt-1 flex items-center gap-1">
              <IconButton label={s.paused ? t('play') : t('pause')} onClick={actions.togglePlay}>
                {s.paused ? <PlayIcon /> : <PauseIcon />}
              </IconButton>
              <IconButton label={s.muted ? t('unmute') : t('mute')} onClick={actions.toggleMute}>
                <VolumeIcon muted={s.muted || s.volume === 0} />
              </IconButton>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.muted ? 0 : s.volume}
                aria-label={t('volume')}
                onChange={(e) => {
                  const v = video()
                  if (!v) return
                  v.volume = Number(e.target.value)
                  v.muted = v.volume === 0
                }}
                className="hidden w-20 accent-primary sm:block"
              />

              {mode === 'live' ? (
                <div className="ml-2 flex items-center gap-2 text-xs font-semibold">
                  <span
                    data-testid="live-badge"
                    data-at-live={atLive}
                    className={`flex items-center gap-1 rounded-control px-1.5 py-0.5 text-white ${atLive ? 'bg-live' : 'bg-white/25'}`}
                  >
                    <span className="size-1.5 rounded-full bg-white" aria-hidden />
                    {t('live')}
                  </span>
                  {!atLive && (
                    <>
                      <span className="tabular-nums text-fg-secondary" data-testid="behind-label">
                        {formatBehind(behind)}
                      </span>
                      <button type="button" onClick={goLive} className="rounded-button bg-primary px-2 py-1 text-primary-foreground hover:bg-primary-hover">
                        {t('goLive')}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <span className="ml-2 text-xs tabular-nums text-fg-secondary">
                  {formatClock(s.currentTime)} / {formatClock(s.duration)}
                </span>
              )}

              <div className="ml-auto flex items-center gap-1">
                <QualityMenu onSelect={hls.setLevel} />
                {!compact && (
                  <IconButton label={theater ? t('exitTheater') : t('theater')} onClick={() => onTheaterChange?.(!theater)}>
                    <TheaterIcon />
                  </IconButton>
                )}
                <IconButton label={s.fullscreen ? t('exitFullscreen') : t('fullscreen')} onClick={actions.toggleFullscreen}>
                  <FullscreenIcon active={s.fullscreen} />
                </IconButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PlayerStoreContext.Provider>
  )
}
