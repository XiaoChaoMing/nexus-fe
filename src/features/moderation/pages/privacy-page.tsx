import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { UserRoundXIcon } from 'lucide-react'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { blocksApi } from '@/features/moderation/api'
import { RowButton, UserRow, UserRowSkeleton } from '@/features/moderation/components/list-parts'
import { blockKeys, useBlockActions } from '@/features/moderation/hooks/use-blocks'
import { formatDate } from '@/lib/format'

/**
 * /settings/privacy (26 · Cài đặt — Quyền riêng tư): "Người dùng đã chặn" with "Bỏ chặn" (no confirmation,
 * toast). The id list used by the chat follows at once.
 */
export function PrivacySettingsPage() {
  const { t } = useTranslation('moderation')
  const userId = useAuthStore((s) => s.user?.id ?? 'guest')
  const { unblock } = useBlockActions()
  const list = useInfiniteQuery({
    queryKey: blockKeys.list(userId),
    queryFn: ({ pageParam }) => blocksApi.list(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })
  // Rows unblocked here leave at once, before the list is fetched again.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const visible = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((b) => !removed.has(b.user.id))

  return (
    <div className="flex flex-col gap-5" data-testid="privacy-settings">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-headline-md font-semibold text-foreground">{t('privacy.title')}</h2>
        {list.isSuccess && <p className="text-[13px] font-semibold text-muted-foreground">{t('privacy.count', { count: visible.length })}</p>}
        <p className="text-body-md text-muted-foreground">{t('privacy.description')}</p>
      </div>
      {list.isPending ? (
        <UserRowSkeleton />
      ) : list.isError ? (
        <ErrorPanel icon={UserRoundXIcon} title={t('privacy.loadFailed')} onRetry={() => void list.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyPanel icon={UserRoundXIcon} title={t('privacy.empty')} body={t('privacy.emptyBody')} testId="blocks-empty" />
      ) : (
        <>
          <ul className="flex flex-col rounded-panel border bg-surface px-1" data-testid="blocks-list">
            {visible.map((b) => (
              <UserRow
                key={b.user.id}
                id={b.user.id}
                name={b.user.displayName}
                username={b.user.username}
                sub={b.createdAt ? t('privacy.blockedOn', { date: formatDate(b.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' }) }) : undefined}
                testId="block-row"
                action={
                  <RowButton onClick={() => unblock.mutate({ id: b.user.id, username: b.user.username }, { onSuccess: () => setRemoved((r) => new Set(r).add(b.user.id)) })} disabled={unblock.isPending && unblock.variables?.id === b.user.id}>
                    {t('privacy.unblock')}
                  </RowButton>
                }
              />
            ))}
          </ul>
          <LoadMore hasMore={list.hasNextPage} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
        </>
      )}
    </div>
  )
}
