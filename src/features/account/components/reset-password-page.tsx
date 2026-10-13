import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { useMessage } from '@/i18n/messages'
import { errorCode } from '@/lib/api-error'
import { errorKeyOf } from '@/lib/error-messages'
import { useUrlToken } from '@/features/account/hooks/use-url-token'
import { authApi } from '@/features/auth/api/auth-api'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { FormAlert } from '@/features/auth/components/form-alert'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { resetPasswordSchema, type ResetPasswordForm } from '@/features/auth/schemas/auth-schemas'

/** /reset-password?token= (NXL-D §3.3): every session is revoked, so the user signs in again afterwards. */
export function ResetPasswordPage() {
  const { t } = useTranslation(['account', 'auth'])
  const msg = useMessage()
  const token = useUrlToken()
  const navigate = useNavigate()
  const clear = useAuthStore((s) => s.clear)
  const qc = useQueryClient()
  const reset = useMutation({
    mutationFn: (password: string) => authApi.resetPassword(token ?? '', password),
    onSuccess: () => {
      clear()
      qc.clear()
      navigate('/login', { replace: true, state: { notice: 'passwordReset' } })
    },
  })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' } })

  const invalid = !token || errorCode(reset.error) === 'TOKEN_INVALID'
  const serverError = reset.error && !invalid && errorCode(reset.error) !== 'RATE_LIMITED' ? (msg(errorKeyOf(reset.error)) ?? null) : null

  return (
    <AuthLayout
      title={invalid ? t('reset.invalidTitle') : t('reset.title')}
      subtitle={invalid ? t('reset.invalidBody') : t('reset.subtitle')}
      footer={
        <Link to="/login" className="font-semibold text-primary hover:text-primary-hover">
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      {invalid ? (
        <Button asChild className="w-full">
          <Link to="/forgot-password">{t('reset.requestNew')}</Link>
        </Button>
      ) : (
        <>
          <FormAlert message={serverError} />
          <form onSubmit={handleSubmit(({ password }) => reset.mutate(password))} noValidate className="flex flex-col gap-4">
            <TextField
              label={t('reset.password')}
              hint={t('auth:register.passwordHint')}
              autoComplete="new-password"
              autoFocus
              revealLabels={{ show: t('auth:password.show'), hide: t('auth:password.hide') }}
              error={msg(errors.password?.message)}
              {...register('password')}
            />
            <TextField
              label={t('auth:register.confirmPasswordLabel')}
              autoComplete="new-password"
              revealLabels={{ show: t('auth:password.show'), hide: t('auth:password.hide') }}
              error={msg(errors.confirmPassword?.message)}
              {...register('confirmPassword')}
            />
            <Button type="submit" loading={reset.isPending} className="w-full">
              {t('reset.submit')}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
