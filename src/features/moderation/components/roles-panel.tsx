import { useId, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CircleAlertIcon, GemIcon, PlusIcon, SwordsIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { modApi } from '@/features/moderation/api'
import { RowButton, UserRow, UserRowSkeleton } from '@/features/moderation/components/list-parts'
import { cleanUsername } from '@/features/moderation/lib/duration'
import { modError } from '@/features/moderation/lib/errors'
import { MOD_LIMITS, type ChannelRole, type ChannelRoleName } from '@/features/moderation/types'
import { detailString, errorCode } from '@/lib/api-error'
import { formatDate } from '@/lib/format'

const roleKeys = {
  list: (channelId: string, role: ChannelRoleName) => ['channel-roles', channelId, role] as const,
}

function useRoleList(channelId: string, role: ChannelRoleName) {
  return useInfiniteQuery({
    queryKey: roleKeys.list(channelId, role),
    queryFn: ({ pageParam }) => modApi.roles(channelId, role, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(channelId),
  })
}

/**
 * Moderator / VIP tab of Studio → Cộng đồng: add by username (`@` prefix, errors under the field, a yellow
 * warning when the person holds the other role), "3/50 Moderator", remove after Modal/Confirm Danger.
 */
export function RolesPanel({ channelId, role, readOnly = false }: { channelId: string; role: ChannelRoleName; readOnly?: boolean }) {
  const { t } = useTranslation('moderation')
  const qc = useQueryClient()
  const myUsername = useAuthStore((s) => s.user?.username ?? '')
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ChannelRole | null>(null)
  const other: ChannelRoleName = role === 'MODERATOR' ? 'VIP' : 'MODERATOR'
  const list = useRoleList(channelId, role)
  const otherList = useRoleList(channelId, other)
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  const max = MOD_LIMITS.rolesPerChannel
  const full = items.length >= max
  const isMod = role === 'MODERATOR'
  const username = cleanUsername(value)
  const holdsOther = username !== '' && (otherList.data?.pages.flatMap((p) => p.items) ?? []).some((r) => r.user.username.toLowerCase() === username.toLowerCase())

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: roleKeys.list(channelId, 'MODERATOR') })
    void qc.invalidateQueries({ queryKey: roleKeys.list(channelId, 'VIP') })
  }

  const add = useMutation({
    mutationFn: (name: string) => modApi.addRole(channelId, name, role),
    onSuccess: (_r, name) => {
      toast.success(t(isMod ? 'community.addedMod' : 'community.addedVip', { username: name }))
      setValue('')
      refresh()
    },
    onError: (err, name) => {
      const code = errorCode(err)
      if (code === 'NOT_FOUND') setError(t('community.userNotFound', { username: name }))
      else if (code === 'VALIDATION_FAILED') setError(t('community.selfRole'))
      else if (code === 'CONFLICT' && detailString(err, 'limit')) setError(t(isMod ? 'community.limitMod' : 'community.limitVip', { max }))
      else toast.error(t(modError(err, 'role').key))
    },
  })

  const remove = useMutation({
    mutationFn: (r: ChannelRole) => modApi.removeRole(channelId, r.user.id),
    onSuccess: (_d, r) => {
      toast.success(t(isMod ? 'toast.roleRemovedMod' : 'toast.roleRemovedVip', { username: r.user.username }))
      setRemoving(null)
      refresh()
    },
    onError: (err) => {
      toast.error(t(modError(err, 'role').key))
      setRemoving(null)
    },
  })

  const submit = () => {
    if (readOnly || full) return
    if (!username) {
      setError(t('community.usernameRequired'))

      return
    }
    if (username.toLowerCase() === myUsername.toLowerCase()) {
      setError(t('community.selfRole'))

      return
    }
    setError(null)
    add.mutate(username)
  }

  return (
    <div className="flex flex-col gap-4" data-testid={`roles-panel-${role}`}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex w-full max-w-90 flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium text-foreground">
            {isMod ? t('community.addMod') : t('community.addVip')}
          </label>
          <div className="flex h-10 items-center gap-1 rounded-lg border border-input bg-background px-3 focus-within:border-primary aria-invalid:border-destructive max-md:h-11" aria-invalid={error !== null}>
            <span className="text-body-md text-muted-foreground" aria-hidden>
              @
            </span>
            <input
              id={id}
              value={value}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              placeholder={t('community.usernamePlaceholder')}
              aria-invalid={error !== null}
              aria-describedby={error ? `${id}-err` : holdsOther ? `${id}-warn` : undefined}
              disabled={readOnly}
              className="min-w-0 flex-1 bg-transparent text-body-md text-foreground outline-none placeholder:text-subtle-foreground disabled:opacity-50"
              data-testid="role-input"
            />
          </div>
        </div>
        <Button type="submit" disabled={full || readOnly} loading={add.isPending} className="max-md:h-11" data-testid="role-add">
          <PlusIcon />
          {t('community.add')}
        </Button>
        <span className="ml-auto pb-3 text-[13px] text-muted-foreground tabular-nums">
          {isMod ? t('community.countMod', { count: items.length, max }) : t('community.countVip', { count: items.length, max })}
        </span>
        {error && (
          <p id={`${id}-err`} className="flex w-full items-center gap-1.5 text-label-sm font-normal text-destructive" role="alert">
            <CircleAlertIcon className="size-3.5" aria-hidden />
            {error}
          </p>
        )}
        {!error && holdsOther && (
          <p id={`${id}-warn`} className="flex w-full items-center gap-1.5 text-label-sm font-normal text-warning" role="status">
            <TriangleAlertIcon className="size-3.5" aria-hidden />
            {t('community.replaceWarning', { username, role: other === 'VIP' ? 'VIP' : 'Moderator', next: isMod ? 'Moderator' : 'VIP' })}
          </p>
        )}
        {full && !error && (
          <p className="w-full text-label-sm font-normal text-muted-foreground">{t(isMod ? 'community.limitMod' : 'community.limitVip', { max })}</p>
        )}
      </form>
      {list.isPending ? (
        <UserRowSkeleton />
      ) : list.isError ? (
        <ErrorPanel icon={SwordsIcon} title={t('community.loadFailed')} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyPanel
          icon={isMod ? SwordsIcon : GemIcon}
          title={isMod ? t('community.emptyMod') : t('community.emptyVip')}
          body={isMod ? t('community.emptyModBody') : t('community.emptyVipBody')}
          testId="roles-empty"
        />
      ) : (
        <>
          <ul className="flex flex-col rounded-panel border bg-surface px-1" data-testid="roles-list">
            {items.map((r) => (
              <UserRow
                key={r.user.id}
                id={r.user.id}
                name={r.user.displayName}
                username={r.user.username}
                sub={r.createdAt ? t('community.grantedBy', { date: formatDate(r.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' }), by: r.grantedBy?.username ?? '' }) : undefined}
                testId="role-row"
                action={
                  <RowButton onClick={() => setRemoving(r)} disabled={readOnly}>
                    {t('community.remove')}
                  </RowButton>
                }
              />
            ))}
          </ul>
          <LoadMore hasMore={list.hasNextPage} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
        </>
      )}
      <ConfirmDialog
        open={removing !== null}
        title={isMod ? t('community.removeModTitle', { username: removing?.user.username ?? '' }) : t('community.removeVipTitle', { username: removing?.user.username ?? '' })}
        confirmLabel={t('community.removeConfirm')}
        danger
        loading={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
      >
        {isMod ? t('community.removeModBody', { username: removing?.user.username ?? '' }) : t('community.removeVipBody', { username: removing?.user.username ?? '' })}
      </ConfirmDialog>
    </div>
  )
}
