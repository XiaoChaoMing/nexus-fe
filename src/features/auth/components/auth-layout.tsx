import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LanguageMenu } from '@/app/shell/language-menu'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { t } = useTranslation()

  return (
    <main className="relative grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="absolute top-3 right-3">
        <LanguageMenu />
      </div>
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-semibold text-foreground">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
            ▶
          </span>
          {t('brand')}
        </Link>
        <section className="rounded-panel border border-border bg-card p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </main>
  )
}
