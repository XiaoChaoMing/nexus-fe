import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ShieldCheckIcon, UsersIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { modApi } from '@/features/moderation/api'
import { RowButton, UserInitials } from '@/features/moderation/components/list-parts'
import { timeLeft } from '@/features/moderation/lib/duration'
import { modError } from '@/features/moderation/lib/errors'
import type { Restriction, RestrictionType } from '@/features/moderation/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { formatDate } from '@/lib/format'
import { useSearchParams } from 'react-router'
import { cn } from '@/lib/utils'

const FILTERS = ['all', 'BAN', 'TIMEOUT'] as const
type Filter = (typeof FILTERS)[number]

function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function useRestrictionTimes() {
  const { t } = useTranslation('moderation')
  const hm = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' })
  const left = (iso: string, now: number) => {
    const l = timeLeft(iso, now)

    return !l ? '' : 'clock' in l ? l.clock : t('duration.day', { count: l.days })
  }

  return {
    expires: (r: Restriction, now: number) => {
      if (r.type === 'BAN' || !r.until) return t('restrictions.forever')
      const at = Date.parse(r.until)

      return sameDay(at, now)
        ? t('restrictions.expiresToday', { time: hm(r.until), left: left(r.until, now) })
        : t('restrictions.expiresOn', { date: formatDate(r.until, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), left: left(r.until, now) })
    },
    at: (iso: string, now: number) => {
      if (!iso) return ''
      const at = Date.parse(iso)
      if (sameDay(at, now)) return t('restrictions.todayAt', { time: hm(iso) })
      if (sameDay(at, now - 86_400_000)) return t('restrictions.yesterdayAt', { time: hm(iso) })

      return formatDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })
    },
  }
}

function TypeBadge({ type }: { type: RestrictionType }) {
  const { t } = useTranslation('moderation')

  return type === 'BAN' ? (
    <span className="inline-flex rounded-control bg-destructive px-2 py-0.75 text-label-sm font-semibold text-primary-foreground">{t('restrictions.typeBan')}</span>
  ) : (
    <span className="inline-flex rounded-control bg-warning/15 px-2 py-0.75 text-label-sm font-semibold text-warning">{t('restrictions.typeTimeout')}</span>
  )
}

/**
 * "Bị cấm" (Studio → Cộng đồng, /moderation/:channel): active bans and timeouts, filter chips (`?type=`), lift
 * one without asking (toast). Timeouts count down in place; an ended one leaves the list.
 */
