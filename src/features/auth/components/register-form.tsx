import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { TextField } from '@/components/ui/text-field'
import { useMessage } from '@/i18n/messages'
import { errorCode, isApiError } from '@/lib/api-error'
import { errorKeyOf, takenFields } from '@/lib/error-messages'
import { FormAlert } from '@/features/auth/components/form-alert'
import { useRegister } from '@/features/auth/hooks/use-auth-mutations'
import { registerSchema, type RegisterForm as RegisterValues } from '@/features/auth/schemas/auth-schemas'

const TAKEN_KEY = { username: 'common:errors.USERNAME_TAKEN', email: 'common:errors.EMAIL_TAKEN' } as const

type RegisterFormProps = {
  onSuccess?: () => void
  autoFocus?: boolean
}

/** Shared by /register and the auth modal. */
export function RegisterForm({ onSuccess, autoFocus = true }: RegisterFormProps) {
  const { t } = useTranslation('auth')
  const msg = useMessage()
  const registerMutation = useRegister()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  })

  const onSubmit = handleSubmit(({ username, email, password, acceptTerms }) => {
    registerMutation.mutate(
      { username, email, password, acceptTerms },
      {
        onSuccess,
        onError: (err) => {
          const taken = takenFields(err)
          taken.forEach((field, i) => setError(field, { message: TAKEN_KEY[field] }, { shouldFocus: i === 0 }))
          if (isApiError(err) && err.details.acceptTerms) setError('acceptTerms', { message: 'auth:validation.acceptTerms' })
        },
      },
    )
  })

  const err = registerMutation.error
  const fieldHandled = takenFields(err).length > 0 || (isApiError(err) && Boolean(err.details.acceptTerms))
  const bannerError = err && !fieldHandled && errorCode(err) !== 'RATE_LIMITED' ? (msg(errorKeyOf(err)) ?? null) : null

  return (
    <>
      <FormAlert message={bannerError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('register.usernameLabel')}
          hint={t('register.usernameHint')}
          autoComplete="username"
          autoFocus={autoFocus}
          error={msg(errors.username?.message)}
          {...register('username')}
        />
        <TextField label={t('register.emailLabel')} type="email" autoComplete="email" error={msg(errors.email?.message)} {...register('email')} />
        <TextField
          label={t('register.passwordLabel')}
          hint={t('register.passwordHint')}
          autoComplete="new-password"
          revealLabels={{ show: t('password.show'), hide: t('password.hide') }}
          error={msg(errors.password?.message)}
          {...register('password')}
        />
        <TextField
          label={t('register.confirmPasswordLabel')}
          autoComplete="new-password"
          revealLabels={{ show: t('password.show'), hide: t('password.hide') }}
          error={msg(errors.confirmPassword?.message)}
          {...register('confirmPassword')}
        />
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <CheckboxField
              name={field.name}
              checked={field.value}
              onCheckedChange={field.onChange}
              error={msg(errors.acceptTerms?.message)}
              label={<Trans t={t} i18nKey="register.acceptTerms" components={{ b: <b className="font-semibold text-foreground" /> }} />}
            />
          )}
        />
        <Button type="submit" loading={registerMutation.isPending} className="mt-1 w-full">
          {registerMutation.isPending ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>
    </>
  )
}
