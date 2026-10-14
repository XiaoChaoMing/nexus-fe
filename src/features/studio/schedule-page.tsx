import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDaysIcon, CalendarPlusIcon, EllipsisIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useWhenText } from '@/features/channels/hooks/use-schedule-text'
import { groupByDay } from '@/features/channels/lib/schedule-days'
import { EmptyPanel, ErrorPanel } from '@/features/discover/components/list-states'
import { studioV4Api } from '@/features/studio/api'
import { NotCreatorYet } from '@/features/studio/components/not-creator'
import { ScheduleFormSheet } from '@/features/studio/components/schedule-form-sheet'
import { studioKeys, useSchedules } from '@/features/studio/hooks/use-studio-data'
import { parseRrule, SCHEDULE_MAX_ACTIVE, scheduleState } from '@/features/studio/lib/schedule-form'
import { StudioPageHeader } from '@/features/studio/studio-layout'
import type { Schedule } from '@/features/studio/types'
import { useNow } from '@/hooks/use-now'
import { errorCode } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { browserTimeZone, isValidTimeZone, zonedDateTime, zonedToUtc } from '@/lib/timezone'
import { cn } from '@/lib/utils'

/** Broadcasts shown in "Buổi phát 14 ngày tới". */
const UPCOMING_DAYS = 14

type Occ = { schedule: Schedule; occurrenceAt: string; reminderCount: number }

/** The creator's zone (account setting), else the browser's. */
function useCreatorTimeZone(): string {
  const tz = useAuthStore((s) => s.me?.user.timezone ?? s.user?.timezone)

  return tz && isValidTimeZone(tz) ? tz : browserTimeZone()
}

function useInvalidateSchedules() {
  const qc = useQueryClient()

  return () => {
    void qc.invalidateQueries({ queryKey: studioKeys.schedules })
    void qc.invalidateQueries({ queryKey: ['channels', 'schedule'] })
  }
}

