import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router'
import { BellIcon, PlusIcon, RadioIcon, SearchIcon } from 'lucide-react'
import { LanguageMenu } from '@/app/shell/language-menu'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserMenu } from '@/features/auth/components/user-menu'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { unreadBadge } from '@/features/auth/lib/roles'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 rounded-control font-heading text-lg font-bold text-foreground md:text-[19px]">
      <span className="grid size-7 place-items-center rounded-control bg-primary/12 text-primary" aria-hidden>
        <RadioIcon className="size-4.5" />
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
        <Button variant="ghost" size="icon" className="relative max-md:size-11" aria-label={badge ? t('notifications.labelCount', { count: unread }) : t('notifications.label')}>
          <BellIcon className="size-5.5" />
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

/** Guests on a phone get one "Đăng nhập" button (Top Nav/Mobile — Khách). */
function GuestMobileLogin() {
  const { t } = useTranslation('auth')
  const show = useAuthModal((s) => s.show)

  return (
    <Button className="h-11 px-4 md:hidden" onClick={() => show('login')}>
      {t('menu.login')}
    </Button>
  )
}

const topLink = 'rounded-control text-label-md text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground'

/**
 * Top Nav (GĐ2 frames): logo, Khám phá / Đang theo dõi from 1280 px, search with Ctrl+K, "Phát trực tiếp"
 * (icon only on tablets), bell + avatar or Đăng nhập/Đăng ký. Phones: logo, bell, avatar; it scrolls away so
 * the player can stick to the top on the live page.
 */
export function TopBar() {
  const { t } = useTranslation()
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const gated = useGatedAction()
  const openSearch = useUiStore((s) => s.setSearchOpen)

  return (
    <header className="z-30 flex h-14 items-center gap-3 border-b bg-surface pr-2 pl-4 md:sticky md:top-0 md:h-16 md:gap-6 md:px-4 xl:px-6">
      <div className="flex items-center gap-7">
        <Logo />
        <nav aria-label={t('nav.main')} className="hidden items-center gap-7 xl:flex">
          <NavLink to="/browse" className={topLink}>
            {t('nav.browse')}
          </NavLink>
          <NavLink to="/following" className={topLink}>
            {t('nav.following')}
          </NavLink>
        </nav>
      </div>
      <button
        type="button"
        onClick={() => openSearch(true)}
        aria-label={t('nav.searchOpen')}
        aria-haspopup="dialog"
        data-testid="search-trigger"
        className="mx-auto hidden h-10 w-full max-w-md min-w-0 items-center gap-2.5 rounded-lg border bg-surface px-3 text-left text-body-md text-subtle-foreground outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring md:flex"
      >
        <SearchIcon className="size-5 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{t('nav.searchPlaceholder')}</span>
        <Kbd className="hidden h-auto border bg-transparent px-1.5 py-0.5 text-[11px] font-normal text-subtle-foreground lg:inline-flex">Ctrl+K</Kbd>
      </button>
      <div className={cn('ml-auto flex items-center gap-1 md:ml-0 md:gap-3')}>
        {/* NXL-C BR28: Creator → Studio, Viewer → Creator application, Guest → login modal. */}
        <Button onClick={() => gated({ type: 'goLive' })} data-testid="go-live" aria-label={t('nav.goLive')} className="hidden md:inline-flex max-xl:size-10 max-xl:px-0">
          <PlusIcon />
          <span className="max-xl:sr-only">{t('nav.goLive')}</span>
        </Button>
        {signedIn && <NotificationBell />}
        <LanguageMenu />
        {!signedIn && <GuestMobileLogin />}
        <div className={cn(!signedIn && 'max-md:hidden')}>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
