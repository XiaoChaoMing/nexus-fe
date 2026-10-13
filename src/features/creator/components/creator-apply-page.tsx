import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { CircleCheckIcon, ClockIcon, Loader2Icon, MailWarningIcon, RadioIcon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TextField } from '@/components/ui/text-field'
import { Textarea } from '@/components/ui/textarea'
import { useMessage } from '@/i18n/messages'
import { errorCode, isApiError } from '@/lib/api-error'
import { errorKeyOf } from '@/lib/error-messages'
import { formatDate } from '@/lib/format'
import { useResendVerification } from '@/features/account/hooks/use-resend-verification'
import { FormAlert } from '@/features/auth/components/form-alert'
import { isCreator } from '@/features/auth/lib/roles'
import { loadMe } from '@/features/auth/lib/session'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { creatorKeys, useCancelApplication, useMyApplication, useSubmitApplication } from '@/features/creator/hooks/use-creator-application'
import { applicationSchema, NOTE_MAX, toIsoDate, type ApplicationForm } from '@/features/creator/schemas/application-schema'
import type { CreatorApplication } from '@/features/creator/types'

/** After approval channel-svc creates the channel within seconds; /v1/me is polled until it appears. */
const CHANNEL_POLL = 3_000

function Card({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-surface p-5 md:p-6" data-testid={testId}>
      {children}
    </section>
  )
}

function AlreadyCreator() {
  const { t } = useTranslation('creator')

  return (
    <Card testId="creator-already">
      <div className="flex items-center gap-3">
        <CircleCheckIcon className="size-6 text-success" aria-hidden />
        <h2 className="font-heading text-headline-sm">{t('already.title')}</h2>
      </div>
      <p className="text-body-sm text-muted-foreground">{t('already.body')}</p>
      <Button asChild className="self-start">
        <Link to="/studio/stream">
          <RadioIcon />
          {t('already.openStudio')}
        </Link>
      </Button>
    </Card>
  )
}

/** APPROVED but the channel is not there yet: poll /v1/me, then open the Studio. */
function CreatingChannel() {
  const { t } = useTranslation('creator')
  const navigate = useNavigate()
  const creator = useAuthStore((s) => isCreator(s.me))

  useEffect(() => {
    if (creator) {
      navigate('/studio/stream', { replace: true })

      return
    }
    void loadMe()
    const id = window.setInterval(() => void loadMe(), CHANNEL_POLL)

    return () => window.clearInterval(id)
  }, [creator, navigate])

  return (
    <Card testId="creator-creating">
      <div className="flex items-center gap-3">
        <Loader2Icon className="size-6 animate-spin text-primary" aria-hidden />
        <h2 className="font-heading text-headline-sm">{t('creating.title')}</h2>
      </div>
      <p className="text-body-sm text-muted-foreground" role="status">
        {t('creating.body')}
      </p>
    </Card>
  )
}

