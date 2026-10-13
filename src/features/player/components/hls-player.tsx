import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useStore } from 'zustand'
import {
  ArrowLeftIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  RectangleHorizontalIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useHls, type PlayerMode } from '@/features/player/hooks/use-hls'
import { usePlayerShortcuts } from '@/features/player/hooks/use-player-shortcuts'
import { displayState, LOADING_TIMEOUT_MS, type DisplayState } from '@/features/player/lib/display-state'
import { behindLive, clampLiveSeek, formatBehind, formatTimecode, isAtLiveEdge } from '@/features/player/lib/live-edge'
import { createPlayerStore, PlayerStoreContext } from '@/features/player/stores/player-store'
import { PlayerOverlay } from '@/features/player/components/player-overlay'
import { QualityMenu } from '@/features/player/components/quality-menu'
import { SeekBar } from '@/features/player/components/seek-bar'
import type { StreamStatus } from '@/features/streams/types'
import { cn } from '@/lib/utils'

const CONTROLS_HIDE_MS = 3000

/** Playback session state from the page (WP1): the 18+ gate and a failed session live outside hls.js. */
export type PlayerSession = {
  matureBlocked: boolean
  failed: boolean
  onAcceptMature: () => void
  onRetry: () => void
}

export type HlsPlayerProps = {
  src: string | null
  mode: PlayerMode
  /** Live only: status from stream-svc (drives Interrupted / Ended). */
  streamStatus?: StreamStatus
  /** Omitted by the Studio preview, which plays its own manifest. */
  session?: PlayerSession
  autoPlay?: boolean
  startAt?: number
  /** Studio preview: no theater, no keyboard shortcuts, no LIVE badge. */
  compact?: boolean
  theater?: boolean
  onTheaterChange?: (on: boolean) => void
  onTimeUpdate?: (time: number, duration: number) => void
  onPause?: () => void
  /** Content of the "ended" overlay. */
  endedContent?: ReactNode
  /** Shown on top of the video in fullscreen (mobile landscape): channel name and stream title. */
  heading?: { title: string; subtitle?: string }
  className?: string
}

/** Views in which the control bar is offered (the others are full overlays). */
const WITH_CONTROLS: DisplayState[] = ['live', 'buffering', 'reconnecting', 'interrupted', 'loading']
/** Views that keep the "TRỰC TIẾP" badge in the corner. */
const WITH_LIVE_BADGE: DisplayState[] = ['live', 'buffering', 'interrupted']

function ControlButton({ label, onClick, active, className, children }: { label: string; onClick: () => void; active?: boolean; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-control text-foreground hover:bg-white/10 md:size-9 [&_svg]:size-6',
        active && 'text-primary',
        className,
      )}
    >
      {children}
    </button>
  )
}

function LiveBadge({ className }: { className?: string }) {
  const { t } = useTranslation('common')

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-control bg-live px-2 py-0.75 text-[11px] font-bold tracking-wide text-white md:px-2.5 md:py-1.25 md:text-label-sm md:font-bold', className)}>
      <span className="size-1.5 rounded-full bg-white" aria-hidden />
      {t('status.onAir')}
    </span>
  )
}

