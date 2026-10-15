import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { BellOffIcon, ChevronRightIcon, MailWarningIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useResendVerification } from '@/features/account/hooks/use-resend-verification'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { ErrorPanel } from '@/features/discover/components/list-states'
import { notificationsApi } from '@/features/notifications/api'
import type { NotificationSetting, NotificationSettings, NotificationType } from '@/features/notifications/types'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

type Channel = 'inApp' | 'email'
type Change = { type: NotificationType; channel: Channel; value: boolean }

function useSettings() {
  const userId = useAuthStore((s) => s.user?.id ?? 'guest')

  return { key: ['notification-settings', userId] as const, query: useQuery({ queryKey: ['notification-settings', userId], queryFn: notificationsApi.settings }) }
}

function applyChange(s: NotificationSettings, c: Change): NotificationSettings {
  return { ...s, items: s.items.map((i) => (i.type === c.type ? { ...i, [c.channel]: c.value } : i)) }
}

/** One switch cell: locked types show the value at 50 % + "Bắt buộc"; types without e-mail show "—". */
function Cell({ setting, channel, emailVerified, onChange }: { setting: NotificationSetting; channel: Channel; emailVerified: boolean; onChange: (c: Change) => void }) {
  const { t } = useTranslation('notifications')
  const typeName = t(`settings.types.${setting.type}`)
  const channelName = channel === 'inApp' ? t('settings.colInApp') : t('settings.colEmail')
  if (channel === 'email' && !setting.emailAvailable) {
    return (
      <span className="text-base text-subtle-foreground" aria-label={`${typeName} — ${channelName}: ${t('settings.notApplicable')}`} title={t('settings.notApplicable')}>
        —
      </span>
    )
  }
  const locked = channel === 'inApp' ? setting.inAppLocked : setting.emailLocked
  const unverified = channel === 'email' && !emailVerified
  const checked = setting[channel]

  return (
    <span className={cn('inline-flex items-center gap-2', unverified && 'opacity-40')}>
      <Switch
        size="md"
        checked={checked}
        disabled={locked || unverified}
        className={cn(locked && 'disabled:opacity-50')}
        aria-label={t('settings.toggle', { type: typeName, channel: channelName })}
        onCheckedChange={(value) => onChange({ type: setting.type, channel, value })}
        data-testid={`setting-${setting.type}-${channel}`}
      />
      {locked && <span className="text-[11px] font-medium text-muted-foreground">{t('settings.required')}</span>}
    </span>
  )
}

function VerifyBanner() {
  const { t } = useTranslation('notifications')
  const { resend, isPending, lockedFor } = useResendVerification()

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3" role="status">
      <MailWarningIcon className="size-5 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 flex-1 text-body-md text-foreground">{t('settings.verifyBanner')}</p>
      <Button variant="secondary" size="sm" onClick={resend} loading={isPending} disabled={lockedFor > 0}>
        {t('settings.resend')}
      </Button>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-0 rounded-panel border bg-surface" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-40 rounded-sm bg-card" />
            <Skeleton className="h-2.5 w-60 rounded-sm bg-card" />
          </div>
          <Skeleton className="h-6 w-10 rounded-full bg-card" />
          <Skeleton className="h-6 w-10 rounded-full bg-card" />
        </div>
      ))}
    </div>
  )
}

/**
 * /settings/notifications (24 · Cài đặt — Thông báo): type × in-app / e-mail, saved on every toggle (optimistic,
 * reverted with a toast on failure); e-mail column locked while the address is unverified.
 */
export function NotificationSettingsPage() {
  const { t } = useTranslation('notifications')
  const qc = useQueryClient()
  const { key, query } = useSettings()
  const desktop = useMediaQuery(MEDIA.md)

  const save = useMutation({
    mutationFn: (c: Change) => notificationsApi.updateSettings([{ type: c.type, [c.channel]: c.value }]),
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<NotificationSettings>(key)
      if (before) qc.setQueryData(key, applyChange(before, c))

      return { before }
    },
    onSuccess: (next) => {
      qc.setQueryData(key, next)
      toast.success(t('settings.saved'), { id: 'notification-settings' })
    },
    onError: (_e, _c, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before)
      toast.error(t('settings.saveFailed'), { id: 'notification-settings' })
    },
  })

  const data = query.data
  const onChange = (c: Change) => save.mutate(c)

  return (
    <div className="flex flex-col gap-5" data-testid="notification-settings">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-headline-md font-semibold text-foreground">{t('settings.title')}</h2>
        <p className="text-body-md text-muted-foreground">{t('settings.description')}</p>
      </div>
      {data && !data.emailVerified && <VerifyBanner />}
      {query.isPending ? (
        <SettingsSkeleton />
      ) : query.isError || !data ? (
        <ErrorPanel icon={BellOffIcon} title={t('settings.loadFailed')} onRetry={() => void query.refetch()} />
      ) : desktop ? (
        <table className="w-full overflow-hidden rounded-panel border-separate border-spacing-0 border bg-surface">
          <thead>
            <tr className="bg-card text-left text-label-sm font-semibold text-muted-foreground">
              <th scope="col" className="h-10 rounded-tl-panel px-5 font-semibold">{t('settings.colType')}</th>
              <th scope="col" className="w-35 px-2 font-semibold">{t('settings.colInApp')}</th>
              <th scope="col" className="w-35 rounded-tr-panel px-2 font-semibold">{t('settings.colEmail')}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((s) => (
              <tr key={s.type} className="[&>td]:border-t">
                <td className="px-5 py-3.5">
                  <p className="text-body-md font-medium text-foreground">{t(`settings.types.${s.type}`)}</p>
                  <p className="text-[13px] leading-4.75 text-muted-foreground">{t(`settings.descriptions.${s.type}`)}</p>
                </td>
                <td className="px-2">
                  <Cell setting={s} channel="inApp" emailVerified={data.emailVerified} onChange={onChange} />
                </td>
                <td className="px-2">
                  <Cell setting={s} channel="email" emailVerified={data.emailVerified} onChange={onChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((s) => (
            <li key={s.type} className="flex flex-col gap-1 rounded-panel border bg-surface p-4">
              <p className="text-body-md font-medium text-foreground">{t(`settings.types.${s.type}`)}</p>
              <p className="text-[13px] leading-4.75 text-muted-foreground">{t(`settings.descriptions.${s.type}`)}</p>
              <div className="mt-1 flex min-h-11 items-center justify-between">
                <span className="text-body-md text-foreground">{t('settings.colInApp')}</span>
                <Cell setting={s} channel="inApp" emailVerified={data.emailVerified} onChange={onChange} />
              </div>
              <div className="flex min-h-11 items-center justify-between">
                <span className="text-body-md text-foreground">{t('settings.colEmail')}</span>
                <Cell setting={s} channel="email" emailVerified={data.emailVerified} onChange={onChange} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-2 rounded-panel border bg-surface p-5" aria-labelledby="per-channel">
        <h3 id="per-channel" className="text-body-lg font-semibold text-foreground">
          {t('settings.perChannelTitle')}
        </h3>
        <p className="text-body-md text-muted-foreground">{t('settings.perChannelBody')}</p>
        <Link to="/following?tab=all" className="inline-flex w-fit items-center gap-1 text-label-md font-semibold text-primary hover:underline max-md:min-h-11">
          {t('settings.manageFollowing')}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  )
}