function MoveDialog({ occ, timezone, onClose }: { occ: Occ | null; timezone: string; onClose: () => void }) {
  const { t } = useTranslation('studio')
  const now = useNow(30_000)
  const invalidate = useInvalidateSchedules()
  const initial = occ ? zonedDateTime(Date.parse(occ.occurrenceAt), timezone) : { date: '', time: '' }
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const move = useMutation({
    mutationFn: () => studioV4Api.moveOccurrence(occ?.schedule.id ?? '', occ?.occurrenceAt ?? '', new Date(zonedToUtc(date, time, timezone)).toISOString()),
    onSuccess: () => {
      toast.success(t('schedule.move.moved'))
      onClose()
    },
    onError: (err) => toast.error(errorCode(err) === 'INVALID_STATE' ? t('schedule.form.errors.startMin') : t('schedule.form.errors.generic')),
    onSettled: invalidate,
  })
  const field = 'h-10 w-full rounded-lg border bg-background px-3 text-[13px] outline-none focus:border-primary max-md:h-11'

  return (
    <Dialog open={occ !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('schedule.move.title')}</DialogTitle>
          <DialogDescription>{t('schedule.move.body')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            {t('schedule.move.date')}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            {t('schedule.move.time')}
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('channelSettings.discard')}
          </Button>
          <Button loading={move.isPending} disabled={!date || !time || zonedToUtc(date, time, timezone) <= now} onClick={() => move.mutate()}>
            {t('schedule.move.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RuleText({ schedule: s, now }: { schedule: Schedule; now: number }) {
  const { t } = useTranslation('studio')
  const when = useWhenText()
  const rule = parseRrule(s.rrule)
  if (!rule) return <>{t('schedule.once', { when: when(s.startAt, now) })}</>
  const time = formatDate(s.startAt, { hour: '2-digit', minute: '2-digit', timeZone: s.timezone })

  return <>{t('schedule.weekly', { days: rule.days.map((d) => t(`schedule.days.${d}`)).join(', '), time })}</>
}

/** /studio/schedule — 18 · Studio Lịch phát: next 14 days by day, the creator's schedules, create / edit / move / cancel. */
export function StudioSchedulePage() {
  const { t } = useTranslation('studio')
  const { t: tc } = useTranslation('channel')
  const when = useWhenText()
  const timezone = useCreatorTimeZone()
  const now = useNow(60_000)
  const { active, cancelled } = useSchedules()
  const invalidate = useInvalidateSchedules()
  const [editing, setEditing] = useState<Schedule | null | 'new'>(null)
  const [moving, setMoving] = useState<Occ | null>(null)
  const [cancelOne, setCancelOne] = useState<Occ | null>(null)
  const [cancelSeries, setCancelSeries] = useState<Schedule | null>(null)

  const cancelOccurrence = useMutation({
    mutationFn: (o: Occ) => studioV4Api.cancelOccurrence(o.schedule.id, o.occurrenceAt),
    onSuccess: () => toast.success(t('schedule.cancelOne.done')),
    onError: () => toast.error(t('schedule.form.errors.generic')),
    onSettled: () => {
      setCancelOne(null)
      invalidate()
    },
  })
  const cancelSchedule = useMutation({
    mutationFn: (s: Schedule) => studioV4Api.cancelSchedule(s.id),
    onSuccess: () => toast.success(t('schedule.cancelSeries.done')),
    onError: () => toast.error(t('schedule.form.errors.generic')),
    onSettled: () => {
      setCancelSeries(null)
      invalidate()
    },
  })

  if (errorCode(active.error) === 'NOT_CREATOR') {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <StudioPageHeader title={t('schedule.title')} />
        <NotCreatorYet />
      </div>
    )
  }

  const schedules = active.data ?? []
  const activeCount = schedules.filter((s) => scheduleState(s, now) === 'active').length
  const horizon = now + UPCOMING_DAYS * 86_400_000
  const occurrences: Occ[] = schedules.flatMap((s) =>
    s.nextOccurrences.filter((o) => Date.parse(o.occurrenceAt) > now && Date.parse(o.occurrenceAt) <= horizon).map((o) => ({ schedule: s, occurrenceAt: o.occurrenceAt, reminderCount: o.reminderCount })),
  )
  const groups = groupByDay(occurrences, (o) => Date.parse(o.occurrenceAt), now, browserTimeZone())
  const all = [...schedules, ...(cancelled.data ?? [])]

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 md:pb-8" data-testid="studio-schedule">
      <StudioPageHeader
        title={t('schedule.title')}
        actions={
          <>
            <span className="text-body-sm text-muted-foreground">{t('schedule.activeCount', { count: activeCount, max: SCHEDULE_MAX_ACTIVE })}</span>
            <Button onClick={() => setEditing('new')} data-testid="schedule-create">
              <CalendarPlusIcon />
              {t('schedule.create')}
            </Button>
          </>
        }
      />

      {active.isError && !active.data ? (
        <ErrorPanel icon={CalendarDaysIcon} title={t('schedule.loadFailed')} onRetry={() => void active.refetch()} />
      ) : active.isPending ? (
        <Skeleton className="h-60 rounded-panel" />
      ) : all.length === 0 ? (
        <EmptyPanel icon={CalendarDaysIcon} title={t('schedule.emptyTitle')} body={t('schedule.emptyBody')} testId="schedule-empty">
          <Button onClick={() => setEditing('new')}>
            <CalendarPlusIcon />
            {t('schedule.create')}
          </Button>
        </EmptyPanel>
      ) : (
        <>
          <section aria-labelledby="upcoming-14" className="flex flex-col gap-3 rounded-panel border bg-surface p-4 md:p-5">
            <h2 id="upcoming-14" className="font-heading text-headline-sm">
              {t('schedule.upcomingTitle')}
            </h2>
            {groups.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">{t('schedule.upcomingEmpty')}</p>
            ) : (
              groups.map((g) => (
                <div key={g.key} className="flex flex-col gap-1">
                  <h3 className="pt-2 text-label-sm font-semibold text-muted-foreground uppercase">
                    {g.label.kind === 'date'
                      ? formatDate(new Date(g.label.ms).toISOString(), { weekday: 'long', day: '2-digit', month: '2-digit' })
                      : tc(g.label.kind === 'today' ? 'schedule.today' : 'schedule.tomorrow')}
                  </h3>
                  <ul className="flex flex-col">
                    {g.items.map((o) => (
                      <li key={`${o.schedule.id}-${o.occurrenceAt}`} className="flex min-h-14 items-center gap-3 rounded-lg px-2 hover:bg-accent" data-testid="schedule-occurrence">
                        <span className="w-14 shrink-0 text-body-md font-semibold tabular-nums">{formatDate(o.occurrenceAt, { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-body-md font-medium">{o.schedule.title}</span>
                          <span className="truncate text-label-sm font-normal text-muted-foreground">
                            {[o.schedule.category?.name, t('schedule.reminders', { count: o.reminderCount })].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="max-md:size-11" aria-label={t('schedule.actions.label', { title: o.schedule.title })}>
                              <EllipsisIcon className="size-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-surface">
                            <DropdownMenuItem onSelect={() => setMoving(o)}>{t('schedule.actions.move')}</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setCancelOne(o)} className="text-destructive focus:text-destructive">
                              {t('schedule.actions.cancelOne')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="your-schedules" className="flex flex-col gap-3 rounded-panel border bg-surface p-4 md:p-5">
            <h2 id="your-schedules" className="font-heading text-headline-sm">
              {t('schedule.yoursTitle')}
            </h2>
            <ul className="flex flex-col">
              {all.map((s) => {
                const state = scheduleState(s, now)

                return (
                  <li key={s.id} className="flex min-h-16 items-center gap-3 border-b py-2 last:border-0" data-testid="schedule-row">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body-md font-medium">{s.title}</span>
                      <span className="truncate text-label-sm font-normal text-muted-foreground">
                        <RuleText schedule={s} now={now} />
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-control px-2 py-0.5 text-label-sm font-semibold',
                        state === 'active' ? 'bg-success/15 text-success' : state === 'cancelled' ? 'bg-destructive/15 text-destructive' : 'bg-card text-muted-foreground',
                      )}
                    >
                      {t(`schedule.status.${state}`)}
                    </span>
                    {s.status === 'ACTIVE' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="max-md:size-11" aria-label={t('schedule.actions.label', { title: s.title })}>
                            <EllipsisIcon className="size-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-surface">
                          <DropdownMenuItem onSelect={() => setEditing(s)}>{t('schedule.actions.edit')}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setCancelSeries(s)} className="text-destructive focus:text-destructive">
                            {t('schedule.actions.cancelSeries')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      <ScheduleFormSheet open={editing !== null} schedule={editing === 'new' ? null : editing} others={schedules} timezone={timezone} onClose={() => setEditing(null)} />
      {moving && <MoveDialog key={`${moving.schedule.id}-${moving.occurrenceAt}`} occ={moving} timezone={timezone} onClose={() => setMoving(null)} />}
      <ConfirmDialog
        open={cancelOne !== null}
        title={t('schedule.cancelOne.title', { when: cancelOne ? when(cancelOne.occurrenceAt, now) : '' })}
        confirmLabel={t('schedule.cancelOne.confirm')}
        cancelLabel={t('schedule.cancelOne.keep')}
        danger
        loading={cancelOccurrence.isPending}
        onConfirm={() => cancelOne && cancelOccurrence.mutate(cancelOne)}
        onClose={() => setCancelOne(null)}
      >
        {t('schedule.cancelOne.body', { count: cancelOne?.reminderCount ?? 0 })}
      </ConfirmDialog>
      <ConfirmDialog
        open={cancelSeries !== null}
        title={t('schedule.cancelSeries.title', { title: cancelSeries?.title ?? '' })}
        confirmLabel={t('schedule.cancelSeries.confirm')}
        cancelLabel={t('schedule.cancelOne.keep')}
        danger
        loading={cancelSchedule.isPending}
        onConfirm={() => cancelSeries && cancelSchedule.mutate(cancelSeries)}
        onClose={() => setCancelSeries(null)}
      >
        {t('schedule.cancelSeries.body')}
      </ConfirmDialog>
    </div>
  )
}
