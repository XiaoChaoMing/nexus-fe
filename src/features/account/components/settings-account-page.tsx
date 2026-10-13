import { useId, useMemo, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CircleCheckIcon, MailWarningIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TextField } from '@/components/ui/text-field'
import { changeLanguage } from '@/i18n'
import { useMessage } from '@/i18n/messages'
import { SUPPORTED_LANGUAGES, type Language } from '@/i18n/resources'
import { errorCode, isApiError } from '@/lib/api-error'
import { errorKeyOf } from '@/lib/error-messages'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { profileSchema, type ProfileForm } from '@/features/account/schemas/profile-schema'
import { useResendVerification } from '@/features/account/hooks/use-resend-verification'
import { meApi } from '@/features/auth/api/auth-api'
import { normalizeMe } from '@/features/auth/lib/roles'
import { completeSignIn } from '@/features/auth/lib/session'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { changePasswordSchema, type ChangePasswordForm } from '@/features/auth/schemas/auth-schemas'
import type { User } from '@/features/auth/types'
import { toIsoDate } from '@/features/creator/schemas/application-schema'

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-xl border bg-surface p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-heading text-headline-sm">
          {title}
        </h2>
        {description && <p className="text-body-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const SELECT_CLASS =
  'h-10 w-full rounded-lg border border-input bg-surface px-3 text-body-md text-foreground outline-none focus-visible:border-primary aria-invalid:border-destructive'

function timeZones(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  if (!zones.includes(current)) zones = [current, ...zones]

  return zones.includes('UTC') ? zones : [...zones, 'UTC']
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
  } catch {
    return 'Asia/Ho_Chi_Minh'
  }
}

