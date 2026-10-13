import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { ExternalLinkIcon, LogOutIcon, RadioIcon, SettingsIcon, SparklesIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/hooks/use-auth-mutations'
import { adminUrl, isAdmin, isCreator } from '@/features/auth/lib/roles'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { channelInitial } from '@/features/channels/lib/channel-display'

/** Pages that make no sense signed out; logging out there goes home instead of to a login prompt. */
const PRIVATE_PREFIXES = ['/studio', '/settings', '/creator']

export function UserMenu() {
  const { t } = useTranslation(['auth', 'common'])
  const user = useAuthStore((s) => s.user)
  const me = useAuthStore((s) => s.me)
  const show = useAuthModal((s) => s.show)
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) {
    // NXL-C BR27: guests get the two buttons instead of an avatar; both open the modal on this page.
    return (
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => show('login')} className="font-medium">
          {t('menu.login')}
        </Button>
        <Button onClick={() => show('register')}>{t('menu.register')}</Button>
      </div>
    )
  }

  const creator = isCreator(me)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full max-md:size-11" aria-label={t('menu.accountOf', { name: user.displayName })} data-testid="user-menu">
          <Avatar className="size-8 outline outline-border md:size-8.5">
            <AvatarFallback>{channelInitial({ displayName: user.displayName, handle: user.username })}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-label-md text-foreground">{user.displayName}</span>
          <span className="truncate text-body-sm font-normal text-muted-foreground">@{user.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {creator ? (
          <DropdownMenuItem asChild>
            <Link to="/studio/stream">
              <RadioIcon />
              {t('common:nav.studio')}
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link to="/creator/apply">
              <SparklesIcon />
              {t('menu.becomeCreator')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/settings/account">
            <SettingsIcon />
            {t('common:nav.accountSettings')}
          </Link>
        </DropdownMenuItem>
        {isAdmin(me) && (
          <DropdownMenuItem asChild>
            {/* Administration lives in the separate nexuslive-admin app; this bundle has no admin code. */}
            <a href={adminUrl()} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              {t('menu.admin')}
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logout.isPending}
          onSelect={() => {
            // AF-D04: stay on the current page as a guest, unless it is a private one (leave it first, so its
            // guard does not bounce to /login).
            if (PRIVATE_PREFIXES.some((p) => location.pathname.startsWith(p))) navigate('/', { replace: true })
            logout.mutate()
          }}
        >
          <LogOutIcon />
          {t('menu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
