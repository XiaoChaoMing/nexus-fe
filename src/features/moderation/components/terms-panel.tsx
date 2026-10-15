import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CircleAlertIcon, InfoIcon, PlusIcon, TextSearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { chatApi } from '@/features/chat/api/chat-api'
import type { ChatSettings } from '@/features/chat/types'
import { EmptyPanel, ErrorPanel } from '@/features/discover/components/list-states'
import { modApi } from '@/features/moderation/api'
import { RowButton } from '@/features/moderation/components/list-parts'
import { termError } from '@/features/moderation/lib/duration'
import { modError } from '@/features/moderation/lib/errors'
import type { BlockedTerm } from '@/features/moderation/types'
import { detailString, errorCode } from '@/lib/api-error'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** "Chặn liên kết trong chat": the only chat setting on this page (PUT keeps the other modes as they are). */
function LinkToggle({ channelId, readOnly }: { channelId: string; readOnly: boolean }) {
  const { t } = useTranslation('moderation')
  const qc = useQueryClient()
  const key = ['chat-settings', channelId] as const
  const settings = useQuery({ queryKey: key, queryFn: () => chatApi.settings(channelId), enabled: Boolean(channelId) })
  const id = useId()
  const save = useMutation({
    mutationFn: (blockLinks: boolean) => {
      const s = settings.data
      if (!s) throw new Error('settings not loaded')

      return chatApi.updateSettings(channelId, { slowSec: s.slowSec, followersMin: s.followersMin, subsOnly: s.subsOnly, blockLinks })
    },
    onMutate: (blockLinks) => {
      const before = qc.getQueryData<ChatSettings>(key)
      if (before) qc.setQueryData(key, { ...before, blockLinks })

      return { before }
    },
    onSuccess: (next) => {
      qc.setQueryData(key, next)
      toast.success(t('terms.saved'))
    },
    onError: (err, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before)
      toast.error(t(modError(err, 'role').key))
    },
  })

  return (
    <div className="flex items-center gap-4 rounded-panel border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={id} className="text-body-md font-medium text-foreground">
          {t('terms.linkToggle')}
        </label>
        <p className="text-[13px] leading-4.5 text-muted-foreground">{t('terms.linkDesc')}</p>
      </div>
      {settings.isPending ? (
        <Skeleton className="h-6 w-10 rounded-full bg-card" />
      ) : (
        <Switch
          id={id}
          size="md"
          checked={settings.data?.blockLinks ?? false}
          disabled={readOnly || !settings.data || save.isPending}
          onCheckedChange={(v) => save.mutate(v)}
          data-testid="block-links"
        />
      )}
    </div>
  )
}

/**
 * "Từ khóa chặn": the link switch, add a word or phrase (2–100 characters, ≤ 100 per channel), the list with
 * who added each term; every change is saved at once (no Save Bar), applied by chat-svc within 5 s.
 */
