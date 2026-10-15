import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { BellIcon, ShieldIcon, UserRoundIcon, UserRoundXIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = { to: string; label: 'settingsNav.profile' | 'settingsNav.security' | 'settingsNav.notifications' | 'settingsNav.privacy'; icon: LucideIcon; active: (path: string, hash: string) => boolean }

const TABS: Tab[] = [
  { to: '/settings/account', label: 'settingsNav.profile', icon: UserRoundIcon, active: (p, h) => p === '/settings/account' && h !== '#security' },
  { to: '/settings/account#security', label: 'settingsNav.security', icon: ShieldIcon, active: (p, h) => p === '/settings/account' && h === '#security' },
  { to: '/settings/notifications', label: 'settingsNav.notifications', icon: BellIcon, active: (p) => p === '/settings/notifications' },
  { to: '/settings/privacy', label: 'settingsNav.privacy', icon: UserRoundXIcon, active: (p) => p === '/settings/privacy' },
]

/**
 * Settings frame (frames 24 / 26): "Cài đặt" with a 220 px tab column on desktop and a scrolling tab strip on
 * phones. "Tài khoản & bảo mật" is the e-mail + password part of the account page.
 */
export function SettingsLayout() {
  const { t } = useTranslation()
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash === '#security') document.getElementById('security')?.scrollIntoView({ block: 'start' })
  }, [hash, pathname])

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8 xl:px-10">
      <h1 className="font-heading text-[28px] leading-9 font-bold text-foreground max-md:text-headline-md">{t('settingsNav.title')}</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <nav aria-label={t('settingsNav.label')} className="-mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-55 lg:flex-col lg:px-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = tab.active(pathname, hash)

            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-label-md whitespace-nowrap text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-lg:h-11',
                  active && 'bg-card font-semibold text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(tab.label)}
              </Link>
            )
          })}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
