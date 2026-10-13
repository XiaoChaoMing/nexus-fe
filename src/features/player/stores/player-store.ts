import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { PlaybackPhase } from '@/features/player/lib/display-state'

export type QualityLevel = { index: number; height: number; bitrate: number }

export type PlayerState = {
  phase: PlaybackPhase
  levels: QualityLevel[]
  /** -1 = Auto (ABR). */
  selectedLevel: number
  /** Height of the rendition actually playing (shown as "Auto · 720p"). */
  activeHeight: number | null
  paused: boolean
  muted: boolean
  volume: number
  currentTime: number
  duration: number
  /** Start of the seekable range (beginning of the broadcast for EVENT playlists). */
  seekStart: number
  /** hls.liveSyncPosition: where "live" is; null for VOD or before the manifest loads. */
  liveSync: number | null
  buffering: boolean
  ended: boolean
  theater: boolean
  fullscreen: boolean
  autoplayMuted: boolean
  set: (patch: Partial<PlayerState>) => void
}

const PREFS_KEY = 'nxl.player'

/** quality: preferred rendition height, 0 = Auto. */
type Prefs = { muted: boolean; volume: number; quality: number }

export function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    const p = raw ? (JSON.parse(raw) as Partial<Prefs>) : {}

    return {
      muted: p.muted ?? false,
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 1,
      quality: typeof p.quality === 'number' ? p.quality : 0,
    }
  } catch {
    return { muted: false, volume: 1, quality: 0 }
  }
}

export function writePrefs(patch: Partial<Prefs>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }))
  } catch {
    // private mode / storage full: preferences are a convenience only
  }
}

/** One store per player instance, so the Studio preview and the watch page never share state. */
export function createPlayerStore(): StoreApi<PlayerState> {
  const prefs = readPrefs()

  return createStore<PlayerState>()((set) => ({
    phase: 'idle',
    levels: [],
    selectedLevel: -1,
    activeHeight: null,
    paused: true,
    muted: prefs.muted,
    volume: prefs.volume,
    currentTime: 0,
    duration: 0,
    seekStart: 0,
    liveSync: null,
    buffering: false,
    ended: false,
    theater: false,
    fullscreen: false,
    autoplayMuted: false,
    set: (patch) => set(patch),
  }))
}

export const PlayerStoreContext = createContext<StoreApi<PlayerState> | null>(null)

export function usePlayer<T>(selector: (s: PlayerState) => T): T {
  const store = useContext(PlayerStoreContext)
  if (!store) throw new Error('usePlayer must be used inside <HlsPlayer>')

  return useStore(store, selector)
}
