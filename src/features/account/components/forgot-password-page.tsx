import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { MailCheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { useMessage } from '@/i18n/messages'
import { errorCode } from '@/lib/api-error'
import { errorKeyOf } from '@/lib/error-messages'
import { authApi } from '@/features/auth/api/auth-api'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { FormAlert } from '@/features/auth/components/form-alert'
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/features/auth/schemas/auth-schemas'

/** /forgot-password (NXL-D §3.3): the answer is the same whether the email exists or not (BR-D07). */
export function ForgotPasswordPage() {
  const { t } = useTranslation(['account', 'auth'])
  const msg = useMessage()
  const forgot = useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })

  const serverError = forgot.error && errorCode(forgot.error) !== 'RATE_LIMITED' ? (msg(errorKeyOf(forgot.error)) ?? null) : null

  return (
    <AuthLayout
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}
      footer={
        <Link to="/login" className="font-semibold text-primary hover:text-primary-hover">
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      {forgot.isSuccess ? (
        <div role="status" className="flex flex-col items-center gap-3 text-center" data-testid="forgot-sent">
          <MailCheckIcon className="size-10 text-success" aria-hidden />
          <p className="text-body-sm text-muted-foreground">{t('forgot.sent')}</p>
        </div>
      ) : (
        <>
          <FormAlert message={serverError} />
          <form onSubmit={handleSubmit(({ email }) => forgot.mutate(email))} noValidate className="flex flex-col gap-4">
            <TextField label={t('auth:register.emailLabel')} type="email" autoComplete="email" autoFocus error={msg(errors.email?.message)} {...register('email')} />
            <Button type="submit" loading={forgot.isPending} className="w-full">
              {t('forgot.submit')}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
