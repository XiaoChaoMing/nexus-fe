import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BellIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon, RadioIcon, SearchIcon } from 'lucide-react'
import { LanguageMenu } from '@/app/shell/language-menu'
import { useSidebarToggle } from '@/app/shell/use-sidebar-toggle'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserMenu } from '@/features/auth/components/user-menu'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { unreadBadge } from '@/features/auth/lib/roles'
import { useAuthStore } from '@/features/auth/stores/auth-store'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-heading text-headline-sm text-foreground">
      <span className="grid size-7 place-items-center rounded-control bg-primary text-primary-foreground" aria-hidden>
        <RadioIcon className="size-4" />
      </span>
      <span>
        Nexus<span className="text-primary">Live</span>
      </span>
    </Link>
  )
}

/** Notifications arrive in GĐ5; the bell already shows the count from `/v1/me` (0 until then). */
function NotificationBell() {
  const { t } = useTranslation()
  const unread = useAuthStore((s) => s.me?.unreadNotifications ?? 0)
  const badge = unreadBadge(unread)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={badge ? t('notifications.labelCount', { count: unread }) : t('notifications.label')}>
          <BellIcon />
          {badge && (
            <span className="absolute top-1 right-1 min-w-4 rounded-full bg-live px-1 text-[10px] leading-4 font-bold text-white" aria-hidden>
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-body-sm text-muted-foreground">
        {t('notifications.empty')}
      </PopoverContent>
    </Popover>
  )
}

export function TopBar() {
  const { t } = useTranslation()
  const { collapsed, toggle } = useSidebarToggle()
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const gated = useGatedAction()

  return (
    <header className="sticky top-0 z-30 flex h-15 items-center gap-3 border-b bg-surface px-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        aria-expanded={!collapsed}
        className="hidden md:inline-flex"
      >
        {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
      </Button>
      <Logo />
      <Link
        to="/search"
        className="mx-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-background px-3 text-body-sm text-subtle-foreground hover:border-border-strong lg:flex"
      >
        <SearchIcon className="size-4" aria-hidden />
        {t('nav.searchPlaceholder')}
      </Link>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:ml-0">
        {/* NXL-C BR28: Creator → Studio, Viewer → Creator application, Guest → login modal. */}
        <Button onClick={() => gated({ type: 'goLive' })} data-testid="go-live" aria-label={t('nav.goLive')} className="max-sm:size-10 max-sm:px-0">
          <PlusIcon />
          <span className="max-sm:sr-only">{t('nav.goLive')}</span>
        </Button>
        {signedIn && <NotificationBell />}
        <LanguageMenu />
        <UserMenu />
      </div>
    </header>
  )
}
