import { useId, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDurationText, useWhenText } from '@/features/channels/hooks/use-schedule-text'
import { Segmented } from '@/features/discover/components/filter-select'
import { studioV4Api } from '@/features/studio/api'
import { CategoryPicker } from '@/features/studio/components/category-picker'
import { studioKeys } from '@/features/studio/hooks/use-studio-data'
import {
  changesTiming,
  DURATION_OPTIONS,
  emptyScheduleForm,
  fromSchedule,
  inputOf,
  previewOccurrences,
  SCHEDULE_TITLE_MAX,
  toScheduleInput,
  validateScheduleForm,
  WEEKDAYS,
  type ScheduleFormErrors,
  type ScheduleFormValues,
  type Weekday,
} from '@/features/studio/lib/schedule-form'
import type { Schedule } from '@/features/studio/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { errorCode, isApiError } from '@/lib/api-error'
import { gmtLabel } from '@/lib/timezone'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  /** null: create. */
  schedule: Schedule | null
  /** Other schedules, for the (non-blocking) overlap warning. */
  others: Schedule[]
  timezone: string
  onClose: () => void
}

const fieldClass = 'h-10 w-full rounded-lg border border-transparent bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary aria-[invalid=true]:border-destructive max-md:h-11'

/** Server field errors (`details.<field>`) mapped onto the form. */
function serverErrors(err: unknown): ScheduleFormErrors {
  if (!isApiError(err) || err.code !== 'VALIDATION_FAILED') return {}
  const d = err.details
  const out: ScheduleFormErrors = {}
  if (d.title) out.title = 'LENGTH'
  if (d.startAt === 'MAX') out.date = 'MAX'
  else if (d.startAt) out.date = 'MIN'
  if (d.durationMin) out.durationMin = 'MIN'
  if (d.rrule) out.days = 'REQUIRED'

  return out
}

