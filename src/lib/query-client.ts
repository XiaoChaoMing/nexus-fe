import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api-error'
import { handleGlobalApiError } from '@/lib/rate-limit-toast'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleGlobalApiError }),
  mutationCache: new MutationCache({ onError: handleGlobalApiError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Client errors (4xx) do not get better by asking again; 429 waits for the user.
      retry: (count, err) => !(isApiError(err) && err.status >= 400 && err.status < 500) && count < 1,
      // Realtime data (viewer count, stream status) arrives over WebSocket; no refetch on tab focus.
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
