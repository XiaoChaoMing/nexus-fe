import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { RegisterForm } from '@/features/auth/components/register-form'

export function RegisterPage() {
  const { t } = useTranslation('auth')
  const location = useLocation()

  return (
    <AuthLayout
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <>
          {t('register.hasAccount')}{' '}
          <Link to={{ pathname: '/login', search: location.search }} state={location.state} className="font-semibold text-primary hover:text-primary-hover">
            {t('register.toLogin')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  )
}