function PendingCard({ app }: { app: CreatorApplication }) {
  const { t } = useTranslation('creator')
  const msg = useMessage()
  const cancel = useCancelApplication()
  const [confirm, setConfirm] = useState(false)

  return (
    <Card testId="creator-pending">
      <div className="flex items-center gap-3">
        <ClockIcon className="size-6 text-warning" aria-hidden />
        <h2 className="font-heading text-headline-sm">{t('pending.title')}</h2>
      </div>
      <p className="text-body-sm text-muted-foreground">{t('pending.body')}</p>
      <dl className="grid gap-3 rounded-lg bg-card p-4 text-body-sm sm:grid-cols-2">
        <div>
          <dt className="text-subtle-foreground">{t('form.legalName')}</dt>
          <dd className="font-semibold">{app.legalName}</dd>
        </div>
        <div>
          <dt className="text-subtle-foreground">{t('pending.submittedAt')}</dt>
          <dd>{formatDate(app.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
        </div>
      </dl>
      <Button variant="secondary" className="self-start" onClick={() => setConfirm(true)}>
        {t('pending.cancel')}
      </Button>
      <ConfirmDialog
        open={confirm}
        title={t('pending.cancelTitle')}
        confirmLabel={t('pending.cancelConfirm')}
        danger
        loading={cancel.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          cancel.mutate(app.id, {
            onSuccess: () => toast.success(t('pending.cancelled')),
            // INVALID_STATE: reviewed meanwhile; the list refetch shows the new state.
            onError: (err) => toast.error(msg(errorKeyOf(err))),
            onSettled: () => setConfirm(false),
          })
        }
      >
        {t('pending.cancelBody')}
      </ConfirmDialog>
    </Card>
  )
}

function UnverifiedNotice() {
  const { t } = useTranslation(['creator', 'account'])
  const { resend, isPending, lockedFor } = useResendVerification()

  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-body-sm" data-testid="creator-unverified">
      <MailWarningIcon className="size-4 text-warning" aria-hidden />
      <span className="min-w-0 flex-1">{t('creator:unverified')}</span>
      <Button size="sm" variant="secondary" onClick={resend} loading={isPending} disabled={lockedFor > 0}>
        {lockedFor > 0 ? t('account:verifyBanner.resendIn', { count: lockedFor }) : t('account:verifyBanner.resend')}
      </Button>
    </div>
  )
}

const FIELD_DETAILS = ['legalName', 'birthDate', 'note', 'acceptCreatorTerms'] as const

function ApplicationFormCard({ previous }: { previous: CreatorApplication | null }) {
  const { t } = useTranslation('creator')
  const msg = useMessage()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const submit = useSubmitApplication()
  const noteId = useId()
  const [today] = useState(() => toIsoDate(new Date()))
  const schema = useMemo(() => applicationSchema(), [])
  const rejected = previous?.status === 'REJECTED'
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ApplicationForm>({
    resolver: zodResolver(schema),
    // AF-D06: a resubmission starts from the rejected application.
    defaultValues: {
      legalName: rejected ? previous.legalName : '',
      birthDate: rejected ? previous.birthDate : (user?.birthDate ?? ''),
      note: rejected ? (previous.note ?? '') : '',
      acceptCreatorTerms: false,
    },
  })

  const onSubmit = handleSubmit((values) => {
    submit.mutate(
      { legalName: values.legalName.trim(), birthDate: values.birthDate, note: values.note.trim() || undefined, acceptCreatorTerms: values.acceptCreatorTerms },
      {
        onSuccess: () => toast.success(t('form.submitted')),
        onError: (err) => {
          const code = errorCode(err)
          if (code === 'UNDERAGE') setError('birthDate', { message: 'common:errors.UNDERAGE' }, { shouldFocus: true })
          if (code === 'APPLICATION_PENDING') void qc.invalidateQueries({ queryKey: creatorKeys.application })
          if (code === 'ALREADY_CREATOR') void loadMe()
          if (code === 'VALIDATION_FAILED' && isApiError(err)) {
            for (const f of FIELD_DETAILS) if (err.details[f]) setError(f, { message: 'common:errors.VALIDATION_FAILED' })
          }
        },
      },
    )
  })

  const code = errorCode(submit.error)
  const banner = submit.error && !['UNDERAGE', 'RATE_LIMITED', 'VALIDATION_FAILED'].includes(code) ? (msg(errorKeyOf(submit.error)) ?? null) : null

  return (
    <Card testId="creator-form">
      {rejected && (
        <div role="alert" className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body-sm" data-testid="creator-rejected">
          <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t('rejected.title')}</span>
            {previous.rejectReason && <span className="text-muted-foreground">{t('rejected.reason', { reason: previous.rejectReason })}</span>}
            <span className="text-muted-foreground">{t('rejected.resubmit')}</span>
          </div>
        </div>
      )}
      {previous?.status === 'CANCELLED' && <p className="text-body-sm text-muted-foreground">{t('cancelledBefore')}</p>}
      {user && !user.emailVerified && <UnverifiedNotice />}
      <FormAlert message={banner} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-body-sm text-muted-foreground">{t('form.handle', { handle: user?.username.toLowerCase() ?? '' })}</p>
        <TextField label={t('form.legalName')} hint={t('form.legalNameHint')} autoComplete="name" error={msg(errors.legalName?.message)} {...register('legalName')} />
        <TextField
          label={t('form.birthDate')}
          type="date"
          max={today}
          hint={t('form.birthDateHint')}
          error={msg(errors.birthDate?.message)}
          {...register('birthDate')}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={noteId}>{t('form.note')}</Label>
          <Textarea id={noteId} rows={3} maxLength={NOTE_MAX} aria-invalid={errors.note ? true : undefined} {...register('note')} />
          {errors.note && <p className="text-label-sm text-destructive">{msg(errors.note.message)}</p>}
        </div>
        <Controller
          control={control}
          name="acceptCreatorTerms"
          render={({ field }) => (
            <CheckboxField
              name={field.name}
              checked={field.value}
              onCheckedChange={field.onChange}
              error={msg(errors.acceptCreatorTerms?.message)}
              label={<Trans t={t} i18nKey="form.terms" components={{ b: <b className="font-semibold text-foreground" /> }} />}
            />
          )}
        />
        <Button type="submit" loading={submit.isPending} className="self-start">
          {rejected ? t('form.resubmit') : t('form.submit')}
        </Button>
      </form>
    </Card>
  )
}

/** /creator/apply — Creator application (NXL-D §3.4, AF-D06/AF-D07). */
export function CreatorApplyPage() {
  const { t } = useTranslation(['creator', 'common'])
  const creator = useAuthStore((s) => isCreator(s.me))
  const app = useMyApplication(!creator)
  const navigate = useNavigate()
  // Set while this page waits for a review or for the channel; becoming a Creator then opens the Studio.
  const waiting = useRef(false)
  const status = app.data?.status

  useEffect(() => {
    if (!creator && (status === 'PENDING' || status === 'APPROVED')) waiting.current = true
    if (creator && waiting.current) navigate('/studio/stream', { replace: true })
  }, [creator, status, navigate])

  let body: ReactNode
  if (creator) body = <AlreadyCreator />
  else if (app.isPending) body = <Skeleton className="h-72 rounded-xl" />
  else if (app.isError) {
    body = (
      <Card>
        <p role="alert">{t('loadFailed')}</p>
        <Button variant="secondary" className="self-start" onClick={() => void app.refetch()}>
          {t('common:actions.retry')}
        </Button>
      </Card>
    )
  } else if (app.data?.status === 'PENDING') body = <PendingCard app={app.data} />
  else if (app.data?.status === 'APPROVED') body = <CreatingChannel />
  else body = <ApplicationFormCard key={app.data?.id ?? 'new'} previous={app.data ?? null} />

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-headline-lg">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      {body}
    </div>
  )
}
