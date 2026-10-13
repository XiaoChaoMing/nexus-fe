import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useNavigate } from 'react-router'
import { HeartIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { channelName } from '@/features/channels/lib/channel-display'
import { useLiveStreams } from '@/features/streams/hooks/use-streams'
import { useUiStore } from '@/stores/ui-store'
import { MAIN_NAV, SETTINGS_NAV, type NavItem } from './nav-items'
import { suggestedChannels } from './suggested-channels'

function WithTooltip({ collapsed, label, children }: { collapsed: boolean; label: string; children: ReactElement }) {
  if (!collapsed) return children

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation()
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const gated = useGatedAction()
  const navigate = useNavigate()
  const Icon = item.icon
  const label = t(item.label)

  return (
    <WithTooltip collapsed={collapsed} label={label}>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        aria-label={collapsed ? label : undefined}
        onClick={(e) => {
          if (!item.gated || signedIn) return
          // AF03: the guest still sees the intro page, with the login modal on top.
          e.preventDefault()
          navigate(item.to)
          gated({ type: 'navigate', params: { to: item.to }, returnTo: item.to })
        }}
        // Static class with aria-current styling: Radix Slot (tooltip trigger) cannot merge a className function.
        className={cn(
          'flex h-10 items-center gap-3 rounded-control px-3 text-label-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          'aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:[&_svg]:text-primary',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        {!collapsed && <span className="truncate">{label}</span>}
      </NavLink>
    </WithTooltip>
  )
}

function SuggestedChannels({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation()
  const { data } = useLiveStreams()
  const items = suggestedChannels(data?.items)

  if (items.length === 0) {
    return collapsed ? null : <p className="px-3 text-body-sm text-subtle-foreground">{t('sidebar.noSuggestions')}</p>
  }

  return (
    <ul className="flex flex-col gap-0.5" data-testid="suggested-channels">
      {items.map((s) => {
        const name = channelName(s.channel) ?? s.title

        return (
          <li key={s.id}>
            <WithTooltip collapsed={collapsed} label={name}>
              <Link
                to={`/live/${s.id}`}
                aria-label={collapsed ? name : undefined}
                className={cn('flex h-11 items-center gap-2.5 rounded-control px-2 hover:bg-accent', collapsed && 'justify-center px-0')}
              >
                <ChannelAvatar channel={s.channel} size="sm" live />
                {!collapsed && (
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-label-md text-foreground">{name}</span>
                    {s.channel && <span className="truncate text-label-sm text-subtle-foreground">{s.title}</span>}
                  </span>
                )}
                {!collapsed && <span className="size-2 shrink-0 rounded-full bg-live" aria-label={t('status.live')} />}
              </Link>
            </WithTooltip>
          </li>
        )
      })}
    </ul>
  )
}

function GuestInvite() {
  const { t } = useTranslation()
  const show = useAuthModal((s) => s.show)

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-card p-3" data-testid="sidebar-login-invite">
      <p className="text-body-sm text-muted-foreground">{t('sidebar.loginInvite')}</p>
      <Button size="sm" onClick={() => show('login')}>
        {t('auth.login')}
      </Button>
    </div>
  )
}

export function Sidebar() {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const signedIn = useAuthStore((s) => s.status === 'authenticated')

  return (
    <aside
      aria-label={t('nav.main')}
      className={cn(
        'sticky top-15 hidden h-[calc(100dvh-3.75rem)] shrink-0 flex-col overflow-y-auto border-r bg-surface p-3 transition-[width] md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <nav className="flex flex-col gap-1">
        {MAIN_NAV.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="my-3 border-t" />

      {signedIn ? (
        <section aria-labelledby="sidebar-following">
          {!collapsed && (
            <h2 id="sidebar-following" className="px-3 pb-2 text-label-sm font-bold tracking-wide text-subtle-foreground uppercase">
              {t('sidebar.following')}
            </h2>
          )}
          {collapsed ? (
            <span id="sidebar-following" className="sr-only">
              {t('sidebar.following')}
            </span>
          ) : (
            <div className="flex flex-col items-start gap-2 px-3 text-body-sm text-muted-foreground" data-testid="sidebar-following-empty">
              <HeartIcon className="size-4 text-subtle-foreground" aria-hidden />
              {t('sidebar.followingEmpty')}
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="sidebar-suggested">
          {!collapsed ? (
            <h2 id="sidebar-suggested" className="px-3 pb-2 text-label-sm font-bold tracking-wide text-subtle-foreground uppercase">
              {t('sidebar.suggested')}
            </h2>
          ) : (
            <span id="sidebar-suggested" className="sr-only">
              {t('sidebar.suggested')}
            </span>
          )}
          <SuggestedChannels collapsed={collapsed} />
          {!collapsed && <GuestInvite />}
        </section>
      )}

      {signedIn && (
        <div className="mt-auto border-t pt-3">
          <SidebarLink item={SETTINGS_NAV} collapsed={collapsed} />
        </div>
      )}
    </aside>
  )
}