export function RestrictionsPanel({ channelId, readOnly = false }: { channelId: string; readOnly?: boolean }) {
  const { t } = useTranslation('moderation')
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const raw = sp.get('type')
  const filter: Filter = raw === 'BAN' || raw === 'TIMEOUT' ? raw : 'all'
  const desktop = useMediaQuery(MEDIA.md)
  const now = useNow(1000)
  const times = useRestrictionTimes()
  const key = ['restrictions', channelId, filter] as const

  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => modApi.restrictions(channelId, filter === 'all' ? null : filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(channelId),
    refetchInterval: 30_000,
  })

  const lift = useMutation({
    mutationFn: (r: Restriction) => (r.type === 'BAN' ? modApi.unban(channelId, r.user.id) : modApi.untimeout(channelId, r.user.id)),
    onSuccess: (_d, r) => {
      toast.success(t(r.type === 'BAN' ? 'toast.unbanned' : 'toast.untimedOut', { username: r.user.username }))
      void qc.invalidateQueries({ queryKey: ['restrictions', channelId] })
    },
    onError: (err, r) => toast.error(t(modError(err, r.type === 'BAN' ? 'unban' : 'untimeout').key, { username: r.user.username })),
  })

  const items = (list.data?.pages.flatMap((p) => p.items) ?? []).filter((r) => r.type === 'BAN' || !r.until || Date.parse(r.until) > now)

  const chips = (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('restrictions.filterLabel')}>
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => {
            const next = new URLSearchParams(sp)
            if (f === 'all') next.delete('type')
            else next.set('type', f)
            setSp(next, { replace: true })
          }}
          className={cn(
            'h-8 rounded-control border px-3 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-ring max-md:h-11',
            filter === f ? 'border-primary bg-card font-semibold text-foreground' : 'bg-surface font-medium text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`restrictions.chips.${f}`)}
        </button>
      ))}
    </div>
  )

  const action = (r: Restriction) => (
    <RowButton onClick={() => lift.mutate(r)} disabled={readOnly || (lift.isPending && lift.variables?.user.id === r.user.id)} testId={`lift-${r.user.username}`}>
      {r.type === 'BAN' ? t('restrictions.unban') : t('restrictions.untimeout')}
    </RowButton>
  )

  let body
  if (list.isPending) {
    body = (
      <div className="flex flex-col gap-2 rounded-panel border bg-surface p-3" aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg bg-card" />
        ))}
      </div>
    )
  } else if (list.isError) {
    body = <ErrorPanel icon={UsersIcon} title={t('community.loadFailed')} onRetry={() => void list.refetch()} />
  } else if (items.length === 0) {
    body = <EmptyPanel icon={ShieldCheckIcon} title={t('restrictions.empty')} body={t('restrictions.emptyBody')} testId="restrictions-empty" />
  } else if (desktop) {
    body = (
      <div className="overflow-x-auto rounded-panel border bg-surface">
        <table className="w-full min-w-[880px] text-left" data-testid="restrictions-table">
          <thead>
            <tr className="h-10 bg-card text-label-sm font-semibold text-muted-foreground">
              <th className="w-50 px-3 font-semibold">{t('restrictions.colUser')}</th>
              <th className="w-22 px-3 font-semibold">{t('restrictions.colType')}</th>
              <th className="w-52 px-3 font-semibold">{t('restrictions.colExpires')}</th>
              <th className="w-32 px-3 font-semibold">{t('restrictions.colActor')}</th>
              <th className="px-3 font-semibold">{t('restrictions.colReason')}</th>
              <th className="w-30 px-3 font-semibold">{t('restrictions.colAt')}</th>
              <th className="w-32 px-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={`${r.type}-${r.user.id}`} className="border-t text-[13px] leading-4.5 text-muted-foreground" data-testid="restriction-row">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <UserInitials id={r.user.id} name={r.user.displayName || r.user.username} size={32} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold text-foreground">{r.user.displayName}</span>
                      <span className="truncate text-label-sm font-normal">@{r.user.username}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3">
                  <TypeBadge type={r.type} />
                </td>
                <td className="px-3 whitespace-nowrap tabular-nums">{times.expires(r, now)}</td>
                <td className="truncate px-3">{r.actor ? `@${r.actor.username}` : t('restrictions.none')}</td>
                <td className="px-3 break-words">{r.reason ?? t('restrictions.none')}</td>
                <td className="px-3 whitespace-nowrap">{times.at(r.createdAt, now)}</td>
                <td className="px-3 text-right">{action(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  } else {
    body = (
      <ul className="flex flex-col rounded-panel border bg-surface" data-testid="restrictions-table">
        {items.map((r) => (
          <li key={`${r.type}-${r.user.id}`} className="flex flex-col gap-2 border-b p-3 last:border-0" data-testid="restriction-row">
            <div className="flex items-center gap-3">
              <UserInitials id={r.user.id} name={r.user.displayName || r.user.username} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-md font-semibold text-foreground">{r.user.displayName}</span>
                <span className="truncate text-[13px] text-muted-foreground">@{r.user.username}</span>
              </span>
              <TypeBadge type={r.type} />
            </div>
            <p className="text-[13px] text-muted-foreground tabular-nums">
              {times.expires(r, now)}
              {r.reason ? ` · ${r.reason}` : ''}
            </p>
            <div className="flex items-center justify-between gap-2 text-label-sm font-normal text-muted-foreground">
              <span>
                {r.actor ? `@${r.actor.username} · ` : ''}
                {times.at(r.createdAt, now)}
              </span>
              {action(r)}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="restrictions-panel">
      {chips}
      {body}
      {items.length > 0 && <LoadMore hasMore={list.hasNextPage} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />}
    </div>
  )
}
