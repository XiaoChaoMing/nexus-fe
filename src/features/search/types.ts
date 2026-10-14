/** channel-svc search (TSD GĐ4 §5.1, §5.2). */

export type SearchType = 'channel' | 'stream' | 'category' | 'vod'

/** Group order of the palette and the results page (NXL-C §8.5): Kênh → Live → Danh mục → Video. */
export const SEARCH_TYPES: readonly SearchType[] = ['channel', 'stream', 'category', 'vod']

export type SearchItem = {
  type: SearchType
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  viewerCount: number | null
  isLive: boolean
  isMature: boolean
  /** Internal path: `/{handle}`, `/live/{id}`, `/browse/{slug}`, `/vod/{id}`. */
  target: string
}

export type SuggestResponse = { query: string; groups: { type: SearchType; items: SearchItem[] }[] }

export type SearchPage = { items: SearchItem[]; nextCursor: string | null }

export type HistoryEntry = { id: string; query: string; createdAt: string }
