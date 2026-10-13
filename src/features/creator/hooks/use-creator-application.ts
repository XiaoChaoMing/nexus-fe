import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creatorApi } from '@/features/creator/api/creator-api'
import type { ApplicationInput } from '@/features/creator/types'

export const creatorKeys = { application: ['creator', 'application'] as const }

/** A pending application is re-read so an approval shows up without a reload. */
const PENDING_POLL = 10_000

export function useMyApplication(enabled = true) {
  return useQuery({
    queryKey: creatorKeys.application,
    queryFn: async () => (await creatorApi.mine()) ?? null,
    enabled,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? PENDING_POLL : false),
  })
}

export function useSubmitApplication() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: ApplicationInput) => creatorApi.submit(body),
    onSuccess: (app) => qc.setQueryData(creatorKeys.application, app),
  })
}

export function useCancelApplication() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => creatorApi.cancel(id),
    onSettled: () => qc.invalidateQueries({ queryKey: creatorKeys.application }),
  })
}