/** Create / edit a schedule (18 · Lịch phát): right panel 480 px, full-height bottom sheet on phones. */
export function ScheduleFormSheet({ open, schedule, others, timezone, onClose }: Props) {
  const desktop = useMediaQuery(MEDIA.md)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={desktop ? 'right' : 'bottom'} className={cn('flex flex-col gap-0 overflow-y-auto bg-surface p-0', desktop ? 'w-full sm:max-w-120' : 'h-[100dvh] rounded-none')}>
        {open && <ScheduleForm key={schedule?.id ?? 'new'} schedule={schedule} others={others} timezone={timezone} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function ScheduleForm({ schedule, others, timezone, onClose }: Omit<Props, 'open'>) {
  const { t } = useTranslation('studio')
  const qc = useQueryClient()
  const duration = useDurationText()
  const when = useWhenText()
  const ids = { title: useId(), category: useId(), date: useId(), time: useId(), duration: useId(), errors: useId() }
  const [values, setValues] = useState<ScheduleFormValues>(() => (schedule ? fromSchedule(schedule) : emptyScheduleForm(Date.now(), timezone)))
  const [submitted, setSubmitted] = useState(false)
  const [serverErr, setServerErr] = useState<ScheduleFormErrors>({})
  const [topError, setTopError] = useState<string | null>(null)
  const now = useNow(30_000)
  const errors: ScheduleFormErrors = { ...(submitted ? validateScheduleForm(values, now) : {}), ...serverErr }
  const set = <K extends keyof ScheduleFormValues>(k: K, v: ScheduleFormValues[K]) => {
    setValues((s) => ({ ...s, [k]: v }))
    setServerErr({})
    setTopError(null)
  }
  const preview = previewOccurrences(values)
  const reminderCount = schedule?.nextOccurrences.reduce((n, o) => n + o.reminderCount, 0) ?? 0
  const timingChanged = schedule !== null && Object.keys(validateScheduleForm(values, now)).length === 0 && changesTiming(inputOf(schedule), toScheduleInput(values))

  const overlap = useMemo(() => {
    const dur = values.durationMin * 60_000
    for (const o of others) {
      if (o.id === schedule?.id || o.status !== 'ACTIVE') continue
      for (const occ of o.nextOccurrences) {
        const a = Date.parse(occ.occurrenceAt)
        const b = a + o.durationMin * 60_000
        if (preview.some((p) => p < b && a < p + dur)) return o
      }
    }

    return null
  }, [others, schedule?.id, values.durationMin, preview])

  const save = useMutation({
    mutationFn: () => (schedule ? studioV4Api.updateSchedule(schedule.id, toScheduleInput(values)) : studioV4Api.createSchedule(toScheduleInput(values))),
    onSuccess: () => {
      toast.success(schedule ? t('schedule.form.saved') : t('schedule.form.created'))
      onClose()
    },
    onError: (err) => {
      const fieldErrors = serverErrors(err)
      setServerErr(fieldErrors)
      if (errorCode(err) === 'CONFLICT' && isApiError(err) && err.details.limit !== undefined) setTopError(t('schedule.form.errors.limit'))
      else if (Object.keys(fieldErrors).length === 0) setTopError(t('schedule.form.errors.generic'))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: studioKeys.schedules })
      void qc.invalidateQueries({ queryKey: ['channels', 'schedule'] })
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateScheduleForm(values, Date.now())).length > 0) return
    save.mutate()
  }

  const msg = {
    title: errors.title && t('schedule.form.errors.titleLength'),
    date: errors.date === 'MIN' ? t('schedule.form.errors.startMin') : errors.date === 'MAX' ? t('schedule.form.errors.startMax') : errors.date ? t('schedule.form.errors.startRequired') : null,
    durationMin: errors.durationMin && t('schedule.form.errors.duration'),
    days: errors.days && t('schedule.form.errors.days'),
  }
  const toggleDay = (d: Weekday) => set('days', values.days.includes(d) ? values.days.filter((x) => x !== d) : [...values.days, d])

  return (
    <form onSubmit={submit} noValidate className="flex min-h-full flex-col" data-testid="schedule-form">
      <SheetHeader className="border-b p-5">
        <SheetTitle className="font-heading text-headline-sm">{schedule ? t('schedule.form.editTitle') : t('schedule.form.createTitle')}</SheetTitle>
        <SheetDescription className="sr-only">{t('schedule.form.timezone', { zone: values.timezone, offset: gmtLabel(now, values.timezone) })}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {topError && (
          <p role="alert" className="rounded-lg bg-destructive/15 p-3 text-body-sm text-foreground" data-testid="schedule-form-error">
            {topError}
          </p>
        )}
        {timingChanged && reminderCount > 0 && (
          <p role="status" className="flex gap-2 rounded-lg bg-warning/15 p-3 text-body-sm text-foreground">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t('schedule.form.timingWarning', { count: reminderCount })}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.title} className="text-[13px] font-medium">
              {t('schedule.form.title')}
            </label>
            <span className="text-body-sm text-subtle-foreground tabular-nums">
              {[...values.title].length}/{SCHEDULE_TITLE_MAX}
            </span>
          </div>
          <input
            id={ids.title}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={SCHEDULE_TITLE_MAX}
            aria-invalid={Boolean(msg.title)}
            aria-describedby={msg.title ? `${ids.title}-err` : undefined}
            className={fieldClass}
            data-testid="schedule-title"
          />
          {msg.title && (
            <p id={`${ids.title}-err`} className="text-body-sm text-destructive">
              {msg.title}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={ids.category} className="text-[13px] font-medium">
            {t('schedule.form.category')}
          </span>
          <CategoryPicker value={values.categoryId} onChange={(v) => set('categoryId', v)} labelId={ids.category} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.date} className="text-[13px] font-medium">
              {t('schedule.form.date')}
            </label>
            <input id={ids.date} type="date" value={values.date} onChange={(e) => set('date', e.target.value)} aria-invalid={Boolean(msg.date)} aria-describedby={msg.date ? `${ids.date}-err` : undefined} className={fieldClass} data-testid="schedule-date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.time} className="text-[13px] font-medium">
              {t('schedule.form.time')}
            </label>
            <input id={ids.time} type="time" value={values.time} onChange={(e) => set('time', e.target.value)} aria-invalid={Boolean(msg.date)} className={fieldClass} data-testid="schedule-time" />
          </div>
          {msg.date && (
            <p id={`${ids.date}-err`} className="col-span-2 text-body-sm text-destructive" data-testid="schedule-date-error">
              {msg.date}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.duration} className="text-[13px] font-medium">
            {t('schedule.form.duration')}
          </label>
          <select id={ids.duration} value={values.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} aria-invalid={Boolean(msg.durationMin)} className={fieldClass}>
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {duration(m)}
              </option>
            ))}
          </select>
          {msg.durationMin && <p className="text-body-sm text-destructive">{msg.durationMin}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">{t('schedule.form.repeat')}</span>
          <Segmented
            label={t('schedule.form.repeat')}
            value={values.repeat}
            onChange={(v) => set('repeat', v)}
            options={[
              { value: 'none', label: t('schedule.form.repeatNone') },
              { value: 'weekly', label: t('schedule.form.repeatWeekly') },
            ]}
            className="w-full"
          />
          {values.repeat === 'weekly' && (
            <div role="group" aria-label={t('schedule.form.weekdays')} className="grid grid-cols-7 gap-1.5" data-testid="schedule-weekdays">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={values.days.includes(d)}
                  aria-label={t(`schedule.days.${d}`)}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'h-10 rounded-control border text-label-sm max-md:h-11',
                    values.days.includes(d) ? 'border-primary bg-card font-semibold text-foreground' : 'bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`schedule.daysShort.${d}`)}
                </button>
              ))}
            </div>
          )}
          {msg.days && <p className="text-body-sm text-destructive">{msg.days}</p>}
        </div>

        <p className="text-body-sm text-muted-foreground">{t('schedule.form.timezone', { zone: values.timezone, offset: gmtLabel(now, values.timezone) })}</p>

        {overlap && (
          <p role="status" className="flex gap-2 rounded-lg bg-warning/15 p-3 text-body-sm text-foreground">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {t('schedule.form.overlap', { title: overlap.title })}
          </p>
        )}

        {preview.length > 0 && (
          <section aria-labelledby="schedule-preview" className="flex flex-col gap-1.5 rounded-lg bg-card p-3">
            <h3 id="schedule-preview" className="text-label-sm font-semibold text-muted-foreground">
              {t('schedule.form.preview')}
            </h3>
            <ul className="flex flex-col gap-1 text-body-sm text-foreground">
              {preview.map((ms) => (
                <li key={ms}>{when(new Date(ms).toISOString(), now)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('channelSettings.discard')}
        </Button>
        <Button type="submit" loading={save.isPending} data-testid="schedule-submit">
          {schedule ? t('schedule.form.submitEdit') : t('schedule.form.submitCreate')}
        </Button>
      </div>
    </form>
  )
}
