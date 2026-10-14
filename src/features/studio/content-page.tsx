import { useState, type KeyboardEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EllipsisIcon, FilmIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Pill } from '@/features/discover/components/filter-select'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { studioV4Api } from '@/features/studio/api'
import { NotCreatorYet } from '@/features/studio/components/not-creator'
import { studioKeys, useStudioVods, type VodFilter } from '@/features/studio/hooks/use-studio-data'
import { StudioPageHeader } from '@/features/studio/studio-layout'
import type { StudioVod, VodVisibility } from '@/features/studio/types'
import { useNow } from '@/hooks/use-now'
import { errorCode, isApiError } from '@/lib/api-error'
import { daysUntil, formatDate, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const TITLE_MAX = 140
const FILTERS: VodFilter[] = ['all', 'public', 'hidden', 'expired']

function useVodMutations() {
  const { t } = useTranslation('studio')
  const qc = useQueryClient()
  const settle = () => {
    void qc.invalidateQueries({ queryKey: studioKeys.vodsAll })
    void qc.invalidateQueries({ queryKey: ['vods'] })
    void qc.invalidateQueries({ queryKey: ['studio', 'dashboard'] })
  }
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; visibility?: VodVisibility } }) => studioV4Api.updateVod(id, patch),
    onSuccess: (_, { patch }) => {
      if (patch.title !== undefined) toast.success(t('content.renamed'))
      else toast.success(patch.visibility === 'HIDDEN' ? t('content.hiddenToast') : t('content.unhiddenToast'))
    },
    onError: () => toast.error(t('content.failed')),
    onSettled: settle,
  })
  const remove = useMutation({
    mutationFn: (id: string) => studioV4Api.deleteVod(id).catch((err: unknown) => {
      // Already deleted (E-G2-03): the goal is reached.
      if (isApiError(err) && err.status === 404) return

      throw err
    }),
    onSuccess: () => toast.success(t('content.deleted')),
    onError: () => toast.error(t('content.failed')),
    onSettled: settle,
  })

  return { update, remove }
}

function RenameField({ vod, onDone, onSave }: { vod: StudioVod; onDone: () => void; onSave: (title: string) => void }) {
  const { t } = useTranslation('studio')
  const [value, setValue] = useState(vod.title)
  const trimmed = value.trim()
  const invalid = trimmed.length < 1 || [...trimmed].length > TITLE_MAX
  const save = () => {
    if (invalid) return
    if (trimmed !== vod.title) onSave(trimmed)
    onDone()
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onDone()
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          maxLength={TITLE_MAX + 20}
          aria-label={t('content.renameLabel')}
          aria-invalid={invalid}
          className={cn('h-9 min-w-0 flex-1 rounded-lg border bg-background px-2.5 text-body-md outline-none focus:border-primary', invalid && 'border-destructive')}
          data-testid="vod-rename-input"
        />
        <span className="text-label-sm font-normal text-subtle-foreground tabular-nums">
          {[...value].length}/{TITLE_MAX}
        </span>
        <Button size="sm" onClick={save} disabled={invalid}>
          {t('content.renameSave')}
        </Button>
      </div>
      {invalid && <span className="text-label-sm font-normal text-destructive">{t('content.renameError')}</span>}
    </div>
  )
}

