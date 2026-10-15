import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { modApi } from '@/features/moderation/api'

/** Channels the account moderates or is VIP of (`GET /v1/me/channel-roles`), live ones first. */
export function useMyChannelRoles({ refetchInterval }: { refetchInterval?: number } = {}) {
  const userId = useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))

  return useQuery({
    queryKey: ['my-channel-roles', userId ?? 'guest'],
    queryFn: modApi.myChannelRoles,
    enabled: userId !== null,
    staleTime: 30_000,
    refetchInterval,
  })
}
