import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { blocksApi } from '@/features/moderation/api'
import { useMuteStore } from '@/features/moderation/stores/mute-store'
import { detailString, errorCode } from '@/lib/api-error'

export const blockKeys = {
  ids: (userId: string) => ['blocks', userId, 'ids'] as const,
  list: (userId: string) => ['blocks', userId, 'list'] as const,
}

const EMPTY: ReadonlySet<string> = new Set()

/** People the account blocked (≤ 1000 ids, loaded once per session): their chat lines are hidden everywhere. */
export function useBlockedIds(): ReadonlySet<string> {
  const userId = useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))
  const query = useQuery({
    queryKey: blockKeys.ids(userId ?? 'guest'),
    queryFn: blocksApi.ids,
    enabled: userId !== null,
    staleTime: Infinity,
    select: (ids) => new Set(ids),
  })

  return query.data ?? EMPTY
}

/** Block / unblock with the id list updated at once; toasts per design 03g. */
export function useBlockActions() {
  const { t } = useTranslation('moderation')
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id ?? 'guest')
  const key = blockKeys.ids(userId)

  const setIds = (fn: (ids: string[]) => string[]) => qc.setQueryData<string[]>(key, (old) => fn(old ?? []))

  const block = useMutation({
    mutationFn: ({ id }: { id: string; username: string }) => blocksApi.block(id),
    onMutate: ({ id }) => setIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    onSuccess: (_d, { username }) => toast.success(t('toast.blocked', { username })),
    onError: (err, { id }) => {
      setIds((ids) => ids.filter((x) => x !== id))
      toast.error(errorCode(err) === 'CONFLICT' && detailString(err, 'limit') ? t('error.blockLimit') : t('error.failed'))
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: blockKeys.list(userId) }),
  })

  const unblock = useMutation({
    mutationFn: ({ id }: { id: string; username: string }) => blocksApi.unblock(id),
    onMutate: ({ id }) => setIds((ids) => ids.filter((x) => x !== id)),
    onSuccess: (_d, { username }) => toast.success(t('toast.unblocked', { username })),
    onError: () => {
      void qc.invalidateQueries({ queryKey: key })
      toast.error(t('error.failed'))
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: blockKeys.list(userId) }),
  })

  return { block, unblock }
}

/** This tab's hidden people for the current account. */
export function useMuted() {
  const owner = useAuthStore((s) => s.user?.id ?? 'guest')
  const use = useMuteStore((s) => s.use)
  const ids = useMuteStore((s) => s.ids)
  const toggle = useMuteStore((s) => s.toggle)
  useEffect(() => use(owner), [owner, use])

  return useMemo(() => ({ ids, toggle }), [ids, toggle])
}