function VodActions({ vod, onRename, onDelete, onVisibility }: { vod: StudioVod; onRename: () => void; onDelete: () => void; onVisibility: (v: VodVisibility) => void }) {
  const { t } = useTranslation('studio')
  const expired = vod.status === 'EXPIRED'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="max-md:size-11" aria-label={t('content.actions.label', { title: vod.title })} data-testid="vod-actions">
          <EllipsisIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 bg-surface">
        <DropdownMenuItem asChild disabled={expired}>
          <Link to={`/vod/${vod.id}`}>{t('content.actions.view')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={expired} onSelect={onRename}>
          {t('content.actions.rename')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={expired} onSelect={() => onVisibility(vod.visibility === 'HIDDEN' ? 'PUBLIC' : 'HIDDEN')}>
          {vod.visibility === 'HIDDEN' ? t('content.actions.unhide') : t('content.actions.hide')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          {t('content.actions.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function VodRow({ vod, now }: { vod: StudioVod; now: number }) {
  const { t } = useTranslation('studio')
  const { update, remove } = useVodMutations()
  const [renaming, setRenaming] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const expired = vod.status === 'EXPIRED'
  const visibility =
    vod.visibility === 'HIDDEN' ? (
      <span className="rounded-control bg-warning/15 px-2 py-0.5 text-label-sm font-semibold text-warning">{t('content.hidden')}</span>
    ) : (
      <span className="text-muted-foreground">{t('content.public')}</span>
    )
  const expiry = expired ? t('content.expired') : t('content.daysLeft', { count: daysUntil(vod.expiresAt, now) })

  return (
    <li className="flex flex-col gap-3 border-b py-3 last:border-0 md:grid md:grid-cols-[minmax(0,1fr)_140px_100px_110px_110px_48px] md:items-center md:gap-4 md:py-2" data-testid="studio-vod-row" data-vod={vod.id}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative shrink-0">
          <Thumbnail src={vod.thumbnailUrl} className={cn('h-14 w-24 overflow-hidden rounded-control', expired && 'opacity-50')} />
          <span className="absolute right-1 bottom-1 rounded-xs bg-overlay px-1 text-[10px] font-semibold text-white tabular-nums">{formatDuration(vod.durationSec)}</span>
        </span>
        {renaming ? (
          <RenameField vod={vod} onDone={() => setRenaming(false)} onSave={(title) => update.mutate({ id: vod.id, patch: { title } })} />
        ) : (
          <span className="line-clamp-2 min-w-0 text-body-md font-medium text-foreground" data-testid="studio-vod-title">
            {vod.title}
          </span>
        )}
        <span className="ml-auto md:hidden">
          <VodActions vod={vod} onRename={() => setRenaming(true)} onDelete={() => setConfirm(true)} onVisibility={(v) => update.mutate({ id: vod.id, patch: { visibility: v } })} />
        </span>
      </div>
      <span className="text-body-sm text-muted-foreground max-md:hidden">{formatDate(vod.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
      <span className="text-body-sm text-muted-foreground tabular-nums max-md:hidden">{formatDuration(vod.durationSec)}</span>
      <span className="text-body-sm max-md:hidden">{visibility}</span>
      <span className={cn('text-body-sm max-md:hidden', expired ? 'text-subtle-foreground' : 'text-muted-foreground')}>{expiry}</span>
      <span className="flex flex-wrap items-center gap-2 text-label-sm font-normal text-muted-foreground md:hidden">
        {formatDate(vod.createdAt, { dateStyle: 'short' })} · {visibility} · {expiry}
      </span>
      <span className="max-md:hidden">
        <VodActions vod={vod} onRename={() => setRenaming(true)} onDelete={() => setConfirm(true)} onVisibility={(v) => update.mutate({ id: vod.id, patch: { visibility: v } })} />
      </span>
      <ConfirmDialog
        open={confirm}
        title={t('content.deleteTitle')}
        confirmLabel={t('content.deleteConfirm')}
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate(vod.id, { onSettled: () => setConfirm(false) })}
        onClose={() => setConfirm(false)}
      >
        {t('content.deleteBody', { title: vod.title })}
      </ConfirmDialog>
    </li>
  )
}

/** /studio/content — 17 · Studio Nội dung: replays with filters, rename in place, hide / unhide, delete. */
export function StudioContentPage() {
  const { t } = useTranslation('studio')
  const [filter, setFilter] = useState<VodFilter>('all')
  const list = useStudioVods(filter)
  const now = useNow(60_000)

  if (errorCode(list.error) === 'NOT_CREATOR') {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <StudioPageHeader title={t('content.title')} />
        <NotCreatorYet />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 md:pb-8" data-testid="studio-content">
      <StudioPageHeader title={t('content.title')} />
      <div role="group" aria-label={t('content.filters.label')} className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <Pill key={f} selected={filter === f} onClick={() => setFilter(f)}>
            {t(`content.filters.${f}`)}
          </Pill>
        ))}
      </div>
      {list.isError && !list.data ? (
        <ErrorPanel icon={FilmIcon} title={t('content.loadFailed')} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <div className="flex flex-col gap-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : list.items.length === 0 ? (
        filter === 'all' ? (
          <EmptyPanel icon={FilmIcon} title={t('content.emptyTitle')} body={t('content.emptyBody')} testId="studio-content-empty" />
        ) : (
          <EmptyPanel icon={FilmIcon} title={t('content.filterEmpty')} />
        )
      ) : (
        <section className="rounded-panel border bg-surface px-4">
          <div className="hidden grid-cols-[minmax(0,1fr)_140px_100px_110px_110px_48px] gap-4 border-b py-2.5 text-label-sm font-medium text-muted-foreground md:grid" aria-hidden>
            <span>{t('content.col.video')}</span>
            <span>{t('content.col.date')}</span>
            <span>{t('content.col.duration')}</span>
            <span>{t('content.col.visibility')}</span>
            <span>{t('content.col.expiry')}</span>
            <span />
          </div>
          <ul>
            {list.items.map((v) => (
              <VodRow key={v.id} vod={v} now={now} />
            ))}
          </ul>
          <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
        </section>
      )}
    </div>
  )
}
