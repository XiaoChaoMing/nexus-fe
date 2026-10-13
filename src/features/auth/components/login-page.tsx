import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { LoginForm } from '@/features/auth/components/login-form'

/** /login deep link; `?returnTo=` (or the router state of a guard) decides where to go afterwards (GuestOnly). */
export function LoginPage() {
  const { t } = useTranslation('auth')
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice === 'passwordReset' ? t('reset.doneLogin') : null

  return (
    <AuthLayout
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link to={{ pathname: '/register', search: location.search }} state={location.state} className="font-semibold text-primary hover:text-primary-hover">
            {t('login.toRegister')}
          </Link>
        </>
      }
    >
      {notice && (
        <p role="status" className="mb-4 rounded-control border border-success/50 bg-success/10 px-3 py-2.5 text-body-sm">
          {notice}
        </p>
      )}
      <LoginForm />
    </AuthLayout>
  )
}