function ProfileSection({ user }: { user: User }) {
  const { t } = useTranslation(['account', 'common'])
  const msg = useMessage()
  const setMe = useAuthStore((s) => s.setMe)
  const localeId = useId()
  const tzId = useId()
  const hasBirthDate = Boolean(user.birthDate)
  const initialTz = user.timezone || browserTimeZone()
  const zones = useMemo(() => timeZones(initialTz), [initialTz])
  const [today] = useState(() => toIsoDate(new Date()))
  const schema = useMemo(() => profileSchema(), [])
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user.displayName,
      birthDate: '',
      locale: (SUPPORTED_LANGUAGES as readonly string[]).includes(user.locale ?? '') ? (user.locale as Language) : 'vi',
      timezone: initialTz,
    },
  })

  const save = useMutation({
    mutationFn: meApi.update,
    onSuccess: (raw, body) => {
      if (raw?.user) setMe(normalizeMe(raw))
      if (body.locale) void changeLanguage(body.locale as Language)
      toast.success(t('profile.saved'))
    },
    onError: (err) => {
      if (isApiError(err) && errorCode(err) === 'VALIDATION_FAILED') {
        for (const f of ['displayName', 'birthDate', 'locale', 'timezone'] as const) {
          if (err.details[f]) setError(f, { message: 'common:errors.VALIDATION_FAILED' })
        }
      } else if (errorCode(err) !== 'RATE_LIMITED') {
        toast.error(msg(errorKeyOf(err)))
      }
    },
  })

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      {
        displayName: values.displayName.trim(),
        locale: values.locale,
        timezone: values.timezone,
        // Only settable while empty (TSD §4.1); afterwards it comes from the Creator application.
        ...(!hasBirthDate && values.birthDate ? { birthDate: values.birthDate } : {}),
      },
      { onSuccess: () => reset({ ...values, birthDate: '' }) },
    )
  })

  return (
    <Section id="settings-profile" title={t('profile.title')} description={t('profile.description')}>
      <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
        <div>
          <dt className="text-subtle-foreground">{t('profile.username')}</dt>
          <dd className="font-semibold">@{user.username}</dd>
        </div>
        <div>
          <dt className="text-subtle-foreground">{t('profile.joined')}</dt>
          <dd>{formatDate(user.createdAt, { dateStyle: 'long' })}</dd>
        </div>
      </dl>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField label={t('profile.displayName')} hint={t('profile.displayNameHint')} maxLength={50} error={msg(errors.displayName?.message)} {...register('displayName')} />
        {hasBirthDate ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('profile.birthDate')}</span>
            <span className="text-body-sm text-muted-foreground">
              {formatDate(`${user.birthDate}T00:00:00`, { dateStyle: 'long' })} · {t('profile.birthDateLocked')}
            </span>
          </div>
        ) : (
          <TextField
            label={t('profile.birthDate')}
            type="date"
            max={today}
            hint={t('profile.birthDateHint')}
            error={msg(errors.birthDate?.message)}
            {...register('birthDate')}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={localeId}>{t('profile.locale')}</Label>
            <select id={localeId} className={SELECT_CLASS} {...register('locale')}>
              {SUPPORTED_LANGUAGES.map((lng) => (
                <option key={lng} value={lng}>
                  {t(`common:language.${lng}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={tzId}>{t('profile.timezone')}</Label>
            <select id={tzId} className={SELECT_CLASS} aria-invalid={errors.timezone ? true : undefined} {...register('timezone')}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" loading={save.isPending} disabled={!isDirty} className="self-start">
          {t('profile.save')}
        </Button>
      </form>
    </Section>
  )
}

function EmailSection({ user }: { user: User }) {
  const { t } = useTranslation('account')
  const { resend, isPending, lockedFor } = useResendVerification()

  return (
    <Section id="settings-email" title={t('email.title')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{user.email}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-label-sm font-semibold',
            user.emailVerified ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}
          data-testid="email-status"
        >
          {user.emailVerified ? <CircleCheckIcon className="size-3.5" aria-hidden /> : <MailWarningIcon className="size-3.5" aria-hidden />}
          {user.emailVerified ? t('email.verified') : t('email.unverified')}
        </span>
      </div>
      {!user.emailVerified && (
        <Button variant="secondary" className="self-start" onClick={resend} loading={isPending} disabled={lockedFor > 0}>
          {lockedFor > 0 ? t('verifyBanner.resendIn', { count: lockedFor }) : t('verifyBanner.resend')}
        </Button>
      )}
    </Section>
  )
}

function PasswordSection() {
  const { t } = useTranslation(['account', 'auth'])
  const msg = useMessage()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const change = useMutation({
    // BR-D08: every other session is revoked; this one continues with the new token.
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => completeSignIn(await meApi.changePassword(body)),
    onSuccess: () => {
      reset()
      toast.success(t('password.changed'))
    },
    onError: (err) => {
      const code = errorCode(err)
      if (code === 'WRONG_PASSWORD') setError('currentPassword', { message: 'common:errors.WRONG_PASSWORD' }, { shouldFocus: true })
      else if (code === 'VALIDATION_FAILED') setError('newPassword', { message: 'auth:validation.passwordComposition' })
      else if (code !== 'RATE_LIMITED') toast.error(msg(errorKeyOf(err)))
    },
  })

  const reveal = { show: t('auth:password.show'), hide: t('auth:password.hide') }

  return (
    <Section id="settings-password" title={t('password.title')} description={t('password.description')}>
      <form
        onSubmit={handleSubmit(({ currentPassword, newPassword }) => change.mutate({ currentPassword, newPassword }))}
        noValidate
        className="flex flex-col gap-4"
      >
        <TextField label={t('password.current')} autoComplete="current-password" revealLabels={reveal} error={msg(errors.currentPassword?.message)} {...register('currentPassword')} />
        <TextField
          label={t('password.new')}
          hint={t('auth:register.passwordHint')}
          autoComplete="new-password"
          revealLabels={reveal}
          error={msg(errors.newPassword?.message)}
          {...register('newPassword')}
        />
        <TextField label={t('password.confirm')} autoComplete="new-password" revealLabels={reveal} error={msg(errors.confirmPassword?.message)} {...register('confirmPassword')} />
        <Button type="submit" loading={change.isPending} className="self-start">
          {t('password.submit')}
        </Button>
      </form>
    </Section>
  )
}

/** /settings/account (NXL-D §3.9). */
export function SettingsAccountPage() {
  const { t } = useTranslation('account')
  const user = useAuthStore((s) => s.user)

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <h1 className="font-heading text-headline-lg">{t('title')}</h1>
      <ProfileSection key={user.id} user={user} />
      <EmailSection user={user} />
      <PasswordSection />
    </div>
  )
}
