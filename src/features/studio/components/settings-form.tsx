import { useEffect, useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, CircleCheckIcon, SaveIcon, SquarePenIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useUpdateSettings } from '@/features/streams/hooks/use-streams'
import type { StreamSettings } from '@/features/streams/types'
import { CategoryPicker } from '@/features/studio/components/category-picker'
import { Panel } from '@/features/studio/components/panel'
import { TagInput } from '@/features/studio/components/tag-input'
import { SETTINGS_LIMITS, settingsSchema, STREAM_LANGUAGES, TAG_MAX, TITLE_MAX, type SettingsForm } from '@/features/studio/schemas/settings-schema'
import { useMessage } from '@/i18n/messages'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const toForm = (s: StreamSettings): SettingsForm => ({ title: s.title, tags: s.tags, language: s.language || 'vi', isMature: s.isMature, categoryId: s.categoryId ?? null })

/** UC-G02: applies to the current broadcast right away, and to the next one. */
export function SettingsFormCard({ settings, live }: { settings: StreamSettings; live: boolean }) {
  const { t } = useTranslation('studio')
  const msg = useMessage()
  const ids = { title: useId(), lang: useId(), mature: useId(), category: useId() }
  const update = useUpdateSettings()
  const { register, handleSubmit, reset, setError, control, formState } = useForm<SettingsForm>({ defaultValues: toForm(settings) })

  // Server values arrive after the first render (and change after each save).
  useEffect(() => {
    if (!formState.isDirty) reset(toForm(settings))
  }, [settings, reset, formState.isDirty])

  const onSubmit = handleSubmit((values) => {
    const parsed = settingsSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === 'title' || field === 'tags') setError(field, { message: issue.message })
      }

      return
    }

    update.mutate(parsed.data, {
      onSuccess: (s) => {
        reset(toForm(s))
        toast.success(t('settings.savedToast'))
      },
      onError: () => toast.error(t('settings.saveFailed')),
    })
  })

  const title = useWatch({ control, name: 'title' }) ?? ''

  return (
    <Panel
      id="settings-heading"
      title={t('settings.title')}
      subtitle={live ? t('settings.appliesNow') : t('settings.appliesNext')}
      icon={SquarePenIcon}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-labelledby="settings-heading" noValidate>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={ids.title} className="text-[13px] font-medium text-foreground">
              {t('settings.titleLabel')}
            </label>
            <span className="text-body-sm text-subtle-foreground tabular-nums">
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          <textarea
            id={ids.title}
            rows={2}
            maxLength={TITLE_MAX}
            aria-invalid={Boolean(formState.errors.title)}
            className={cn(
              'resize-none rounded-lg border border-transparent bg-background px-3 py-2.5 text-[13px] leading-5 text-foreground outline-none focus:border-primary',
              formState.errors.title && 'border-destructive',
            )}
            {...register('title')}
          />
          {formState.errors.title && <p className="text-body-sm text-destructive">{msg(formState.errors.title.message, SETTINGS_LIMITS)}</p>}
        </div>

        <Controller
          control={control}
          name="tags"
          render={({ field, fieldState }) => (
            <TagInput
              label={t('settings.tags')}
              value={field.value}
              onChange={field.onChange}
              hint={t('settings.tagsHint', { max: TAG_MAX })}
              error={msg(fieldState.error?.message, SETTINGS_LIMITS)}
            />
          )}
        />

        <div className="flex flex-col gap-1.5">
          <span id={ids.category} className="text-[13px] font-medium text-foreground">
            {t('category.label')}
          </span>
          <Controller control={control} name="categoryId" render={({ field }) => <CategoryPicker value={field.value} onChange={field.onChange} labelId={ids.category} />} />
          {live && <p className="text-body-sm text-subtle-foreground">{t('category.liveHint')}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.lang} className="text-[13px] font-medium text-foreground">
            {t('settings.language')}
          </label>
          <div className="relative">
            <select
              id={ids.lang}
              className="h-10 w-full appearance-none rounded-lg border border-transparent bg-background pr-9 pl-3 text-[13px] text-foreground outline-none focus:border-primary"
              {...register('language')}
            >
              {STREAM_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {t(`streamLanguages.${code}`)}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-card p-3">
          <label htmlFor={ids.mature} className="flex flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-foreground">{t('settings.mature')}</span>
            <span className="text-body-sm text-subtle-foreground">{t('settings.matureHint')}</span>
          </label>
          <Controller
            control={control}
            name="isMature"
            render={({ field }) => <Switch id={ids.mature} checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
            <SaveIcon />
            {t('settings.save')}
          </Button>
          {settings.updatedAt && !formState.isDirty && (
            <span className="inline-flex items-center gap-1.5 text-body-sm text-success">
              <CircleCheckIcon className="size-3.5" aria-hidden />
              {t('settings.savedAt', { time: formatDate(settings.updatedAt, { timeStyle: 'short' }) })}
            </span>
          )}
        </div>
      </form>
    </Panel>
  )
}
