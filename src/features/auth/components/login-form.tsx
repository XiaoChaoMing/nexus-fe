import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { useMessage } from '@/i18n/messages'
import { detailString, errorCode } from '@/lib/api-error'
import { errorKeyOf } from '@/lib/error-messages'
import { FormAlert } from '@/features/auth/components/form-alert'
import { LockedNotice } from '@/features/auth/components/locked-notice'
import { useLogin } from '@/features/auth/hooks/use-auth-mutations'
import { loginSchema, type LoginForm as LoginValues } from '@/features/auth/schemas/auth-schemas'

type LoginFormProps = {
  onSuccess?: () => void
  /** Called when a link leaves the current page (closes the modal). */
  onNavigate?: () => void
  autoFocus?: boolean
}

/** Shared by /login and the auth modal. */
export function LoginForm({ onSuccess, onNavigate, autoFocus = true }: LoginFormProps) {
  const { t } = useTranslation('auth')
  const msg = useMessage()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { login: '', password: '' } })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess })
  })

  if (errorCode(login.error) === 'ACCOUNT_LOCKED') {
    return <LockedNotice until={detailString(login.error, 'lockedUntil')} onRetry={() => login.reset()} onNavigate={onNavigate} />
  }

  // 429 is announced by the global toast with the wait time.
  const serverError = login.error && errorCode(login.error) !== 'RATE_LIMITED' ? (msg(errorKeyOf(login.error)) ?? null) : null

  return (
    <>
      <FormAlert message={serverError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('login.loginLabel')}
          autoComplete="username"
          autoFocus={autoFocus}
          error={msg(errors.login?.message)}
          {...register('login')}
        />
        <TextField
          label={t('login.passwordLabel')}
          autoComplete="current-password"
          revealLabels={{ show: t('password.show'), hide: t('password.hide') }}
          error={msg(errors.password?.message)}
          {...register('password')}
        />
        <Link to="/forgot-password" onClick={onNavigate} className="-mt-1 self-end text-label-sm font-semibold text-primary hover:underline">
          {t('login.forgot')}
        </Link>
        <Button type="submit" loading={login.isPending} className="mt-1 w-full">
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
    </>
  )
}
