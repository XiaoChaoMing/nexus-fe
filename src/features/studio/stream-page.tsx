import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CircleAlertIcon, Loader2Icon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStreamKeyInfo, useStudio } from '@/features/streams/hooks/use-streams'
import { HealthPanel } from '@/features/studio/components/health-panel'
import { KeyCard } from '@/features/studio/components/key-card'
import { ObsGuide } from '@/features/studio/components/obs-guide'
import { PreviewPanel } from '@/features/studio/components/preview-panel'
import { SettingsFormCard } from '@/features/studio/components/settings-form'
import { StudioHeader } from '@/features/studio/components/studio-header'
import { isCreator } from '@/features/auth/lib/roles'
import { loadMe } from '@/features/auth/lib/session'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { errorCode } from '@/lib/api-error'

/** Ticks once a second for elapsed time, grace countdown and health freshness. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(id)
  }, [])

  return now
}

/**
 * stream-svc answers 403 NOT_CREATOR until it knows the caller's channel. Right after approval that can lag
 * identity by a moment, so a creator waits here (the Studio query keeps polling); anyone else is sent to apply.
 */
function NotCreatorYet() {
  const { t } = useTranslation('studio')
  const creator = useAuthStore((s) => isCreator(s.me))

  useEffect(() => {
    void loadMe()
  }, [])

  if (creator) {
    return (
      <section role="status" className="flex items-center gap-3 rounded-xl border bg-surface p-5" data-testid="studio-preparing">
        <Loader2Icon className="size-5 animate-spin text-primary" aria-hidden />
        {t('notCreator.preparing')}
      </section>
    )
  }

  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-5" data-testid="studio-not-creator">
      <h2 className="font-heading text-headline-sm">{t('notCreator.title')}</h2>
      <p className="text-body-sm text-muted-foreground">{t('notCreator.body')}</p>
      <Button asChild>
        <Link to="/creator/apply">
          <SparklesIcon />
          {t('notCreator.apply')}
        </Link>
      </Button>
    </section>
  )
}

/** /studio/stream — Stream Manager (UC-G01–G05). */
export function StudioStreamPage() {
  const { t } = useTranslation('studio')
  const studio = useStudio()
  const keyInfo = useStreamKeyInfo()
  const now = useNow()
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const current = studio.data?.current ?? null
  const notCreator = errorCode(studio.error) === 'NOT_CREATOR' || errorCode(keyInfo.error) === 'NOT_CREATOR'
  const refetchKey = keyInfo.refetch

  // The channel appeared: the key card was loaded while it was missing.
  useEffect(() => {
    if (studio.data && keyInfo.isError) void refetchKey()
  }, [studio.data, keyInfo.isError, refetchKey])

  if (notCreator && !studio.data) {
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 p-4 md:p-6 md:pb-8">
        <h1 className="font-heading text-[28px] leading-tight font-bold">{t('title')}</h1>
        <NotCreatorYet />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 p-4 md:p-6 md:pb-8">
      <StudioHeader current={current} channel={studio.data?.channel} now={now} onEnded={() => setEndedAt(Date.now())} />

      {studio.isError && !notCreator && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/15 p-3 text-body-sm text-foreground">
          <CircleAlertIcon className="size-4 text-destructive" aria-hidden />
          {t('loadFailed')}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <PreviewPanel current={current} hasKey={Boolean(keyInfo.data?.hasKey)} settingsSaved={Boolean(studio.data?.settings.updatedAt)} />
          <HealthPanel current={current} now={now} endedAt={endedAt} />
        </div>
        <div className="flex flex-col gap-5">
          <KeyCard status={current?.status ?? null} />
          {studio.data ? <SettingsFormCard settings={studio.data.settings} live={current !== null} /> : <Skeleton className="h-96 rounded-xl" />}
        </div>
      </div>

      <ObsGuide />
    </div>
  )
}
