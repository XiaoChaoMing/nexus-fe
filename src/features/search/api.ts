import { apiRequest } from '@/lib/api-client'
import type { HistoryEntry, SearchPage, SearchType, SuggestResponse } from '@/features/search/types'

const enc = encodeURIComponent

/** channel-svc search and history (TSD GĐ4 §5.2). */
export const searchApi = {
  suggest: (q: string, signal?: AbortSignal, limit = 5) => apiRequest<SuggestResponse>(`/v1/search/suggest?q=${enc(q)}&limit=${limit}`, { signal }),
  search: (q: string, type: SearchType, cursor?: string | null, limit = 24) =>
    apiRequest<SearchPage>(`/v1/search?q=${enc(q)}&type=${type}&limit=${limit}${cursor ? `&cursor=${enc(cursor)}` : ''}`),
  history: () => apiRequest<{ items: HistoryEntry[] }>('/v1/me/search-history', { auth: true }),
  addHistory: (query: string) => apiRequest<HistoryEntry>('/v1/me/search-history', { method: 'POST', body: { query }, auth: true }),
  removeHistory: (id: string) => apiRequest<void>(`/v1/me/search-history/${enc(id)}`, { method: 'DELETE', auth: true }),
  clearHistory: () => apiRequest<void>('/v1/me/search-history', { method: 'DELETE', auth: true }),
}