export function HlsPlayer({
  src,
  mode,
  streamStatus,
  session,
  autoPlay = true,
  startAt,
  compact = false,
  theater = false,
  onTheaterChange,
  onTimeUpdate,
  onPause,
  endedContent,
  heading,
  className,
}: HlsPlayerProps) {
  const { t } = useTranslation('player')
  const navigate = useNavigate()
  const signedIn = useAuthStore((st) => st.status === 'authenticated')
  const store = useMemo(() => createPlayerStore(), [])
  const s = useStore(store)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)
  const hideTimer = useRef<number | undefined>(undefined)
  const lastPointer = useRef<string>('mouse')

  const matureBlocked = session?.matureBlocked ?? false
  const sourceFailed = session?.failed ?? false
  const hls = useHls({ videoRef, store, src: matureBlocked ? null : src, mode, autoPlay, startAt })

  const behind = mode === 'live' ? behindLive(s.liveSync, s.currentTime) : 0
  const atLive = isAtLiveEdge(behind)
  const input = {
    apiStatus: mode === 'live' ? streamStatus : undefined,
    phase: s.phase,
    buffering: s.buffering,
    videoEnded: s.ended,
    atLiveEdge: atLive,
    matureBlocked,
    sourceFailed,
    vod: mode === 'vod',
  }
  const stillLoading = displayState(input) === 'loading'
  const view = displayState({ ...input, loadingTimedOut })

  // 03b state 1 → 9: no picture after 10 s is shown as an error (with "Thử lại"); a late start still recovers.
  useEffect(() => {
    if (!stillLoading) return
    const id = window.setTimeout(() => setLoadingTimedOut(true), LOADING_TIMEOUT_MS)

    return () => {
      window.clearTimeout(id)
      setLoadingTimedOut(false)
    }
  }, [stillLoading, src])

  useEffect(() => {
    onTimeUpdate?.(s.currentTime, s.duration)
  }, [s.currentTime, s.duration, onTimeUpdate])

  useEffect(() => {
    if (s.paused && s.currentTime > 0) onPause?.()
  }, [s.paused, s.currentTime, onPause])

  useEffect(() => {
    const onFs = () => store.getState().set({ fullscreen: document.fullscreenElement === frameRef.current })
    document.addEventListener('fullscreenchange', onFs)

    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [store])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

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

  usePlayerShortcuts(!compact && view !== 'mature', actions)

  const goLive = () => {
    const live = hls.liveSyncPosition()
    const v = videoRef.current
    if (v && live !== null) {
      v.currentTime = live
      if (v.paused) void v.play().catch(() => undefined)
    }
  }

  const retry = () => {
    setLoadingTimedOut(false)
    if (sourceFailed) session?.onRetry()
    else hls.retry()
  }

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const showControls = () => {
    setControlsVisible(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }

  // Touch: a tap shows the controls (or hides them again); a mouse click toggles playback.
  const onVideoClick = () => {
    if (lastPointer.current !== 'touch') {
      actions.togglePlay()

      return
    }
    if (controlsVisible) setControlsVisible(false)
    else showControls()
  }

  const hasControls = WITH_CONTROLS.includes(view) && !(view === 'loading' && s.phase === 'idle')
  const controlsShown = controlsVisible || s.paused || view === 'interrupted' || view === 'reconnecting'
  const liveBadge = mode === 'live' && !compact && WITH_LIVE_BADGE.includes(view) && streamStatus !== 'ENDED'
  const fullscreenHeading = s.fullscreen && heading
  const muted = s.muted || s.volume === 0

  return (
    <PlayerStoreContext.Provider value={store}>
      <div
        ref={frameRef}
        role="region"
        aria-label={t('label')}
        data-testid="player"
        data-state={view}
        data-behind={Math.round(behind)}
        className={cn(
          'group/player relative aspect-video w-full overflow-hidden bg-black',
          !s.fullscreen && 'rounded-panel border',
          s.fullscreen && 'border-0',
          className,
        )}
        onMouseMove={showControls}
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType
        }}
        onMouseLeave={() => !s.paused && setControlsVisible(false)}
      >
        <video
          ref={videoRef}
          className="size-full"
          playsInline
          onClick={onVideoClick}
          onDoubleClick={actions.toggleFullscreen}
        />

        {liveBadge && !fullscreenHeading && <LiveBadge className="pointer-events-none absolute top-2 left-2 md:top-4 md:left-4" />}

        <PlayerOverlay
          state={view}
          onRetry={retry}
          mature={{ signedIn, onAccept: () => session?.onAcceptMature(), onBack: goBack }}
          endedContent={endedContent}
        />

        {fullscreenHeading && hasControls && (
          <div
            className={cn(
              'absolute inset-x-0 top-0 flex items-center gap-2 bg-linear-to-t from-background/0 to-background/80 pt-2 pr-4 pb-6 pl-2 transition-opacity',
              controlsShown ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <ControlButton label={t('exitFullscreen')} onClick={actions.toggleFullscreen} className="size-11 md:size-11">
              <ArrowLeftIcon />
            </ControlButton>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold text-foreground">{heading.title}</span>
              {heading.subtitle && <span className="truncate text-body-sm text-muted-foreground">{heading.subtitle}</span>}
            </div>
            {liveBadge && <LiveBadge />}
          </div>
        )}

        {s.autoplayMuted && s.muted && view === 'live' && (
          <button
            type="button"
            onClick={actions.toggleMute}
            className={cn(
              'absolute left-2 flex h-11 items-center gap-2 rounded-lg border bg-card px-4 text-label-md font-semibold text-foreground transition-[bottom] hover:bg-accent md:left-4',
              hasControls && controlsShown ? 'bottom-24 md:bottom-22' : 'bottom-2 md:bottom-4',
            )}
          >
            <VolumeXIcon className="size-4.5" aria-hidden />
            {t('tapToUnmute')}
          </button>
        )}

        {hasControls && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-linear-to-b from-background/0 to-background/90 px-1 pt-5 transition-opacity md:px-3 md:pt-8 md:pb-2',
              s.fullscreen && 'px-2 pt-6 pb-2',
              controlsShown ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <SeekBar mode={mode} onSeek={seek} />
            <div className="flex items-center gap-1">
              <ControlButton label={s.paused ? t('play') : t('pause')} onClick={actions.togglePlay}>
                {s.paused ? <PlayIcon className="fill-current" /> : <PauseIcon className="fill-current" />}
              </ControlButton>
              <ControlButton label={muted ? t('unmute') : t('mute')} onClick={actions.toggleMute}>
                {muted ? <VolumeXIcon /> : <Volume2Icon />}
              </ControlButton>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.muted ? 0 : s.volume}
                aria-label={t('volume')}
                onChange={(e) => {
                  const v = videoRef.current
                  if (!v) return
                  v.volume = Number(e.target.value)
                  v.muted = v.volume === 0
                }}
                className="hidden h-1 w-18 cursor-pointer accent-foreground md:block"
              />
              <span className="w-2 shrink-0" aria-hidden />

              {mode === 'live' ? (
                atLive ? (
                  <span data-testid="live-badge" data-at-live="true" className="flex items-center gap-1.5 rounded-control px-2 py-1.5 text-body-sm font-bold tracking-wide text-live">
                    <span className="size-2 rounded-full bg-live" aria-hidden />
                    {t('live')}
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid="live-badge"
                    data-at-live="false"
                    aria-label={t('goLive')}
                    onClick={goLive}
                    className="flex min-h-9 items-center gap-1.5 rounded-control border bg-card px-2.5 py-1.5 text-body-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground max-md:min-h-11"
                  >
                    <span className="size-2 rounded-full bg-subtle-foreground" aria-hidden />
                    {t('goLive')}
                    <span className="text-label-sm text-subtle-foreground tabular-nums max-sm:hidden" data-testid="behind-label">
                      {formatBehind(behind)}
                    </span>
                  </button>
                )
              ) : (
                <span className="text-body-sm tabular-nums" data-testid="vod-time">
                  <span className="font-semibold text-foreground">{formatTimecode(s.currentTime)}</span>{' '}
                  <span className="text-muted-foreground">/ {formatTimecode(s.duration)}</span>
                </span>
              )}

              <div className="ml-auto flex items-center gap-1">
                <QualityMenu onSelect={hls.setLevel} />
                {!compact && !s.fullscreen && (
                  <ControlButton label={theater ? t('exitTheater') : t('theater')} onClick={() => onTheaterChange?.(!theater)} active={theater} className="max-md:hidden">
                    <RectangleHorizontalIcon />
                  </ControlButton>
                )}
                <ControlButton label={s.fullscreen ? t('exitFullscreen') : t('fullscreen')} onClick={actions.toggleFullscreen}>
                  {s.fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
                </ControlButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PlayerStoreContext.Provider>
  )
}
