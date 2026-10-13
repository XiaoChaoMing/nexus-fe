import Hls, { type ErrorData, type Level } from 'hls.js'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { StoreApi } from 'zustand'
import { readPrefs, writePrefs, type PlayerState } from '@/features/player/stores/player-store'

const RETRY_DELAYS_MS = [1000, 2000, 4000]
/** A freshly started stream has no playlist in storage for a few seconds. */
const MANIFEST_WAIT_MS = 20_000
const MANIFEST_RETRY_MS = 2000
const BUFFERING_DELAY_MS = 500
const TICK_MS = 500

export type PlayerMode = 'live' | 'vod'

export type HlsControls = {
  setLevel: (index: number) => void
  retry: () => void
  liveSyncPosition: () => number | null
}

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>
  store: StoreApi<PlayerState>
  src: string | null
  mode: PlayerMode
  autoPlay: boolean
  startAt?: number
}

function toLevels(levels: Level[]) {
  return levels
    .map((l, index) => ({ index, height: l.height, bitrate: l.bitrate }))
    .sort((a, b) => b.height - a.height)
}

/**
 * Owns the hls.js instance for one <video>: loading, ABR level list, error recovery with backoff,
 * and mirroring video element state into the player store. Safari plays HLS natively (Auto only).
 */
export function useHls({ videoRef, store, src, mode, autoPlay, startAt }: Options): HlsControls {
  const hlsRef = useRef<Hls | null>(null)
  const retryRef = useRef(0)
  const generation = useRef(0)

  const set = store.getState().set

  const tryPlay = useCallback(async (video: HTMLVideoElement) => {
    try {
      await video.play()
    } catch {
      // Autoplay with sound blocked: start muted and let the viewer unmute.
      video.muted = true
      store.getState().set({ muted: true, autoplayMuted: true })

      try {
        await video.play()
      } catch {
        store.getState().set({ paused: true })
      }
    }
  }, [store])

  const load = useCallback(() => {
    const video = videoRef.current
    if (!video || !src) return

    const gen = ++generation.current
    hlsRef.current?.destroy()
    hlsRef.current = null
    retryRef.current = 0
    set({ phase: 'loading', ended: false, levels: [], activeHeight: null })

    const startedAt = Date.now()

    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        if (startAt) video.currentTime = startAt
        if (autoPlay) void tryPlay(video)
      } else {
        set({ phase: 'error' })
      }

      return
    }

    const hls = new Hls({
      liveSyncDurationCount: 2,
      // No liveMaxLatencyDuration: a rewound viewer (DVR) must not be pulled back to live.
      backBufferLength: 90,
      capLevelToPlayerSize: true,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      fragLoadingMaxRetry: 6,
      startPosition: startAt ?? -1,
    })
    hlsRef.current = hls

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      if (gen !== generation.current) return

      // The preference is a height, not an index: ladders differ between streams.
      const preferred = readPrefs().quality
      const index = preferred > 0 ? data.levels.findIndex((l) => l.height === preferred) : -1
      if (index >= 0) hls.currentLevel = index

      set({ levels: toLevels(data.levels), selectedLevel: index, phase: 'playing' })
      retryRef.current = 0
      if (autoPlay) void tryPlay(video)
    })

    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
      set({ activeHeight: hls.levels[data.level]?.height ?? null })
    })

    hls.on(Hls.Events.FRAG_LOADED, () => {
      if (store.getState().phase === 'reconnecting') set({ phase: 'playing' })
      retryRef.current = 0
    })

    hls.on(Hls.Events.ERROR, (_e, data: ErrorData) => {
      if (!data.fatal || gen !== generation.current) return

      if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR && Date.now() - startedAt < MANIFEST_WAIT_MS) {
        window.setTimeout(() => gen === generation.current && hls.loadSource(src), MANIFEST_RETRY_MS)

        return
      }

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryRef.current < RETRY_DELAYS_MS.length) {
        set({ phase: 'reconnecting' })
        const delay = RETRY_DELAYS_MS[retryRef.current++]
        window.setTimeout(() => gen === generation.current && hls.startLoad(), delay)

        return
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryRef.current < 2) {
        if (retryRef.current++ === 0) hls.recoverMediaError()
        else hls.swapAudioCodec()

        return
      }

      set({ phase: 'error' })
    })

    hls.loadSource(src)
    hls.attachMedia(video)
  }, [videoRef, src, startAt, autoPlay, set, store, tryPlay])

  // (Re)load when the source changes.
  useEffect(() => {
    load()
    const gen = generation
    const instance = hlsRef

    return () => {
      // Invalidates timers scheduled by the previous source (retries, manifest wait).
      gen.current++
      instance.current?.destroy()
      instance.current = null
    }
  }, [load])

  // Mirror <video> state into the store.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let bufferingTimer: number | undefined

    const sync = () => {
      const seekable = video.seekable
      const hls = hlsRef.current
      const liveSync =
        mode === 'live'
          ? (hls?.liveSyncPosition ?? (seekable.length ? seekable.end(seekable.length - 1) - 6 : null))
          : null

      set({
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        seekStart: seekable.length ? seekable.start(0) : 0,
        liveSync,
      })
    }

    const onWaiting = () => {
      window.clearTimeout(bufferingTimer)
      bufferingTimer = window.setTimeout(() => set({ buffering: true }), BUFFERING_DELAY_MS)
    }
    const onPlaying = () => {
      window.clearTimeout(bufferingTimer)
      set({ buffering: false, paused: false, ended: false, phase: store.getState().phase === 'loading' ? 'playing' : store.getState().phase })
    }
    const onPause = () => set({ paused: true })
    const onEnded = () => set({ ended: true, paused: true })
    const onVolume = () => {
      set({ muted: video.muted, volume: video.volume })
      writePrefs({ muted: video.muted, volume: video.volume })
    }

    const state = store.getState()
    video.muted = state.muted
    video.volume = state.volume

    video.addEventListener('timeupdate', sync)
    video.addEventListener('durationchange', sync)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    video.addEventListener('volumechange', onVolume)
    const tick = window.setInterval(sync, TICK_MS)

    return () => {
      window.clearTimeout(bufferingTimer)
      window.clearInterval(tick)
      video.removeEventListener('timeupdate', sync)
      video.removeEventListener('durationchange', sync)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('volumechange', onVolume)
    }
  }, [videoRef, mode, set, store])


  return {
    setLevel: (index: number) => {
      const hls = hlsRef.current
      if (hls) hls.currentLevel = index
      set({ selectedLevel: index })
      writePrefs({ quality: index < 0 ? 0 : (hls?.levels[index]?.height ?? 0) })
    },
    retry: load,
    liveSyncPosition: () => hlsRef.current?.liveSyncPosition ?? store.getState().liveSync,
  }
}