export function TermsPanel({ channelId, readOnly = false }: { channelId: string; readOnly?: boolean }) {
  const { t } = useTranslation('moderation')
  const qc = useQueryClient()
  const [term, setTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const desktop = useMediaQuery(MEDIA.md)
  const key = ['blocked-terms', channelId] as const
  const list = useQuery({ queryKey: key, queryFn: () => modApi.terms(channelId), enabled: Boolean(channelId) })
  const items = list.data?.items ?? []
  const max = list.data?.limit ?? 100
  const full = items.length >= max

  const add = useMutation({
    mutationFn: (value: string) => modApi.addTerm(channelId, value),
    onSuccess: (created) => {
      const exists = created !== null && items.some((i) => i.id === created.id)
      toast.success(exists ? t('terms.exists') : t('terms.added'))
      setTerm('')
      void qc.invalidateQueries({ queryKey: key })
    },
    onError: (err) => {
      if (errorCode(err) === 'CONFLICT' && detailString(err, 'limit')) setError(t('terms.limit', { max }))
      else if (errorCode(err) === 'VALIDATION_FAILED') setError(t('terms.length'))
      else toast.error(t(modError(err, 'role').key))
    },
  })

  const remove = useMutation({
    mutationFn: (item: BlockedTerm) => modApi.removeTerm(channelId, item.id),
    onMutate: (item) => qc.setQueryData<{ items: BlockedTerm[]; limit: number }>(key, (old) => (old ? { ...old, items: old.items.filter((i) => i.id !== item.id) } : old)),
    onSuccess: () => toast.success(t('terms.deleted')),
    onError: (err) => {
      toast.error(t(modError(err, 'role').key))
      void qc.invalidateQueries({ queryKey: key })
    },
  })

  const submit = () => {
    if (full || readOnly) return
    if (termError(term)) {
      setError(t('terms.length'))

      return
    }
    setError(null)
    add.mutate(term.trim().replace(/\s+/g, ' '))
  }

  const date = (iso: string) => (iso ? formatDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

  return (
    <div className="flex flex-col gap-4" data-testid="terms-panel">
      <LinkToggle channelId={channelId} readOnly={readOnly} />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex w-full max-w-105 flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium text-foreground">
            {t('terms.label')}
          </label>
          <Input
            id={id}
            value={term}
            maxLength={120}
            onChange={(e) => {
              setTerm(e.target.value)
              setError(null)
            }}
            placeholder={t('terms.placeholder')}
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-err` : undefined}
            disabled={readOnly}
            className="bg-background max-md:h-11"
            data-testid="term-input"
          />
        </div>
        <Button type="submit" disabled={full || readOnly} loading={add.isPending} className="max-md:h-11" data-testid="term-add">
          <PlusIcon />
          {t('community.add')}
        </Button>
        <span className="ml-auto pb-3 text-[13px] text-muted-foreground tabular-nums">{t('terms.count', { count: items.length, max })}</span>
        {error && (
          <p id={`${id}-err`} className="flex w-full items-center gap-1.5 text-label-sm font-normal text-destructive" role="alert">
            <CircleAlertIcon className="size-3.5" aria-hidden />
            {error}
          </p>
        )}
      </form>
      <p className="flex items-start gap-2 text-[13px] leading-4.75 text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('terms.note')}
      </p>
      {list.isPending ? (
        <div className="flex flex-col gap-2 rounded-panel border bg-surface p-3" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg bg-card" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorPanel icon={TextSearchIcon} title={t('community.loadFailed')} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyPanel icon={TextSearchIcon} title={t('terms.empty')} body={t('terms.emptyBody')} testId="terms-empty" />
      ) : (
        <div className="overflow-hidden rounded-panel border bg-surface">
          {desktop && (
            <div className="flex h-10 items-center gap-3 bg-card px-3 text-label-sm font-semibold text-muted-foreground">
              <span className="flex-1">{t('terms.colTerm')}</span>
              <span className="w-50">{t('terms.colBy')}</span>
              <span className="w-40">{t('terms.colDate')}</span>
              <span className="w-20" />
            </div>
          )}
          <ul data-testid="terms-list">
            {items.map((i) => (
              <li key={i.id} className={cn('flex items-center gap-3 border-t px-3 py-2 text-[13px] leading-4.5', !desktop && 'first:border-t-0')} data-testid="term-row">
                <span className="min-w-0 flex-1 font-medium break-words text-foreground">{i.term}</span>
                {desktop ? (
                  <>
                    <span className="w-50 truncate text-muted-foreground">{i.createdBy ? `@${i.createdBy.username}` : ''}</span>
                    <span className="w-40 text-muted-foreground">{date(i.createdAt)}</span>
                  </>
                ) : (
                  <span className="text-label-sm font-normal text-muted-foreground">{date(i.createdAt)}</span>
                )}
                <span className="flex w-20 justify-end">
                  <RowButton onClick={() => remove.mutate(i)} disabled={readOnly} label={t('terms.deleteLabel', { term: i.term })}>
                    {t('terms.delete')}
                  </RowButton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
